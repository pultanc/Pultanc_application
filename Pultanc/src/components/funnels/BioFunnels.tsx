import { VideoWatermarkOverlay } from "../../utils/watermarkUtility";
import React, { useState, useEffect, useRef } from 'react';
import { 
  Link2, Copy, Plus, Minus, ChevronDown, Phone, CreditCard, Share2, CheckCircle2, 
  AlertCircle, X, Lock, Smartphone, Shield, ArrowRight,
  Play, Pause, Scissors, Upload, Video, RotateCcw, Clock, Trash2, 
  Check, Volume2, VolumeX, Eye, HelpCircle, ChevronRight, Sliders,
  Film, ExternalLink, FileText, Download, Flag, ShieldCheck, Sparkles, User, Bookmark, Edit3, Tag, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, increment, runTransaction, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { savePendingPayment, showPaymentSuccessPopup } from '../../utils/paymentSession';
import { recordPaymentTransaction } from '../../utils/transactionRecorder';
import { uploadMediaToStorage } from '../../utils/firebaseStorage';
import { cacheVideoFileUnderKeys } from '../../utils/localVideoCache';
import { downloadClimerTeaserWithPaywall } from '../../utils/climerVideoRecorder';
import { DynamicProtectedWatermark, ScreenRecordingShield, useScreenRecordingProtection } from '../common/VideoProtection';

interface Funnel {
 id: string;
 title: string;
 subtitle?: string;
 creatorHandle: string;
 creatorName: string;
 price: number;
 videoUrl: string;
 lockTime: number;
 visits: number;
 unlocks: number;
 revenue: number;
 slug: string;
 category?: string;
 isCustom?: boolean;
 creatorId?: string;
 createdAt?: number;
 exportRestriction?: 'teaser_only' | 'allow_full';
 promoCaption?: string;
 cardTheme?: string;
 creatorAvatar?: string;
 thumbnailUrl?: string;
 musicTitle?: string;
 creatorVerified?: boolean;
}

export default function BioFunnels() {
 const [funnels, setFunnels] = useState<Funnel[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'funnels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbFunnels = snapshot.docs
        .filter(doc => doc.data().status !== 'under_review' && doc.data().status !== 'banned')
        .map(doc => {
          const data = doc.data();
          return {
            id: data.id || doc.id,
            title: data.title || "Climer Video",
            subtitle: data.subtitle || data.promoCaption || "Watch the exclusive cliffhanger teaser on Pultanc. Unlock the climax scene directly.",
            creatorHandle: data.creatorHandle || "@creator",
            creatorName: data.creatorName || (data.creatorEmail ? data.creatorEmail.split('@')[0] : "Creator"),
            price: Number(data.price) || 2.00,
            videoUrl: data.videoUrl || "",
            lockTime: typeof data.lockTime === 'number' ? data.lockTime : (Number(data.lockTime) || 10.0),
            visits: Number(data.visits) || 0,
            unlocks: Number(data.unlocks) || 0,
            revenue: Number(data.revenue) || 0,
            slug: data.slug || data.id || "climer",
            category: data.category || 'Entertainment',
            isCustom: data.isCustom !== undefined ? data.isCustom : true,
            creatorId: data.creatorId || "",
            createdAt: data.createdAt || Date.now(),
            exportRestriction: data.exportRestriction || 'teaser_only',
            promoCaption: data.promoCaption || "",
            cardTheme: data.cardTheme || 'momo_gold',
            musicTitle: data.musicTitle || "Original Sound - Creator",
            thumbnailUrl: data.thumbnailUrl || "",
            creatorVerified: !!(data.creatorVerified || data.isVerified)
          };
        });
      
      setFunnels(dbFunnels);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'funnels');
    });

    return () => unsubscribe();
  }, []);

 const [selectedFunnelForSim, setSelectedFunnelForSim] = useState<Funnel | null>(null);
 const [copiedId, setCopiedId] = useState<string | null>(null);

 const [savedFunnelIds, setSavedFunnelIds] = useState<string[]>([]);
 useEffect(() => {
  if (!auth.currentUser) return;
  const unsub = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'savedEpisodes'), (snap) => {
   setSavedFunnelIds(snap.docs.map(d => d.id));
  });
  return () => unsub();
 }, []);

 const handleToggleSaveFunnel = async (fun: Funnel) => {
  if (!auth.currentUser) {
   toast.error('Please sign in to save climers.');
   return;
  }
  const rawId = fun.id || fun.slug || fun.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cleanId = rawId.replace(/\//g, '_');
  const isSaved = savedFunnelIds.includes(cleanId) || savedFunnelIds.includes(fun.id);
  const docRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', cleanId);
  try {
   if (isSaved) {
    await deleteDoc(docRef);
    toast.success('Removed from your Saves');
   } else {
    await setDoc(docRef, {
     id: cleanId,
     episodeId: cleanId,
     episodeTitle: fun.title,
     climerTitle: fun.title,
     title: fun.title,
     type: 'climer',
     seriesId: cleanId,
     seriesTitle: fun.title,
     creatorName: fun.creatorName || 'Creator',
     creatorHandle: fun.creatorHandle || '@creator',
     creatorAvatar: fun.creatorAvatar || '',
     videoUrl: fun.videoUrl || '',
     thumbnail: fun.thumbnailUrl || (fun.videoUrl ? '' : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=400'),
     price: Number(fun.price) || 2.0,
     lockTime: Number(fun.lockTime) || 10,
     isClimer: true,
     slug: fun.slug || cleanId,
     savedAt: serverTimestamp(),
     collectionId: null
    });
    toast.success('Climer saved to your Saves!');
   }
  } catch (err) {
   console.error('Save funnel error:', err);
   toast.error('Could not update saves');
  }
 };

 // Studio / Video Timeline Editor State
 const [showNewFunnelForm, setShowNewFunnelForm] = useState(false);
 const [editorTitle, setEditorTitle] = useState('');
  const [editorSubtitle, setEditorSubtitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorTagInput, setEditorTagInput] = useState('');

  const handleAddEditorTag = (tagToAdd?: string) => {
    const raw = (typeof tagToAdd === 'string' ? tagToAdd : editorTagInput).trim().toLowerCase().replace(/^#+/, '');
    if (!raw) return;
    if (!editorTags.includes(raw)) {
      setEditorTags(prev => [...prev, raw]);
    }
    setEditorTagInput('');
  };

  const handleEditorTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddEditorTag();
    }
  };

  const removeEditorTag = (tagToRemove: string) => {
    setEditorTags(prev => prev.filter(t => t !== tagToRemove));
  };
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editPrice, setEditPrice] = useState<number>(2.00);
  const [editLockTime, setEditLockTime] = useState<number>(10.0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingFunnel, setDeletingFunnel] = useState<Funnel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
 const [editorCategory, setEditorCategory] = useState('Entertainment');
 const CATEGORIES = [
   'Entertainment',
   'Micro-Drama',
   'Comedy',
   'Romance',
   'Thriller & Suspense',
   'Action & Adventure',
   'Mystery & Crime',
   'Drama & Emotion',
   'Sci-Fi & Fantasy',
   'Horror & Supernatural',
   'Reality & Lifestyle',
   'Music & Dance',
   'Gaming & Esports',
   'Education & Tutorials',
   'Documentary & History',
   'Motivation & Faith',
   'Sports & Fitness',
   'Animation & Anime',
   'News & Commentary',
   'Vlog & Behind The Scenes'
 ];
 const [editorPrice, setEditorPrice] = useState(2.00);
 
 // Master Video sources
 const [editorVideoUrl, setEditorVideoUrl] = useState('');
 const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
 const [isStorageUploading, setIsStorageUploading] = useState(false);
 const [storageUploadProgress, setStorageUploadProgress] = useState(0);
 const [editorDuration, setEditorDuration] = useState(30); // in seconds
 const [editorCurrentTime, setEditorCurrentTime] = useState(0);
 const [editorLockTime, setEditorLockTime] = useState(10.0);
 const [editorIsPlaying, setEditorIsPlaying] = useState(false);
 const [editorMuted, setEditorMuted] = useState(false);
 const [isRecordingTeaser, setIsRecordingTeaser] = useState(false);
 const [recordingProgress, setRecordingProgress] = useState(0);
 const [isRecordingSimTeaser, setIsRecordingSimTeaser] = useState(false);
 const [simRecordingProgress, setSimRecordingProgress] = useState(0);
 const [exportRestriction, setExportRestriction] = useState<'teaser_only' | 'allow_full'>('teaser_only');
 const [editorCaption, setEditorCaption] = useState('');
 const [editorCardTheme, setEditorCardTheme] = useState<string>('momo_gold');
 const [isCaptionCustomized, setIsCaptionCustomized] = useState(false);

 // Preview States
 const [simPhoneNumber, setSimPhoneNumber] = useState('');
 const [simProvider, setSimProvider] = useState<'mtn' | 'telecel' | 'airteltigo'>('mtn');
 const [simStatus, setSimStatus] = useState<'idle' | 'initiating' | 'pin_auth' | 'processing' | 'success'>('idle');
 const [simOtp, setSimOtp] = useState('');
 const [paystackUrl, setPaystackUrl] = useState('');
 const [paystackRef, setPaystackRef] = useState('');
 const [simIsPlaying, setSimIsPlaying] = useState(true);
 const [simMuted, setSimMuted] = useState(true);
 const [isSimLocked, setIsSimLocked] = useState(false);
 const [simCurrentTime, setSimCurrentTime] = useState(0);
 const [simDuration, setSimDuration] = useState(0);
 
 const [showReportModal, setShowReportModal] = useState(false);
 const [reportDetails, setReportDetails] = useState('');
 const [reportSubmitting, setReportSubmitting] = useState(false);

 // Video Refs
 const editorVideoRef = useRef<HTMLVideoElement>(null);
 const simVideoRef = useRef<HTMLVideoElement>(null);
 const activeUploadPromiseRef = useRef<Promise<string> | null>(null);
 const uploadedFileBlobRef = useRef<File | null>(null);
  const { isRecordingBlocked, blockReason, videoProtectionProps } = useScreenRecordingProtection(simVideoRef);

 const formatTitleToSlug = (title: string) => {
   return (title || '')
     .toLowerCase()
     .trim()
     .replace(/[^a-z0-9]+/g, '-')
     .replace(/^-+|-+$/g, '') || 'video';
 };

 const getSimpleTemplate = (title: string, lockTime: number, price: number, titleSlug: string) => {
   const user = auth.currentUser;
   const raw = user?.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_') : (user?.email ? user.email.split('@')[0] : "creator");
   const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
   return `🍿 WATCH THE EXCITING CLINCH! 🍿\n\n` +
   `🎥 Video: ${title}\n` +
   `⏱️ Locked cliffhanger point: ${lockTime.toFixed(1)}s\n` +
   `🔗 Watch & Unlock: pultanc.com/${cleanHandle}/${titleSlug}\n` +
   `💳 Unlock instantly with Mobile Money to watch the full story!`;
 };

 const [currentUserHandle, setCurrentUserHandle] = useState<string>('');

 // Keep creator handle synchronized immediately from user profile
 useEffect(() => {
   if (!auth.currentUser) return;
   const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
     if (docSnap.exists()) {
       const d = docSnap.data();
       const h = d.handle || (d.username ? `@${d.username}` : (d.displayName ? `@${d.displayName}` : ''));
       if (h) {
         setCurrentUserHandle(h);
       }
     }
   });

   const handleProfileUpdate = (e: any) => {
     const newHandle = e.detail?.handle || (e.detail?.username ? `@${e.detail.username}` : '');
     if (newHandle) {
       setCurrentUserHandle(newHandle);
       setFunnels(prev => prev.map(f => {
         if (f.creatorId === auth.currentUser?.uid || f.creatorEmail === auth.currentUser?.email) {
           return {
             ...f,
             creatorHandle: newHandle,
             creatorName: e.detail?.displayName || e.detail?.name || f.creatorName
           };
         }
         return f;
       }));
     }
   };
   window.addEventListener('creator_handle_updated', handleProfileUpdate);
   window.addEventListener('user_profile_updated', handleProfileUpdate);

   return () => {
     unsub();
     window.removeEventListener('creator_handle_updated', handleProfileUpdate);
     window.removeEventListener('user_profile_updated', handleProfileUpdate);
   };
 }, []);

 const getClimerLink = (funnel: any) => {
   const isOwner = Boolean(auth.currentUser?.uid && (funnel?.creatorId === auth.currentUser.uid || funnel?.creatorEmail === auth.currentUser.email));
   const activeHandle = (isOwner && currentUserHandle) ? currentUserHandle : (funnel?.creatorHandle || funnel?.creatorName || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'creator');
   const raw = (activeHandle || 'creator').trim();
   const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
   const climerTitle = formatTitleToSlug(funnel?.title || funnel?.climerTitle || funnel?.slug || 'climer');
   return `pultanc.com/${cleanHandle}/${climerTitle}`;
 };

 const getClimerFullUrl = (funnel: any) => {
   const isOwner = Boolean(auth.currentUser?.uid && (funnel?.creatorId === auth.currentUser.uid || funnel?.creatorEmail === auth.currentUser.email));
   const activeHandle = (isOwner && currentUserHandle) ? currentUserHandle : (funnel?.creatorHandle || funnel?.creatorName || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'creator');
   const raw = (activeHandle || 'creator').trim();
   const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
   const climerTitle = formatTitleToSlug(funnel?.title || funnel?.climerTitle || funnel?.slug || 'climer');
   const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pultanc.com';
   return `${origin}/${cleanHandle}/${climerTitle}`;
 };

 const getBestMimeAndExtension = () => {
 const candidates = [
 { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
 { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
 { mime: 'video/mp4', ext: 'mp4' },
 { mime: 'video/webm;codecs=h264,opus', ext: 'mp4' },
 { mime: 'video/webm;codecs=h264', ext: 'mp4' },
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
 };

 const getFileExtension = (filenameOrUrl: string | null, fallback: string = 'mp4') => {
 if (!filenameOrUrl) return fallback;
 try {
 const pathOnly = filenameOrUrl.split('?')[0];
 const parts = pathOnly.split('.');
 if (parts.length > 1) {
 const ext = parts.pop()?.toLowerCase();
 if (ext && ['mp4', 'webm', 'mov', 'avi', 'mkv', '3gp'].includes(ext)) {
 return ext;
 }
 }
 } catch (e) {
 // ignore
 }
 return fallback;
 };

 useEffect(() => {
 if (!isCaptionCustomized) {
   const titleSlug = formatTitleToSlug(editorTitle || "exclusive-climer");
   setEditorCaption(getSimpleTemplate(editorTitle || "Exclusive Climer", editorLockTime, editorPrice, titleSlug));
 }
 }, [editorTitle, editorLockTime, editorPrice, isCaptionCustomized]);

 useEffect(() => {
  if (funnels.length > 0) {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      let urlSlug: string | null = null;
      if (path.includes('/bio/')) {
        urlSlug = path.split('/bio/')[1].split('?')[0];
      } else {
        const cleanPath = path.replace(/^\/+/, '');
        const segments = cleanPath.split('/').filter(Boolean);
        if (segments.length >= 2 && segments[0].startsWith('@')) {
          urlSlug = segments[1].split('?')[0];
        }
      }
      const params = new URLSearchParams(window.location.search);
      const querySlug = params.get('climer') || params.get('funnel') || params.get('bio') || params.get('slug');
      const target = urlSlug || querySlug;
      if (target) {
        const decodedTarget = decodeURIComponent(target).toLowerCase().trim();
        const matched = funnels.find(f => {
          const titleSlug = formatTitleToSlug(f.title || '');
          const titleUnderscore = (f.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          return f.slug === target || f.id === target || titleSlug === decodedTarget || titleUnderscore === decodedTarget || (f.title && f.title.toLowerCase().trim() === decodedTarget);
        });
        if (matched) {
          setSelectedFunnelForSim(matched);
          return;
        }
      }
    }
    if (!selectedFunnelForSim) {
      setSelectedFunnelForSim(funnels[0]);
    }
  }
 }, [funnels, selectedFunnelForSim]);

 // Reset preview states and play from 0s when funnel changes
 useEffect(() => {
 if (selectedFunnelForSim) {
 setSimStatus('idle');
 setIsSimLocked(false);
 setSimIsPlaying(true);
 setSimCurrentTime(0);
 setSimOtp('');
 setSimPhoneNumber('');
 if (simVideoRef.current) {
 simVideoRef.current.currentTime = 0;
 simVideoRef.current.muted = simMuted;
 simVideoRef.current.play().catch(() => {
 setSimIsPlaying(false);
 });
 }
 }
 }, [selectedFunnelForSim]);

  const handleStartEdit = (fun: Funnel) => {
    setEditingFunnel(fun);
    setEditTitle(fun.title);
    setEditSubtitle(fun.subtitle || fun.promoCaption || '');
    setEditPrice(fun.price || 2.00);
    setEditLockTime(typeof fun.lockTime === 'number' ? fun.lockTime : (Number(fun.lockTime) || 10.0));
  };

  const handleSaveEdit = async () => {
    if (!editingFunnel) return;
    if (!editTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    const cleanPrice = Math.max(0.5, Number(editPrice) || 2.00);
    const cleanLockTime = Math.max(0.1, Number(editLockTime) || 10.0);
    setIsSavingEdit(true);
    try {
      const funnelId = editingFunnel.id;
      const updates = {
        title: editTitle.trim(),
        subtitle: editSubtitle.trim(),
        promoCaption: editSubtitle.trim(),
        price: cleanPrice,
        lockTime: cleanLockTime,
        updatedAt: Date.now()
      };

      const funnelRef = doc(db, 'funnels', funnelId);
      const climerRef = doc(db, 'climers', funnelId);
      const seriesRef = doc(db, 'series', funnelId);

      await Promise.all([
        updateDoc(funnelRef, updates).catch(() => setDoc(funnelRef, updates, { merge: true })),
        updateDoc(climerRef, updates).catch(() => setDoc(climerRef, updates, { merge: true })),
        updateDoc(seriesRef, {
          title: editTitle.trim(),
          subtitle: editSubtitle.trim(),
          price: cleanPrice,
          lockTime: cleanLockTime,
          updatedAt: Date.now()
        }).catch(() => {})
      ]);

      setFunnels(prev => prev.map(f => f.id === funnelId ? {
        ...f,
        title: editTitle.trim(),
        subtitle: editSubtitle.trim(),
        promoCaption: editSubtitle.trim(),
        price: cleanPrice,
        lockTime: cleanLockTime
      } : f));

      if (selectedFunnelForSim?.id === funnelId) {
        setSelectedFunnelForSim(prev => prev ? {
          ...prev,
          title: editTitle.trim(),
          subtitle: editSubtitle.trim(),
          promoCaption: editSubtitle.trim(),
          price: cleanPrice,
          lockTime: cleanLockTime
        } : null);
      }

      toast.success('Climer details & paywall time updated!');
      setEditingFunnel(null);
    } catch (err) {
      console.error('Failed to update climer:', err);
      toast.error('Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteClimer = async (funnelId: string) => {
    setIsDeleting(true);
    try {
      const funnelRef = doc(db, 'funnels', funnelId);
      const climerRef = doc(db, 'climers', funnelId);
      const seriesRef = doc(db, 'series', funnelId);

      await Promise.all([
        deleteDoc(funnelRef).catch(() => {}),
        deleteDoc(climerRef).catch(() => {}),
        deleteDoc(seriesRef).catch(() => {})
      ]);

      setFunnels(prev => prev.filter(f => f.id !== funnelId));
      if (selectedFunnelForSim?.id === funnelId) {
        const remaining = funnels.filter(f => f.id !== funnelId);
        setSelectedFunnelForSim(remaining.length > 0 ? remaining[0] : null);
      }
      toast.success('Climer deleted');
      setDeletingFunnel(null);
    } catch (err) {
      console.error('Failed to delete climer:', err);
      toast.error('Could not delete climer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadClimerVideo = async (targetFunnel?: Funnel) => {
    const activeFun = targetFunnel || selectedFunnelForSim;
    if (!activeFun) return;
    if (activeFun.status === 'under_review' || activeFun.status === 'banned') {
      alert("This content is currently under review and cannot receive payments.");
      return;
    }
    if (!activeFun.videoUrl) {
      alert("No video URL available!");
      return;
    }
    try {
      setIsRecordingTeaser(true);
      setIsRecordingSimTeaser(true);
      setRecordingProgress(0);
      setSimRecordingProgress(0);

      await downloadClimerTeaserWithPaywall({
        videoUrl: activeFun.videoUrl,
        title: activeFun.title || "Climer Video",
        subtitle: activeFun.subtitle || activeFun.promoCaption || activeFun.description,
        creatorName: activeFun.creatorName || activeFun.creatorHandle || "Creator",
        creatorHandle: activeFun.creatorHandle || "@creator",
        creatorAvatar: activeFun.creatorAvatar,
        price: activeFun.price || 2.00,
        lockTime: activeFun.lockTime || 10.0,
        slug: formatTitleToSlug(activeFun.title || activeFun.slug || "climer"),
        creatorVerified: activeFun.creatorVerified ?? false,
        onProgress: (percent) => {
          setRecordingProgress(percent);
          setSimRecordingProgress(percent);
        }
      });
      toast.success("Climer video with paywall card downloaded!");
    } catch (err) {
      console.error("Download with paywall failed, falling back to direct video download:", err);
      toast.error("Enhanced video generation hit a browser limit. Downloading direct video...");
      try {
        const videoUrl = activeFun.videoUrl;
        const fileExt = getFileExtension(videoUrl, 'mp4');
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = (activeFun.title || 'video').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        a.download = cleanName + '_full.' + fileExt;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (fallbackErr) {
        const a = document.createElement('a');
        a.href = activeFun.videoUrl;
        a.target = '_blank';
        a.download = (activeFun.title || 'video') + '_full.mp4';
        document.body.appendChild(a);
        a.click();
      }
    } finally {
      setIsRecordingTeaser(false);
      setIsRecordingSimTeaser(false);
    }
  };

  // Trims and downloads the teaser portion up to editorLockTime with full paywall card and watermark
  const handleDownloadTeaser = async () => {
    if (selectedFunnelForSim?.status === 'under_review' || selectedFunnelForSim?.status === 'banned') {
      alert("This content is currently under review and cannot receive payments.");
      return;
    }
    if (!editorVideoUrl) {
      alert("No video URL available! Please upload a video first.");
      return;
    }
    try {
      setIsRecordingTeaser(true);
      setIsRecordingSimTeaser(true);
      setRecordingProgress(0);
      setSimRecordingProgress(0);

      const user = auth.currentUser;
      const rawHandle = (user?.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_') : (user?.email ? user.email.split('@')[0] : "creator")).trim();
      const cleanHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;

      await downloadClimerTeaserWithPaywall({
        videoUrl: editorVideoUrl,
        title: editorTitle || "Climer Video",
        subtitle: editorSubtitle || undefined,
        creatorName: user?.displayName || "Creator",
        creatorHandle: cleanHandle,
        creatorAvatar: user?.photoURL || undefined,
        price: editorPrice || 2.00,
        lockTime: editorLockTime || 10.0,
        slug: formatTitleToSlug(editorTitle || "climer"),
        creatorVerified: true,
        onProgress: (percent) => {
          setRecordingProgress(percent);
          setSimRecordingProgress(percent);
        }
      });
      toast.success("Climer video with paywall card downloaded!");
    } catch (err) {
      console.error("Teaser download with paywall failed:", err);
      toast.error("Download failed, saving source video...");
      try {
        const fileExt = getFileExtension(editorVideoUrl, 'mp4');
        const response = await fetch(editorVideoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = (editorTitle || 'video').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        a.download = `${cleanName}_full.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (fallbackErr) {
        const a = document.createElement('a');
        a.href = editorVideoUrl;
        a.target = '_blank';
        a.download = `${editorTitle || 'video'}_full.mp4`;
        document.body.appendChild(a);
        a.click();
      }
    } finally {
      setIsRecordingTeaser(false);
      setIsRecordingSimTeaser(false);
    }
  };

  // Share handler for the studio editor
  const handleShareStudioClimer = async () => {
    const title = editorTitle || "Climer Video";
    const slug = formatTitleToSlug(title);
    const user = auth.currentUser;
    const rawHandle = (user?.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_') : (user?.email ? user.email.split('@')[0] : "creator")).trim();
    const cleanHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pultanc.com';
    const climerUrl = `${origin}/${cleanHandle}/${slug}`;
    const shareText = `🎬 Watch "${title}" on Pultanc! Unlock the climax scene directly with Mobile Money: ${climerUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: climerUrl,
        });
        toast.success("Climer link shared!");
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard?.writeText(climerUrl);
          toast.success("Climer link copied to clipboard!");
        }
      }
    } else {
      navigator.clipboard?.writeText(climerUrl);
      toast.success("Climer link copied to clipboard!");
    }
  };

  // Share handler for existing funnel items
  const handleShareFunnel = async (funnel: any) => {
    const shareUrl = getClimerFullUrl(funnel);
    const title = funnel?.title || "Climer Video";
    const shareText = `🎬 Watch "${title}" on Pultanc! Unlock the climax scene directly with Mobile Money: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
        toast.success("Climer link shared!");
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard?.writeText(shareUrl);
          toast.success("Climer link copied to clipboard!");
        }
      }
    } else {
      navigator.clipboard?.writeText(shareUrl);
      toast.success("Climer link copied to clipboard!");
    }
  };

 // Handle local video file upload
 const handleLocalVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 uploadedFileBlobRef.current = file;
 const url = URL.createObjectURL(file);
 setEditorVideoUrl(url);
 setUploadedFileName(file.name);
 
 // Attempt to extract clean title from filename
 const cleanName = file.name
 .replace(/\.[^/.]+$/,"") // remove extension
 .replace(/[_-]/g," ") // replace underscores/dashes with spaces
 .split(' ')
 .filter(Boolean)
 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
 .join(' ');
 
 setEditorTitle(cleanName);
 setEditorCurrentTime(0);
 setEditorIsPlaying(false);
 if (editorVideoRef.current) {
 editorVideoRef.current.currentTime = 0;
 }

 // Upload to persistent server storage / Firebase Storage with real progress
 setIsStorageUploading(true);
 setStorageUploadProgress(15);

 const folder = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'images' : 'videos';
 const uploadPromise = uploadMediaToStorage(file, folder, (progress) => {
   setStorageUploadProgress(Math.max(15, Math.min(99, Math.round(progress))));
 });
 activeUploadPromiseRef.current = uploadPromise;

 try {
   const downloadUrl = await uploadPromise;
   setStorageUploadProgress(100);
   setEditorVideoUrl(downloadUrl);
   cacheVideoFileUnderKeys([downloadUrl, file.name, cleanName], file, file.name).catch(() => {});
   toast.success("Video ready for your Climer!");
 } catch (err) {
   console.warn("Storage upload error:", err);
   setStorageUploadProgress(100);
 } finally {
   setTimeout(() => {
     setIsStorageUploading(false);
     activeUploadPromiseRef.current = null;
   }, 500);
 }
 }
 };

 // Video Editor Event Handlers
 const handleEditorTimeUpdate = () => {
 if (editorVideoRef.current) {
 const curTime = editorVideoRef.current.currentTime;
 setEditorCurrentTime(curTime);
 setEditorLockTime(Number(curTime.toFixed(1)));
 }
 };

 const handleEditorLoadedMetadata = () => {
 if (editorVideoRef.current) {
 const duration = editorVideoRef.current.duration;
 if (duration && !isNaN(duration)) {
 setEditorDuration(duration);
 // Place default lock at 35% of duration
 setEditorLockTime(Number((duration * 0.35).toFixed(1)));
 }
 }
 };

 const toggleEditorPlay = () => {
 if (editorVideoRef.current) {
 if (editorIsPlaying) {
 editorVideoRef.current.pause();
 } else {
 editorVideoRef.current.play().catch(() => {});
 }
 setEditorIsPlaying(!editorIsPlaying);
 }
 };

 const handleEditorSeek = (time: number) => {
 if (editorVideoRef.current) {
 editorVideoRef.current.currentTime = time;
 setEditorCurrentTime(time);
 }
 };

 const handleSetLockAtCurrent = () => {
 setEditorLockTime(Number(editorCurrentTime.toFixed(1)));
 };

 // Preview Lock Enforcement
 const handleSimVideoTimeUpdate = () => {
 if (simVideoRef.current && selectedFunnelForSim) {
 const current = simVideoRef.current.currentTime;
 setSimCurrentTime(current);
 const lock = selectedFunnelForSim.lockTime;
 
 if (simStatus !== 'success' && current >= lock) {
 simVideoRef.current.pause();
 simVideoRef.current.currentTime = lock;
 setIsSimLocked(true);
 setSimIsPlaying(false);
 } else {
 if (isSimLocked && current < lock) {
 setIsSimLocked(false);
 }
 }
 }
 };

 const toggleSimPlay = () => {
 if (simVideoRef.current && selectedFunnelForSim) {
 if (simIsPlaying) {
 simVideoRef.current.pause();
 setSimIsPlaying(false);
 } else {
 const current = simVideoRef.current.currentTime;
 const lock = selectedFunnelForSim.lockTime;
 if (simStatus !== 'success' && current >= lock) {
 // Locked - clicking play cannot proceed unless paid
 return;
 }
 simVideoRef.current.play().catch(() => {});
 setSimIsPlaying(true);
 }
 }
 };

 const initiateSimPayment = async () => {
 if (simStatus !== 'success' && isSimLocked) {
 setSimStatus('initiating');
 try {
 const amountGHS = selectedFunnelForSim.price;
    const paymentWindow = window.open("", "_blank");
 const userEmail = auth.currentUser?.email || 'user@example.com';
	const targetCreatorId = selectedFunnelForSim?.creatorId || '';
	const targetContentId = selectedFunnelForSim?.id || selectedFunnelForSim?.slug || '';
	const response = await fetch('/api/paystack/initialize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: userEmail,
			transaction_type: 'unlock',
			creator_id: targetCreatorId,
			user_id: auth.currentUser?.uid || '',
			content_id: targetContentId,
			callback_url: `${window.location.origin}/?tab=funnels`,
			currency: 'GHS',
			metadata: {
				transaction_type: 'unlock',
				creator_id: targetCreatorId,
				user_id: auth.currentUser?.uid || '',
				content_id: targetContentId,
				funnelSlug: selectedFunnelForSim?.slug
			}
		})
	});

 const data = await response.json();
 
 if (data.status && data.data?.authorization_url) {
 const reference = data.data.reference;
 setPaystackRef(reference);
 setPaystackUrl(data.data.authorization_url);
 savePendingPayment({
 reference,
 tab: 'funnels',
 type: 'funnel',
 funnelSlug: selectedFunnelForSim?.slug,
 recipientName: selectedFunnelForSim?.creatorName || 'Creator',
 title: selectedFunnelForSim?.title ? `Bio Funnel: ${selectedFunnelForSim.title}` : 'Bio Funnel Content Unlock',
 amount: amountGHS
 });

        if (paymentWindow) paymentWindow.location.href = data.data.authorization_url;
        else window.location.href = data.data.authorization_url;

 setSimStatus('pin_auth');
 
 // Poll for payment success every 1500ms
 const pollInterval = setInterval(async () => {
 try {
 if (!reference) return;
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (e) {
 // Pending or still completing on payment tab
 }
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 clearInterval(pollInterval);
 setSimStatus('success');
 setIsSimLocked(false);
        if (paymentWindow) paymentWindow.close();
 setSimIsPlaying(true);
 toast.success('Climax unlocked successfully!');
 showPaymentSuccessPopup({
   amount: selectedFunnelForSim?.price || 0,
   currency: 'GHS',
   recipientName: selectedFunnelForSim?.creatorName || 'Creator',
   paymentFor: selectedFunnelForSim?.title ? `Bio Funnel: ${selectedFunnelForSim.title}` : 'Bio Funnel Content Unlock',
   reference: reference,
   tab: 'funnels',
   type: 'funnel'
 });
 if (simVideoRef.current) {
 simVideoRef.current.play().catch(() => {});
        if (paymentWindow) paymentWindow.close();
 }
 
 // Update stats upon successful simulation
 setFunnels(prev => prev.map(f => {
 if (f.id === selectedFunnelForSim.id) {
 const isOwnerCreator = Boolean(auth.currentUser?.uid && (f.creatorId === auth.currentUser.uid || f.creatorEmail === auth.currentUser.email));
 const updatedFun = {
 ...f,
 visits: isOwnerCreator ? f.visits : f.visits + 1,
 unlocks: f.unlocks + 1,
 revenue: f.revenue + f.price
 };
 // Save to DB
 if (f.id.startsWith('f_')) {
 const funnelDocRef = doc(db, 'funnels', f.id);
 updateDoc(funnelDocRef, {
 visits: updatedFun.visits,
 unlocks: updatedFun.unlocks,
 revenue: updatedFun.revenue
 }).catch(err => console.warn("Firestore count update error:", err));
 }
 if (f.creatorId) {
 recordPaymentTransaction({
 reference: reference,
 recipientId: f.creatorId,
 recipientName: f.creatorName || f.creatorHandle || 'Creator',
 amount: f.price,
 type: 'funnel',
 title: `Cliffhanger Unlock: ${f.title}`
 }).catch(err => console.warn("Failed to record funnel transaction:", err));
 }
 return updatedFun;
 }
 return f;
 }));
 }
 } catch (err) {
 console.warn('Polling verification tick skipped due to network/parsing exception.');
 }
 }, 1500);

 // Clear polling after 5 minutes
 setTimeout(() => {
 clearInterval(pollInterval);
 }, 300000);
 } else {
 setSimStatus('idle');
 alert('Could not initialize checkout. Please try again.');
 }
 } catch (error) {
 console.error('Payment initialization error:', error);
 setSimStatus('idle');
 alert('Could not contact Paystack server. Try again.');
 }
 }
 };

 const verifySimulationPayment = async () => {
 if (!paystackRef) return;
 try {
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(paystackRef)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (e) {
 console.warn("Manual verification error:", e);
 }
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 setSimStatus('success');
 setIsSimLocked(false);
 setSimIsPlaying(true);
 toast.success('Climax unlocked successfully!');
 showPaymentSuccessPopup({
   amount: selectedFunnelForSim?.price || 0,
   currency: 'GHS',
   recipientName: selectedFunnelForSim?.creatorName || 'Creator',
   paymentFor: selectedFunnelForSim?.title ? `Bio Funnel: ${selectedFunnelForSim.title}` : 'Bio Funnel Content Unlock',
   reference: paystackRef,
   tab: 'funnels',
   type: 'funnel'
 });
 if (simVideoRef.current) {
 simVideoRef.current.play().catch(() => {});
 }
 
 // Update stats
 setFunnels(prev => prev.map(f => {
 if (f.id === selectedFunnelForSim.id) {
 const isOwnerCreator = Boolean(auth.currentUser?.uid && (f.creatorId === auth.currentUser.uid || f.creatorEmail === auth.currentUser.email));
 const updatedFun = {
 ...f,
 visits: isOwnerCreator ? f.visits : f.visits + 1,
 unlocks: f.unlocks + 1,
 revenue: f.revenue + f.price
 };
 if (f.id.startsWith('f_')) {
 const funnelDocRef = doc(db, 'funnels', f.id);
 updateDoc(funnelDocRef, {
 visits: updatedFun.visits,
 unlocks: updatedFun.unlocks,
 revenue: updatedFun.revenue
 }).catch(err => console.warn("Firestore count update error:", err));
 }
 if (f.creatorId) {
 recordPaymentTransaction({
 reference: paystackRef,
 recipientId: f.creatorId,
 recipientName: f.creatorName || f.creatorHandle || 'Creator',
 amount: f.price,
 type: 'funnel',
 title: `Cliffhanger Unlock: ${f.title}`
 }).catch(err => console.warn("Failed to record funnel transaction:", err));
 }
 return updatedFun;
 }
 return f;
 }));
 alert('🎉 Payment verified! Climer unlocked.');
 } else {
 alert('Payment is still pending. Please finalize it in the checkout tab!');
 }
 } catch (e) {
 console.error(e);
 alert('Verification request failed. Try again.');
 }
 };

 const handleSimVideoClick = () => {
 if (simStatus !== 'success' && isSimLocked) {
 initiateSimPayment();
 return;
 }
 toggleSimPlay();
 };

 const toggleSimMute = () => {
 if (simVideoRef.current) {
 const newMuted = !simMuted;
 simVideoRef.current.muted = newMuted;
 setSimMuted(newMuted);
 }
 };

 const submitReport = async () => {
 setReportSubmitting(true);
 try {
 const reporterId = auth.currentUser?.uid;
 if (!reporterId) {
 alert('You must be logged in to report content.');
 return;
 }
 
 const contentId = selectedFunnelForSim?.id;
 if (!contentId) return;

 // 1. Check for Duplicate Reports
 const reportsRef = collection(db, 'reports');
 const q = query(reportsRef, where('reporterId', '==', reporterId), where('contentId', '==', contentId));
 const querySnapshot = await getDocs(q);
 
 if (!querySnapshot.empty) {
 alert('You have already reported this content.');
 setShowReportModal(false);
 return;
 }
 
 const contentRef = doc(db, 'funnels', contentId);
 
 // 2 & 3. Atomic increment and threshold check
 await runTransaction(db, async (transaction) => {
 const contentDoc = await transaction.get(contentRef);
 
 let currentFlags = 0;
 if (contentDoc.exists() && contentDoc.data().flagCount) {
 currentFlags = contentDoc.data().flagCount;
 }
 const newFlags = currentFlags + 1;
 
 const updateData: any = { flagCount: newFlags };
 if (newFlags >= 3) {
 updateData.status = 'under_review';
 }
 
 if (contentDoc.exists()) {
 transaction.update(contentRef, updateData);
 }
 
 const newReportRef = doc(collection(db, 'reports'));
 transaction.set(newReportRef, {
 id: newReportRef.id,
 contentId: contentId,
 reporterId: reporterId,
 reason: 'copyright_theft',
 details: reportDetails,
 timestamp: serverTimestamp()
 });
 });
 
 alert('Thank you! Your report has been submitted for review and will be handled by our admin dashboard.');
 setShowReportModal(false);
 setReportDetails('');
 } catch (error) {
 console.error("Error submitting report:", error);
 alert('Failed to submit report. Please try again.');
 } finally {
 setReportSubmitting(false);
 }
 };

 const handleSimLoadedMetadata = () => {
 if (simVideoRef.current && selectedFunnelForSim) {
 setSimDuration(simVideoRef.current.duration);
 setSimCurrentTime(0);
 simVideoRef.current.currentTime = 0;
 simVideoRef.current.muted = simMuted;
 simVideoRef.current.play().catch(() => {
 setSimIsPlaying(false);
 });
 setSimIsPlaying(true);
 }
 };

 const handleCreateFunnel = async () => {
 // Smart auto-title from video filename if user hasn't typed one
 let activeTitle = editorTitle.trim();
 if (!activeTitle) {
   if (uploadedFileName) {
     activeTitle = uploadedFileName
       .replace(/\.[^/.]+$/, "")
       .replace(/[_-]/g, " ")
       .split(' ')
       .filter(Boolean)
       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
       .join(' ');
   }
   if (!activeTitle) {
     activeTitle = "Climer Video";
   }
   setEditorTitle(activeTitle);
 }

 let finalVideoUrl = editorVideoUrl;
 if (!finalVideoUrl && uploadedFileBlobRef.current) {
   finalVideoUrl = URL.createObjectURL(uploadedFileBlobRef.current);
   setEditorVideoUrl(finalVideoUrl);
 }

 if (!finalVideoUrl || !finalVideoUrl.trim()) {
   alert("Please upload a video before saving your Climer!");
   return;
 }

 const pendingUploadPromise = activeUploadPromiseRef.current;
 const slug = formatTitleToSlug(activeTitle);

 const user = auth.currentUser;
 const creatorHandle = user?.displayName ? `@${user.displayName.toLowerCase().replace(/\s+/g, '_')}` : (user?.email ? `@${user.email.split('@')[0]}` : "@creator");
 const creatorName = user?.displayName || (user?.email ? user.email.split('@')[0] : "Creator");
 const creatorAvatar = user?.photoURL || "";

 const newFunnel: any = {
 id: 'f_' + Date.now(),
 title: activeTitle,
 subtitle: editorSubtitle || undefined,
 description: editorDescription.trim(),
 tags: editorTags.length > 0 ? editorTags : [editorCategory.toLowerCase()],
 category: editorCategory || 'Entertainment',
 creatorHandle,
 creatorName,
 creatorEmail: user?.email || '',
 creatorAvatar,
 creatorPhotoURL: creatorAvatar,
 creatorVerified: true,
 price: Number(editorPrice) || 2.00,
 videoUrl: finalVideoUrl,
 lockTime: Number(editorLockTime) || 10.0,
 visits: 0,
 unlocks: 0,
 revenue: 0,
 slug: slug,
 isCustom: true,
 creatorId: user?.uid || "creator_uid",
 createdAt: Date.now(),
 exportRestriction: exportRestriction,
 promoCaption: editorCaption,
 cardTheme: editorCardTheme,
 musicTitle: `Original Sound - ${creatorName}`,
 thumbnailUrl: "",
 platform: 'Powered by Pultanc',
 signature: 'Powered by Pultanc',
 poweredBy: 'Pultanc'
 };

 if (uploadedFileBlobRef.current) {
   cacheVideoFileUnderKeys(
     [newFunnel.id, newFunnel.slug, finalVideoUrl, uploadedFileName],
     uploadedFileBlobRef.current,
     uploadedFileName
   ).catch(() => {});
 }

 // Save to Firestore immediately
 const funnelRef = doc(db, 'funnels', newFunnel.id);
 const climerRef = doc(db, 'climers', newFunnel.id);
 const seriesRef = doc(db, 'series', newFunnel.id);
 Promise.all([
 setDoc(funnelRef, newFunnel),
 setDoc(climerRef, newFunnel),
 setDoc(seriesRef, {
 ...newFunnel,
 episodes: [
 {
 id: newFunnel.id,
 title: newFunnel.title,
 videoUrl: newFunnel.videoUrl || '',
 isLocked: true,
 isClimer: true,
 lockTime: Number(newFunnel.lockTime) || 10.0,
 price: Number(newFunnel.price) || 2.00,
 slug: newFunnel.slug || newFunnel.id
 }
 ]
 })
 ])
 .then(() => {
   toast.success("🎉 Premium Climer Saved!");
 })
 .catch((err) => {
 handleFirestoreError(err, OperationType.CREATE, `funnels/${newFunnel.id}`);
 });

 // If cloud upload is still in progress, update remote URL in background
 if (pendingUploadPromise) {
   toast("Video is finalizing cloud sync in background...", { icon: '☁️', duration: 3500 });
   pendingUploadPromise.then(async (remoteUrl) => {
     if (remoteUrl && remoteUrl !== finalVideoUrl) {
       try {
         await Promise.all([
           updateDoc(funnelRef, { videoUrl: remoteUrl }),
           updateDoc(climerRef, { videoUrl: remoteUrl }),
           updateDoc(seriesRef, { videoUrl: remoteUrl })
         ]);
         setFunnels(prev => prev.map(f => f.id === newFunnel.id ? { ...f, videoUrl: remoteUrl } : f));
       } catch (bgErr) {
         console.warn("Background URL sync note:", bgErr);
       }
     }
   }).catch((e) => {
     console.warn("Background upload error handled gracefully:", e);
   });
 }

 setFunnels(prev => [newFunnel, ...prev.filter(f => f.id !== newFunnel.id)]);
 setSelectedFunnelForSim(newFunnel);
 setShowNewFunnelForm(false);
 setSimStatus('idle');
 setSimPhoneNumber('');
 setSimOtp('');
 };

 // Format seconds to MM:SS
 const formatTime = (secs: number) => {
 if (isNaN(secs)) return"00:00.0";
 const minutes = Math.floor(secs / 60);
 const seconds = Math.floor(secs % 60);
 const ms = Math.floor((secs % 1) * 10);
 const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
 const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
 return `${minStr}:${secStr}.${ms}`;
 };

 return (
 <div className="h-full w-full bg-white lg:p-8 overflow-y-auto">
 <div className="max-w-7xl mx-auto space-y-6 pb-12">
 
 {/* Header Block */}
 <div className="bg-white p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 text-left">
 <div className="space-y-1">
 <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">
 Climer Studio
 </h1>
 <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
          Upload your content, drag your paywall, post and start earning. Turn views into cash.
          <span className="block text-red-600 font-semibold mt-0.5">Note: Full climers are only streamed on Pultanc upon unlock </span>
 </p>
 </div>
 
 <button
 onClick={() => setShowNewFunnelForm(!showNewFunnelForm)}
 className={`shrink-0 font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 ${
 showNewFunnelForm 
 ? 'bg-zinc-100 text-gray-700 hover:bg-zinc-200 border border-zinc-200' 
 : 'bg-red-500 text-black hover:bg-red-400'
 }`}
 >
 {showNewFunnelForm ? (
 <>
 <X className="w-3.5 h-3.5 stroke-[2.5]"/>
 Close
 </>
 ) : (
 <>
 <Plus className="w-3.5 h-3.5 stroke-[2.5]"/> 
 Studio
 </>
 )}
 </button>
 </div>

 {/* Studio / New Funnel Workspace */}
 <AnimatePresence>
 {showNewFunnelForm && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="bg-zinc-950 border border-zinc-900 rounded-3xl p-4 sm:p-6 text-left space-y-5 sm:space-y-6 overflow-hidden"
 >
 {/* Studio Header */}
 <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sm:pb-4 gap-2">
 <div className="flex items-center gap-2 sm:gap-2.5">
 <div className="p-2 sm:p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
 <Film className="w-4 h-4 sm:w-5 sm:h-5 text-red-400"/>
 </div>
 <div>
 <h3 className="font-bold text-xs sm:text-sm text-white">Video Climax Timeline Editor</h3>
 <p className="text-[9px] sm:text-[10px] text-zinc-400">Lock preview point & monetize your full video</p>
 </div>
 </div>

 <button
 type="button"
 onClick={handleCreateFunnel}
 className="bg-red-500 hover:bg-red-400 active:scale-95 text-black font-bold py-1 px-2.5 sm:py-1.5 sm:px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer transition-all shrink-0"
 title="Save your Climer immediately"
 >
 <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
 <span>Save Climer</span>
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 
 {/* Visual Video Player Deck */}
 <div className="lg:col-span-5 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Visual Preview Panel</span>
 <label className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 cursor-pointer border border-zinc-800 transition-colors active:scale-95">
 <Upload className="w-3.5 h-3.5 text-red-400 animate-bounce"/>
 <span>{uploadedFileName ? 'Replace Video' : 'Upload Video'}</span>
 <input
 type="file"
 accept="video/*,audio/*,image/*"
 onChange={handleLocalVideoUpload}
 className="hidden"
 />
 </label>
 </div>

 {uploadedFileName && (
 <div className="space-y-1.5 w-full">
   <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-900">
     <div className="flex items-center gap-2 truncate">
       <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStorageUploading ? 'bg-amber-400 animate-ping' : 'bg-green-400 animate-pulse'}`}/>
       <span className="truncate max-w-[200px] font-bold">Video: {uploadedFileName}</span>
     </div>
     {isStorageUploading ? (
       <span className="text-amber-400 font-extrabold ml-2 shrink-0 font-mono">Uploading {Math.round(storageUploadProgress)}%</span>
     ) : (
       <span className="text-green-400 font-bold ml-2 shrink-0">Ready (100%)</span>
     )}
   </div>
   {isStorageUploading && (
     <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
       <div 
         className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-200"
         style={{ width: `${Math.max(6, Math.min(100, Math.round(storageUploadProgress)))}%` }}
       />
     </div>
   )}
 </div>
 )}

 <div className="relative aspect-[9/16] max-h-[380px] w-full mx-auto bg-black rounded-2xl overflow-hidden border border-zinc-800 group">
 <VideoWatermarkOverlay 
   creatorHandle={auth.currentUser?.email ? `@${auth.currentUser.email.split("@")[0]}` : "@creator"}
   creatorName={auth.currentUser?.displayName || undefined}
   position="top-right"
 />
 <video
 ref={editorVideoRef}
 crossOrigin="anonymous"
 src={editorVideoUrl}
 controlsList="nodownload nofullscreen noplaybackrate"
 disablePictureInPicture
 onTimeUpdate={handleEditorTimeUpdate}
 onLoadedMetadata={handleEditorLoadedMetadata}
 className="w-full h-full object-contain"
 muted={editorMuted}
 playsInline
 />

 {/* Timeline Position Indicator overlay */}
 <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 font-mono text-[10px] text-zinc-300">
 Time: {formatTime(editorCurrentTime)}
 </div>

 {/* Locked Visual overlay showing in the editor to represent what viewers see */}
 {editorCurrentTime >= editorLockTime && (
 <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
 <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center mb-2 animate-pulse">
 <Lock className="w-5 h-5"/>
 </div>
 <span className="text-[9px] font-mono tracking-widest text-red-400 font-bold bg-red-950/75 border border-red-500/20 px-2 py-0.5 rounded uppercase">
 Monetization Gate Active
 </span>
 <p className="text-[10px] font-bold text-white mt-1 max-w-[200px]">
 Viewers will pay GHS {editorPrice} to unlock past {editorLockTime}s
 </p>
 </div>
 )}

 {/* Simple Player control strip inside video container */}
 <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex items-center justify-between">
 <button
 onClick={toggleEditorPlay}
 className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
 >
 {editorIsPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4 fill-white"/>}
 </button>

 <div className="text-[10px] font-mono text-zinc-400">
 {formatTime(editorCurrentTime)} / {formatTime(editorDuration)}
 </div>

 <button
 onClick={() => setEditorMuted(!editorMuted)}
 className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
 >
 {editorMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
 </button>
 </div>
 </div>

 {/* CapCut-style Video Timeline Slide */}
 <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2 mt-4">
 <div className="flex items-center justify-between text-[10px] font-mono">
 <span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
 <Sliders className="w-3.5 h-3.5 text-red-400"/>
 Monetization Gate Timeline
 </span>
 <div className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
 <Clock className="w-3 h-3 text-red-500"/>
 <input
 type="number"
 value={editorLockTime}
 onChange={(e) => {
 let val = parseFloat(e.target.value);
 if (isNaN(val)) val = 0;
 if (val < 0) val = 0;
 if (val > editorDuration) val = editorDuration;
 setEditorLockTime(val);
 handleEditorSeek(val);
 }}
 step="0.1"
 min="0"
 max={editorDuration}
 className="bg-transparent font-bold text-red-500 w-12 text-right focus:outline-none"
 />
 <span className="font-bold text-red-500">s</span>
 </div>
 </div>

 {/* Interactive Track Container */}
 <div className="relative h-12 bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col justify-center px-1">
 {/* Filmstrip notches representation */}
 <div className="absolute inset-y-1.5 left-2 right-2 flex justify-between pointer-events-none opacity-25">
 {Array.from({ length: 15 }).map((_, i) => (
 <div key={i} className="w-2 h-full bg-zinc-900 rounded-sm"/>
 ))}
 </div>

 {/* Free Teaser region highlight (green overlay) */}
 <div 
 style={{ width: `${(editorLockTime / editorDuration) * 100}%` }}
 className="absolute left-1 h-9 rounded-l-lg bg-gray-500/10 border-r border-gray-500/40 pointer-events-none"
 >
 <span className="absolute left-2 top-1.5 text-[7px] font-mono text-gray-400 font-bold uppercase tracking-widest opacity-80">
 Free Preview
 </span>
 </div>

 {/* Locked Climax region highlight (red overlay) */}
 <div 
 style={{ left: `${(editorLockTime / editorDuration) * 100}%`, right: 4 }}
 className="absolute h-9 rounded-r-lg bg-red-500/10 pointer-events-none"
 >
 <span className="absolute right-2 top-1.5 text-[7px] font-mono text-red-400 font-bold uppercase tracking-widest opacity-80 flex items-center gap-0.5">
 <Lock className="w-2 h-2"/> Paywall Active
 </span>
 </div>

 {/* Input Range Control */}
 <input
 type="range"
 min={0}
 max={editorDuration}
 step={0.1}
 value={editorLockTime}
 onChange={(e) => {
 const val = Number(parseFloat(e.target.value).toFixed(1));
 setEditorLockTime(val);
 handleEditorSeek(val);
 }}
 className="absolute inset-x-1 h-9 opacity-0 cursor-ew-resize z-20"
 />

 {/* Custom Lock Knob */}
 <div 
 style={{ left: `calc(${(editorLockTime / editorDuration) * 100}% - 14px)` }}
 className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500 border-2 border-white flex items-center justify-center cursor-grab pointer-events-none z-10 hover:scale-105 active:scale-95 transition-transform"
 >
 <Lock className="w-3.5 h-3.5 text-white"/>
 </div>

 {/* Playhead indicator */}
 <div 
 style={{ left: `${(editorCurrentTime / editorDuration) * 100}%` }}
 className="absolute top-1 bottom-1 w-0.5 bg-white pointer-events-none z-10"
 >
 <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-white"/>
 </div>
 </div>

 <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 px-1">
 <span>0.0s (Start)</span>
 <span>{editorDuration.toFixed(1)}s (End)</span>
 </div>
 </div>

                  {/* Quick Climer Studio Actions: Download, Share, & Quick Save */}
                  <div className="pt-2 flex items-center justify-between gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTeaser}
                      disabled={isRecordingTeaser || !editorVideoUrl}
                      title="Download teaser video"
                      className={`flex-1 font-bold py-1.5 px-2 sm:py-2 sm:px-3 rounded-xl text-[10px] sm:text-[11px] flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-sm min-w-0 ${
                        isRecordingTeaser
                          ? 'bg-zinc-800 text-red-400 border border-red-500/30'
                          : !editorVideoUrl
                          ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-95'
                      }`}
                    >
                      {isRecordingTeaser ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full shrink-0"
                          />
                          <span className="truncate">Generating...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 shrink-0" />
                          <span className="truncate">Download</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleShareStudioClimer}
                      title="Share Climer link"
                      className="font-bold py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-xl text-[10px] sm:text-[11px] flex items-center justify-center gap-1 sm:gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 shrink-0" />
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateFunnel}
                      className="bg-red-500 hover:bg-red-400 active:scale-95 text-black font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-xl text-[10px] sm:text-[11px] flex items-center justify-center gap-1 sm:gap-1.5 shadow-md shadow-red-500/20 cursor-pointer transition-all shrink-0"
                      title="Save and publish Climer"
                    >
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] shrink-0" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

 {/* Timeline and Settings Controls: Only Title, Subtitle, Fixed Powered by Pultanc, and Save button */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-left">
                  <div className="border-b border-zinc-800 pb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Link & Preview Details</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Title, price, and optional cliffhanger descriptions</p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                      Details Optional
                    </span>
                  </div>

                  {/* Note on streaming upon unlock and quick save */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 sm:gap-2.5">
                    <Shield className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] sm:text-[11px] text-zinc-300 leading-snug space-y-0.5">
                      <p>
                        <strong className="text-white font-bold">Note:</strong> Full video is only streamed on Pultanc upon unlock for Climer videos.
                      </p>
                      <p className="text-zinc-400 text-[9px] sm:text-[10px]">
                        💡 <strong>Quick Save:</strong> Only video & paywall are required! Title is auto-set from your video, and details (description, tags) do not need to be saved if you want to publish quickly.
                      </p>
                    </div>
                  </div>

                  {/* Unlock Price (Moved up before Title, stepper + direct input) */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Unlock Price (GHS)
                      </label>
                      <span className="text-[10px] text-zinc-500 font-mono">Tap + / - or type</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditorPrice(prev => Math.max(0.5, Number((prev - 0.5).toFixed(2))))}
                        className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-red-500/50 hover:bg-zinc-900 text-white font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-base shrink-0"
                        title="Decrease price"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold font-mono">
                          GH₵
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editorPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEditorPrice(isNaN(val) ? 0.5 : val);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl pl-12 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none transition-colors"
                          placeholder="2.00"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditorPrice(prev => Number((prev + 0.5).toFixed(2)))}
                        className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-red-500/50 hover:bg-zinc-900 text-white font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-base shrink-0"
                        title="Increase price"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title Field */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                      placeholder="Add your title (e.g. Confronting The Cheat)"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Subtitle Field */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Subtitle
                    </label>
                    <textarea
                      rows={3}
                      value={editorSubtitle}
                      onChange={(e) => setEditorSubtitle(e.target.value)}
                      placeholder="Add your subtitle (e.g. Watch the exclusive cliffhanger teaser on Pultanc. Unlock the climax scene directly.)"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Description Field */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={editorDescription}
                      onChange={(e) => setEditorDescription(e.target.value)}
                      placeholder="Add an engaging synopsis, cliffhanger backstory, or context to help viewers easily find your video in search..."
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Optional Tags Input */}
                  <div className="space-y-2 text-left pt-0.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Tags & Keywords <span className="text-zinc-500 font-normal lowercase tracking-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {editorTags.length > 0 ? `${editorTags.length} tag${editorTags.length > 1 ? 's' : ''} added` : 'e.g. #drama, #thriller'}
                      </span>
                    </div>

                    {/* Active Tags Chips */}
                    {editorTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-0.5">
                        {editorTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 bg-red-950/60 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-xs"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => removeEditorTag(tag)}
                              className="hover:text-red-200 hover:bg-red-900/50 rounded-full p-0.5 transition-colors cursor-pointer"
                              title={`Remove tag #${tag}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tag Input Field */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={editorTagInput}
                          onChange={(e) => setEditorTagInput(e.target.value)}
                          onKeyDown={handleEditorTagKeyDown}
                          placeholder="Type tag & press Enter or comma..."
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl pl-8 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddEditorTag()}
                        className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Category Selection Dropdown */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={editorCategory}
                        onChange={(e) => setEditorCategory(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none transition-colors appearance-none cursor-pointer pr-10"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat} className="bg-zinc-900 text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Download Climer Video, Share, Cancel, Save */}
                  <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadTeaser}
                      disabled={isRecordingTeaser || !editorVideoUrl}
                      title="Download teaser video"
                      className={`font-bold py-1.5 px-2.5 sm:py-2.5 sm:px-4 rounded-xl text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                        isRecordingTeaser
                          ? 'bg-zinc-800 text-red-400 border border-red-500/30'
                          : !editorVideoUrl
                          ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-95 shadow-sm'
                      }`}
                    >
                      {isRecordingTeaser ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-red-400 border-t-transparent rounded-full"
                          />
                          <span>Generating ({recordingProgress}%)...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />
                          <span>Download</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleShareStudioClimer}
                      title="Share Climer link"
                      className="font-bold py-1.5 px-2.5 sm:py-2.5 sm:px-3.5 rounded-xl text-[10px] sm:text-xs flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                      <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />
                      <span>Share</span>
                    </button>

                    <div className="flex-1 min-w-[4px]" />

                    <button
                      type="button"
                      onClick={() => setShowNewFunnelForm(false)}
                      className="px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-bold text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateFunnel}
                      className="min-w-[90px] sm:min-w-[110px] bg-red-500 hover:bg-red-400 active:scale-[0.99] text-black shadow-md shadow-red-500/20 cursor-pointer font-bold py-1.5 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[10px] sm:text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isStorageUploading ? `Save (${Math.round(storageUploadProgress)}%)` : 'Save Climer'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
 )}
 </AnimatePresence>

 {/* Grid Layout: Active Links Manager + Visual Live Preview */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 
 {/* Left: management panel & links list */}
 <div className="lg:col-span-7 space-y-6 text-left">
 
 {/* List block */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h3 className="font-bold text-xs text-gray-900 uppercase flex items-center gap-1.5">
 <span>My Active Climers</span>
 <span className="text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full font-mono">
 {funnels.length} Live
 </span>
 </h3>
 </div>

 <div className="space-y-3">
 {funnels.map((fun) => {
 const isSelected = selectedFunnelForSim?.id === fun.id;
 const promoLink = getClimerLink(fun);
 return (
 <div
 key={fun.id}
 onClick={() => {
 setSelectedFunnelForSim(fun);
 setSimStatus('idle');
 setSimPhoneNumber('');
 setSimOtp('');
 }}
 className={`border-2 rounded-2xl p-4 text-left transition-all duration-250 cursor-pointer ${
 isSelected 
 ? 'border-red-500 bg-red-50/15 ' 
 : 'border-gray-200 bg-white hover:bg-gray-50'
 }`}
 >
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <div className="flex items-center gap-1.5">
 <h4 className="font-bold text-xs text-gray-900 line-clamp-1">{fun.title}</h4>
 </div>
 <span className="text-[9px] text-gray-400 block font-mono">
 By {fun.creatorName} • Locked at <strong className="text-gray-700 font-bold">{fun.lockTime.toFixed(1)}s</strong>
 </span>
 </div>
 <span className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full font-mono shrink-0">
 GH₵ {fun.price}
 </span>
 </div>

  {/* Share link & actions block */}
  <div className="mt-2.5 space-y-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1.5 sm:p-2" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-1.5 overflow-hidden px-0.5">
      <Link2 className="w-3 h-3 text-gray-400 shrink-0"/>
      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-700 select-all truncate flex-1">{promoLink}</span>
    </div>

    {/* 5 Compact Action Buttons: Download, Share, Copy, Edit, Delete */}
    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
      {/* Download locked climer video */}
      <button
        type="button"
        onClick={() => {
          setSelectedFunnelForSim(fun);
          handleDownloadClimerVideo(fun);
        }}
        disabled={isRecordingTeaser && selectedFunnelForSim?.id === fun.id}
        className="text-[8px] sm:text-[9px] font-bold bg-white border border-gray-250 hover:bg-gray-100 py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-lg flex items-center gap-0.5 sm:gap-1 text-gray-700 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        title="Download locked climer video with paywall card & watermark"
      >
        {isRecordingTeaser && selectedFunnelForSim?.id === fun.id ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-2 h-2 sm:w-2.5 sm:h-2.5 border border-red-500 border-t-transparent rounded-full shrink-0" />
            <span className="text-red-600 font-mono text-[8px] sm:text-[9px]">{simRecordingProgress}%</span>
          </>
        ) : (
          <>
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 shrink-0"/>
            <span>Download</span>
          </>
        )}
      </button>

      {/* Share climer link */}
      <button
        type="button"
        onClick={() => handleShareFunnel(fun)}
        className="text-[8px] sm:text-[9px] font-bold bg-white border border-gray-250 hover:bg-gray-100 py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-lg flex items-center gap-0.5 sm:gap-1 text-gray-700 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        title="Share Climer link"
      >
        <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 shrink-0"/>
        <span>Share</span>
      </button>

      {/* Copy link */}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(`https://${promoLink}`);
          setCopiedId(fun.id);
          setTimeout(() => setCopiedId(null), 2000);
        }}
        className="text-[8px] sm:text-[9px] font-bold bg-white border border-gray-250 hover:bg-gray-100 py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-lg flex items-center gap-0.5 sm:gap-1 text-gray-600 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        title="Copy climer link"
      >
        {copiedId === fun.id ? (
          <><CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 shrink-0"/> <span>Copied</span></>
        ) : (
          <><Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 shrink-0"/> <span>Copy</span></>
        )}
      </button>

      {/* Edit: title, subtitle, price (video locked) */}
      <button
        type="button"
        onClick={() => handleStartEdit(fun)}
        className="text-[8px] sm:text-[9px] font-bold bg-white border border-amber-250 hover:bg-amber-50 py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-lg flex items-center gap-0.5 sm:gap-1 text-amber-700 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        title="Edit title, subtitle, and price"
      >
        <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600 shrink-0"/>
        <span>Edit</span>
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={() => setDeletingFunnel(fun)}
        className="text-[8px] sm:text-[9px] font-bold bg-white border border-red-200 hover:bg-red-50 py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-lg flex items-center gap-0.5 sm:gap-1 text-red-600 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        title="Delete this climer"
      >
        <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600 shrink-0"/>
        <span>Delete</span>
      </button>
    </div>
  </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>

 {/* Right: Live Interactive Smartphone Preview */}
 <div className="lg:col-span-5 flex flex-col items-center">
 <div className="text-center mb-2.5">
 
 <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider mt-0.5">Climer Preview</h3>
 </div>

 {/* Smartphone container */}
 <div className="relative w-full max-w-[250px] h-[525px] bg-zinc-950 rounded-[38px] p-2 border-[5px] border-zinc-800 flex flex-col overflow-hidden select-none shadow-xl">
 
 {/* Smartphone Camera Notch */}
 <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-3.5 bg-zinc-950 rounded-full z-40 flex items-center justify-center">
 <div className="w-2.5 h-2.5 rounded-full bg-zinc-900/40"/>
 </div>

 {/* Smartphone Top Status Bar */}
 <div className="absolute top-1.5 left-6 right-6 flex justify-between text-[8px] text-white font-mono z-30 opacity-70">
 <span>12:02</span>
 <span className="text-red-400 font-bold tracking-widest flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
 
 </span>
 </div>

 {/* Screen View */}
 <div className="w-full h-full bg-zinc-900 rounded-[30px] overflow-hidden relative flex flex-col justify-between pt-5">
 
 {/* Simulation View Contents */}
 {selectedFunnelForSim ? (
 <div className="absolute inset-0 flex flex-col justify-between text-white">
 
 {/* Address Bar */}
 <div className="bg-zinc-950/95 border-b border-white/10 pt-3 pb-1.5 px-2.5 flex flex-col gap-0.5 shrink-0 z-20">
 <div className="bg-zinc-900/90 border border-white/5 rounded-xl px-2.5 py-1 flex items-center justify-between gap-1.5 text-zinc-300">
 <div className="flex items-center gap-1 min-w-0 flex-1">
 <Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>
 <span className="text-[9px] font-mono font-medium text-red-400 truncate">
 {getClimerLink(selectedFunnelForSim)}
 </span>
 </div>
 <span className="text-[7px] font-mono font-bold text-zinc-500 uppercase">HTTPS</span>
 </div>
 </div>

 {/* Video Area */}
 <div className="relative flex-1 bg-black w-full overflow-hidden flex items-center justify-center">
 <video
 key={selectedFunnelForSim.id}
 ref={simVideoRef}
 crossOrigin="anonymous"
 src={selectedFunnelForSim.videoUrl || ''}
 controlsList="nodownload nofullscreen noplaybackrate"
 disablePictureInPicture
 {...videoProtectionProps}
 onTimeUpdate={handleSimVideoTimeUpdate}
 onLoadedMetadata={handleSimLoadedMetadata}
 onPlay={() => setSimIsPlaying(true)}
 onPause={() => setSimIsPlaying(false)}
 className="w-full h-full object-cover cursor-pointer select-none pointer-events-auto"
 onClick={handleSimVideoClick}
 autoPlay
 loop
 muted={simMuted}
 playsInline
 />

 {/* Dynamic Anti-Piracy Watermark with Viewer ID */}
 <DynamicProtectedWatermark 
 creatorHandle={selectedFunnelForSim.creatorHandle || selectedFunnelForSim.creatorName}
 />

 {/* Screen Recording Blackout Shield */}
 <ScreenRecordingShield 
 isBlocked={isRecordingBlocked}
 reason={blockReason}
 creatorHandle={selectedFunnelForSim.creatorHandle || selectedFunnelForSim.creatorName}
 />

 {/* Big Interactive Play Overlay Button when paused and not locked */}
 {!simIsPlaying && (!isSimLocked || simStatus === 'success') && (
 <button
 type="button"
 onClick={toggleSimPlay}
 className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all z-10 group/btn animate-pulse"
 >
 <Play className="w-8 h-8 fill-white ml-1 text-white group-hover/btn:scale-110 transition-transform duration-200"/>
 </button>
 )}

  {/* Climer Video Details HUD on Video during active playback */}
  {(!isSimLocked || simStatus === 'success') && (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-2.5">
      {/* Top Bar: Creator Badge & Price Tag */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 shadow-md pointer-events-auto">
          {selectedFunnelForSim.creatorAvatar ? (
            <img 
              src={selectedFunnelForSim.creatorAvatar} 
              alt={selectedFunnelForSim.creatorHandle} 
              className="w-4 h-4 rounded-full object-cover border border-red-500/60 shrink-0" 
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-zinc-800 border border-red-500/60 flex items-center justify-center shrink-0">
              <User className="w-2.5 h-2.5 text-zinc-400" />
            </div>
          )}
          <span className="text-[8.5px] font-bold text-white leading-none truncate max-w-[90px]">
            {selectedFunnelForSim.creatorHandle?.startsWith('@') ? selectedFunnelForSim.creatorHandle : `@${selectedFunnelForSim.creatorHandle || 'creator'}`}
          </span>
          {selectedFunnelForSim.creatorVerified && (
            <ShieldCheck className="w-2.5 h-2.5 text-red-400 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-md border border-white/30">
            <span>GHS {selectedFunnelForSim.price.toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSaveFunnel(selectedFunnelForSim)}
          className={`flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-md border transition-all cursor-pointer pointer-events-auto active:scale-95 ${
            savedFunnelIds.includes(selectedFunnelForSim.id) || savedFunnelIds.includes(selectedFunnelForSim.slug)
              ? 'bg-red-600 text-white border-white/40 shadow-red-600/30'
              : 'bg-black/60 hover:bg-black/80 text-white border-white/20'
          }`}
          title="Save to your Saves"
        >
          <Bookmark className={`w-2.5 h-2.5 ${savedFunnelIds.includes(selectedFunnelForSim.id) || savedFunnelIds.includes(selectedFunnelForSim.slug) ? 'fill-white text-white' : 'text-white'}`} />
          <span>{savedFunnelIds.includes(selectedFunnelForSim.id) || savedFunnelIds.includes(selectedFunnelForSim.slug) ? 'Saved' : 'Save'}</span>
        </button>
        </div>
      </div>

      {/* Bottom Teaser Info Bar (above playback controls) */}
      <div className="space-y-1 mb-9 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-white/15 pointer-events-auto">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-[9.5px] font-bold text-white line-clamp-1 flex items-center gap-1">
            <span>🎬</span>
            <span>{selectedFunnelForSim.title}</span>
          </h4>
          {simStatus === 'success' && (
            <span className="text-[7.5px] font-mono text-green-400 font-bold bg-green-950/80 px-1 py-0.5 rounded border border-green-500/30 shrink-0">
              UNLOCKED
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[7px] text-zinc-400 font-mono">
          <span className="truncate">
            {getClimerLink(selectedFunnelForSim)}
          </span>
        </div>
      </div>
    </div>
  )}

  {/* Complete Paywall Card on the Climer Video when locked */}
  {simStatus !== 'success' && isSimLocked && (
    <div 
      onClick={initiateSimPayment}
      className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 text-center z-20 pt-6 pb-12 cursor-pointer overflow-y-auto"
    >
      {/* Top Lock Badge */}
      <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-500/50 px-2.5 py-0.5 rounded-full shadow-lg">
        <Lock className="w-3 h-3 text-red-400 animate-bounce" />
        <span className="text-[8.5px] font-bold text-red-300 tracking-wider uppercase">
          CLIMAX LOCKED • {selectedFunnelForSim.lockTime.toFixed(1)}s
        </span>
      </div>

      {/* Card Main Body */}
      <div className="space-y-1.5 w-full max-w-[210px] my-auto">
        {/* Creator Avatar & Handle */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 mx-auto">
          {selectedFunnelForSim.creatorAvatar ? (
            <img 
              src={selectedFunnelForSim.creatorAvatar} 
              alt={selectedFunnelForSim.creatorHandle} 
              className="w-4 h-4 rounded-full object-cover border border-red-500/50 shrink-0" 
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-zinc-800 border border-red-500/50 flex items-center justify-center shrink-0">
              <User className="w-2.5 h-2.5 text-zinc-400" />
            </div>
          )}
          <span className="text-[9px] font-bold text-white leading-none truncate max-w-[90px]">
            {selectedFunnelForSim.creatorHandle?.startsWith('@') ? selectedFunnelForSim.creatorHandle : `@${selectedFunnelForSim.creatorHandle || 'creator'}`}
          </span>
          {selectedFunnelForSim.creatorVerified && (
            <ShieldCheck className="w-3 h-3 text-red-400 shrink-0" />
          )}
        </div>

        <h3 className="text-[11px] font-extrabold text-white leading-tight line-clamp-2 px-1">
          "{selectedFunnelForSim.title}"
        </h3>

        {/* Price Highlight */}
        <div className="py-1 px-2 rounded-xl bg-red-500/15 border border-red-500/30">
          <div className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider">Unlock Full Story</div>
          <div className="text-sm font-black text-red-400">
            GHS {selectedFunnelForSim.price.toFixed(2)}
          </div>
        </div>

        {/* Mobile Money Badges */}
        <div className="flex items-center justify-center gap-1 text-[7px] font-bold py-0.5 text-zinc-300">
          <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">MTN MoMo</span>
          <span className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">Telecel Cash</span>
          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">AT Money</span>
        </div>

        {paystackUrl && (
          <a
            href={paystackUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[8.5px] rounded-lg flex items-center justify-center gap-1 transition-all mb-1 cursor-pointer shadow-sm border border-white/10"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Open Paystack Tab
          </a>
        )}

        {/* Interactive MoMo Unlock CTA */}
        <button
          type="button"
          disabled={simStatus === 'initiating' || simStatus === 'processing'}
          onClick={(e) => {
            e.stopPropagation();
            initiateSimPayment();
          }}
          className="w-full bg-red-500 hover:bg-red-400 active:scale-95 text-black font-extrabold text-[9.5px] py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-500/25 disabled:opacity-75"
        >
          {simStatus === 'initiating' ? (
            <>
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
                className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full"
              />
              <span>Connecting MoMo...</span>
            </>
          ) : simStatus === 'pin_auth' ? (
            <>
              <CreditCard className="w-3.5 h-3.5"/>
              <span>Awaiting Checkout Tab...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-black"/>
              <span>Unlock Climax (GHS {selectedFunnelForSim.price.toFixed(2)})</span>
            </>
          )}
        </button>

        {/* Bio Link tag */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(getClimerFullUrl(selectedFunnelForSim));
            toast.success("Climer link copied!");
          }}
          className="text-[7.5px] font-mono text-zinc-300 hover:text-white bg-black/50 border border-white/10 rounded-lg py-1 px-1.5 cursor-pointer flex items-center justify-center gap-1"
          title="Click to copy climer link"
        >
          <span>🔗 {getClimerLink(selectedFunnelForSim)}</span>
          <Copy className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
        </div>
      </div>

      <p className="text-[6.5px] text-zinc-500 font-bold uppercase tracking-wider">
        Instant MoMo Auto-Unlock • Secure Gateway
      </p>
    </div>
  )}

              {/* Micro progress indicator & Controls inside preview */}
 <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[8px] font-mono text-zinc-300 flex items-center justify-between gap-2 z-20 border border-white/5">
 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={toggleSimPlay}
 className="p-1 hover:bg-white/10 text-white rounded transition-colors"
 >
 {simIsPlaying ? <Pause className="w-2.5 h-2.5"/> : <Play className="w-2.5 h-2.5 fill-white"/>}
 </button>
 <button
 type="button"
 onClick={toggleSimMute}
 className="p-1 hover:bg-white/10 text-white rounded transition-colors"
 >
 {simMuted ? <VolumeX className="w-2.5 h-2.5 text-zinc-400"/> : <Volume2 className="w-2.5 h-2.5 text-red-400"/>}
 </button>
 <span>{simCurrentTime.toFixed(1)}s / {simDuration > 0 ? simDuration.toFixed(1) : selectedFunnelForSim.lockTime.toFixed(1)}s</span>
 </div>
 <div className="flex items-center gap-1">
 <span className="text-zinc-500">Gate:</span>
 <span className="text-gray-400 font-bold">{selectedFunnelForSim.lockTime.toFixed(1)}s</span>
 <button
   type="button"
   onClick={(e) => {
     e.stopPropagation();
     handleStartEdit(selectedFunnelForSim);
   }}
   className="p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
   title="Edit paywall time & climer"
 >
   <Edit3 className="w-2.5 h-2.5" />
 </button>
 {simStatus === 'success' ? (
 <span className="text-red-400 font-bold ml-1 bg-red-950/50 px-1 py-0.5 rounded border border-red-500/20 text-[8px]">Unlocked ✅</span>
 ) : (
 isSimLocked && <span className="text-red-400 font-bold ml-1 bg-red-950/50 px-1 py-0.5 rounded border border-red-500/20 text-[8px]">Locked 🔒</span>
 )}
 </div>
 </div>
 </div>

 {/* Mobile-Optimized Payment Section Below */}
 <div className="bg-zinc-950 border-t border-white/10 p-2.5 space-y-1.5 shrink-0">
 
 {/* Checkout Header */}
 <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
 <div className="flex items-center gap-1.5">
 {selectedFunnelForSim.creatorAvatar ? (
   <img 
     src={selectedFunnelForSim.creatorAvatar} 
     alt={selectedFunnelForSim.creatorHandle}
     className="w-5 h-5 rounded-full object-cover border border-red-500/40 shrink-0"
   />
 ) : (
   <div className="w-5 h-5 rounded-full bg-zinc-800 border border-red-500/40 flex items-center justify-center shrink-0">
     <User className="w-3 h-3 text-zinc-400" />
   </div>
 )}
 <div>
   <span className="text-[9px] font-bold text-red-400 block leading-none">
     {selectedFunnelForSim.creatorHandle?.startsWith('@') ? selectedFunnelForSim.creatorHandle : ('@' + (selectedFunnelForSim.creatorHandle || 'creator'))}
   </span>
   <span className="text-[7.5px] text-zinc-400 block leading-none mt-0.5">Verified Merchant</span>
 </div>
 </div>
 <div className="flex items-center gap-1.5 text-right">
   <button 
     onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
     className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:border-red-300 shadow-xs flex items-center justify-center transition-all p-1"
     title="Report issue"
   >
     <Flag className="w-3 h-3 text-red-600 fill-current"/>
   </button>
 </div>
 </div>

 <AnimatePresence mode="wait">
 {simStatus === 'idle' && (
 <motion.div
 key="sim-idle"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="py-1 text-center"
 >
 <p className="text-[8.5px] text-zinc-400 font-medium leading-relaxed">
 Note: Full climers are only streamed on Pultanc upon unlock 
 </p>
 </motion.div>
 )}

 {simStatus === 'initiating' && (
 <motion.div
 key="sim-initiating"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="py-6 flex flex-col items-center justify-center space-y-3"
 >
 <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin"/>
 <span className="text-[10px] font-mono tracking-widest text-zinc-400 font-medium text-center">
 Connecting Paystack Gateway...
 </span>
 </motion.div>
 )}

 {simStatus === 'pin_auth' && (
 <motion.div
 key="sim-pin"
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="bg-zinc-900 border border-white/10 rounded-2xl p-3 space-y-2 text-left"
 >
 <div className="flex items-center gap-1.5 text-gray-500">
 <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-pulse"/>
 <span className="text-[9px] font-bold uppercase tracking-wider">Awaiting Checkout</span>
 </div>
 <p className="text-[8px] text-zinc-300 font-medium leading-relaxed">
 Paystack secure gateway has been initialized in a new browser tab. Please complete payment there.
 </p>
 
 <div className="flex flex-col gap-1.5 pt-1">
 <button
 onClick={() => {
 if (paystackUrl) {
 window.open(paystackUrl, '_blank', 'noopener,noreferrer');
 }
 }}
 className="w-full bg-zinc-950 hover:bg-zinc-900 text-white border border-white/10 font-bold py-1.5 rounded-xl text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer"
 >
 <ExternalLink className="w-3 h-3"/>
 Reopen Checkout Tab
 </button>
 <button
 onClick={verifySimulationPayment}
 className="w-full bg-red-500 hover:bg-red-400 text-black font-bold py-1.5 rounded-xl text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer"
 >
 <RotateCcw className="w-3 h-3"/>
 Verify Payment State
 </button>
 </div>
 </motion.div>
 )}

 {simStatus === 'processing' && (
 <motion.div
 key="sim-proc"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="py-6 flex flex-col items-center justify-center space-y-3"
 >
 <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin"/>
 <span className="text-[10px] font-mono tracking-widest text-zinc-400 font-medium text-center">
 Verifying Paystack Settled Callback...
 </span>
 </motion.div>
 )}

 {simStatus === 'success' && (
 <motion.div
 key="sim-success"
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="py-1.5 flex flex-col items-center justify-center space-y-2 text-center"
 >
 <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/30">
 <CheckCircle2 className="w-4 h-4"/>
 </div>
 <span className="text-[10px] font-bold text-red-400 leading-none">
 Payment Authorized!
 </span>
 <p className="text-[8px] text-zinc-400 max-w-[200px]">
 The remaining climax is fully unlocked and playing past the lock point!
 </p>
 <button
 onClick={() => {
 setSimStatus('idle');
 setPaystackRef('');
 setPaystackUrl('');
 if (simVideoRef.current) {
 simVideoRef.current.currentTime = 0;
 simVideoRef.current.play().catch(() => {});
 }
 }}
 className="text-[8px] bg-white/5 hover:bg-white/10 text-white font-bold py-1 px-3 rounded-lg border border-white/10 transition-colors cursor-pointer"
 >
 Reset & Re-Test
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Device Home Bar */}
 <div className="pt-2 border-t border-white/5 flex items-center justify-center pb-1">
 <div className="w-16 h-1 bg-white/20 rounded-full mx-auto"/>
 </div>
 </div>
 </div>
 ) : (
 <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">
 
 </div>
 )}

 </div>
 </div>

  {/* Climer Link & Compact Quick Actions */}
  {selectedFunnelForSim && (
  <div className="mt-3 w-full max-w-[250px] px-1 space-y-2">
    {/* 4 Compact Action Buttons Grid */}
    <div className="grid grid-cols-2 gap-1.5">
      {/* Edit Paywall Time & Details */}
      <button
        type="button"
        onClick={() => handleStartEdit(selectedFunnelForSim)}
        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold py-1.5 px-2 rounded-xl text-[11px] transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
        title="Edit paywall time, price & title"
      >
        <Edit3 className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="truncate">Edit ({selectedFunnelForSim.lockTime.toFixed(1)}s)</span>
      </button>

      {/* Share Climer Link */}
      <button
        type="button"
        onClick={() => handleShareFunnel(selectedFunnelForSim)}
        className="bg-red-500 hover:bg-red-400 text-black font-bold py-1.5 px-2 rounded-xl text-[11px] transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        title="Share Climer link"
      >
        <Share2 className="w-3 h-3 shrink-0"/>
        <span>Share</span>
      </button>

      {/* Download Teaser Video */}
      <button
        type="button"
        onClick={handleDownloadClimerVideo}
        disabled={isRecordingTeaser}
        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 font-bold py-1.5 px-2 rounded-xl text-[11px] transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        title="Download teaser video"
      >
        {isRecordingTeaser ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full shrink-0" />
            <span className="text-[10px] truncate">{simRecordingProgress}%</span>
          </>
        ) : (
          <>
            <Download className="w-3 h-3 text-red-400 shrink-0" />
            <span>Download</span>
          </>
        )}
      </button>

      {/* Copy Link */}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(getClimerFullUrl(selectedFunnelForSim));
          toast.success('Climer link copied!');
        }}
        className="bg-white/5 hover:bg-white/10 text-zinc-300 font-bold py-1.5 px-2 rounded-xl text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
        title="Copy link"
      >
        <Copy className="w-3 h-3 text-zinc-400 shrink-0"/>
        <span>Copy</span>
      </button>
    </div>

    <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 text-[9.5px] font-mono select-none pointer-events-none text-center">
      <Shield className="w-3 h-3 text-red-500 shrink-0" />
      <span>Full climers stream on Pultanc upon unlock</span>
    </div>
  </div>
  )}
 </div>
 </div>

 </div>
 
 {/* Report Modal */}
 <AnimatePresence>
 {showReportModal && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 pointer-events-auto"
 onClick={(e) => { e.stopPropagation(); setShowReportModal(false); }}
 >
 <motion.div 
 initial={{ scale: 0.95, y: 20 }} 
 animate={{ scale: 1, y: 0 }} 
 exit={{ scale: 0.95, y: 20 }}
 className="bg-white w-full max-w-sm rounded-3xl overflow-hidden border border-gray-200 shadow-2xl text-gray-900"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
 <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-white border border-red-200 shadow-xs flex items-center justify-center">
 <Flag className="w-3.5 h-3.5 text-red-600 fill-current"/>
 </div>
 Report Issue
 </h3>
 <button 
 onClick={() => setShowReportModal(false)}
 className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors cursor-pointer"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
 
 <div className="p-5 bg-white">
 <p className="text-xs text-gray-600 mb-4">
 Help us protect the Pultanc community. Report stolen work, violations of terms, or creators not following community standards.
 </p>

 <div className="space-y-4">
 <textarea 
 value={reportDetails}
 onChange={(e) => setReportDetails(e.target.value)}
 placeholder="Provide details about the issue (e.g. stolen work, standards violation)..."
 className="w-full h-24 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-red-500 transition-colors resize-none shadow-2xs"
 />
 </div>

 <div className="pt-2 flex gap-3 mt-4">
 <button 
 onClick={() => setShowReportModal(false)}
 className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
 >
 Cancel
 </button>
 <button 
 onClick={submitReport}
 disabled={reportSubmitting}
 className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
 >
 {reportSubmitting ? (
 <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
 ) : (
 <>
 <Flag className="w-3.5 h-3.5 fill-current"/> Submit Report
 </>
 )}
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

  {/* Edit Climer Modal (Edit title, subtitle, price - but not video) */}
  <AnimatePresence>
    {editingFunnel && (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 pointer-events-auto"
        onClick={() => setEditingFunnel(null)}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 15 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-md rounded-3xl overflow-hidden border border-gray-200 shadow-2xl text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Edit3 className="w-3.5 h-3.5 text-amber-600"/>
              </div>
              Edit Climer Details
            </h3>
            <button 
              type="button"
              onClick={() => setEditingFunnel(null)}
              className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>
          
          <div className="p-5 space-y-4 text-left">
            {/* Notice that master video is preserved */}
            <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center gap-2 text-[11px] text-zinc-600">
              <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="leading-snug">
                The uploaded master video is preserved. You can adjust the paywall time, price, and titles below.
              </span>
            </div>

            {/* Paywall Lock Time */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Paywall Time (Seconds)
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Locks clip at this timestamp</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditLockTime(prev => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs shrink-0"
                  title="Decrease paywall lock time by 0.5s"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="relative flex-1">
                  <input 
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={editLockTime}
                    onChange={(e) => setEditLockTime(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    className="w-full bg-white border border-gray-200 focus:border-red-500 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-bold font-mono focus:outline-none transition-colors text-center"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 pointer-events-none">
                    sec
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditLockTime(prev => Number((prev + 0.5).toFixed(1)))}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs shrink-0"
                  title="Increase paywall lock time by 0.5s"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input 
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter Climer title..."
                className="w-full bg-white border border-gray-200 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-900 font-medium focus:outline-none transition-colors"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Subtitle / Description
              </label>
              <textarea 
                rows={2}
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                placeholder="Enter subtitle or teaser description..."
                className="w-full bg-white border border-gray-200 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-900 font-medium focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Unlock Price (GHS)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditPrice(prev => Math.max(0.5, Number((prev - 0.5).toFixed(2))))}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input 
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="w-full bg-white border border-gray-200 focus:border-red-500 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-bold font-mono focus:outline-none transition-colors text-center"
                />
                <button
                  type="button"
                  onClick={() => setEditPrice(prev => Number((prev + 0.5).toFixed(2)))}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                type="button"
                onClick={() => setEditingFunnel(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSavingEdit ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5"/>
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Delete Climer Confirmation Modal */}
  <AnimatePresence>
    {deletingFunnel && (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 pointer-events-auto"
        onClick={() => setDeletingFunnel(null)}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 15 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-sm rounded-3xl overflow-hidden border border-gray-200 shadow-2xl text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-600"/>
              </div>
              Delete Climer
            </h3>
            <button 
              type="button"
              onClick={() => setDeletingFunnel(null)}
              className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className="p-5 space-y-3 text-left">
            <p className="text-xs text-gray-700 leading-relaxed">
              Are you sure you want to delete <strong className="text-gray-950 font-bold font-mono">"{deletingFunnel.title}"</strong>?
            </p>
            <p className="text-[11px] text-red-600 leading-relaxed bg-red-50 p-2.5 rounded-xl border border-red-200">
              This will permanently remove this Climer link and paywall gate. Viewers will no longer be able to watch or unlock this climax scene.
            </p>

            <div className="pt-2 flex gap-3">
              <button 
                type="button"
                onClick={() => setDeletingFunnel(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteClimer(deletingFunnel.id)}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5"/>
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
 </div>
 );
}
