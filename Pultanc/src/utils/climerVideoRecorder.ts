import { drawCanvasWatermark } from "./watermarkUtility";
/**
 * Utility to record and download Climer teaser videos with real-time Paywall card,
 * climer video details (creator badge, title, price in GHS, lock time, and bio URL)
 * burned directly into the video frames for social media promotion.
 */

export interface ClimerVideoDetails {
  videoUrl: string;
  title: string;
  subtitle?: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  creatorVerified?: boolean;
  price: number;
  lockTime: number;
  slug: string;
  onProgress?: (percent: number) => void;
}

function getBestMimeAndExtension(): { mime: string; ext: string } {
  const candidates = [
    { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=h264,opus', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { mime: 'video/webm', ext: 'webm' };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadClimerTeaserWithPaywall(
  details: ClimerVideoDetails
): Promise<void> {
  const {
    videoUrl,
    title,
    subtitle,
    creatorName,
    creatorHandle,
    creatorAvatar,
    price,
    lockTime,
    slug,
    creatorVerified,
    onProgress
  } = details;

  const updateProgress = (p: number) => {
    if (onProgress) onProgress(Math.min(100, Math.max(0, Math.round(p))));
  };

  updateProgress(5);

  // 1. Fetch video as blob to bypass any CORS restrictions on Canvas
  let objectUrl = '';
  try {
    const res = await fetch(videoUrl);
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
  } catch (err) {
    // If direct fetch fails (rare), try using videoUrl directly
    objectUrl = videoUrl;
  }

  // 2. Preload avatar if present
  let avatarImg: HTMLImageElement | null = null;
  if (creatorAvatar) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = creatorAvatar;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
        setTimeout(res, 800);
      });
      if (img.complete && img.naturalWidth > 0) {
        avatarImg = img;
      }
    } catch {
      // ignore
    }
  }

  updateProgress(15);

  // 3. Setup offscreen video element
  const video = document.createElement('video');
  video.src = objectUrl;
  video.crossOrigin = 'anonymous';
  video.muted = true; // muted to allow autoplay without user gesture
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video metadata'));
    setTimeout(() => {
      if (video.readyState >= 1) resolve();
      else reject(new Error('Video load timeout'));
    }, 10000);
  });

  const duration = video.duration || 30;
  const effectiveLockTime = Math.min(Math.max(1, lockTime), duration);

  // 4. Setup Canvas
  let targetW = video.videoWidth || 720;
  let targetH = video.videoHeight || 1280;

  // Cap dimensions to max 1080p for fast reliable real-time canvas capture
  if (targetW > 1080 || targetH > 1920) {
    const scale = Math.min(1080 / targetW, 1920 / targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  // Ensure even dimensions
  targetW = targetW % 2 === 0 ? targetW : targetW - 1;
  targetH = targetH % 2 === 0 ? targetH : targetH - 1;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Scale factor relative to 720x1280 base
  const s = targetW / 720;

  // 5. Setup Audio capture if supported
  let audioTrack: MediaStreamTrack | null = null;
  let audioCtx: AudioContext | null = null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      video.muted = false;
      const sourceNode = audioCtx.createMediaElementSource(video);
      const destNode = audioCtx.createMediaStreamDestination();
      sourceNode.connect(destNode);
      if (destNode.stream.getAudioTracks().length > 0) {
        audioTrack = destNode.stream.getAudioTracks()[0];
      }
    }
  } catch (e) {
    console.warn('[ClimerRecorder] Audio track capture note:', e);
    video.muted = true;
  }

  // 6. Setup MediaStream & MediaRecorder
  // @ts-ignore
  const canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream(30);
  const streamTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioTrack) {
    streamTracks.push(audioTrack);
  }
  const combinedStream = new MediaStream(streamTracks);

  const bestMime = getBestMimeAndExtension();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: bestMime.mime,
    videoBitsPerSecond: 2500000 // 2.5 Mbps crisp output
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const cleanHandle = (creatorHandle || 'creator').replace(/^@/, '');
  const cleanTitle = (title || 'climer_video').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cleanName = `${cleanTitle}_climer_teaser_paywall.${bestMime.ext}`;

  // Helper: Draw Teaser HUD Overlay during active playback
  const drawTeaserHud = (currentTime: number) => {
    // 1. Top Bar: Creator Info & Price Badge
    const headerY = 28 * s;
    const headerH = 46 * s;

    // Creator Pill (Left)
    const creatorPillW = 320 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    drawRoundRect(ctx, 24 * s, headerY, creatorPillW, headerH, 23 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Avatar Circle
    const avatarR = 17 * s;
    const avatarX = 24 * s + 6 * s + avatarR;
    const avatarY = headerY + headerH / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImg) {
      ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${16 * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((creatorName || 'C').charAt(0).toUpperCase(), avatarX, avatarY);
    }
    ctx.restore();

    // Creator text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const dispName = creatorName || cleanHandle;
    const truncatedName = dispName.length > 15 ? dispName.slice(0, 14) + '…' : dispName;
    ctx.fillText(truncatedName, avatarX + avatarR + 8 * s, avatarY - 6 * s);

    ctx.fillStyle = '#f87171';
    ctx.font = `bold ${12 * s}px monospace`;
    ctx.fillText(`@${cleanHandle}`, avatarX + avatarR + 8 * s, avatarY + 9 * s);

    // Verified badge check - only if creator is verified
    if (creatorVerified) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24 * s + creatorPillW - 20 * s, avatarY, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${9 * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', 24 * s + creatorPillW - 20 * s, avatarY + 1 * s);
    }
    ctx.restore();

    // App Badge (Center)
    const appBadgeW = 140 * s;
    const appBadgeX = (targetW - appBadgeW) / 2;
    ctx.save();
    ctx.fillStyle = '#ef4444';
    drawRoundRect(ctx, appBadgeX, headerY, appBadgeW, headerH, 23 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${15 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PULTANC', appBadgeX + appBadgeW / 2, headerY + headerH / 2);
    ctx.restore();

    // Price Pill (Right)
    const pricePillW = 160 * s;
    const pricePillX = targetW - pricePillW - 24 * s;
    ctx.save();
    ctx.fillStyle = '#ef4444';
    drawRoundRect(ctx, pricePillX, headerY, pricePillW, headerH, 23 * s);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`GHS ${price.toFixed(2)}`, pricePillX + pricePillW / 2, headerY + headerH / 2);
    ctx.restore();

    // 2. Bottom Info Card
    const hasSubtitle = Boolean(subtitle && subtitle.trim());
    const bottomCardH = (hasSubtitle ? 122 : 110) * s;
    const bottomCardY = targetH - bottomCardH - 32 * s;
    const bottomCardW = targetW - 48 * s;

    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
    drawRoundRect(ctx, 24 * s, bottomCardY, bottomCardW, bottomCardH, 18 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Video Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const displayTitle = title.length > 36 ? title.slice(0, 35) + '…' : title;
    ctx.fillText(`🎬 ${displayTitle}`, 38 * s, bottomCardY + 12 * s);

    let offsetAfterTitle = 36 * s;
    if (hasSubtitle) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 ${11 * s}px sans-serif`;
      const cleanSub = subtitle!.trim().length > 48 ? subtitle!.trim().slice(0, 47) + '…' : subtitle!.trim();
      ctx.fillText(cleanSub, 38 * s, bottomCardY + 30 * s);
      offsetAfterTitle = 48 * s;
    }

    // Climax lock notice
    const remainingTime = Math.max(0, effectiveLockTime - currentTime);
    ctx.fillStyle = '#f87171';
    ctx.font = `bold ${12 * s}px sans-serif`;
    ctx.fillText(`🔒 Climax locks at ${effectiveLockTime.toFixed(1)}s (in ${remainingTime.toFixed(1)}s) • Pay to unlock full climax`, 38 * s, bottomCardY + offsetAfterTitle);

    // Link tag
    const effectiveHandle = (creatorHandle || '@creator').trim().replace(/^@*/, '@');
    const climerTitleSlug = (title || slug || 'climer').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'climer';
    ctx.fillStyle = '#e4e4e7';
    ctx.font = `bold ${11 * s}px monospace`;
    ctx.fillText(`🔗 pultanc.com/${effectiveHandle}/${climerTitleSlug}`, 38 * s, bottomCardY + offsetAfterTitle + 20 * s);

    // Mini progress bar within teaser
    const progRatio = Math.min(1, currentTime / effectiveLockTime);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    drawRoundRect(ctx, 38 * s, bottomCardY + bottomCardH - 12 * s, bottomCardW - 28 * s, 4 * s, 2 * s);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    drawRoundRect(ctx, 38 * s, bottomCardY + bottomCardH - 12 * s, (bottomCardW - 28 * s) * progRatio, 4 * s, 2 * s);
    ctx.fill();
    ctx.restore();
  };

  // Helper: Draw Full Paywall Card when reaching the cliffhanger lock
  const drawPaywallCard = () => {
    // 1. Dark vignette / overlay across entire canvas
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, targetW, targetH);

    // 2. Central/Bottom Paywall Card
    const cardW = Math.min(targetW - 44 * s, 630 * s);
    const hasSubtitle = Boolean(subtitle && subtitle.trim());
    const cardH = (hasSubtitle ? 600 : 580) * s;
    const cardX = (targetW - cardW) / 2;
    const cardY = (targetH - cardH) / 2;

    // Outer glow / shadow
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 30 * s;

    // Card background
    ctx.fillStyle = '#111114';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 28 * s);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    // 3. Top Lock Badge
    const lockBadgeW = 240 * s;
    const lockBadgeH = 34 * s;
    const lockBadgeX = cardX + (cardW - lockBadgeW) / 2;
    const lockBadgeY = cardY + 24 * s;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    drawRoundRect(ctx, lockBadgeX, lockBadgeY, lockBadgeW, lockBadgeH, 17 * s);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${13 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🔒 PULTANC CLIMAX LOCKED • ${effectiveLockTime.toFixed(1)}s`, lockBadgeX + lockBadgeW / 2, lockBadgeY + lockBadgeH / 2);

    // 4. Video Title & Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${20 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cardTitle = title.length > 30 ? title.slice(0, 29) + '…' : title;
    ctx.fillText(`"${cardTitle}"`, cardX + cardW / 2, cardY + (hasSubtitle ? 66 * s : 74 * s));

    if (hasSubtitle) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 ${11.5 * s}px sans-serif`;
      ctx.textAlign = 'center';
      const cleanSub = subtitle!.trim().length > 48 ? subtitle!.trim().slice(0, 47) + '…' : subtitle!.trim();
      ctx.fillText(cleanSub, cardX + cardW / 2, cardY + 92 * s);
    }

    // 5. Creator Pill
    const cPillW = 280 * s;
    const cPillH = 40 * s;
    const cPillX = cardX + (cardW - cPillW) / 2;
    const cPillY = cardY + (hasSubtitle ? 122 * s : 116 * s);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    drawRoundRect(ctx, cPillX, cPillY, cPillW, cPillH, 20 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    const cAvatarR = 14 * s;
    const cAvatarX = cPillX + 18 * s;
    const cAvatarY = cPillY + cPillH / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cAvatarX, cAvatarY, cAvatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (avatarImg) {
      ctx.drawImage(avatarImg, cAvatarX - cAvatarR, cAvatarY - cAvatarR, cAvatarR * 2, cAvatarR * 2);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cAvatarX - cAvatarR, cAvatarY - cAvatarR, cAvatarR * 2, cAvatarR * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${12 * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((creatorName || 'C').charAt(0).toUpperCase(), cAvatarX, cAvatarY);
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${12.5 * s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const handleToDisplay = `@${cleanHandle}`;
    const creatorDisplay = creatorName && creatorName.toLowerCase() !== cleanHandle.toLowerCase()
      ? `${creatorName} (${handleToDisplay})`
      : handleToDisplay;
    const truncatedCreator = creatorDisplay.length > 26 ? creatorDisplay.slice(0, 25) + '…' : creatorDisplay;
    ctx.fillText(truncatedCreator, cAvatarX + cAvatarR + 8 * s, cAvatarY);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cPillX + cPillW - 18 * s, cAvatarY, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${8 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✓', cPillX + cPillW - 18 * s, cAvatarY + 1 * s);

    // 6. Big Unlock Price Callout
    const offsetBase = (hasSubtitle ? 16 : 0) * s;
    ctx.fillStyle = '#9ca3af';
    ctx.font = `bold ${11 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('UNLOCK REMAINING STORY INSTANTLY', cardX + cardW / 2, cardY + 180 * s + offsetBase);

    ctx.fillStyle = '#22c55e';
    ctx.font = `900 ${36 * s}px sans-serif`;
    ctx.fillText(`GHS ${price.toFixed(2)}`, cardX + cardW / 2, cardY + 215 * s + offsetBase);

    // 7. Payment Methods Badges (MTN MoMo, Telecel, AT, Card)
    const badges = [
      { name: 'MTN MoMo', color: '#fbbf24' },
      { name: 'Telecel', color: '#ef4444' },
      { name: 'AT Money', color: '#3b82f6' },
      { name: 'Debit Card', color: '#10b981' }
    ];
    const badgeW = (cardW - 80 * s) / 4;
    const badgeH = 30 * s;
    const badgeY = cardY + 250 * s + offsetBase;

    badges.forEach((b, i) => {
      const bx = cardX + 28 * s + i * (badgeW + 8 * s);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      drawRoundRect(ctx, bx, badgeY, badgeW, badgeH, 8 * s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1 * s;
      ctx.stroke();

      ctx.fillStyle = b.color;
      ctx.font = `bold ${10 * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, bx + badgeW / 2, badgeY + badgeH / 2);
    });

    // 8. Call To Action Button (Simulated Tap to Unlock)
    const btnW = cardW - 60 * s;
    const btnH = 58 * s;
    const btnX = cardX + 30 * s;
    const btnY = cardY + 305 * s + offsetBase;

    ctx.fillStyle = '#ef4444';
    drawRoundRect(ctx, btnX, btnY, btnW, btnH, 18 * s);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${18 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`👉 TAP LINK IN BIO TO UNLOCK NOW`, btnX + btnW / 2, btnY + btnH / 2 - 2 * s);

    // 9. Bio Link Banner
    const linkBannerW = cardW - 60 * s;
    const linkBannerH = 46 * s;
    const linkBannerX = cardX + 30 * s;
    const linkBannerY = cardY + 382 * s + offsetBase;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    drawRoundRect(ctx, linkBannerX, linkBannerY, linkBannerW, linkBannerH, 14 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const effectiveBannerHandle = (creatorHandle || '@creator').trim().replace(/^@*/, '@');
    const climerBannerTitleSlug = (title || slug || 'climer').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'climer';
    ctx.fillText(`🔗 pultanc.com/${effectiveBannerHandle}/${climerBannerTitleSlug}`, linkBannerX + linkBannerW / 2, linkBannerY + linkBannerH / 2);

    // 10. Footer Security / Licensing Note
    ctx.fillStyle = '#a1a1aa';
    ctx.font = `bold ${11 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Instant MoMo Unlock • Powered by Pultanc', cardX + cardW / 2, cardY + 465 * s + offsetBase);

    ctx.restore();
  };

  // 7. Execute frame-by-frame rendering and recording
  return new Promise<void>((resolve, reject) => {
    let animFrameId: number;
    let holdStartTime = 0;
    const PAYWALL_HOLD_SECONDS = 3.5; // Freeze & display the full paywall for 3.5 seconds

    recorder.onstop = () => {
      try {
        const finalBlob = new Blob(recordedChunks, { type: bestMime.mime });
        const downloadUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = cleanName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        if (objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
        }
        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
        updateProgress(100);
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    recorder.onerror = (e) => {
      cancelAnimationFrame(animFrameId);
      video.pause();
      reject(e);
    };

    // Start recording
    recorder.start(100); // chunk every 100ms
    video.currentTime = 0;
    video.play().catch(() => {});

    const renderLoop = () => {
      if (video.currentTime < effectiveLockTime && !video.ended) {
        // Render video frame + Teaser HUD
        ctx.drawImage(video, 0, 0, targetW, targetH);
        drawCanvasWatermark(ctx, targetW, targetH, {
          creatorHandle: cleanHandle,
          creatorName,
          showPoweredBy: true,
          position: "bottom-right",
          scale: s
        });
        drawTeaserHud(video.currentTime);

        const prog = 20 + (video.currentTime / effectiveLockTime) * 60;
        updateProgress(prog);

        animFrameId = requestAnimationFrame(renderLoop);
      } else {
        // Video has reached lock point! Pause video and hold freeze frame with Paywall Card
        video.pause();

        if (holdStartTime === 0) {
          holdStartTime = performance.now();
        }

        const elapsedSeconds = (performance.now() - holdStartTime) / 1000;

        // Draw last video frame as background
        ctx.drawImage(video, 0, 0, targetW, targetH);
        // Draw Full Paywall Card
        drawCanvasWatermark(ctx, targetW, targetH, {
          creatorHandle: cleanHandle,
          creatorName,
          showPoweredBy: true,
          position: "top-right",
          scale: s
        });
        drawPaywallCard();

        const holdProgress = 80 + Math.min(19, (elapsedSeconds / PAYWALL_HOLD_SECONDS) * 19);
        updateProgress(holdProgress);

        if (elapsedSeconds < PAYWALL_HOLD_SECONDS) {
          animFrameId = requestAnimationFrame(renderLoop);
        } else {
          // Paywall hold finished! Stop recording and output video
          cancelAnimationFrame(animFrameId);
          recorder.stop();
        }
      }
    };

    animFrameId = requestAnimationFrame(renderLoop);
  });
}
