import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  increment
} from "firebase/firestore";

dotenv.config();

// Initialize server-side Firestore instance
let serverDb: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const existingApps = getApps();
    const serverApp = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig, "server-backend");
    serverDb = initializeFirestore(serverApp, {}, firebaseConfig.firestoreDatabaseId);
    console.log("[Server] Server-side Firestore initialized successfully.");
  } else {
    console.warn("[Server] firebase-applet-config.json not found.");
  }
} catch (err) {
  console.warn("[Server] Failed to initialize server-side Firestore:", err);
}

const sandboxTransactions = new Map<string, { status: string; amount: number; email: string; updatedAt: number }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Streaming upload endpoint for large video/audio/image uploads
  app.post("/api/storage/upload", (req, res) => {
    try {
      const folder = (req.query.folder as string) || "videos";
      const rawFilename = (req.query.filename as string) || `media_${Date.now()}.mp4`;
      const safeName = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const targetDir = path.join(uploadsDir, folder);
      fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, safeName);

      const writeStream = fs.createWriteStream(targetPath);
      req.pipe(writeStream);

      writeStream.on("finish", () => {
        const fileUrl = `/api/storage/uploads/${folder}/${safeName}`;
        res.json({ success: true, url: fileUrl, filename: safeName });
      });

      writeStream.on("error", (err) => {
        console.error("Storage upload write error:", err);
        res.status(500).json({ success: false, error: err.message });
      });
    } catch (err: any) {
      console.error("Storage upload handler error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Chunked / resumable upload endpoint for large files (> 20MB)
  app.post("/api/storage/upload-chunk", (req, res) => {
    try {
      const uploadId = (req.query.uploadId as string) || (req.headers['x-upload-id'] as string);
      const chunkIndex = parseInt((req.query.chunkIndex as string) || (req.headers['x-chunk-index'] as string) || '0', 10);
      const totalChunks = parseInt((req.query.totalChunks as string) || (req.headers['x-total-chunks'] as string) || '1', 10);
      const folder = (req.query.folder as string) || "videos";
      const rawFilename = (req.query.filename as string) || `video_${Date.now()}.mp4`;
      const safeFilename = (req.query.safeName as string) || `${rawFilename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

      if (!uploadId) {
        return res.status(400).json({ success: false, error: "Missing uploadId for chunked upload" });
      }

      const chunkDir = path.join(uploadsDir, ".chunks", uploadId);
      fs.mkdirSync(chunkDir, { recursive: true });

      const chunkFilePath = path.join(chunkDir, `part_${chunkIndex.toString().padStart(6, '0')}`);
      const writeStream = fs.createWriteStream(chunkFilePath);
      req.pipe(writeStream);

      writeStream.on("finish", async () => {
        const existingChunks = fs.readdirSync(chunkDir).filter(f => f.startsWith("part_"));
        if (existingChunks.length >= totalChunks) {
          const targetDir = path.join(uploadsDir, folder);
          fs.mkdirSync(targetDir, { recursive: true });
          const finalSafeName = safeFilename.startsWith("media_") || safeFilename.includes("_") ? safeFilename : `${Date.now()}_${safeFilename}`;
          const finalPath = path.join(targetDir, finalSafeName);
          const finalWriteStream = fs.createWriteStream(finalPath);

          const sortedChunkFiles = existingChunks.sort();
          for (const chunkFile of sortedChunkFiles) {
            const chunkData = fs.readFileSync(path.join(chunkDir, chunkFile));
            finalWriteStream.write(chunkData);
          }
          finalWriteStream.end();

          finalWriteStream.on("finish", () => {
            try {
              fs.rmSync(chunkDir, { recursive: true, force: true });
            } catch (cleanupErr) {
              console.warn("Chunk cleanup error:", cleanupErr);
            }
            const fileUrl = `/api/storage/uploads/${folder}/${finalSafeName}`;
            res.json({
              success: true,
              complete: true,
              url: fileUrl,
              filename: finalSafeName,
              receivedChunks: totalChunks,
              totalChunks
            });
          });

          finalWriteStream.on("error", (assembleErr) => {
            console.error("Chunk reassembly error:", assembleErr);
            res.status(500).json({ success: false, error: "Failed to assemble chunks" });
          });
        } else {
          const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          res.json({
            success: true,
            complete: false,
            chunkIndex,
            totalChunks,
            progress: progressPercent
          });
        }
      });

      writeStream.on("error", (err) => {
        console.error("Chunk write stream error:", err);
        res.status(500).json({ success: false, error: err.message });
      });
    } catch (err: any) {
      console.error("Chunk handler error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve static uploaded files (videos, audio, images) with full CORS, byte-range streaming, and proper mime types
  app.use('/api/storage/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Accept-Ranges, Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Dedicated video/media streaming endpoint with robust HTTP 206 Partial Content range support
  app.get('/api/storage/uploads/:folder/:filename', (req, res) => {
    try {
      const { folder, filename } = req.params;
      const safeFilename = path.basename(filename);
      const safeFolder = path.basename(folder);
      const filePath = path.join(uploadsDir, safeFolder, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(safeFilename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err: any) {
      console.error('Video streaming error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream media' });
      }
    }
  });

  // Fallback static handler for subdirectories
  app.use('/api/storage/uploads', express.static(uploadsDir, {
    acceptRanges: true,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    }
  }));

  app.use(express.json({ limit: '150mb' }));
  
  // Pre-signed direct upload URL generator
  app.post("/api/storage/presigned-url", (req, res) => {
    try {
      const { filename = `video_${Date.now()}.mp4`, folder = "videos" } = req.body || {};
      const cleanFilename = String(filename).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const safeName = `${Date.now()}_${cleanFilename}`;
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const uploadUrl = `/api/storage/upload?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(cleanFilename)}&uploadId=${uploadId}`;
      const chunkUploadUrl = `/api/storage/upload-chunk?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(cleanFilename)}&uploadId=${uploadId}&safeName=${encodeURIComponent(safeName)}`;
      const publicUrl = `/api/storage/uploads/${folder}/${safeName}`;

      res.json({
        success: true,
        uploadId,
        uploadUrl,
        chunkUploadUrl,
        publicUrl,
        filename: safeName,
        maxChunkSize: 5 * 1024 * 1024
      });
    } catch (err: any) {
      console.error("Presigned URL generation error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  
  // Base64 upload endpoint for smaller media / fallback
  app.post("/api/storage/upload-base64", (req, res) => {
    try {
      const { folder = "videos", filename = `upload_${Date.now()}.mp4`, dataUrl } = req.body;
      if (!dataUrl) {
        return res.status(400).json({ success: false, error: "Missing dataUrl" });
      }
      const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const targetDir = path.join(uploadsDir, folder);
      fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, safeName);

      const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(targetPath, Buffer.from(base64Data, "base64"));
      const fileUrl = `/api/storage/uploads/${folder}/${safeName}`;
      res.json({ success: true, url: fileUrl, filename: safeName });
    } catch (err: any) {
      console.error("Base64 upload error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Explicitly hardcode the deployment environment to target the west1 region
  // and align internal server headers with the custom domain
  app.use((req, res, next) => {
    res.setHeader('X-Deployment-Environment', 'west1');
    res.setHeader('X-Region-Target', 'west1');
    res.setHeader('X-Backend-Region', 'west1');
    res.setHeader('X-Custom-Domain', 'yourdomain.com');
    next();
  });

  // Sandbox Simulated Checkout Screen page - Disabled in favor of live Paystack
  app.get("/api/sandbox/checkout", (req, res) => {
    return res.redirect("/");
  });

  // Action simulated webhook API
  app.post("/api/sandbox/simulate-action", (req, res) => {
    return res.json({ ok: true, message: "Live Paystack integration active" });
  });

  // Real Paystack Activities Tracking
  interface RealPaystackActivity {
    id: string;
    reference: string;
    amount: number; // in GHS
    currency: string;
    email: string;
    channel?: string;
    status: string;
    paidAt: string;
    timestamp: number;
    metadata?: any;
  }
  const realPaystackActivities: RealPaystackActivity[] = [];
  const fulfilledTxReferences = new Set<string>();

  // Helper to fetch user record by UID or handle
  const fetchUserRecord = async (identifier: string) => {
    if (!identifier || !serverDb) return null;
    try {
      const userRef = doc(serverDb, 'users', identifier);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { id: userSnap.id, data: userSnap.data() };
      }

      const cleanHandle = identifier.startsWith('@') ? identifier : `@${identifier}`;
      const cleanUsername = identifier.replace(/^@/, '');

      const qHandle = query(collection(serverDb, 'users'), where('handle', '==', cleanHandle), limit(1));
      const snapHandle = await getDocs(qHandle);
      if (!snapHandle.empty) {
        const d = snapHandle.docs[0];
        return { id: d.id, data: d.data() };
      }

      const qUser = query(collection(serverDb, 'users'), where('username', '==', cleanUsername), limit(1));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        const d = snapUser.docs[0];
        return { id: d.id, data: d.data() };
      }

      const qUid = query(collection(serverDb, 'users'), where('uid', '==', identifier), limit(1));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        const d = snapUid.docs[0];
        return { id: d.id, data: d.data() };
      }

      if (identifier.includes('@')) {
        const qEmail = query(collection(serverDb, 'users'), where('email', '==', identifier), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const d = snapEmail.docs[0];
          return { id: d.id, data: d.data() };
        }
      }
    } catch (err) {
      console.warn('Error fetching user record:', err);
    }
    return null;
  };

  // Preload recorded activities from Firestore on server startup
  const preloadActivitiesFromFirestore = async () => {
    if (!serverDb) return;
    try {
      const snap = await getDocs(query(collection(serverDb, 'activities'), orderBy('timestamp', 'desc'), limit(100)));
      snap.forEach((d) => {
        const a = d.data();
        if (a.reference) {
          fulfilledTxReferences.add(a.reference);
          if (!realPaystackActivities.some(item => item.reference === a.reference)) {
            realPaystackActivities.push({
              id: a.id || `ps_${d.id}`,
              reference: a.reference,
              amount: Number(a.amount) || 0,
              currency: a.currency || 'GHS',
              email: a.email || '',
              channel: a.channel || 'paystack',
              status: a.status || 'success',
              paidAt: a.paidAt || new Date(a.timestamp || Date.now()).toISOString(),
              timestamp: a.timestamp || Date.now(),
              metadata: a.metadata
            });
          }
        }
      });
      console.log(`[Paystack Activities] Preloaded ${realPaystackActivities.length} real activities from Firestore.`);
    } catch (err) {
      console.warn("[Paystack Activities] Preload warning:", err);
    }
  };
  preloadActivitiesFromFirestore();

  // Helper to fetch content item from collections
  const fetchContentRecord = async (id: string) => {
    if (!id || !serverDb) return null;
    const collectionsToCheck = ['funnels', 'series', 'climers', 'clips', 'videos', 'content'];

    for (const col of collectionsToCheck) {
      try {
        const cRef = doc(serverDb, col, id);
        const snap = await getDoc(cRef);
        if (snap.exists()) {
          return { id: snap.id, collection: col, data: snap.data() };
        }
      } catch (e) {}
    }

    // If ID is an episode ID (e.g. f_1234_2), check inside series/funnels episodes array
    if (id.includes('_')) {
      const parentId = id.substring(0, id.lastIndexOf('_'));
      for (const col of ['series', 'funnels']) {
        try {
          const pRef = doc(serverDb, col, parentId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const episodes = Array.isArray(pData.episodes) ? pData.episodes : [];
            const ep = episodes.find((e: any) => e.id === id);
            return {
              id: pSnap.id,
              collection: col,
              data: pData,
              matchedEpisode: ep
            };
          }
        } catch (e) {}
      }
    }

    // Query by slug in funnels and series
    for (const col of ['funnels', 'series']) {
      try {
        const qSlug = query(collection(serverDb, col), where('slug', '==', id), limit(1));
        const sSnap = await getDocs(qSlug);
        if (!sSnap.empty) {
          const d = sSnap.docs[0];
          return { id: d.id, collection: col, data: d.data() };
        }
      } catch (e) {}
    }

    return null;
  };

  // Helper to dynamically query database for active price set on creator's account or specific content item
  async function lookupCreatorPriceAndDetails({
    transaction_type,
    creator_id,
    content_id,
    user_amount
  }: {
    transaction_type?: string;
    creator_id?: string;
    content_id?: string;
    user_amount?: number;
  }): Promise<{
    creator_price: number;
    resolved_creator_id: string;
    resolved_content_id: string;
    transaction_type: 'unlock' | 'subscribe' | 'support';
    error?: string;
  }> {
    if (!serverDb) {
      return {
        creator_price: 0,
        resolved_creator_id: creator_id || '',
        resolved_content_id: content_id || '',
        transaction_type: 'unlock',
        error: "Database is not connected. Unable to dynamically look up creator price."
      };
    }

    const rawType = (transaction_type || '').toLowerCase().trim();
    let normalizedType: 'unlock' | 'subscribe' | 'support' = 'unlock';
    if (rawType.includes('sub')) {
      normalizedType = 'subscribe';
    } else if (rawType.includes('support') || rawType.includes('tip')) {
      normalizedType = 'support';
    } else {
      normalizedType = 'unlock';
    }

    let resolved_creator_id = (creator_id || '').trim();
    let resolved_content_id = (content_id || '').trim();

    // 1. FOR 'unlock': fetch the video/climer record and read its custom 'price' set by the creator
    if (normalizedType === 'unlock') {
      let contentItem = resolved_content_id ? await fetchContentRecord(resolved_content_id) : null;
      if (!contentItem && resolved_creator_id) {
        try {
          const qFunnels = query(collection(serverDb, 'funnels'), where('creatorId', '==', resolved_creator_id), limit(1));
          const snapFunnels = await getDocs(qFunnels);
          if (!snapFunnels.empty) {
            contentItem = { id: snapFunnels.docs[0].id, collection: 'funnels', data: snapFunnels.docs[0].data() };
            resolved_content_id = contentItem.id;
          }
        } catch (e) {}
      }

      if (!contentItem) {
        const numUserAmount = Number(user_amount);
        return {
          creator_price: (!isNaN(numUserAmount) && numUserAmount > 0) ? numUserAmount : 1.00,
          resolved_creator_id,
          resolved_content_id,
          transaction_type: 'unlock'
        };
      }

      const data = contentItem.data || {};
      if (!resolved_creator_id) {
        resolved_creator_id = data.creatorId || data.user_id || data.creatorHandle || '';
      }

      let rawPrice: any = undefined;
      if ((contentItem as any).matchedEpisode) {
        rawPrice = (contentItem as any).matchedEpisode.price ?? (contentItem as any).matchedEpisode.price_tier;
      }
      if (rawPrice === undefined || rawPrice === null) {
        rawPrice = data.price ?? data.price_tier ?? data.customPrice ?? data.unlockPrice;
      }

      let numPrice = Number(rawPrice);
      if (isNaN(numPrice) || numPrice <= 0) {
        const numUserAmount = Number(user_amount);
        numPrice = (!isNaN(numUserAmount) && numUserAmount > 0) ? numUserAmount : 1.00;
      }

      return {
        creator_price: numPrice,
        resolved_creator_id,
        resolved_content_id,
        transaction_type: 'unlock'
      };
    }

    // 2. FOR 'subscribe': fetch creator's profile/settings record and read their defined subscription 'price'
    if (normalizedType === 'subscribe') {
      let creatorRecord = await fetchUserRecord(resolved_creator_id);

      if (!creatorRecord && resolved_content_id) {
        const contentItem = await fetchContentRecord(resolved_content_id);
        if (contentItem && contentItem.data) {
          const cId = contentItem.data.creatorId || contentItem.data.user_id || contentItem.data.creatorHandle;
          if (cId) {
            resolved_creator_id = cId;
            creatorRecord = await fetchUserRecord(cId);
          }
        }
      }

      if (creatorRecord) {
        resolved_creator_id = creatorRecord.id;
      }

      const uData = creatorRecord?.data || {};
      let rawSubPrice = uData.subscribePrice ?? uData.creatorSubscribePrice ?? uData.subscriptionPrice ?? uData.pricing?.subscribePrice;

      // Also check creator's series or funnel record for subscribePrice if not present on user doc
      if ((rawSubPrice === undefined || rawSubPrice === null) && resolved_content_id) {
        const contentItem = await fetchContentRecord(resolved_content_id);
        if (contentItem && contentItem.data) {
          rawSubPrice = contentItem.data.subscribePrice ?? contentItem.data.creatorSubscribePrice;
        }
      }

      let numSubPrice = Number(rawSubPrice);
      const numUserAmount = Number(user_amount);
      const VALID_SUB_TIERS = [5, 15, 50];

      if (!isNaN(numUserAmount) && VALID_SUB_TIERS.includes(numUserAmount)) {
        numSubPrice = numUserAmount;
      } else if (!VALID_SUB_TIERS.includes(numSubPrice)) {
        numSubPrice = 15.00; // Platform standard subscription price in GHS (5, 15, 50)
      }

      return {
        creator_price: numSubPrice,
        resolved_creator_id,
        resolved_content_id,
        transaction_type: 'subscribe'
      };
    }

    // 3. FOR 'support': allow user to select or input an amount, defaulting to creator's base support 'price' if specified
    if (normalizedType === 'support') {
      let creatorRecord = await fetchUserRecord(resolved_creator_id);
      if (!creatorRecord && resolved_content_id) {
        const contentItem = await fetchContentRecord(resolved_content_id);
        if (contentItem && contentItem.data) {
          const cId = contentItem.data.creatorId || contentItem.data.user_id || contentItem.data.creatorHandle;
          if (cId) {
            resolved_creator_id = cId;
            creatorRecord = await fetchUserRecord(cId);
          }
        }
      }

      if (creatorRecord) {
        resolved_creator_id = creatorRecord.id;
      }

      const uData = creatorRecord?.data || {};
      const baseSupportPrice = Number(
        uData.supportPrice ?? uData.baseSupportPrice ?? uData.creatorSupportPrice ?? uData.pricing?.supportPrice ?? uData.tipPrice
      );

      let activePrice = 0;
      const numUserAmount = Number(user_amount);

      if (!isNaN(numUserAmount) && numUserAmount > 0) {
        activePrice = numUserAmount;
      } else if (!isNaN(baseSupportPrice) && baseSupportPrice > 0) {
        activePrice = baseSupportPrice;
      } else {
        activePrice = 5.00; // Platform default support amount in GHS
      }

      return {
        creator_price: activePrice,
        resolved_creator_id,
        resolved_content_id,
        transaction_type: 'support'
      };
    }

    return {
      creator_price: 1.00,
      resolved_creator_id,
      resolved_content_id,
      transaction_type: 'unlock'
    };
  }

  // Fulfill transaction and credit 70% earnings to creator with counter increments & analytics updates
  const fulfillPaymentTransaction = async (tx: any) => {
    if (!tx || tx.status !== 'success' || !tx.reference) return;
    const reference = tx.reference as string;

    if (fulfilledTxReferences.has(reference)) {
      return;
    }
    fulfilledTxReferences.add(reference);

    // Convert Paystack's incoming subunit amount back into standard currency (amount / 100)
    const incomingSubunits = Number(tx.amount || 0);
    const standardAmount = incomingSubunits / 100;
    if (isNaN(standardAmount) || standardAmount <= 0) {
      console.warn(`[Paystack Fulfillment] Invalid amount for ${reference}: ${tx.amount}`);
      return;
    }

    const meta = tx.metadata || {};
    let creator_id = meta.creator_id || meta.creatorId || meta.recipientId || '';
    const user_id = meta.user_id || meta.userId || meta.payerId || '';
    const content_id = meta.content_id || meta.contentId || meta.clipId || meta.funnelId || meta.seriesId || meta.episodeId || '';
    const rawType = (meta.transaction_type || meta.transactionType || meta.type || meta.action || 'unlock').toString().toLowerCase();

    let transaction_type: 'unlock' | 'subscribe' | 'support' = 'unlock';
    if (rawType.includes('sub')) {
      transaction_type = 'subscribe';
    } else if (rawType.includes('support') || rawType.includes('tip')) {
      transaction_type = 'support';
    } else {
      transaction_type = 'unlock';
    }

    const now = Date.now();
    const paidAt = tx.paid_at || new Date(now).toISOString();

    // Track in realPaystackActivities list
    if (!realPaystackActivities.some(a => a.reference === reference)) {
      realPaystackActivities.unshift({
        id: `ps_${tx.id || Date.now()}`,
        reference,
        amount: standardAmount,
        currency: tx.currency || 'GHS',
        email: tx.customer?.email || meta.payerEmail || '',
        channel: tx.channel || 'paystack',
        status: 'success',
        paidAt,
        timestamp: now,
        metadata: meta
      });
    }

    if (!serverDb) {
      console.warn("[Paystack Fulfillment] serverDb not initialized, skipping database updates.");
      return;
    }

    // Check if this reference was already recorded in Firestore to guarantee exact-once crediting
    try {
      const existingSnap = await getDocs(query(collection(serverDb, 'transactions'), where('reference', '==', reference), limit(1)));
      if (!existingSnap.empty) {
        console.log(`[Paystack Fulfillment] Reference ${reference} already recorded in Firestore.`);
        return;
      }
    } catch (e) {
      console.warn("[Paystack Fulfillment] Error checking existing transaction:", e);
    }

    // Resolve creator_id to actual Firestore UID
    let creatorRecord = await fetchUserRecord(creator_id);
    if (!creatorRecord && content_id) {
      const contentItem = await fetchContentRecord(content_id);
      if (contentItem && contentItem.data) {
        const cId = contentItem.data.creatorId || contentItem.data.user_id || contentItem.data.creatorHandle;
        if (cId) {
          creatorRecord = await fetchUserRecord(cId);
        }
      }
    }
    if (creatorRecord) {
      creator_id = creatorRecord.id;
    }

    const creatorName = creatorRecord?.data?.displayName || creatorRecord?.data?.name || creatorRecord?.data?.username || meta.recipientName || 'Creator';
    const payerName = meta.payerName || tx.customer?.first_name || (tx.customer?.email ? tx.customer.email.split('@')[0] : 'Supporter');

    // Title generation
    let itemTitle = meta.title || '';
    if (!itemTitle) {
      if (transaction_type === 'subscribe') {
        itemTitle = `Monthly Creator Subscription to ${creatorName}`;
      } else if (transaction_type === 'support') {
        itemTitle = `Support Tip to ${creatorName}`;
      } else {
        itemTitle = meta.clipTitle ? `Unlocked: ${meta.clipTitle}` : 'Content Access Unlock';
      }
    }

    // Calculate 70% creator split
    const creatorEarnings = Number((standardAmount * 0.70).toFixed(2));
    const platformSplit = Number((standardAmount - creatorEarnings).toFixed(2));

    console.log(`[Paystack Fulfillment] Crediting creator ${creator_id} (${creatorName}): GHS ${creatorEarnings} (70% of GHS ${standardAmount}), Action: ${transaction_type}`);

    // Credit creator 70% amount directly to creator's earnings balance & increment respective counters
    if (creator_id) {
      try {
        const creatorRef = doc(serverDb, 'users', creator_id);
        const updatePayload: any = {
          balance: increment(creatorEarnings),
          totalEarnings: increment(creatorEarnings),
          updatedAt: new Date().toISOString()
        };

        if (transaction_type === 'unlock') {
          updatePayload.unlock_count = increment(1);
          updatePayload.unlocksCount = increment(1);
        } else if (transaction_type === 'subscribe') {
          updatePayload.subscribe_count = increment(1);
          updatePayload.subscribersCount = increment(1);
        } else if (transaction_type === 'support') {
          updatePayload.support_count = increment(1);
          updatePayload.supportsCount = increment(1);
        }

        await updateDoc(creatorRef, updatePayload).catch(async () => {
          await setDoc(creatorRef, {
            balance: creatorEarnings,
            totalEarnings: creatorEarnings,
            unlock_count: transaction_type === 'unlock' ? 1 : 0,
            unlocksCount: transaction_type === 'unlock' ? 1 : 0,
            subscribe_count: transaction_type === 'subscribe' ? 1 : 0,
            subscribersCount: transaction_type === 'subscribe' ? 1 : 0,
            support_count: transaction_type === 'support' ? 1 : 0,
            supportsCount: transaction_type === 'support' ? 1 : 0,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
      } catch (err) {
        console.error("[Paystack Fulfillment] Error updating creator balance/counts:", err);
      }

      // Update analytics metrics on content item upon confirmed payment
      if (content_id) {
        try {
          for (const col of ['funnels', 'series', 'climers', 'clips', 'videos', 'content']) {
            const cRef = doc(serverDb, col, content_id);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
              await updateDoc(cRef, {
                unlocks: increment(1),
                revenue: increment(standardAmount)
              }).catch(() => {});
              break;
            }
          }
        } catch (err) {
          console.warn("[Paystack Fulfillment] Error updating content analytics:", err);
        }
      }

      // Record transaction under creator subcollection and notifications
      try {
        await addDoc(collection(serverDb, 'users', creator_id, 'transactions'), {
          reference,
          type: 'credit',
          category: transaction_type,
          title: itemTitle,
          amount: standardAmount,
          netAmount: creatorEarnings,
          creatorSplit: creatorEarnings,
          platformSplit,
          payerId: user_id || 'guest',
          payerName,
          recipientId: creator_id,
          recipientName: creatorName,
          seriesId: meta.seriesId || meta.funnelId || '',
          episodeId: meta.episodeId || '',
          contentId: content_id || '',
          status: 'completed',
          timestamp: now
        }).catch(() => {});

        await addDoc(collection(serverDb, 'users', creator_id, 'notifications'), {
          title: transaction_type === 'support' ? 'New Support Tip!' : transaction_type === 'subscribe' ? 'New Subscriber!' : 'New Content Unlock!',
          text: `Confirmed payment of GHS ${standardAmount.toFixed(2)} from ${payerName}. Net 70% earnings of GHS ${creatorEarnings.toFixed(2)} credited to your balance.`,
          timestamp: now,
          read: false,
          type: 'general'
        }).catch(() => {});

        if (transaction_type === 'subscribe' && user_id) {
          await setDoc(doc(serverDb, 'users', creator_id, 'subscribers', user_id), {
            id: user_id,
            username: payerName,
            amount: standardAmount,
            status: 'active',
            subscribedAt: now
          }, { merge: true }).catch(() => {});

          await setDoc(doc(serverDb, 'users', user_id, 'subscriptions', creator_id), {
            creatorId: creator_id,
            creatorName,
            amount: standardAmount,
            status: 'active',
            subscribedAt: now
          }, { merge: true }).catch(() => {});
        }

        if (transaction_type === 'support' && user_id) {
          await setDoc(doc(serverDb, 'users', creator_id, 'supporters', user_id), {
            id: user_id,
            username: payerName,
            supportValue: increment(standardAmount),
            totalSpent: increment(standardAmount),
            lastActive: now
          }, { merge: true }).catch(() => {});
        }
      } catch (err) {
        console.warn("[Paystack Fulfillment] Error recording user subcollection records:", err);
      }
    }

    // Payer's transaction ledger entry (debit) if user_id is provided
    if (user_id && user_id !== creator_id) {
      try {
        await addDoc(collection(serverDb, 'users', user_id, 'transactions'), {
          reference,
          type: 'debit',
          category: transaction_type,
          title: itemTitle,
          amount: standardAmount,
          payerId: user_id,
          payerName,
          recipientId: creator_id,
          recipientName: creatorName,
          seriesId: meta.seriesId || meta.funnelId || '',
          episodeId: meta.episodeId || '',
          contentId: content_id || '',
          status: 'completed',
          timestamp: now
        }).catch(() => {});

        // If unlock: persist to savedEpisodes so the clip/climer is permanently unlocked
        if (transaction_type === 'unlock') {
          const episodeId = meta.episodeId || content_id;
          const seriesId = meta.seriesId || meta.funnelId || (content_id.includes('_') ? content_id.split('_')[0] : content_id);
          const savedDocId = seriesId ? `${seriesId}_${episodeId}` : episodeId;
          await setDoc(doc(serverDb, 'users', user_id, 'savedEpisodes', savedDocId), {
            id: savedDocId,
            seriesId,
            episodeId,
            title: meta.title || meta.clipTitle || 'Unlocked Content',
            unlockedAt: now,
            reference,
            status: 'unlocked'
          }, { merge: true }).catch(() => {});
        }
      } catch (err) {
        console.warn("[Paystack Fulfillment] Error writing payer subcollections:", err);
      }
    }

    // Record global transaction in Firestore
    try {
      await addDoc(collection(serverDb, 'transactions'), {
        reference,
        userId: user_id || 'guest',
        user_id: user_id || 'guest',
        payerId: user_id || 'guest',
        payerName,
        creatorId: creator_id,
        creator_id,
        recipientId: creator_id,
        recipientName: creatorName,
        contentId: content_id,
        content_id,
        amount: standardAmount,
        creator_price: standardAmount,
        creatorEarnings,
        netAmount: creatorEarnings,
        creatorSplit: creatorEarnings,
        platformSplit,
        type: transaction_type,
        transaction_type,
        title: itemTitle,
        channel: tx.channel || 'paystack',
        status: 'completed',
        currency: tx.currency || 'GHS',
        timestamp: now
      });
    } catch (err) {
      console.warn("[Paystack Fulfillment] Error adding global transaction:", err);
    }

    // Record persistent Activity in Firestore
    try {
      await setDoc(doc(serverDb, 'activities', reference), {
        id: `ps_${tx.id || reference}`,
        reference,
        amount: standardAmount,
        netAmount: creatorEarnings,
        currency: tx.currency || 'GHS',
        email: tx.customer?.email || meta.payerEmail || '',
        type: transaction_type,
        title: itemTitle,
        creatorId: creator_id,
        creatorName,
        payerId: user_id || 'guest',
        payerName,
        channel: tx.channel || 'paystack',
        status: 'success',
        paidAt,
        timestamp: now,
        metadata: meta
      }, { merge: true });
      console.log(`[Paystack Activities] Persisted activity for reference ${reference} (GHS ${standardAmount}, ${transaction_type})`);
    } catch (err) {
      console.warn("[Paystack Fulfillment] Error writing activities doc:", err);
    }
  };

  // Paystack Initialization API - Dynamic Creator Pricing & Subunit Conversion
  app.post("/api/paystack/initialize", async (req, res) => {
    try {
      const {
        email,
        amount: incomingAmount,
        support_amount: incomingSupportAmount,
        tipAmount: incomingTipAmount,
        callback_url: clientCallbackUrl,
        metadata: incomingMetadata = {},
        transaction_type: incomingTxType,
        type: incomingType,
        action: incomingAction,
        creator_id: incomingCreatorId,
        creatorId: incomingCreatorId2,
        user_id: incomingUserId,
        userId: incomingUserId2,
        content_id: incomingContentId,
        contentId: incomingContentId2,
        currency = "GHS"
      } = req.body;

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      const host = req.get('host');
      const origin = req.headers.referer 
        ? new URL(req.headers.referer as string).origin 
        : (process.env.APP_URL || `${proto}://${host}`);
      const callbackUrl = clientCallbackUrl || `${origin}/`;

      // Real payment requirement - No sandbox simulation allowed
      if (!secretKey || secretKey.trim() === "" || secretKey === "dummy_key") {
        return res.status(400).json({
          status: false,
          error: "PAYSTACK_SECRET_KEY is required to process real payments. Please set your live Paystack Secret Key in settings or environment variables.",
          message: "PAYSTACK_SECRET_KEY is required to process real payments. Please set your live Paystack Secret Key in settings or environment variables."
        });
      }

      const validEmail = (email && typeof email === 'string' && email.includes('@'))
        ? email.trim()
        : `supporter_${Date.now()}@pultanc.com`;

      // Extract transaction type, creator, user, and content IDs
      const rawTxType = incomingTxType || incomingType || incomingAction || incomingMetadata.transaction_type || incomingMetadata.transactionType || incomingMetadata.type || (incomingMetadata.clipId || incomingMetadata.funnelId || incomingContentId ? 'unlock' : '');
      const rawCreatorId = incomingCreatorId || incomingCreatorId2 || incomingMetadata.creator_id || incomingMetadata.creatorId || incomingMetadata.recipientId || '';
      const rawUserId = incomingUserId || incomingUserId2 || incomingMetadata.user_id || incomingMetadata.userId || incomingMetadata.payerId || '';
      const rawContentId = incomingContentId || incomingContentId2 || incomingMetadata.content_id || incomingMetadata.contentId || incomingMetadata.clipId || incomingMetadata.funnelId || incomingMetadata.seriesId || incomingMetadata.episodeId || '';

      const userProvidedAmount = req.body.price ?? req.body.subscribePrice ?? req.body.subscribe_price ?? incomingAmount ?? incomingSupportAmount ?? incomingTipAmount ?? incomingMetadata.amount ?? incomingMetadata.price ?? incomingMetadata.amountGHS;

      // 1. Dynamic Creator Price Lookup:
      // In the Paystack checkout initialization handler, dynamically query the database for the active 'price' set on creator's account or specific content item
      const priceLookup = await lookupCreatorPriceAndDetails({
        transaction_type: rawTxType,
        creator_id: rawCreatorId,
        content_id: rawContentId,
        user_amount: userProvidedAmount
      });

      if (priceLookup.error || !priceLookup.creator_price || priceLookup.creator_price <= 0) {
        return res.status(400).json({
          status: false,
          error: priceLookup.error || "Creator has not configured a valid price for the selected action.",
          message: priceLookup.error || "Creator has not configured a valid price for the selected action."
        });
      }

      const creator_price = priceLookup.creator_price;
      const resolved_creator_id = priceLookup.resolved_creator_id || rawCreatorId;
      const resolved_content_id = priceLookup.resolved_content_id || rawContentId;
      const transaction_type = priceLookup.transaction_type;

      // 2. Subunit Conversion & Metadata:
      // Convert the fetched creator 'price' into Paystack integer subunits (amount = Math.round(creator_price * 100))
      const subunitAmount = Math.round(creator_price * 100);

      // Include creator's configured 'price', creator_id, user_id, content_id, and transaction_type inside Paystack metadata payload
      const paystackMetadata = {
        ...incomingMetadata,
        creator_price: creator_price,
        creator_id: resolved_creator_id,
        user_id: rawUserId,
        content_id: resolved_content_id,
        transaction_type: transaction_type,
        // Include camelCase equivalents for compatibility
        creatorPrice: creator_price,
        creatorId: resolved_creator_id,
        userId: rawUserId,
        contentId: resolved_content_id,
        transactionType: transaction_type,
        price: creator_price,
        amountGHS: creator_price
      };

      try {
        const response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: validEmail,
            amount: subunitAmount, 
            callback_url: callbackUrl,
            metadata: paystackMetadata,
            currency: currency || "GHS",
            channels: req.body.channels || ["mobile_money", "card"],
          }),
        });

        const data = await response.json();
        if (data.status) {
          return res.json(data);
        } else {
          console.error("Paystack API Error:", data);
          return res.status(400).json({ status: false, error: data.message || "Paystack initialization failed", full_error: data });
        }
      } catch (innerErr) {
        console.error("External Paystack fetch failed:", innerErr);
        return res.status(500).json({ status: false, error: "Failed to connect to Paystack API." });
      }

    } catch (error) {
      console.error("Paystack initialization handler error:", error);
      return res.status(500).json({ error: "Failed to initialize payment." });
    }
  });

  // Paystack Verify API - Real Verification, Fulfillment & Earnings Crediting
  const handlePaystackVerify = async (req: express.Request, res: express.Response) => {
    try {
      const reference = (req.params.reference || req.query.reference || "") as string;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;

      if (!secretKey || secretKey.trim() === "" || secretKey === "dummy_key") {
        return res.status(200).json({
          status: false,
          message: "Paystack secret key not configured. Real verification requires PAYSTACK_SECRET_KEY.",
          data: {
            status: "pending",
            reference: reference,
            amount: 0,
            gateway_response: "Payment gateway pending configuration"
          }
        });
      }

      if (!reference) {
        return res.status(400).json({ 
          status: false, 
          message: "No transaction reference provided",
          data: { status: "failed", reference: "" } 
        });
      }

      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`
          }
        });

        const data = await response.json();

        // 3. Fulfillment & Earnings Crediting upon confirmed payment
        if (data && data.status && data.data?.status === 'success') {
          const tx = data.data;
          
          // Execute backend fulfillment: credit 70% earnings, increment counters, and update analytics
          await fulfillPaymentTransaction(tx);
        }

        return res.json(data);
      } catch (innerErr) {
        console.error("External Paystack verification failed:", innerErr);
        return res.status(502).json({
          status: false,
          message: "Could not reach Paystack verification servers",
          data: {
            status: "pending",
            reference: reference,
            amount: 0,
            gateway_response: "Verification service temporarily unreachable"
          }
        });
      }
    } catch (error) {
      console.error("Paystack verification handler error:", error);
      return res.status(500).json({ 
        status: false, 
        message: "Internal server error during verification",
        data: { status: "error", reference: "" } 
      });
    }
  };

  app.get("/api/paystack/verify", handlePaystackVerify);
  app.get("/api/paystack/verify/:reference", handlePaystackVerify);

  // Real Paystack Webhook - Listen, Track & Fulfill confirmed payments
  app.post("/api/paystack/webhook", async (req, res) => {
    try {
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const signature = req.headers['x-paystack-signature'];
      if (signature && secretKey && secretKey !== 'dummy_key') {
        try {
          const hash = crypto.createHmac('sha512', secretKey).update(JSON.stringify(req.body)).digest('hex');
          if (hash !== signature) {
            console.warn("[Paystack Webhook] Signature mismatch, rejecting event.");
            return res.status(401).json({ error: "Invalid webhook signature" });
          }
        } catch (sigErr) {
          console.warn("[Paystack Webhook] Signature verification error:", sigErr);
        }
      }

      const event = req.body;
      if (event && (event.event === 'charge.success' || event.event === 'transfer.success') && event.data) {
        const tx = event.data;

        // Fulfillment & Earnings Crediting upon confirmed webhook event
        if (event.event === 'charge.success' && tx.status === 'success') {
          await fulfillPaymentTransaction(tx);
        }
      }
      return res.status(200).json({ status: true, received: true });
    } catch (err) {
      console.error("Paystack webhook error:", err);
      return res.status(500).json({ error: "Webhook error" });
    }
  });

  // Track Real Money Activities API
  app.get("/api/paystack/activities", async (req, res) => {
    let allActivities = [...realPaystackActivities];
    if (serverDb) {
      try {
        const snap = await getDocs(query(collection(serverDb, 'activities'), orderBy('timestamp', 'desc'), limit(100)));
        snap.forEach(d => {
          const act = d.data() as RealPaystackActivity;
          if (!allActivities.some(a => a.reference === act.reference)) {
            allActivities.push(act);
          }
        });
      } catch (e) {
        console.warn("Could not query activities from Firestore:", e);
      }
    }
    allActivities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const totalGHS = allActivities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    res.json({
      success: true,
      totalRealMoneyTracked: Number(totalGHS.toFixed(2)),
      currency: "GHS",
      count: allActivities.length,
      activities: allActivities
    });
  });

  // Storage for Paystack payout notices
  const paystackPayoutNotices: Array<{
    id: string;
    username: string;
    email: string;
    amount: number;
    paymentMethod: string;
    timestamp: string;
    status: string;
  }> = [];

  // Payout Notice API
  app.post("/api/paystack/transfer", async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || secretKey.trim() === "" || secretKey === "dummy_key") {
      return res.status(400).json({ ok: false, error: "Real Paystack Secret Key is missing in environment variables." });
    }

    const { username, amount, payoutSettings } = req.body;
    
    if (!payoutSettings || !payoutSettings.accountNumber) {
      return res.status(400).json({ ok: false, error: "Incomplete payout settings. Please update your Destination Method in Wallet Settings." });
    }

    try {
      // 1. Create a Transfer Recipient
      let type = "nuban";
      let bankCode = payoutSettings.bankName;
      if (payoutSettings.method === "mobile_money") {
        type = "mobile_money";
        // Map common networks to Paystack codes if needed, or use the exact string if configured correctly
        bankCode = payoutSettings.mobileNetwork === "MTN" ? "MTN" 
                 : payoutSettings.mobileNetwork === "Vodafone" ? "VOD" 
                 : payoutSettings.mobileNetwork === "AirtelTigo" ? "TGO" 
                 : payoutSettings.mobileNetwork;
      }

      const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: type,
          name: payoutSettings.accountName || username,
          account_number: payoutSettings.accountNumber,
          bank_code: bankCode,
          currency: "GHS"
        })
      });

      const recipientData = await recipientResponse.json();
      
      if (!recipientData.status) {
         console.error("Paystack Recipient Creation Failed:", recipientData);
         return res.status(400).json({ ok: false, error: "Failed to create transfer recipient: " + recipientData.message });
      }

      const recipientCode = recipientData.data.recipient_code;

      // 2. Initiate the Transfer
      const transferResponse = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(Number(amount) * 100), // Convert GHS to pesewas
          reference: `PAYOUT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          recipient: recipientCode,
          reason: "Creator Payout from Deort"
        })
      });

      const transferData = await transferResponse.json();

      if (!transferData.status) {
         console.error("Paystack Transfer Failed:", transferData);
         return res.status(400).json({ ok: false, error: "Transfer failed: " + transferData.message });
      }

      console.log("Paystack Transfer Successful:", transferData.data);
      res.json({ ok: true, message: "Transfer initiated successfully.", data: transferData.data });
      
    } catch (error: any) {
      console.error("Live Paystack Transfer Error:", error);
      res.status(500).json({ ok: false, error: "Internal server error during transfer: " + error.message });
    }
  });

  // Paystack Merchant Dashboard Page
  const handlePaystackDashboard = (req: express.Request, res: express.Response) => {
    // Return HTML page displaying paystackPayoutNotices
    const rows = paystackPayoutNotices.map((n) => `
      <tr class="border-b border-slate-800 hover:bg-slate-900/50 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">${n.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
          <div class="font-bold text-teal-400">${n.username}</div>
          <div class="text-xs text-slate-500">${n.email}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-teal-300">GHS ${n.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">${n.paymentMethod}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">${n.timestamp}</td>
        <td class="px-6 py-4 whitespace-nowrap text-center">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
            ${n.status}
          </span>
        </td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="6" class="px-6 py-12 text-center text-slate-500">
          <svg class="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>
          No payout notices received yet. Request a payout inside the app's wallet view first.
        </td>
      </tr>
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Paystack Merchant Payout Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #0c1013; }
          .font-display { font-family: 'Space Grotesk', sans-serif; }
        </style>
      </head>
      <body class="min-h-screen text-slate-100 flex flex-col">
        <!-- Top Navigation -->
        <header class="bg-[#121a20] border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-8 w-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-black text-xl">p</div>
            <h1 class="text-lg font-bold font-display tracking-tight flex items-center gap-2">
              paystack <span class="text-xs bg-slate-800 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider">LIVE MERCHANT PAGE</span>
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-400 font-mono">Status: Connected</span>
            <span class="w-2.5 h-2.5 bg-teal-400 rounded-full animate-ping"></span>
          </div>
        </header>

        <!-- Main Body -->
        <main class="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-black font-display text-white">Platform Payout Notice Center</h2>
              <p class="text-slate-400 text-sm mt-1">This dashboard displays the platform owner's Paystack account receiving integration notices and webhook transfers upon creator manual requests.</p>
            </div>
            <div>
              <button onclick="window.location.reload()" class="bg-teal-500 hover:bg-teal-400 active:scale-95 text-black font-bold px-5 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg>
                Refresh Log
              </button>
            </div>
          </div>

          <!-- Cards Summary -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-[#121a20] border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
              <span class="text-slate-500 font-mono text-xs uppercase tracking-wider font-bold">Total Notices Recorded</span>
              <span class="text-4xl font-extrabold font-display text-teal-400 mt-2">${paystackPayoutNotices.length}</span>
              <span class="text-xs text-slate-500 mt-1 leading-normal">Notices pushed directly via App payout-notice API.</span>
            </div>
            
            <div class="bg-[#121a20] border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
              <span class="text-slate-500 font-mono text-xs uppercase tracking-wider font-bold">Total Request Volume</span>
              <span class="text-4xl font-extrabold font-display text-white mt-2">GHS ${paystackPayoutNotices.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span class="text-xs text-slate-500 mt-1 leading-normal">Sum of all accumulated creator requested payouts.</span>
            </div>

            <div class="bg-[#121a20] border-2 border-dashed border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
              <p class="text-xs text-slate-400 leading-relaxed mb-3">Want to trigger more notices? Go back to the client app & click 'Request Payout'.</p>
              <button onclick="window.close()" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 font-bold px-4 py-2 text-xs rounded-xl transition-all">
                Close This Tab
              </button>
            </div>
          </div>

          <!-- Logs Table -->
          <div class="bg-[#121a20] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 class="font-display font-bold text-white tracking-tight">Recent Payout Integration Messages</h3>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-teal-400"></span>
                <span class="text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">Live Feed Webhook Center</span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-900/30 text-slate-500 text-xs font-mono font-bold uppercase border-b border-slate-800 tracking-wider">
                    <th class="px-6 py-4">Notice ID</th>
                    <th class="px-6 py-4">Creator / Email</th>
                    <th class="px-6 py-4">Transfer Amount</th>
                    <th class="px-6 py-4">Direct Destination Setup</th>
                    <th class="px-6 py-4">Time Received</th>
                    <th class="px-6 py-4 text-center">Integration Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <footer class="mt-auto py-8 text-center text-slate-600 text-xs border-t border-slate-900 bg-slate-950/20">
          <p>© 2026 Paystack Group Integration. Real money transaction processing active.</p>
        </footer>
      </body>
      </html>
    `;
    res.send(html);
  };
  app.get("/api/sandbox/paystack", handlePaystackDashboard);
  app.get("/api/paystack/dashboard", handlePaystackDashboard);

  // Serve public static assets (favicons, logos, robots.txt, sitemaps)
  const publicPath = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, { maxAge: '1d' }));
  }

  function getMetaForUrl(urlPath: string, query: Record<string, any>, host: string) {
    const cleanPath = urlPath.replace(/^\/+/, '');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const defaultLogo = `${baseUrl}/pultanc-logo.png`;

    if (cleanPath.startsWith('bio/') || query.funnel || query.climer) {
      const slug = cleanPath.startsWith('bio/') ? cleanPath.replace('bio/', '').split('/')[0] : (query.funnel || query.climer);
      const rawTitle = query.title || (slug
        ? String(slug).split(/[-_]+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
        : 'Exclusive Climer');
      const rawSubtitle = query.subtitle || query.desc || 'Watch the exclusive cliffhanger teaser on Pultanc. Unlock the climax scene directly.';
      return {
        title: `${rawTitle} • Powered by Pultanc`,
        description: `${rawSubtitle} • Powered by Pultanc`,
        image: defaultLogo,
        url: `${baseUrl}/bio/${slug}`,
        type: 'video.other'
      };
    }

    if (cleanPath.startsWith('video/') || cleanPath.startsWith('clip/') || query.video || query.series) {
      const vidId = cleanPath.startsWith('video/') ? cleanPath.replace('video/', '').split('/')[0]
        : cleanPath.startsWith('clip/') ? cleanPath.replace('clip/', '').split('/')[0]
        : (query.video || query.series);
      const rawTitle = query.title || (vidId
        ? String(vidId).split(/[-_]+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
        : 'Original Clip');
      const rawSubtitle = query.subtitle || query.desc || 'Stream this mini-series and original creation on Pultanc. Tap to watch the preview!';
      return {
        title: `${rawTitle} • Powered by Pultanc`,
        description: `${rawSubtitle} • Powered by Pultanc`,
        image: defaultLogo,
        url: `${baseUrl}/?video=${vidId}`,
        type: 'video.episode'
      };
    }

    if (cleanPath.startsWith('@') || query.profile || query.creator || query.u || query.user) {
      const handle = cleanPath.startsWith('@') ? cleanPath.replace('@', '').split('/')[0]
        : String(query.profile || query.creator || query.u || query.user || 'creator').replace(/^@/, '');
      
      const rawTitle = query.title || (query.card === 'goal' ? `Goal Video Card: @${handle}` : query.card === 'social' ? `Social Video Card: @${handle}` : `@${handle}`);
      const rawSubtitle = query.subtitle || (query.card === 'goal'
        ? `Watch the official goal series and support @${handle}'s creative journey directly on Pultanc.`
        : query.card === 'social'
        ? `Explore exclusive clips, climers, and releases from @${handle}. Tap to watch on Pultanc!`
        : `Stream exclusive series, cliffhanger climers, and support @${handle} directly on Pultanc.`);

      return {
        title: `${rawTitle} • Powered by Pultanc`,
        description: `${rawSubtitle} • Powered by Pultanc`,
        image: defaultLogo,
        url: `${baseUrl}/@${handle}${query.card ? `?card=${query.card}` : ''}`,
        type: 'profile'
      };
    }

    return {
      title: 'Pultanc • Powered by Pultanc',
      description: 'Stream premium clips, exclusive live shows, and original creations. • Powered by Pultanc',
      image: defaultLogo,
      url: baseUrl,
      type: 'website'
    };
  }

  function injectMetaTags(html: string, meta: {
    title: string;
    description: string;
    image: string;
    url: string;
    type?: string;
  }): string {
    let result = html;
    result = result.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);
    result = result.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${meta.description}" />`);
    result = result.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${meta.title}" />`);
    result = result.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${meta.description}" />`);
    result = result.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${meta.image}" />`);
    result = result.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${meta.url}" />`);
    if (meta.type) {
      result = result.replace(/<meta property="og:type" content=".*?" \/>/i, `<meta property="og:type" content="${meta.type}" />`);
    }
    result = result.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${meta.title}" />`);
    result = result.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${meta.description}" />`);
    result = result.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${meta.image}" />`);
    result = result.replace(/<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${meta.url}" />`);
    return result;
  }

  const isCrawlerOrSpecialRoute = (req: express.Request) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /bot|crawler|spider|facebookexternalhit|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|embedly|quora|pinterest|applebot|discordbot/.test(ua);
    const p = req.path.replace(/^\/+/, '');
    const isSpecial = p.startsWith('bio/') || p.startsWith('@') || p.startsWith('video/') || p.startsWith('clip/') || req.query.card || req.query.funnel || req.query.climer || req.query.video || req.query.series;
    return isBot || Boolean(isSpecial);
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });

    app.use(async (req, res, next) => {
      if (req.method === 'GET' && isCrawlerOrSpecialRoute(req)) {
        try {
          const indexPath = path.join(process.cwd(), 'index.html');
          let html = fs.readFileSync(indexPath, 'utf-8');
          html = await vite.transformIndexHtml(req.originalUrl, html);
          const meta = getMetaForUrl(req.path, req.query, req.headers.host || 'pultanc.com');
          const finalHtml = injectMetaTags(html, meta);
          return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(finalHtml);
        } catch (e) {
          next(e);
          return;
        }
      }
      next();
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.method !== 'GET') return next();
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        const meta = getMetaForUrl(req.path, req.query, req.headers.host || 'pultanc.com');
        const finalHtml = injectMetaTags(html, meta);
        return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(finalHtml);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      try {
        const indexPath = path.join(distPath, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        const meta = getMetaForUrl(req.path, req.query, req.headers.host || 'pultanc.com');
        const finalHtml = injectMetaTags(html, meta);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(finalHtml);
      } catch (e) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
