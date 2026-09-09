import React, { useState, useEffect, useRef } from 'react';
import { Bell, Settings, LayoutDashboard, Video, FileCheck, User, Wallet, Heart, Volume2, VolumeX, MessageCircle, Share2, Play, Lock, Unlock, CheckCircle2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Smartphone, X, RefreshCw, Send, Search, Bookmark, MoreHorizontal, Users, UserPlus, Plus, Flag, Eye, Star, Link2, Copy, Phone, CreditCard, AlertCircle, ShieldCheck, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LegalDrawer } from '../legal/LegalDrawer';
import { LEGAL_DOCS } from '../../data/legal';
import { mockSeries } from '../../data';
import { usePricing } from '../../usePricing';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc, updateDoc, increment, runTransaction, where, getDocs, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { savePendingPayment, showPaymentSuccessPopup } from '../../utils/paymentSession';
import { recordPaymentTransaction } from '../../utils/transactionRecorder';
import { triggerHaptic } from '../../utils/haptics';
import { DynamicProtectedWatermark, ScreenRecordingShield, useScreenRecordingProtection } from '../common/VideoProtection';
import { resolveVideoSource, isPlayableVideoUrl, getLocalVideoUrl } from '../../utils/localVideoCache';

// FeedPost Component handles individual series as a feed item
function FeedPost({ 
 series, 
 onToast, 
 onNavigateToProfile,
 onRequireAuth,
 onNavigateToTab,
 id,
 isActive
}: { 
 key?: React.Key;
 series: any, 
 onToast: (msg: string) => void,
 onNavigateToProfile?: (creator?: string) => void,
 onRequireAuth?: () => void,
 onNavigateToTab?: (tab: string) => void,
 id?: string,
 isActive?: boolean
}) {
 const { episodePrice, subscribePrice } = usePricing();
 const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
 const [direction, setDirection] = useState(0);
 const currentEpisode = series.episodes[currentEpisodeIndex];
 const nextEpisode = series.episodes[currentEpisodeIndex + 1];
 const currentEpisodePrice = currentEpisode?.price !== undefined 
 ? currentEpisode.price 
 : (currentEpisode?.priceGHS !== undefined ? currentEpisode.priceGHS : episodePrice);
 const nextEpisodePrice = nextEpisode?.price !== undefined 
 ? nextEpisode.price 
 : (nextEpisode?.priceGHS !== undefined ? nextEpisode.priceGHS : episodePrice);
 const [unlockedEpisodes, setUnlockedEpisodes] = useState<Set<string>>(new Set());
  const isCurrentlyLocked = (currentEpisode?.isLocked || currentEpisode?.isClimer) && !unlockedEpisodes.has(currentEpisode?.id || "");
  const hasPreview = (Number(currentEpisode?.lockTime) || 0) > 0 || (currentEpisode?.isClimer && currentEpisode?.lockTime !== 0);
  const isBlockedEntirely = isCurrentlyLocked && !hasPreview;
  const isCurrentClipLocked = isCurrentlyLocked;
  const targetEpisodeToUnlock = isCurrentClipLocked ? currentEpisode : (nextEpisode || currentEpisode);
  const targetEpisodeIndex = isCurrentClipLocked ? currentEpisodeIndex : (nextEpisode ? currentEpisodeIndex + 1 : currentEpisodeIndex);
  const targetEpisodePrice = targetEpisodeToUnlock?.price !== undefined 
    ? targetEpisodeToUnlock.price 
    : (targetEpisodeToUnlock?.priceGHS !== undefined ? targetEpisodeToUnlock.priceGHS : episodePrice);

 const [isSubscribed, setIsSubscribed] = useState(series.isSubscribed || false);
 const [showPaywall, setShowPaywall] = useState(false);
 const [localSupportsDelta, setLocalSupportsDelta] = useState(0);
 const [localSubscribesDelta, setLocalSubscribesDelta] = useState(0);
 const [localUnlocksDelta, setLocalUnlocksDelta] = useState(0);

 // Sync subscription state from Firestore in real-time
 useEffect(() => {
   if (!auth.currentUser?.uid || !series.creatorId) return;
   const subDocRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', series.creatorId);
   const unsub = onSnapshot(subDocRef, (snap) => {
     if (snap.exists() && snap.data()?.active !== false) {
       setIsSubscribed(true);
       if (Array.isArray(series.episodes)) {
         const allLocked = series.episodes.filter((e: any) => e.isLocked).map((e: any) => e.id);
         setUnlockedEpisodes(prev => new Set([...prev, ...allLocked]));
       }
     }
   }, (err) => console.warn(err));
   return () => unsub();
 }, [series.creatorId, series.episodes]);

 // Sync unlocked episodes from savedEpisodes in real-time
 useEffect(() => {
   if (!auth.currentUser?.uid || !series.id) return;
   const savedColRef = collection(db, 'users', auth.currentUser.uid, 'savedEpisodes');
   const unsub = onSnapshot(savedColRef, (snap) => {
     const unlockedIds: string[] = [];
     snap.forEach((docSnap) => {
       const data = docSnap.data();
       if (data.seriesId === series.id && data.episodeId) {
         unlockedIds.push(data.episodeId);
       } else if (docSnap.id.startsWith(`${series.id}_`)) {
         const epId = docSnap.id.replace(`${series.id}_`, '');
         if (epId) unlockedIds.push(epId);
       }
     });
     if (unlockedIds.length > 0) {
       setUnlockedEpisodes(prev => new Set([...prev, ...unlockedIds]));
     }
   }, (err) => console.warn(err));
   return () => unsub();
 }, [series.id]);

   const [loggedInUser, setLoggedInUser] = useState<{ name: string; handle: string; avatarUrl: string }>({
    name: auth.currentUser?.displayName || "Supporter",
    handle: auth.currentUser?.email ? `@${auth.currentUser.email.split("@")[0]}` : "@user",
    avatarUrl: auth.currentUser?.photoURL || ""
  });
  const [userBalance, setUserBalance] = useState<number>(0);

  useEffect(() => {
    if (auth.currentUser?.uid) {
      const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setUserBalance(Number(d.balance) || 0);
          setLoggedInUser({
            name: d.name || auth.currentUser?.displayName || "Supporter",
            handle: d.handle || (d.username ? `@${d.username}` : (auth.currentUser?.email ? `@${auth.currentUser.email.split("@")[0]}` : "@user")),
            avatarUrl: d.avatarUrl || d.photoURL || auth.currentUser?.photoURL || ""
          });
        } else {
          setUserBalance(0);
        }
      });
      return () => unsub();
    } else {
      setUserBalance(0);
    }
  }, []);

  const [showTipModal, setShowTipModal] = useState(false);
 const [tipAmount, setTipAmount] = useState<number | ''>('');
 const [isProcessingTip, setIsProcessingTip] = useState(false);
 const [tipSuccess, setTipSuccess] = useState(false);
 const [tipReference, setTipReference] = useState<string | null>(null);
 const [tipPaystackUrl, setTipPaystackUrl] = useState<string | null>(null);
 const [isCheckingTip, setIsCheckingTip] = useState(false);
 const [isProcessing, setIsProcessing] = useState(false);
 const [paystackReference, setPaystackReference] = useState<string | null>(null);
 const [unlockType, setUnlockType] = useState<'episode' | 'subscribe'>('episode');
 const [selectedSubTier, setSelectedSubTier] = useState<number>(15);
 const [isLiked, setIsLiked] = useState(false);
 const [isSaved, setIsSaved] = useState(false);
 const [videoError, setVideoError] = useState(false);
 const [isPaywallDismissed, setIsPaywallDismissed] = useState(false);
 const [unlockSuccess, setUnlockSuccess] = useState(false);
 
 const [currentTime, setCurrentTime] = useState(0);
 const [duration, setDuration] = useState(0);
 const [showSeekAnimation, setShowSeekAnimation] = useState<'forward' | 'backward' | null>(null);
 const lastTapRef = useRef<{time: number, x: number}>({time: 0, x: 0});
 
 const [isMuted, setIsMuted] = useState(false);
 const isOwner = !!auth.currentUser;

 const formatTime = (time: number) => {
 if (isNaN(time)) return '0:00';
 const minutes = Math.floor(time / 60);
 const seconds = Math.floor(time % 60);
 return `${minutes}:${seconds.toString().padStart(2, '0')}`;
 };

 const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
 e.stopPropagation();
 handleInteraction();

 if (videoRef.current) {
 const now = Date.now();
 const tapX = e.clientX;
 const lastTap = lastTapRef.current;
 
 if (now - lastTap.time < 300) {
 // Double tap detected
 const rect = e.currentTarget.getBoundingClientRect();
 const isLeft = tapX < rect.left + rect.width / 2;
 
 if (isLeft) {
 videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
 setShowSeekAnimation('backward');
 } else {
 let targetTime = videoRef.current.currentTime + 10;
 const isEpisodeLocked = (currentEpisode.isClimer || currentEpisode.isLocked) && !unlockedEpisodes.has(currentEpisode.id);
 const lockGate = Number(currentEpisode.lockTime) || (currentEpisode.isClimer ? 10 : 0);
 if (isEpisodeLocked && lockGate > 0 && targetTime >= lockGate) {
 targetTime = lockGate;
 videoRef.current.pause();
 setIsPlaying(false);
 setShowPaywall(true);
 onToast("Please complete the unlock transaction to continue watching!");
 }
 videoRef.current.currentTime = Math.min(videoRef.current.duration, targetTime);
 setShowSeekAnimation('forward');
 }
 
 setTimeout(() => setShowSeekAnimation(null), 500);
 lastTapRef.current = { time: 0, x: 0 };
 return;
 }
 
 lastTapRef.current = { time: now, x: tapX };

 // Block play click past gate if locked
 const isEpisodeLocked = (currentEpisode.isClimer || currentEpisode.isLocked) && !unlockedEpisodes.has(currentEpisode.id);
 const lockGate = Number(currentEpisode.lockTime) || (currentEpisode.isClimer ? 10 : 0);
 if (isEpisodeLocked && lockGate > 0 && videoRef.current.currentTime >= lockGate) {
 videoRef.current.pause();
 videoRef.current.currentTime = lockGate;
 setIsPlaying(false);
 setShowPaywall(true);
 onToast(currentEpisode.isClimer ? "Please unlock to watch the climax!" : "Please unlock to watch the rest of the clip!");
 return;
 }

 if (isPlaying) {
 videoRef.current.pause();
 setIsPlaying(false);
 if (watchParty?.active) {
 onToast('Paused for Watch Party');
 }
 } else {
 videoRef.current.play();
 setIsPlaying(true);
 if (watchParty?.active) {
 onToast('Playing for Watch Party');
 }
 }
 }
 };

 useEffect(() => {
 setVideoError(false);
 setIsPaywallDismissed(false);
 setUnlockSuccess(false);
 }, [currentEpisodeIndex, series.id]);

 // Real-time Bookmark Sync Listener
 useEffect(() => {
 let unsubscribe = () => {};
 let unsubscribeSub = () => {};
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user) {
 if (currentEpisode) {
 const savedDocRef = doc(db, 'users', user.uid, 'savedEpisodes', `${series.id}_${currentEpisode.id}`);
 unsubscribe = onSnapshot(savedDocRef, (snap) => {
 setIsSaved(snap.exists());
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `users/${user.uid}/savedEpisodes/${series.id}_${currentEpisode.id}`);
 });
 }
 if (series.creatorId) {
 const subRef = doc(db, 'users', user.uid, 'subscriptions', series.creatorId);
 unsubscribeSub = onSnapshot(subRef, (snap) => {
 setIsSubscribed(snap.exists());
 });
 }
 } else {
 setIsSaved(false);
 setIsSubscribed(false);
 }
 });

 return () => {
 unsubscribeAuth();
 unsubscribe();
 unsubscribeSub();
 };
 }, [currentEpisodeIndex, series.id, currentEpisode, series.creatorId]);

 // Real-time Views States and Logic - Reflect real Firestore view counts without fake seeding
 const [viewCount, setViewCount] = useState<number>(0);
 const [activeViewers, setActiveViewers] = useState<number>(0);

 // Exclude creator viewing their own climers and clips from counting as views
 const isCreatorViewingOwnContent = Boolean(
   // 1. Logged in user UID matches creator ID of series, episode, or funnel
   (auth.currentUser?.uid && (
     (series?.creatorId && series.creatorId === auth.currentUser.uid) ||
     (currentEpisode?.creatorId && currentEpisode.creatorId === auth.currentUser.uid) ||
     (series?.userId && series.userId === auth.currentUser.uid)
   )) ||
   // 2. Logged in user email matches creator email
   (auth.currentUser?.email && (
     (series?.creatorEmail && series.creatorEmail.toLowerCase() === auth.currentUser.email.toLowerCase()) ||
     (currentEpisode?.creatorEmail && currentEpisode.creatorEmail.toLowerCase() === auth.currentUser.email.toLowerCase())
   )) ||
   // 3. User handle/name matching creator handle/name
   (() => {
     const userHandles = [
       loggedInUser?.handle,
       loggedInUser?.username,
       auth.currentUser?.displayName,
       auth.currentUser?.email ? `@${auth.currentUser.email.split('@')[0]}` : ''
     ].filter(Boolean).map(h => (h || '').toLowerCase().replace(/^@/, '').trim());

     const contentHandles = [
       series?.creatorHandle,
       series?.creator,
       series?.creatorName,
       currentEpisode?.creatorHandle,
       currentEpisode?.creatorName
     ].filter(Boolean).map(h => (h || '').toLowerCase().replace(/^@/, '').trim());

     return userHandles.some(uh => uh && contentHandles.some(ch => ch && (ch === uh || ch.includes(uh) || uh.includes(ch))));
   })() ||
   // 4. Direct match between logged-in user handle and creator handle
   (loggedInUser?.handle && series?.creatorHandle && loggedInUser.handle.toLowerCase().replace(/^@/, '') === series.creatorHandle.toLowerCase().replace(/^@/, '')) ||
   (loggedInUser?.handle && currentEpisode?.creatorHandle && loggedInUser.handle.toLowerCase().replace(/^@/, '') === currentEpisode.creatorHandle.toLowerCase().replace(/^@/, ''))
 );

 const loggedViewsRef = useRef<Set<string>>(new Set());

 // Sync real-time view count for the active episode / series directly from Firestore
 useEffect(() => {
   if (!series?.id) return;

   // Initial view count directly from Firestore series / episode
   const initialViews = Number(currentEpisode?.views !== undefined ? currentEpisode.views : (series?.views !== undefined ? series.views : 0));
   setViewCount(initialViews);
   setActiveViewers(1);

   // Listen to real-time view count updates on the Firestore document
   const unsubFunnel = onSnapshot(doc(db, 'funnels', series.id), (snap) => {
     if (snap.exists()) {
       const d = snap.data();
       const liveViews = Number(d.views !== undefined ? d.views : (d.plays !== undefined ? d.plays : 0));
       setViewCount(liveViews);
     }
   }, () => {});

   let unsubClip: (() => void) | null = null;
   if (currentEpisode?.id && currentEpisode.id !== series.id) {
     unsubClip = onSnapshot(doc(db, 'clips', currentEpisode.id), (snap) => {
       if (snap.exists()) {
         const d = snap.data();
         const liveViews = Number(d.views !== undefined ? d.views : (d.plays !== undefined ? d.plays : 0));
         setViewCount(liveViews);
       }
     }, () => {});
   }

   return () => {
     unsubFunnel();
     if (unsubClip) unsubClip();
   };
 }, [series?.id, currentEpisode?.id, currentEpisode?.views, series?.views]);
 
 const [showWatchPartyInvite, setShowWatchPartyInvite] = useState(false);
 const [watchParty, setWatchParty] = useState<{ active: boolean; viewers: { name: string; avatar: string }[] } | null>(null);

 const [showComments, setShowComments] = useState(false);
 const [showCommentsModal, setShowCommentsModal] = useState(false);
 const [showShareModal, setShowShareModal] = useState(false);
 const [shareSearchQuery, setShareSearchQuery] = useState('');
 const [shareUsers, setShareUsers] = useState<any[]>([]);
 const [newComment, setNewComment] = useState('');
 const [showHud, setShowHud] = useState(true);

 // Safety & Report states
 const [showReportModal, setShowReportModal] = useState(false);
 const [reportReason, setReportReason] = useState('Inappropriate Content');
 const [reportDetails, setReportDetails] = useState('');
 const [reportSubmitting, setReportSubmitting] = useState(false);

 const submitReport = async () => {
 setReportSubmitting(true);
 try {
 const reporterId = auth.currentUser?.uid || `guest_${Math.random().toString(36).substring(2, 9)}`;
 const contentId = series.id;

 // 1. Check for Duplicate Reports if authenticated
 if (auth.currentUser?.uid) {
   const reportsRef = collection(db, 'reports');
   const q = query(reportsRef, where('reporterId', '==', reporterId), where('contentId', '==', contentId));
   const querySnapshot = await getDocs(q);
   
   if (!querySnapshot.empty) {
     onToast('You have already reported this content.');
     setShowReportModal(false);
     setReportSubmitting(false);
     return;
   }
 }
 
 const contentRef = doc(db, 'series', contentId);
 
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
 } else {
 // maybe it's a funnel
 const funnelRef = doc(db, 'funnels', contentId);
 const funnelDoc = await transaction.get(funnelRef);
 if(funnelDoc.exists()) {
 currentFlags = funnelDoc.data().flagCount || 0;
 const updateFunnelData: any = { flagCount: currentFlags + 1 };
 if (currentFlags + 1 >= 3) {
 updateFunnelData.status = 'under_review';
 }
 transaction.update(funnelRef, updateFunnelData);
 }
 }
 
 const newReportRef = doc(collection(db, 'reports'));
 transaction.set(newReportRef, {
 id: newReportRef.id,
 contentId: contentId,
 seriesTitle: series.title || series.name || 'Video Media',
 episodeTitle: currentEpisode?.title || (currentEpisode?.isClimer ? 'Climer' : `Clip ${currentEpisodeIndex + 1}`),
 episodeIndex: currentEpisodeIndex,
 creatorName: series.creator || series.creatorName || 'Creator',
 reporterId: reporterId,
 reason: reportReason || 'Inappropriate Content',
 details: reportDetails.trim(),
 timestamp: serverTimestamp()
 });
 });
 
 triggerHaptic('success');
 onToast('Thank you! Your report has been submitted to maintain platform safety.');
 setShowReportModal(false);
 setReportDetails('');
 } catch (error) {
 console.error("Error submitting report:", error);
 onToast('Failed to submit report. Please try again.');
 } finally {
 setReportSubmitting(false);
 }
 };

 const submitComment = async () => {
 if (!auth.currentUser) {
 if (onRequireAuth) onRequireAuth();
 return;
 }
 if (!newComment.trim()) return;
 const msg = newComment;
 setNewComment('');
 try {
 await addDoc(collection(db, 'streams', series.id, 'messages'), {
 userId: auth.currentUser?.uid || 'anon',
 userName: auth.currentUser?.displayName || 'User',
 text: msg,
 timestamp: serverTimestamp()
 });
 } catch (error) {
 handleFirestoreError(error, OperationType.CREATE, `streams/${series.id}/messages`);
 }
 };

 const [isPlaying, setIsPlaying] = useState(true);
 let hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 const lastWheelTimeRef = useRef<number>(0);

 const [comments, setComments] = useState<any[]>([]);

 useEffect(() => {
 // Listen to comments
 const q = query(
 collection(db, 'streams', series.id, 'messages'),
 orderBy('timestamp', 'asc'),
 limit(50)
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const newMessages = snapshot.docs.map(doc => ({
 id: doc.id,
 user: doc.data().userName || 'Anonymous',
 text: doc.data().text || '',
 time: 'Just now',
 likes: 0
 }));
 setComments(newMessages.length > 0 ? newMessages : [
 { id: 1, user: 'StreamFanatic99', text: 'Omo, I did not see that coming! 😱', time: '2m ago', likes: 45 },
 { id: 2, user: 'Kwasia_Ba', text: 'This landlord is too much chale.', time: '15m ago', likes: 120 }
 ]);
 }, (error) => {
 console.error(error);
 });

 return () => unsubscribe();
 }, [series.id]);

 const videoRef = useRef<HTMLVideoElement>(null);
 const { isRecordingBlocked, blockReason, videoProtectionProps } = useScreenRecordingProtection(videoRef);
 const containerRef = useRef<HTMLDivElement>(null);
 const lastSavedTimeRef = useRef<number>(0);


 const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>('');

 useEffect(() => {
   let isCurrent = true;
   const rawUrl = (currentEpisode?.videoUrl || '').trim();

   async function loadEpisodeSource() {
     const resolved = await resolveVideoSource(rawUrl, [
       currentEpisode?.id,
       currentEpisode?.slug,
       series?.id,
       series?.slug,
       currentEpisode?.title
     ]);
     if (isCurrent) {
       setResolvedVideoSrc(resolved || rawUrl);
       setVideoError(false);
     }
   }

   loadEpisodeSource();
   return () => {
     isCurrent = false;
   };
 }, [currentEpisode?.videoUrl, currentEpisode?.id, currentEpisode?.slug, series?.id]);

 const videoSrc = resolvedVideoSrc || (currentEpisode?.videoUrl?.trim() || '');

 const touchStartXRef = useRef<number | null>(null);
 const touchStartYRef = useRef<number | null>(null);

 const handleFeedTouchStart = (e: React.TouchEvent) => {
 handleInteraction();
 if (e.touches && e.touches.length > 0) {
 touchStartXRef.current = e.touches[0].clientX;
 touchStartYRef.current = e.touches[0].clientY;
 }
 };

 const handleFeedTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchXEnd = e.changedTouches[0].clientX;
    const touchYEnd = e.changedTouches[0].clientY;

    const deltaX = touchXEnd - touchStartXRef.current;
    const deltaY = touchYEnd - touchStartYRef.current;

    // Swipe Right: finger moved left to right (deltaX > 45) and horizontal movement is dominant -> Creator Page
    if (deltaX > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      triggerHaptic('swipe');
      if (onNavigateToProfile) {
        onNavigateToProfile(series.creatorId || series.creator || series.creatorName);
      }
    }
    // Swipe Left: finger moved right to left (deltaX < -45) and horizontal movement is dominant -> Discover or Profile
    else if (deltaX < -45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      triggerHaptic('swipe');
      if (onNavigateToProfile) {
        onNavigateToProfile(series.creatorId || series.creator || series.creatorName);
      } else if (onNavigateToTab) {
        onNavigateToTab('discover');
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleInteraction = () => {
 setShowHud(true);
 if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
 if (!showComments && !showPaywall && !isCurrentlyLocked) {
 hudTimeoutRef.current = setTimeout(() => {
 setShowHud(false);
 }, 3500);
 }
 };

 useEffect(() => {
 handleInteraction();
 return () => {
 if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
 };
 }, [currentEpisodeIndex, isCurrentlyLocked, showComments, showPaywall]);

 useEffect(() => {
 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting && isPlaying) {
 videoRef.current?.play().catch(() => {});
 } else {
 videoRef.current?.pause();
 }
 });
 },
 { threshold: 0.6 }
 );

 if (containerRef.current) {
 observer.observe(containerRef.current);
 }

 return () => observer.disconnect();
 }, [currentEpisodeIndex, isPlaying]);

 useEffect(() => {
 // When episode changes or unlocks, ensure we play if it's visible or as a fallback
 if (!isCurrentlyLocked && videoRef.current && isPlaying) {
 videoRef.current.play().catch(() => {});
 }
 }, [currentEpisodeIndex, isCurrentlyLocked, isPlaying]);

 // Record view only for authentic, non-creator viewers (anonymous preview/autoplay and creator self-views do not count)
 useEffect(() => {
   if (!isPlaying || !currentEpisode) return;
   const viewKey = `${series?.id}_${currentEpisode?.id}`;
   if (loggedViewsRef.current.has(viewKey)) return;

   // Only genuine authenticated other users count towards creator view analytics
   if (!auth.currentUser?.uid) {
     return;
   }

   // A creator account viewing his or her own climers and clips do not count as views
   if (isCreatorViewingOwnContent) {
     return;
   }

   // Only record view when non-creator viewer has watched at least 3 seconds
   if (currentTime < 3) {
     return;
   }

   loggedViewsRef.current.add(viewKey);

   try {
     if (series?.id) {
       updateDoc(doc(db, 'funnels', series.id), { views: increment(1), visits: increment(1) }).catch(() => {});
       updateDoc(doc(db, 'series', series.id), { views: increment(1), plays: increment(1) }).catch(() => {});
     }
     if (currentEpisode?.id && currentEpisode.id !== series.id) {
       updateDoc(doc(db, 'clips', currentEpisode.id), { views: increment(1), plays: increment(1) }).catch(() => {});
     }
   } catch (err) {
     console.warn("Could not record content view:", err);
   }
 }, [isPlaying, currentEpisode?.id, series?.id, isCreatorViewingOwnContent, currentTime]);

 const handleLike = () => {
 if (!auth.currentUser) {
 if (onRequireAuth) onRequireAuth();
 return;
 }
 setIsLiked(!isLiked);
 };
 
 const handleSave = async () => {
  if (!auth.currentUser) {
   if (onRequireAuth) onRequireAuth();
   return;
  }
  if (!currentEpisode) return;
  triggerHaptic('medium');
  const savedDocRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', `${series.id}_${currentEpisode.id}`);
  try {
   if (isSaved) {
    await deleteDoc(savedDocRef);
    onToast('Removed from Saves');
    toast.success('Removed from Saves');
   } else {
    await setDoc(savedDocRef, {
     id: `${series.id}_${currentEpisode.id}`,
     episodeId: currentEpisode.id,
     episodeTitle: currentEpisode.title,
     climerTitle: currentEpisode.isClimer ? currentEpisode.title : null,
     clipTitle: currentEpisode.isClimer ? null : currentEpisode.title,
     title: currentEpisode.title,
     type: currentEpisode.isClimer ? 'climer' : 'clip',
     seriesId: series.id,
     seriesTitle: series.name || series.title || (currentEpisode.isClimer ? 'Climer' : 'Series'),
     creatorName: series.creatorName || (series.creator ? series.creator : 'Creator'),
     creatorHandle: series.creatorHandle || (series.creator ? `@${series.creator}` : '@creator'),
     creatorAvatar: series.creatorAvatar || '',
     videoUrl: currentEpisode.videoUrl,
     thumbnail: currentEpisode.thumbnail || series.thumbnail || series.thumbnailUrl || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=400',
     savedAt: serverTimestamp(),
     isClimer: !!currentEpisode.isClimer,
     price: Number(currentEpisodePrice) || 0,
     lockTime: Number(currentEpisode.lockTime) || 0,
     slug: currentEpisode.slug || series.id,
     collectionId: null
    });
    onToast(currentEpisode.isClimer ? 'Climer saved to Saves' : 'Clip saved to Saves');
    toast.success(currentEpisode.isClimer ? 'Climer saved to Saves' : 'Clip saved to Saves', {
     action: onNavigateToTab ? {
      label: 'View Saves',
      onClick: () => onNavigateToTab('profile')
     } : undefined
    });
   }
  } catch (err: any) {
   console.error("Error setting/deleting bookmark status:", err);
   onToast("Could not complete bookmark operation.");
  }
 };

 const handleNext = () => {
 if (currentEpisodeIndex < series.episodes.length - 1) {
 setDirection(1);
 setCurrentEpisodeIndex(prev => prev + 1);
 }
 };

 const handlePrev = () => {
 if (currentEpisodeIndex > 0) {
 setDirection(-1);
 setCurrentEpisodeIndex(prev => prev - 1);
 }
 };

 // Keyboard navigation for shifting clips/episodes with ArrowLeft and ArrowRight
 useEffect(() => {
   if (!isActive) return;
   const handleClipKeyDown = (e: KeyboardEvent) => {
     const activeEl = document.activeElement;
     if (
       activeEl && 
       (activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable)
     ) {
       return;
     }

     if (e.key === 'ArrowLeft') {
       if (currentEpisodeIndex > 0) {
         e.preventDefault();
         triggerHaptic('swipe');
         handlePrev();
       }
     } else if (e.key === 'ArrowRight') {
       if (currentEpisodeIndex < series.episodes.length - 1) {
         e.preventDefault();
         if (isCurrentlyLocked) {
           setShowPaywall(true);
         } else {
           triggerHaptic('swipe');
           handleNext();
         }
       }
     }
   };

   window.addEventListener('keydown', handleClipKeyDown);
   return () => window.removeEventListener('keydown', handleClipKeyDown);
 }, [isActive, currentEpisodeIndex, series.episodes?.length, isCurrentlyLocked]);

 const handleManualVerify = async (refInput?: string, typeOverride?: 'episode' | 'subscribe') => {
 const ref = refInput || paystackReference;
 const currentUnlockType = typeOverride || unlockType;
 if (!ref) return;
 try {
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (err) {
 console.warn("Verification error:", err);
 }
 
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 setIsProcessing(false);
 setPaystackReference(null);
 setUnlockSuccess(true);
 
 let pricePaid = 0;
 if (currentUnlockType === 'episode') {
 pricePaid = targetEpisodePrice;
 setLocalUnlocksDelta(d => d + 1);
 if (currentEpisode.isClimer) {
 const funnelDocRef = doc(db, 'funnels', series.id);
 updateDoc(funnelDocRef, {
 unlocks: increment(1),
 revenue: increment(pricePaid)
 }).catch(err => console.warn("Firestore count update error:", err));
 }
 } else {
 if (currentUnlockType === 'subscribe') {
 pricePaid = (series?.subscribePrice || series?.creatorSubscribePrice || subscribePrice || 15.00);
 setLocalSubscribesDelta(d => d + 1);
 }
 }

 // Add 70% earnings to creator and record payment transaction
 if (series.creatorId && pricePaid > 0) {
 recordPaymentTransaction({
 reference: ref,
 recipientId: series.creatorId,
 recipientName: series.creatorName || '@creator',
 amount: pricePaid,
 type: currentUnlockType,
 title: currentUnlockType === 'subscribe' ? `Subscription to ${series.creatorName || 'Creator'}` : (currentEpisode?.isClimer ? `Unlocked Climer: ${currentEpisode.title || 'Climer'}` : `Unlocked Clip: ${currentEpisode.title || 'Premium Episode'}`),
 seriesId: series.id,
 funnelId: series.id,
 contentId: currentEpisode?.id
 }).catch(err => console.warn("Failed to record transaction:", err));
 }

 // Auto-save the unlocked climer/clip to user's saved items
 if (auth.currentUser && currentUnlockType === 'episode') {
 const savedDocRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', `${series.id}_${currentEpisode.id}`);
 setDoc(savedDocRef, {
 id: `${series.id}_${currentEpisode.id}`,
 seriesId: series.id,
 episodeId: currentEpisode.id,
 climerTitle: currentEpisode?.isClimer ? currentEpisode.title : null,
 clipTitle: currentEpisode?.isClimer ? null : currentEpisode.title,
 title: currentEpisode.title,
 type: currentEpisode?.isClimer ? 'climer' : 'clip',
 isClimer: !!currentEpisode?.isClimer,
 creatorName: series.creatorName || '@creator',
 thumbnail: currentEpisode.thumbnail || series.thumbnail,
 savedAt: Date.now(),
 isAutoSavedPaid: true
 }).catch(err => console.warn('Failed to auto-save paid item:', err));
 }

 showPaymentSuccessPopup({
   amount: pricePaid,
   currency: 'GHS',
   recipientName: series?.creatorName || 'Creator',
   paymentFor: currentUnlockType === 'subscribe' ? `Subscription to ${series?.creatorName || 'Creator'}` : (currentEpisode?.isClimer ? `Climer Unlock: ${currentEpisode?.title || 'Climer'}` : `Episode Unlock: ${currentEpisode?.title || 'Clip'}`),
   reference: ref,
   tab: 'consumer',
   type: currentUnlockType
 });

 setTimeout(() => {
 if (currentUnlockType === 'episode') {
 setUnlockedEpisodes(prev => {
 const nextSet = new Set(prev);
 nextSet.add(currentEpisode.id);
 if (nextEpisode) {
 nextSet.add(nextEpisode.id);
 }
 return nextSet;
 });
 onToast(currentEpisode?.isClimer ? 'Climax unlocked successfully!' : 'Clip unlocked successfully!');
 } else {
 if (currentUnlockType === 'subscribe') {
 setIsSubscribed(true);
 if (auth.currentUser && series.creatorId) {
 const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', series.creatorId);
 setDoc(subRef, {
 creatorId: series.creatorId,
 subscribedAt: Date.now(),
 amountPaid: (series?.subscribePrice || series?.creatorSubscribePrice || subscribePrice || 15.00)
 }).catch(err => console.warn('Failed to save subscription:', err));
 }
 }
 const allLocked = series.episodes.filter((e: any) => e.isLocked).map((e: any) => e.id);
 setUnlockedEpisodes(prev => new Set([...prev, ...allLocked]));
 onToast('Subscribed successfully! All content unlocked.');
 }
 setShowPaywall(false);
 setUnlockSuccess(false);

 // Resume playing the rest of the video immediately after unlock
 setTimeout(() => {
 if (videoRef.current) {
 videoRef.current.play().catch(e => console.warn("Auto-play error post unlock:", e));
 setIsPlaying(true);
 }
 }, 150);
 }, 1500);

 return true;
 }
 if (!refInput) {
 onToast('Payment is not completed yet. Please pay in the opened checkout tab.');
 }
 return false;
 } catch (e) {
 console.error('Manual verification error:', e);
 if (!refInput) {
 onToast('Verification check failed. Please try again.');
 }
 return false;
 }
 };

 
 const handleTipSubmit = async () => {
 if (series?.status === 'under_review' || series?.status === 'banned') {
 onToast("This content is currently under review and cannot receive payments.");
 return;
 }
 if (!tipAmount || Number(tipAmount) <= 0) return;
 setIsProcessingTip(true);
 let paymentWindow: Window | null = null;
 try {
   paymentWindow = window.open("about:blank", "_blank");
 } catch (e) {
   console.warn("Popup blocked, fallback to redirect", e);
 }
 try {
   const userEmail = (auth.currentUser?.email && auth.currentUser.email.includes('@'))
     ? auth.currentUser.email
     : `supporter_${auth.currentUser?.uid || Date.now()}@pultanc.com`;

	const targetCreatorId = series?.creatorId || series?.creatorHandle || 'creator';
	const response = await fetch('/api/paystack/initialize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: userEmail,
			transaction_type: 'support',
			creator_id: targetCreatorId,
			user_id: auth.currentUser?.uid || '',
			content_id: series?.id || '',
			amount: Number(tipAmount),
			support_amount: Number(tipAmount),
			callback_url: `${window.location.origin}/?tab=consumer`,
			currency: 'GHS',
			metadata: {
				transaction_type: 'support',
				creator_id: targetCreatorId,
				user_id: auth.currentUser?.uid || '',
				content_id: series?.id || '',
				seriesId: series?.id,
				recipientName: series?.creatorName || 'Creator'
			}
		})
	});

 const data = await response.json();
 if (data.status && data.data?.authorization_url) {
 setTipReference(data.data.reference);
 setTipPaystackUrl(data.data.authorization_url);
 savePendingPayment({
 reference: data.data.reference,
 tab: 'consumer',
 type: 'tip',
 seriesId: series?.id,
 creatorId: series?.creatorId || series?.creatorHandle || 'creator',
 recipientName: series?.creatorName || 'Creator',
 title: `Support to ${series?.creatorName || 'Creator'}`,
 amount: Number(tipAmount)
 });
   let navigated = false;
   if (paymentWindow && !paymentWindow.closed) {
     try {
       paymentWindow.location.href = data.data.authorization_url;
       navigated = true;
     } catch (e) {
       console.warn("Popup navigation error:", e);
     }
   }
   if (!navigated) {
     window.location.href = data.data.authorization_url;
   }

   const pollInterval = setInterval(async () => {
     try {
       const isVerified = await handleManualTipVerify(data.data.reference);
       if (isVerified) {
         clearInterval(pollInterval);
       }
     } catch (e) {
       console.error('Polling tip error:', e);
     }
   }, 1200);

   setTimeout(() => {
     clearInterval(pollInterval);
   }, 5 * 60 * 1000);
 } else {
   if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
 onToast('Payment initialization failed. Please try again.');
 setIsProcessingTip(false);
 }
 } catch (error) {
 console.error('Payment Error:', error);
   if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
 onToast('An error occurred during payment.');
 setIsProcessingTip(false);
 }
 };

 const handleManualTipVerify = async (refInput?: string) => {
 const activeRef = refInput || tipReference;
 if (!activeRef) return false;
 setIsCheckingTip(true);
 try {
 let data: any = null;
 try {
 const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(activeRef)}`);
 if (response.ok) {
 data = await response.json();
 }
 } catch (err) {
 console.warn("Tip verification fetch error:", err);
 }
 
 if (data && data.status && data.data?.status === 'success') {
 setIsCheckingTip(false);
 setTipSuccess(true);
 setIsLiked(true);
 setLocalSupportsDelta(d => d + 1);
 onToast('Support sent successfully!');

 showPaymentSuccessPopup({
   amount: Number(tipAmount),
   currency: 'GHS',
   recipientName: series?.creatorName || 'Creator',
   paymentFor: `Support to ${series?.creatorName || 'Creator'}`,
   reference: activeRef || 'PUL-TIP',
   tab: 'consumer',
   type: 'tip'
 });

 const creatorId = series?.creatorId || series?.creatorHandle || 'creator';
 if (creatorId && tipAmount) {
 recordPaymentTransaction({
 reference: activeRef || `TIP_${Date.now()}`,
 recipientId: creatorId,
 recipientName: series?.creatorName || 'Creator',
 amount: Number(tipAmount),
 type: 'tip',
 title: `Support to ${series?.creatorName || 'Creator'}`
 }).catch(err => console.warn("Failed to record tip transaction:", err));
 }
 
 setTimeout(() => {
 setShowTipModal(false);
 setTipSuccess(false);
 setTipAmount('');
 setTipReference(null);
 setTipPaystackUrl(null);
 setIsProcessingTip(false);
 }, 2000);
 return true;
 } else {
 setIsCheckingTip(false);
 if (!refInput) {
   onToast('Payment not yet successful. Please complete checkout in Paystack.');
 }
 return false;
 }
 } catch (error) {
 console.error('Verification error:', error);
 setIsCheckingTip(false);
 if (!refInput) {
   onToast('Error verifying payment.');
 }
 return false;
 }
 };

 const handleUnlock = async (type: 'episode' | 'subscribe') => {
  if (series?.status === 'under_review' || series?.status === 'banned') {
    onToast("This content is currently under review and cannot receive payments.");
    return;
  }
  setUnlockType(type);
  setIsProcessing(true);
  setShowPaywall(true);

  let paymentWindow: Window | null = null;
  try {
    paymentWindow = window.open("about:blank", "_blank");
  } catch (err) {
    console.warn("Popup blocked, fallback to redirect", err);
  }

  const targetEp = isCurrentClipLocked ? currentEpisode : (nextEpisode || currentEpisode);

  let amountGHS = 0;
  if (type === 'episode') {
    amountGHS = targetEpisodePrice;
  } else if (type === 'subscribe') {
    amountGHS = [5, 15, 50].includes(selectedSubTier) ? selectedSubTier : (series?.subscribePrice || series?.creatorSubscribePrice || subscribePrice || 15.00);
  }

  try {
    const isSub = type === 'subscribe';
    const targetCreatorId = series?.creatorId || series?.creatorHandle || 'creator';
    const targetContentId = targetEp?.id || currentEpisode?.id || series?.id || '';
    const response = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: auth.currentUser?.email || 'user@example.com',
        transaction_type: isSub ? 'subscribe' : 'unlock',
        creator_id: targetCreatorId,
        user_id: auth.currentUser?.uid || '',
        content_id: targetContentId,
        price: amountGHS,
        subscribePrice: amountGHS,
        amount: amountGHS,
        callback_url: `${window.location.origin}/?tab=consumer`,
        currency: 'GHS',
        metadata: {
          transaction_type: isSub ? 'subscribe' : 'unlock',
          creator_id: targetCreatorId,
          user_id: auth.currentUser?.uid || '',
          content_id: targetContentId,
          price: amountGHS,
          subscribePrice: amountGHS,
          amount: amountGHS,
          seriesId: series?.id,
          episodeId: targetEp?.id || currentEpisode?.id,
          recipientName: series?.creatorName || 'Creator'
        }
      })
    });

    const data = await response.json();
    
    if (data.status && data.data?.authorization_url) {
      const reference = data.data.reference;
      setPaystackReference(reference);
      savePendingPayment({
        reference,
        tab: 'consumer',
        type,
        seriesId: series?.id,
        episodeId: targetEp?.id || currentEpisode?.id,
        creatorId: series?.creatorId || series?.creatorHandle || 'creator',
        recipientName: series?.creatorName || 'Creator',
        title: type === 'subscribe' ? `Subscription to ${series?.creatorName || 'Creator'}` : (targetEp?.isClimer ? `Climer Unlock: ${targetEp?.title || 'Climer'}` : `Episode Unlock: ${targetEp?.title || 'Clip'}`),
        amount: amountGHS
      });

      let navigated = false;
      if (paymentWindow && !paymentWindow.closed) {
        try {
          paymentWindow.location.href = data.data.authorization_url;
          navigated = true;
        } catch (e) {
          console.warn("Popup location navigation blocked:", e);
        }
      }
      if (!navigated) {
        window.location.href = data.data.authorization_url;
      }

      // Start polling for payment success (ultra-fast 1200ms checks)
      const pollInterval = setInterval(async () => {
        try {
          const isVerified = await handleManualVerify(reference, type);
          if (isVerified) {
            clearInterval(pollInterval);
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 1200);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isProcessing) {
          setIsProcessing(false);
          setPaystackReference(null);
        }
      }, 5 * 60 * 1000);
    } else {
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
      throw new Error(data.error || 'Failed to initialize payment');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
    onToast(error instanceof Error ? error.message : 'Payment failed to initialize.');
    setIsProcessing(false);
  }
};

  return (
 <div 
   ref={containerRef} 
   id={id}
   className="w-full h-[100dvh] snap-start relative bg-black group overflow-hidden" 
   onClick={handleInteraction} 
   onTouchStart={handleFeedTouchStart} 
   onTouchEnd={handleFeedTouchEnd}
   onContextMenu={(e) => {
     e.preventDefault();
     e.stopPropagation();
     triggerHaptic('medium');
     setShowReportModal(true);
   }}
 >
 
 {/* Real-time View Count (Top Right Overlay) */}
 <div className={`absolute top-12 right-4 z-30 transition-all duration-300 flex flex-col items-end gap-1 pointer-events-none select-none ${showHud ? 'opacity-100 scale-100' : 'opacity-0 scale-95 animate-out'}`}>
 <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5">
 <Eye className="w-3.5 h-3.5 text-red-400 fill-red-400/20"/>
 <span className="text-[10.5px] font-bold font-mono text-white">
 {viewCount.toLocaleString()} <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider ml-0.5">Views</span>
 </span>
 </div>
 </div>
 
 
 {/* Top Left Overlay: Profile & Info */}
 <div className={`absolute top-10 sm:top-6 left-4 z-30 transition-all duration-300 pointer-events-none ${showHud ? 'opacity-100' : 'opacity-0'}`}>
 <div className="flex items-center gap-1.5 pointer-events-auto">
 <button 
 onClick={() => {
 triggerHaptic('light');
 if (onNavigateToProfile) onNavigateToProfile(series.creatorId || series.creatorHandle || series.creator || series.creatorName);
 }} 
 className="relative group hover:opacity-85 transition-transform active:scale-95 shrink-0 cursor-pointer"
 >
 {series.creatorAvatar ? (
 <img 
 src={series.creatorAvatar} 
 alt={series.creatorName || series.creator} 
 className="w-10 h-10 rounded-full object-cover border-2 border-white/50 shadow-md"
 />
 ) : (
 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-900 p-[2px] shadow-md">
 <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
 <span className="font-bold text-white text-base">{(series.creator || series.creatorName || 'C').charAt(0).toUpperCase()}</span>
 </div>
 </div>
 )}
 </button>
 <button 
 onClick={() => {
 triggerHaptic('light');
 if (onNavigateToProfile) onNavigateToProfile(series.creatorId || series.creatorHandle || series.creator || series.creatorName);
 }} 
 className="flex items-center gap-1.5 hover:opacity-85 transition-transform active:scale-95 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 cursor-pointer"
 >
 <span className="text-xs font-bold text-white tracking-tight">
 {series.creatorHandle ? (series.creatorHandle.startsWith('@') ? series.creatorHandle : `@${series.creatorHandle}`) : `@${series.creator || 'creator'}`}
 </span>
 {series.creatorVerified && (
 <ShieldCheck className="w-3.5 h-3.5 fill-[#ff0514] text-white shrink-0"/>
 )}
 </button>
 </div>
 </div>

 {/* Video Container */}
 <div className="absolute inset-0 w-full h-full flex items-center justify-center">
 <AnimatePresence mode="popLayout" initial={false} custom={direction}>
 <motion.div
 key={currentEpisode.id}
 custom={direction}
 initial={(d: number) => ({ opacity: 0, x: d > 0 ? 100 : -100, scale: 0.96 })}
 animate={{ opacity: 1, x: 0, scale: 1 }}
 exit={(d: number) => ({ opacity: 0, x: d > 0 ? -100 : 100, scale: 0.96 })}
 transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.8 }}
 className="absolute inset-0"
 drag="x"
 dragConstraints={{ left: 0, right: 0 }}
 dragElastic={0.8}
 onDragEnd={(e, { offset, velocity }) => {
 const swipe = offset.x;
 if (swipe < -45) {
 if (currentEpisodeIndex < series.episodes.length - 1 && !isCurrentlyLocked) {
 triggerHaptic('swipe');
 handleNext();
 }
 } else if (swipe > 45) {
 if (currentEpisodeIndex > 0) {
 triggerHaptic('swipe');
 handlePrev();
 }
 }
 }}
 >
 {!isBlockedEntirely ? (
 <>
 <video 
 ref={videoRef}
 src={videoSrc}
 className="absolute inset-0 w-full h-full object-cover cursor-pointer"
 loop={currentEpisodeIndex === series.episodes.length - 1}
 controlsList="nodownload nofullscreen noplaybackrate"
 disablePictureInPicture
 muted={isMuted}
 playsInline
 {...videoProtectionProps}
 onLoadedMetadata={(e) => {
   setDuration(e.currentTarget.duration);
   setVideoError(false);
 }}
 onError={async () => {
   console.warn("Video playback load error for episode:", currentEpisode?.id);
   if (resolvedVideoSrc && !resolvedVideoSrc.startsWith('blob:')) {
     const cached = await getLocalVideoUrl(currentEpisode?.id || series.id);
     if (cached) {
       setResolvedVideoSrc(cached);
       setVideoError(false);
       return;
     }
   }
   setVideoError(true);
 }}
 onTimeUpdate={(e) => {
 const video = e.currentTarget;
 if (!video.duration) return;
 
 setCurrentTime(video.currentTime);

 // Enforce lockTime gate for both locked Climers and locked Clips
 const isEpisodeLocked = (currentEpisode.isClimer || currentEpisode.isLocked) && !unlockedEpisodes.has(currentEpisode.id);
 const lockGate = Number(currentEpisode.lockTime) || (currentEpisode.isClimer ? 10 : 0);
 if (isEpisodeLocked && lockGate > 0) {
 if (video.currentTime >= lockGate) {
 video.pause();
 video.currentTime = lockGate;
 setIsPlaying(false);
 setShowPaywall(true);
 }
 }

 const progress = (video.currentTime / video.duration) * 100;
 if (!auth.currentUser || video.currentTime < 5) return;
 
 // Throttle updates to every 5 seconds of watch time
 if (video.currentTime - lastSavedTimeRef.current >= 5) {
 lastSavedTimeRef.current = video.currentTime;
 try {
 setDoc(doc(db, 'users', auth.currentUser.uid, 'watchHistory', series.id), {
 seriesId: series.id,
 seriesTitle: series.title || series.name,
 episodeTitle: currentEpisode.title,
 progress: Math.round(progress),
 thumbnailUrl: series.thumbnailUrl || 'https://images.unsplash.com/photo-1543807535-eceef0bc6504?auto=format&fit=crop&q=80&w=400',
 updatedAt: serverTimestamp()
 }, { merge: true });
 } catch (err) {}
 }
 }}
 onClick={handleVideoClick}
 onEnded={() => {
 if (!isCurrentlyLocked) {
 handleNext();
 }
 }}
 />

 {/* Dynamic Anti-Piracy Watermark with Viewer ID */}
 <DynamicProtectedWatermark 
   creatorHandle={currentEpisode?.creatorHandle || series?.creatorHandle || series?.creator || '@creator'} 
 />

 {/* Screen Recording Blackout Shield */}
 <ScreenRecordingShield 
   isBlocked={isRecordingBlocked} 
   reason={blockReason} 
   creatorHandle={currentEpisode?.creatorHandle || series?.creatorHandle || series?.creator || '@creator'} 
 />
 {!isPlaying && (
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
 <div className="w-16 h-16 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center pl-1 text-white border border-white/20">
 <Play className="w-6 h-6 fill-current"/>
 </div>
 </div>
 )}

 {/* Seek Animation Overlay */}
 <AnimatePresence>
 {showSeekAnimation && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0 }}
 className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center pointer-events-none z-10 bg-white/5 backdrop-blur-[2px] ${showSeekAnimation === 'forward' ? 'right-0 rounded-l-[100%]' : 'left-0 rounded-r-[100%]'}`}
 >
 <div className="flex flex-col items-center gap-1 text-white">
 <div className="flex items-center gap-1">
 {showSeekAnimation === 'backward' && <Play className="w-6 h-6 fill-current rotate-180" />}
 <span className="font-bold text-xl">10s</span>
 {showSeekAnimation === 'forward' && <Play className="w-6 h-6 fill-current" />}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Progress Bar */}
 {duration > 0 && (
 <div className="absolute bottom-[80px] left-0 right-0 h-1 bg-white/30 z-30">
 <div 
 className="h-full bg-red-500 transition-all duration-100" 
 style={{ width: `${(currentTime / duration) * 100}%` }} 
 />
 </div>
 )}

 {/* Time Display */}
 {duration > 0 && (
 <div className="absolute bottom-[82px] left-2 z-30 pointer-events-none">
 <div className="text-[8px] font-medium text-white/90 drop-shadow-md">
 {formatTime(currentTime)} / {formatTime(duration)}
 </div>
 </div>
 )}
 </>
 ) : (
 <div className="absolute inset-0 bg-gray-900 cursor-pointer"onClick={(e) => { e.stopPropagation(); handleInteraction(); }}>
 <img src={series.thumbnailUrl ||"https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=800&q=80"} className="absolute inset-0 w-full h-full object-cover opacity-20"alt="Locked video background"/>
 </div>
 )}
 
 {((isBlockedEntirely || (((currentEpisode.isClimer || currentEpisode.isLocked) && !unlockedEpisodes.has(currentEpisode.id)) && showPaywall)) && !isPaywallDismissed) && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isProcessing && !unlockSuccess) {
                    setUnlockType('episode');
                    setShowPaywall(true);
                  }
                }}
                className="absolute inset-0 backdrop-blur-xl bg-black/60 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-[35] cursor-pointer"
              >
                {!isProcessing && !unlockSuccess && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPaywallDismissed(true);
                    }}
                    className="absolute top-[60px] right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md border border-white/15 z-50 transition-all pointer-events-auto cursor-pointer shadow-lg"
                    title="Dismiss paywall"
                  >
                    <X className="w-5 h-5"/>
                  </button>
                )}

                {/* Glassmorphic Central Card Container - Compact for clips, full for climers */}
                <div className={`w-full ${currentEpisode?.isClimer ? 'max-w-[290px] p-4.5 rounded-3xl' : 'max-w-[205px] p-2.5 rounded-2xl'} bg-white/[0.07] backdrop-blur-2xl border border-white/20 shadow-2xl flex flex-col items-center pointer-events-auto relative overflow-hidden`}>
                  {/* Subtle Background Glow Accent - Warm Orange */}
                  <div className="absolute -top-16 -left-16 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />

                  {/* Creator Profile & Verification Badge Pill */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      if (onNavigateToProfile) onNavigateToProfile(series.creatorHandle || series.creatorId || series.creator || series.creatorName);
                    }}
                    className={`flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md ${currentEpisode?.isClimer ? 'px-3 py-1.5 mb-2.5' : 'px-2 py-0.5 mb-1'} rounded-full border border-white/20 shadow-sm transition-all cursor-pointer group`}
                    title="View creator profile"
                  >
                    {series.creatorAvatar ? (
                      <img 
                        src={series.creatorAvatar} 
                        alt={series.creatorName || series.creator} 
                        className={`${currentEpisode?.isClimer ? 'w-5 h-5' : 'w-4 h-4'} rounded-full object-cover border border-white/40 shrink-0 group-hover:scale-105 transition-transform`}
                      />
                    ) : (
                      <div className={`${currentEpisode?.isClimer ? 'w-5 h-5 text-[10px]' : 'w-4 h-4 text-[8.5px]'} rounded-full bg-white text-black font-bold flex items-center justify-center border border-white/40 shrink-0`}>
                        {(series.creator || 'C').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1">
                        <span className={`${currentEpisode?.isClimer ? 'text-xs' : 'text-[9.5px]'} font-bold text-white leading-none group-hover:text-orange-300 transition-colors`}>
                          {series.creatorName || series.creator}
                        </span>
                        {series.creatorVerified && (
                          <ShieldCheck className={`${currentEpisode?.isClimer ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill-orange-500 text-white shrink-0`} />
                        )}
                      </div>
                      <span className={`${currentEpisode?.isClimer ? 'text-[9px]' : 'text-[8px]'} text-gray-300 font-mono leading-none mt-0.5`}>
                        {series.creatorHandle?.startsWith('@') ? series.creatorHandle : `@${series.creator || 'creator'}`}
                      </span>
                    </div>
                  </button>

                  {/* Lock Indicator Icon - Orange theme */}
                  <div className={`${currentEpisode?.isClimer ? 'w-10 h-10 rounded-2xl mb-2' : 'w-7 h-7 rounded-xl mb-1'} flex items-center justify-center transition-transform ${unlockSuccess ? 'bg-orange-500 scale-110' : 'bg-orange-500/20 border border-orange-500/40 shadow-inner'} ${isProcessing ? 'animate-pulse' : ''}`}>
                    {isProcessing && unlockType === 'episode' ? (
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 1, ease:"linear"}} 
                        className={`${currentEpisode?.isClimer ? 'w-4 h-4' : 'w-3.5 h-3.5'} border-2 border-white/20 border-t-orange-500 rounded-full`}
                      />
                    ) : unlockSuccess ? (
                      <CheckCircle2 className={`${currentEpisode?.isClimer ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} text-black`}/>
                    ) : (
                      <Lock className={`${currentEpisode?.isClimer ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} text-orange-400`}/>
                    )}
                  </div>

                  <h3 className={`${currentEpisode?.isClimer ? 'text-sm mb-1' : 'text-[11px] mb-0.5'} font-extrabold text-white tracking-tight`}>
                    {unlockSuccess ? 'Successfully Unlocked!' : (currentEpisode?.isClimer ? 'Climer Locked' : 'Clip Locked')}
                  </h3>

                  {/* Orange lock price badge */}
                  {!unlockSuccess && (
                    <div className={`inline-flex items-center gap-1 font-bold font-mono ${currentEpisode?.isClimer ? 'text-[9px] px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 mb-1.5' : 'text-[7px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 mb-1'} rounded-full shadow-sm`}>
                      <span>🔒 {currentEpisode?.isClimer ? `GHS ${currentEpisodePrice.toFixed(2)}` : '1 Cedi (GHS 1.00)'}</span>
                    </div>
                  )}

                  <p className={`text-zinc-300 ${currentEpisode?.isClimer ? 'mb-2.5 text-[10.5px] max-w-[230px] leading-relaxed' : 'mb-1 text-[8.5px] max-w-[165px] leading-tight'}`}>
                    {unlockSuccess ? (
                      <span className="text-orange-400 font-medium">Payment complete. Playing video...</span>
                    ) : isProcessing && unlockType === 'episode' ? (
                      <span className="text-orange-400 font-medium animate-pulse">Initiating MoMo checkout...</span>
                    ) : (
                      currentEpisode?.isClimer 
                        ? `Unlock full climer for ${currentEpisodePrice.toFixed(2)} GHS to continue.`
                        : `Unlock Clip ${currentEpisodeIndex + 1} to continue.`
                    )}
                  </p>

                  {/* Ghana Mobile Money Badges - Orange style */}
                  <div className={`flex items-center justify-center ${currentEpisode?.isClimer ? 'gap-1.5 text-[7.5px] pb-2.5' : 'gap-1 text-[6px] pb-1'} font-bold text-zinc-200`}>
                    <span className={`bg-orange-500/20 text-orange-300 ${currentEpisode?.isClimer ? 'px-2 py-0.5' : 'px-1 py-0.5'} rounded border border-orange-500/30 backdrop-blur-sm`}>MTN MoMo</span>
                    <span className={`bg-red-500/20 text-red-300 ${currentEpisode?.isClimer ? 'px-2 py-0.5' : 'px-1 py-0.5'} rounded border border-red-500/30 backdrop-blur-sm`}>Telecel</span>
                    <span className={`bg-blue-500/20 text-blue-300 ${currentEpisode?.isClimer ? 'px-2 py-0.5' : 'px-1 py-0.5'} rounded border border-blue-500/30 backdrop-blur-sm`}>AT Money</span>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <button 
                      disabled={isProcessing || unlockSuccess}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnlockType('episode');
                        setShowPaywall(true);
                      }}
                      className={`font-extrabold ${currentEpisode?.isClimer ? 'px-4 py-2 text-xs rounded-xl' : 'px-2.5 py-1.5 text-[10px] rounded-lg'} flex justify-center items-center gap-1.5 transition-transform active:scale-95 w-full cursor-pointer shadow-lg ${unlockSuccess ? 'bg-orange-500 text-black scale-105' : 'bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black shadow-orange-500/25'}`}
                    >
                    {isProcessing && unlockType === 'episode' ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }} 
                          transition={{ repeat: Infinity, duration: 1, ease:"linear"}} 
                          className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full"
                        />
                        <span>Securing Connection...</span>
                      </>
                    ) : unlockSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5"/>
                        <span>Successfully Unlocked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5"/>
                        <span>{currentEpisode?.isClimer ? 'Unlock Climer' : 'Unlock Clip'}</span>
                      </>
                    )}
                  </button>
                </div>
                </div>
              </div>
            )}
          </motion.div>
 </AnimatePresence>
 </div>

 {/* Desktop & Tablet Episode/Clip Horizontal Arrow Navigators (Shift & Swipe) */}
 {series.episodes && series.episodes.length > 1 && (
   <>
     {/* Left Arrow: Previous Clip */}
     {currentEpisodeIndex > 0 && (
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           triggerHaptic('swipe');
           handlePrev();
         }}
         className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xl cursor-pointer pointer-events-auto group"
         title={`Previous Clip (Part ${currentEpisodeIndex} of ${series.episodes.length})`}
         aria-label="Previous Clip"
       >
         <ChevronLeft className="w-6 h-6 text-white group-hover:-translate-x-0.5 transition-transform" />
       </button>
     )}

     {/* Right Arrow: Next Clip */}
     {currentEpisodeIndex < series.episodes.length - 1 && (
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           if (isCurrentlyLocked) {
             setShowPaywall(true);
           } else {
             triggerHaptic('swipe');
             handleNext();
           }
         }}
         className="hidden sm:flex absolute right-4 lg:right-16 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xl cursor-pointer pointer-events-auto group"
         title={isCurrentlyLocked ? "Unlock Next Clip" : `Next Clip (Part ${currentEpisodeIndex + 2} of ${series.episodes.length})`}
         aria-label="Next Clip"
       >
         <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-0.5 transition-transform" />
       </button>
     )}

     {/* Subtle Clip Counter Pill for Desktop & Tablet */}
     <div className="hidden sm:flex absolute bottom-20 left-1/2 -translate-x-1/2 z-30 items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white/90 shadow-md select-none pointer-events-none">
       <span>Clip {currentEpisodeIndex + 1} of {series.episodes.length}</span>
     </div>
   </>
 )}

 {/* Video progress indicator top */}
 <div className={`absolute top-12 inset-x-0 h-1 flex gap-0.5 z-20 px-2 group-hover:opacity-100 transition-opacity duration-500 delay-100 ${showHud ? 'opacity-50' : 'opacity-0'}`}>
 {series.episodes.map((ep: any, idx: number) => (
 <div key={ep.id} className="h-full flex-1 bg-white/20 rounded-full">
 {idx <= currentEpisodeIndex && (
 <div className={`h-full w-full rounded-full ${idx === currentEpisodeIndex ? 'bg-gray-500' : 'bg-white/80'}`} />
 )}
 </div>
 ))}
 </div>

 {/* Floating Mute Button */}
 {!isBlockedEntirely && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setIsMuted(!isMuted);
 }}
 className={`absolute top-[120px] right-4 z-30 p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transition-opacity duration-300 pointer-events-auto hover:bg-black/60 ${showHud ? 'opacity-100' : 'opacity-0'}`}
 title={isMuted ? "Unmute" : "Mute"}
 >
 {isMuted ? <VolumeX className="w-3.5 h-3.5"/> : <Volume2 className="w-3.5 h-3.5"/>}
 </button>
 )}

 {/* Floating Save / Bookmark Button */}
 {!isBlockedEntirely && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleSave();
 }}
 title={isSaved ? "Saved to Saves (Click to remove)" : "Save to Saves"}
 className={`absolute top-[162px] right-4 z-30 p-1.5 rounded-full backdrop-blur-md border transition-all duration-300 pointer-events-auto cursor-pointer active:scale-90 ${
  isSaved 
   ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40' 
   : 'bg-black/40 hover:bg-black/60 border-white/10 text-white'
 } ${showHud ? 'opacity-100' : 'opacity-0'}`}
 >
 <Bookmark className={`w-3.5 h-3.5 transition-all ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
 </button>
 )}

 {/* Paywall Overlay */}
 <AnimatePresence>
 {showPaywall && (
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md pointer-events-auto"
 >
 <div className="absolute inset-0"onClick={(e) => { e.stopPropagation(); if (!isProcessing) setShowPaywall(false); }} />
 <motion.div 
 initial={{ y:"100%"}}
 animate={{ y: 0 }}
 exit={{ y:"100%"}}
 transition={{ type:"spring", damping: 25, stiffness: 300 }}
 className="relative w-full max-w-lg bg-[#1A1A1A] md:rounded-t-3xl border-t border-white/10 p-6 pb-10"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"/>
 
            {/* Pultanc Secure Checkout Header */}
            <div className="flex items-center justify-between mb-4 bg-white/15 border border-white/20 rounded-2xl p-3.5">
              <div className="flex items-center gap-3 text-left">
                {series.creatorAvatar ? (
                  <img 
                    src={series.creatorAvatar} 
                    alt={series.creatorName || series.creator} 
                    className="w-9 h-9 rounded-full object-cover border-2 border-red-500/50 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-500 text-black font-bold text-sm flex items-center justify-center shrink-0">
                    {(series.creator || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-bold text-white tracking-wide">{series.creatorName || series.creator}</h4>
                    {series.creatorVerified && (
                      <ShieldCheck className="w-3.5 h-3.5 fill-red-500 text-white shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-red-400 font-mono">
                    {series.creatorHandle?.startsWith('@') ? series.creatorHandle : `@${series.creator || 'creator'}`}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { if (!isProcessing) setShowPaywall(false); }}
                className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-xl mb-5">
              <button 
                type="button"
                onClick={() => setUnlockType('episode')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${unlockType === 'episode' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                {targetEpisodeToUnlock?.isClimer ? `Unlock Climer (GHS ${targetEpisodePrice.toFixed(2)})` : `Unlock Clip (GHS ${targetEpisodePrice.toFixed(2)})`}
              </button>
              <button 
                type="button"
                onClick={() => setUnlockType('subscribe')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${unlockType === 'subscribe' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                Subscribe Pass (GHS {selectedSubTier.toFixed(2)})
              </button>
            </div>

            {unlockType === 'subscribe' ? (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {selectedSubTier === 5 ? 'Basic Pass' : selectedSubTier === 15 ? 'Standard Pass' : 'VIP Pass'}
                    </div>
                    <div className="text-xs font-bold text-red-400">GHS {selectedSubTier.toFixed(2)}/mo</div>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Monthly Creator Subscription to @{series?.creator || 'Creator'}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">
                    Choose your plan to watch exclusive drops, BTS footage, and unlimited series clips on Pultanc.
                  </p>

                  {/* 3 Subscription Tiers: 5, 15, 50 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 15, 50].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setSelectedSubTier(tier)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                          selectedSubTier === tier
                            ? 'bg-red-500/20 border-red-500 text-white shadow-sm'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xs font-bold">GHS {tier}</span>
                        <span className="text-[9px] text-gray-400">
                          {tier === 5 ? 'Basic' : tier === 15 ? 'Standard' : 'VIP'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => handleUnlock('subscribe')}
                  disabled={isProcessing || isSubscribed}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer ${
                    isSubscribed 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                  }`}
                >
                  {isProcessing && unlockType === 'subscribe' ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Redirecting to Checkout...</span>
                    </>
                  ) : isSubscribed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Subscribed Successfully</span>
                    </>
                  ) : (
                    `Confirm & Pay GHS ${selectedSubTier.toFixed(2)}`
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{targetEpisodeToUnlock?.isClimer ? 'Single Climer Unlock' : 'Single Clip Unlock'}</div>
                    <div className="text-xs font-bold text-red-400">GHS {targetEpisodePrice.toFixed(2)}</div>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{targetEpisodeToUnlock?.isClimer ? 'Unlock Climer' : `Unlock Clip ${targetEpisodeIndex + 1}`}</h4>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    "{targetEpisodeToUnlock?.title || (targetEpisodeToUnlock?.isClimer ? 'Climer' : ('Clip ' + (targetEpisodeIndex + 1)))}"
                  </p>
                </div>

                <button 
                  type="button"
                  onClick={() => handleUnlock('episode')}
                  disabled={isProcessing || unlockSuccess}
                  className="w-full py-3.5 px-4 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-red-500/25 cursor-pointer"
                >
                  {isProcessing && unlockType === 'episode' ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Redirecting to Checkout...</span>
                    </>
                  ) : unlockSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Unlocked Successfully</span>
                    </>
                  ) : (
                    `Confirm & Pay GHS ${targetEpisodePrice.toFixed(2)}`
                  )}
                </button>
              </div>
            )}

 {isProcessing && (
 <div className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center animate-pulse">
 <div className="flex items-center justify-center gap-2 mb-1.5 text-red-400 font-bold text-xs tracking-wider uppercase">
 <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin shrink-0"/>
 <span>Verifying Checkout Status...</span>
 </div>
 <p className="text-[10px] text-gray-300 leading-normal mb-3">
 Your checkout tab has been opened. Once you complete payment, we'll auto-unlock instantly. Or check the status right now.
 </p>
 <button 
 onClick={() => handleManualVerify()}
 className="w-full py-1.5 bg-red-500 hover:bg-red-600 text-gray-950 font-bold text-xs rounded-xl tracking-wide uppercase transition-all -[0_4px_12px_rgba(132,204,22,0.2)] active:scale-95 cursor-pointer"
 >
 Verify payment instant ⚡
 </button>
 </div>
 )}

 {/* Powered By Loop Tag */}
 <div className="mt-6 pt-3 border-t border-white/5 text-center flex items-center justify-center gap-1.5">
 <span className="text-[10px] text-gray-500 font-medium">
 Powered by <span className="text-red-400 font-bold">Pultanc</span> — <span className="text-white hover:text-red-400 underline transition-colors cursor-pointer font-medium">Start Monetizing</span>
 </span>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Watch Party Invite Overlay */}
 <AnimatePresence>
 {showWatchPartyInvite && (
 <motion.div
 initial={{ opacity: 0, y: 100 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 100 }}
 className="absolute inset-x-0 bottom-0 z-40 bg-gray-900 rounded-t-3xl p-6 border-t border-white/10"
 onClick={(e) => e.stopPropagation()}
 onTouchStart={(e) => e.stopPropagation()}
 >
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <Users className="w-6 h-6 text-red-400"/> Watch Party
 </h3>
 <button onClick={() => setShowWatchPartyInvite(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
 <X className="w-5 h-5 text-white"/>
 </button>
 </div>
 
 <p className="text-xs text-gray-300 mb-6 leading-relaxed">
 Invite friends to watch this clip together. You'll see their live reactions and can chat in real-time.
 </p>

 <button 
 onClick={() => {
 setWatchParty({
 active: true,
 viewers: [
 { name: 'You', avatar: 'https://images.unsplash.com/photo-1543807535-eceef0bc6504?auto=format&fit=crop&q=80&w=100' },
 { name: 'Kweku', avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=100' },
 { name: 'Ama', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100' }
 ]
 });
 setShowWatchPartyInvite(false);
 onToast('Watch Party Started! Link copied to clipboard.');
 }}
 className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-1.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] -[0_0_20px_rgba(132,204,22,0.3)]"
 >
 <UserPlus className="w-5 h-5"/> Copy Invite Link & Start
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Watch Party Active Header */}
 <AnimatePresence>
 {watchParty?.active && (
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="absolute top-16 right-4 z-30 bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1.5 pr-4 flex items-center gap-3"
 >
 <div className="flex -space-x-2">
 {watchParty.viewers.map((viewer, i) => (
 <img key={i} src={viewer.avatar} alt={viewer.name} className="w-6 h-6 rounded-full border-2 border-black object-cover"/>
 ))}
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
 <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span> Live
 </span>
 <span className="text-xs font-bold text-white">{watchParty.viewers.length} Watching</span>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Bottom Overlay with Data & Actions */}
 <div 
 className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-32 pb-24 px-4 z-20 pointer-events-none flex flex-col justify-end transition-opacity duration-500 delay-100 ${showHud ? 'opacity-100' : 'opacity-0'}`}
 >
 <div className="flex flex-col gap-2 pointer-events-auto w-full max-w-2xl mx-auto"onClick={(e) => e.stopPropagation()}>
 
 {/* Clip Title & Context Overlay */}
 <div className="flex flex-col text-left pointer-events-auto mb-1">
   <div className="flex items-center gap-2 flex-wrap">
     {(currentEpisode.isLocked || currentEpisode.isClimer) && (
       <span className="text-[10px] font-mono font-bold text-orange-300 bg-black/80 border border-orange-500/60 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
         <span>🔒 GHS {(Number(currentEpisode.price) || 2).toFixed(2)}</span>
         {currentEpisode.lockTime ? <span className="text-[9px] text-orange-200/90">({currentEpisode.lockTime}s preview)</span> : null}
       </span>
     )}
     <span className="text-[11px] font-bold text-zinc-300 font-mono">
       {series.creatorHandle ? (series.creatorHandle.startsWith('@') ? series.creatorHandle : `@${series.creatorHandle}`) : `@${series.creator || 'creator'}`}
     </span>
   </div>
   <h3 className="text-sm font-extrabold text-white line-clamp-1 drop-shadow-md mt-0.5">
     🎬 {currentEpisode.title || series.title || (currentEpisode.isClimer ? 'Exclusive Climer' : 'Exclusive Clip')}
   </h3>
   {(currentEpisode.description || series.description || currentEpisode.subtitle || series.subtitle) && (
     <p className="text-[11px] text-zinc-200 line-clamp-2 drop-shadow-sm mt-0.5 font-normal leading-tight max-w-xl">
       {currentEpisode.description || series.description || currentEpisode.subtitle || series.subtitle}
     </p>
   )}
   {((Array.isArray(currentEpisode.tags) && currentEpisode.tags.length > 0) || (Array.isArray(series.tags) && series.tags.length > 0)) && (
     <div className="flex flex-wrap gap-1 mt-1">
       {((currentEpisode.tags && currentEpisode.tags.length > 0) ? currentEpisode.tags : series.tags).map((t: string) => (
         <span key={t} className="text-[10px] font-medium text-red-300 bg-red-950/60 border border-red-500/30 px-1.5 py-0.5 rounded-md">
           #{String(t).replace(/^#+/, '')}
         </span>
       ))}
     </div>
   )}
 </div>

 {/* Top Action Row above Counts (Next Clip & Report Button over Subscribe Count) */}
 <div className="flex items-center justify-between mb-1">
 {!isCurrentlyLocked && currentEpisodeIndex < series.episodes.length - 1 ? (
 <button 
 onClick={handleNext}
 className="bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-white hover:text-black font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all text-[10px] group w-fit cursor-pointer"
 >
 {nextEpisode?.isClimer ? 'Next Climer' : 'Next Clip'} <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
 </button>
 ) : (
 <div />
 )}

 {/* Report Button positioned directly on top of the subscribe count */}
 <button
 onClick={(e) => {
  e.stopPropagation();
  triggerHaptic('medium');
  setShowReportModal(true);
 }}
 title="Report Video"
 aria-label="Report Video"
 className="flex items-center justify-center bg-white hover:bg-gray-100 border border-gray-200/90 shadow-md p-1.5 rounded-full text-red-600 transition-all cursor-pointer active:scale-95 ml-auto"
 >
 <Flag className="w-3.5 h-3.5 text-red-600 fill-current"/>
 </button>
 </div>

 {/* Counts Container */}
 <div className="flex items-center gap-2 mb-1">
 <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Unlocks</span>
 <span className="text-[10px] font-bold text-white">
 {(Number(series.unlocksCount) || (unlockedEpisodes.size > 0 ? unlockedEpisodes.size : 0)) + localUnlocksDelta}
 </span>
 </div>
 <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Supports</span>
 <span className="text-[10px] font-bold text-white">
 {((Number(series.supportsCount) || 0) + (isLiked && !series.supportsCount ? 1 : 0)) + localSupportsDelta}
 </span>
 </div>
 <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Subscribes</span>
 <span className="text-[10px] font-bold text-white">
 {((Number(series.subscribersCount) || 0) + (isSubscribed && !series.subscribersCount ? 1 : 0)) + localSubscribesDelta}
 </span>
 </div>
 </div>

 {/* Action Buttons: Comment, Support, Subscribe */}
 <div className="flex items-center gap-1.5">
 <button onClick={() => setShowCommentsModal(true)} className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-2 py-1.5 rounded-xl transition-colors cursor-pointer">
 <MessageCircle className="w-3.5 h-3.5 text-white"/>
 <span className="text-[10px] font-bold text-white">Comment</span>
 </button>
 
 <button onClick={(e) => { e.stopPropagation(); triggerHaptic('selection'); setShowTipModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-2 py-1.5 rounded-xl transition-colors cursor-pointer">
 <Heart className={`w-3.5 h-3.5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
 <span className="text-[10px] font-bold text-white">Support</span>
 </button>

 <button 
 onClick={(e) => {
  e.stopPropagation();
  if (isSubscribed) return;
  triggerHaptic('medium');
  handleUnlock('subscribe');
  }} 
 className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl transition-colors font-bold text-[10px] cursor-pointer ${
 isSubscribed 
 ? 'bg-gray-800 text-gray-400 border border-gray-700' 
 : 'bg-[#ff0514] hover:bg-red-600 text-white shadow-md'
 }`}
 >
 {isSubscribed ? (
 <>
 <CheckCircle2 className="w-3.5 h-3.5"/> Subscribed
 </>
 ) : (
 <>
 <UserPlus className="w-3.5 h-3.5"/> Subscribe
 </>
 )}
 </button>
 </div>

 

 </div>

 {/* Comments / Watch Party Chat Section */}
 {watchParty?.active && (
 <div className={`bg-black/40 backdrop-blur-md rounded-xl p-2.5 border border-red-500/50 transform transition-all duration-300`}>
 <button 
 onClick={() => setShowComments(!showComments)}
 className="flex items-center justify-between w-full mb-1.5 border-b border-red-500/20 pb-1.5"
 >
 <div className="flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
 <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Party Chat</span>
 </div>
 <span className="text-[10px] text-red-400/80 font-medium">{showComments ? 'Hide' : 'Show chat'}</span>
 </button>
 
 <AnimatePresence>
 {showComments && (
 <motion.div 
 initial={{ opacity: 0, height: 0, y: 20 }}
 animate={{ opacity: 1, height: 'auto', y: 0 }}
 exit={{ opacity: 0, height: 0, y: 20 }}
 transition={{ type:"spring", stiffness: 300, damping: 25 }}
 className="space-y-2 mb-2 overflow-hidden max-h-[200px] overflow-y-auto min-h-[40px] flex flex-col justify-end"
 >
 {comments.slice(-4).map((comment) => (
 <div key={comment.id} className="flex gap-2">
 <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 shrink-0 flex items-center justify-center text-white font-bold text-[8px] uppercase">
 {comment.user.charAt(0)}
 </div>
 <div className="flex-1">
 <div className="text-xs mb-0.5 line-clamp-2">
 <span className={`font-bold mr-1.5 ${comment.user !== 'You' ? 'text-red-300' : 'text-white'}`}>{comment.user}</span>
 <span className="text-gray-200">{comment.text}</span>
 </div>
 </div>
 </div>
 ))}
 </motion.div>
 )}
 </AnimatePresence>

 {/* Add Comment Input */}
 <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/5">
 <div className="w-5 h-5 rounded-full bg-gray-600 shrink-0 overflow-hidden border border-white/20 flex items-center justify-center">
 {loggedInUser.avatarUrl ? (
 <img src={loggedInUser.avatarUrl} className="w-full h-full object-cover" alt="User"/>
 ) : (
 <User className="w-3 h-3 text-gray-300" />
 )}
 </div>
 <input
 type="text"
 placeholder="Chat with the party..."
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 submitComment();
 }
 }}
 className="flex-1 bg-transparent border-none text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-0 py-0.5"
 />
 {newComment.trim() && (
 <button 
 onClick={submitComment}
 className={`text-red-400 hover:text-red-300 text-xs font-bold transition-colors pr-1 `}
 >
 Send
 </button>
 )}
 </div>
 </div>
 )}
 </div>

 {/* 🚩 Report Content Modal overlay */}
 <AnimatePresence>
 {showReportModal && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 pointer-events-auto"
 onClick={(e) => { e.stopPropagation(); setShowReportModal(false); }}
 >
 <motion.div 
 initial={{ scale: 0.95, y: 20 }} 
 animate={{ scale: 1, y: 0 }} 
 exit={{ scale: 0.95, y: 20 }}
 className="bg-white border border-gray-200 w-full max-w-sm rounded-3xl p-6 relative shadow-2xl text-gray-900"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex justify-between items-center mb-3">
 <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-white text-red-600 flex items-center justify-center border border-red-200 shadow-xs">
 <Flag className="w-3.5 h-3.5 text-red-600 fill-current"/>
 </div>
 <span>Report Content</span>
 </h3>
 <button 
 onClick={() => setShowReportModal(false)}
 className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors cursor-pointer"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>

 <div className="space-y-4 text-left">
 <div className="p-3 bg-red-50/80 border border-red-200/80 rounded-2xl flex items-start gap-2.5">
 <ShieldCheck className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
 <p className="text-[11px] text-gray-700 leading-relaxed">
 Flag inappropriate content to maintain platform safety. All reports are immediately reviewed by our moderators.
 </p>
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-500 block">Select Violation Category</label>
 <select 
 value={reportReason}
 onChange={(e) => setReportReason(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-red-500 cursor-pointer shadow-2xs"
 >
 <option value="Inappropriate Content">Explicit or Inappropriate Content</option>
 <option value="Copyright Violation">Copyright or IP Infringement</option>
 <option value="Hate Speech or Bullying">Hate Speech, Harassment or Bullying</option>
 <option value="Violence or Harm">Violence, Self-Harm or Dangerous Content</option>
 <option value="Spam or Deceptive">Spam, Scams or Deceptive Media</option>
 <option value="Standards Violation">Creator Standards Violation</option>
 <option value="Other">Other Safety Concerns</option>
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-500 block">Provide Details (Optional)</label>
 <textarea 
 rows={3}
 placeholder="Provide timestamps or specific details to help our safety review..."
 value={reportDetails}
 onChange={(e) => setReportDetails(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 resize-none shadow-2xs"
 />
 </div>

 <div className="pt-2 flex gap-3">
 <button 
 type="button"
 onClick={() => setShowReportModal(false)}
 className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
 >
 Cancel
 </button>
 <button 
 type="button"
 onClick={submitReport}
 disabled={reportSubmitting}
 className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
 >
 {reportSubmitting ? 'Submitting...' : 'Submit Report'}
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Comments Modal */}
 <AnimatePresence>
 {showCommentsModal && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 pointer-events-auto"
 onClick={(e) => { e.stopPropagation(); setShowCommentsModal(false); }}
 >
 <motion.div 
 initial={{ scale: 0.95, y: 20 }} 
 animate={{ scale: 1, y: 0 }} 
 exit={{ scale: 0.95, y: 20 }}
 className="bg-[#1A1A1A] border-t border-white/10 w-full max-w-sm rounded-t-3xl p-6 relative flex flex-col h-[60vh]"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex justify-between items-center mb-4 shrink-0">
 <h3 className="text-md font-bold text-white flex items-center gap-2">
 <MessageCircle className="w-4 h-4 text-gray-300"/>
 Comments
 </h3>
 <button 
 onClick={() => setShowCommentsModal(false)}
 className="text-gray-400 hover:text-white bg-white/5 p-1 rounded-full transition-colors"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
 
 <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
 {comments.map((comment) => (
 <div key={comment.id} className="flex gap-3">
 <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 shrink-0 flex items-center justify-center text-white font-bold text-xs uppercase">
 {comment.user.charAt(0)}
 </div>
 <div className="flex-1">
 <div className="text-xs mb-1">
 <span className="font-bold mr-2 text-white">{comment.user}</span>
 <span className="text-gray-300">{comment.text}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-xs text-gray-500">{comment.time}</span>
 <button className="text-xs text-gray-500 font-medium hover:text-gray-300 transition-colors">Reply</button>
 </div>
 </div>
 <button className="self-start mt-1">
 <Heart className="w-4 h-4 text-gray-500 hover:text-red-400 transition-colors"/>
 </button>
 </div>
 ))}
 </div>

 {/* Add Comment Input */}
 <div className="flex items-center gap-3 shrink-0 pt-4 border-t border-white/10">
 <div className="w-6 h-6 rounded-full bg-gray-600 shrink-0 overflow-hidden border border-white/20 flex items-center justify-center">
 {loggedInUser.avatarUrl ? (
 <img src={loggedInUser.avatarUrl} className="w-full h-full object-cover" alt="User"/>
 ) : (
 <User className="w-3.5 h-3.5 text-gray-300" />
 )}
 </div>
 <div className="flex-1 bg-white/5 rounded-full px-4 py-2 border border-white/10 flex items-center focus-within:border-white/30 transition-colors">
 <input
 type="text"
 placeholder="Add a comment..."
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 submitComment();
 }
 }}
 className="flex-1 bg-transparent border-none text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-0"
 />
 {newComment.trim() && (
 <button 
 onClick={submitComment}
 className="text-white hover:text-gray-300 text-sm font-bold transition-colors ml-2"
 >
 <Send className="w-4 h-4"/>
 </button>
 )}
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Share Modal */}
 <AnimatePresence>
 {showShareModal && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 pointer-events-auto"
 onClick={(e) => { e.stopPropagation(); setShowShareModal(false); }}
 >
 <motion.div 
 initial={{ scale: 0.95, y: 20 }} 
 animate={{ scale: 1, y: 0 }} 
 exit={{ scale: 0.95, y: 20 }}
 className="bg-[#1A1A1A] border border-white/10 w-full max-w-sm rounded-3xl p-6 relative flex flex-col max-h-[80vh]"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-md font-bold text-white flex items-center gap-2">
 <Share2 className="w-4 h-4 text-red-500"/>
 Share with Users
 </h3>
 <button 
 onClick={() => setShowShareModal(false)}
 className="text-gray-400 hover:text-white bg-white/5 p-1 rounded-full transition-colors"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>

 <div className="relative mb-4 shrink-0">
 <input
 type="text"
 placeholder="Search usernames..."
 value={shareSearchQuery}
 onChange={(e) => setShareSearchQuery(e.target.value)}
 className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors"
 />
 <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2"/>
 </div>

 <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
 {['alex_dev', 'sarah_creator', 'mike_jones', 'emily_art', 'david_w', 'chris_p', 'jessica_m'].filter(u => u.includes(shareSearchQuery.toLowerCase())).map(username => (
 <button 
 key={username}
 onClick={() => {
 onToast(`Shared to @${username}!`);
 setShowShareModal(false);
 }}
 className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
 >
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
 {username.charAt(0).toUpperCase()}
 </div>
 <span className="text-xs font-bold text-gray-200 group-hover:text-white transition-colors">@{username}</span>
 </div>
 <div className="bg-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full group-hover:bg-red-500 transition-colors">
 Send
 </div>
 </button>
 ))}
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {showTipModal && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowTipModal(false)}>
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 onClick={(e) => e.stopPropagation()}
 className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl text-white"
 >
 <div className="p-5">
 <button 
 onClick={() => setShowTipModal(false)}
 className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors z-10 cursor-pointer"
 >
 <X className="w-4 h-4"/>
 </button>
 
 <div className="text-center mb-4">
 <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-2">
 <Heart className="w-5 h-5 text-red-500 fill-red-500"/>
 </div>
 <h3 className="text-lg font-bold text-white mb-0.5">Pultanc Support Checkout</h3>
 <p className="text-gray-400 text-xs">Direct financial support to creator</p>
 </div>

 {/* User & Creator Profile Banner */}
 <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-4 flex items-center justify-between gap-2">
 <div className="flex items-center gap-2 max-w-[42%] overflow-hidden">
 {loggedInUser.avatarUrl ? (
 <img 
 src={loggedInUser.avatarUrl} 
 alt="Your Avatar" 
 className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0" 
 />
 ) : (
 <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
 <User className="w-4 h-4 text-gray-300" />
 </div>
 )}
 <div className="overflow-hidden text-left">
 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supporter</div>
 <div className="text-xs font-bold text-white truncate">{loggedInUser.name}</div>
 <div className="text-[10px] text-gray-400 truncate">{loggedInUser.handle}</div>
 </div>
 </div>

 <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
 <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
 </div>

 <div className="flex items-center gap-2 max-w-[42%] overflow-hidden">
 <div className="overflow-hidden text-right">
 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Creator</div>
 <div className="text-xs font-bold text-white truncate">{series?.creatorName || series?.creator || 'Creator'}</div>
 <div className="text-[10px] text-gray-400 truncate">@{series?.creator || 'creator'}</div>
 </div>
 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0 border border-white/20">
 {(series?.creatorName || series?.creator || 'C').charAt(0).toUpperCase()}
 </div>
 </div>
 </div>

 {/* Custom Support Amount Input */}
 <div className="mb-4">
 <label className="block text-xs font-bold text-gray-400 mb-1.5 text-left">
 Support Amount (GHS)
 </label>
 <div className="relative">
 <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">GHS</span>
 <input 
 type="number"
 min="1"
 step="1"
 value={tipAmount}
 onChange={(e) => setTipAmount(e.target.value ? Number(e.target.value) : '')}
 className="w-full bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl py-2.5 pl-12 pr-3 focus:outline-none focus:border-red-500 transition-colors"
 placeholder="Enter support amount in GHS..."
 />
 </div>
 </div>
 
 <button 
 onClick={handleTipSubmit}
 disabled={isProcessingTip || tipSuccess || !tipAmount || Number(tipAmount) <= 0}
 className={`w-full font-bold text-xs py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2 cursor-pointer ${
 tipSuccess ? 'bg-emerald-500 text-white font-extrabold scale-105' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
 }`}
 >
 {isProcessingTip ? (
 <>
 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
 <span>Redirecting to Checkout...</span>
 </>
 ) : tipSuccess ? (
 <>
 <CheckCircle2 className="w-4 h-4"/>
 <span>Support Sent Successfully!</span>
 </>
 ) : (
 `Send GHS ${Number(tipAmount || 0).toFixed(2)} Support`
 )}
 </button>

 {isProcessingTip && (
 <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-center animate-pulse">
 <div className="flex items-center justify-center gap-2 mb-1 text-red-400 font-bold text-xs tracking-wider uppercase">
 <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin shrink-0"/>
 <span>Checkout Tab Opened</span>
 </div>
 <p className="text-[10px] text-gray-400 leading-normal mb-2">
 Check support state instantly down below:
 </p>
 <button 
 onClick={() => handleManualTipVerify()}
 disabled={isCheckingTip}
 className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
 >
 {isCheckingTip ? 'Verifying...' : 'Verify support instant ⚡'}
 </button>
 </div>
 )}
 </div>
 </motion.div>
 </div>
 )}

 </div>
 );
}

export default function ConsumerFeed({ onNavigateToProfile, onRequireAuth, onNavigateToTab }: { onNavigateToProfile?: (creator?: string) => void, onRequireAuth?: () => void, onNavigateToTab?: (tab: string) => void }) {
 const [searchQuery, setSearchQuery] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [showToast, setShowToast] = useState<string | null>(null);

 const [dbFunnels, setDbFunnels] = useState<any[]>([]);
 const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { photoURL?: string, displayName?: string, handle?: string, verified?: boolean, subscribePrice?: number, unlocksCount?: number, supportsCount?: number, subscribersCount?: number }>>({});
 const [isLoading, setIsLoading] = useState(true);
 const isOwner = !!auth.currentUser;
 const [userBalance, setUserBalance] = useState<number>(0);

 // Fetch real creator profiles to display their uploaded profile photo, name, handle, verification badge, price, and stats in real time
 useEffect(() => {
   if (dbFunnels.length === 0) return;
   const creatorIds: string[] = Array.from(new Set(dbFunnels.map(f => String(f.creatorId || '')).filter(Boolean)));
   const unsubs: (() => void)[] = [];
   creatorIds.forEach((cId: string) => {
     try {
       const userDocRef = doc(db, 'users', cId);
       const unsub = onSnapshot(userDocRef, (snap) => {
         if (snap.exists()) {
           const d = snap.data();
           setCreatorProfiles(prev => ({
             ...prev,
             [cId]: {
               photoURL: d.photoURL || d.avatarUrl || d.avatar || "",
               displayName: d.displayName || d.name || "",
               handle: d.handle || d.username || "",
               verified: d.isVerified || d.verified || false,
               subscribePrice: Number(d.subscribePrice || d.creatorSubscribePrice) || undefined,
               unlocksCount: d.unlocksCount !== undefined ? Number(d.unlocksCount) : undefined,
               supportsCount: d.supportsCount !== undefined ? Number(d.supportsCount) : undefined,
               subscribersCount: d.subscribersCount !== undefined ? Number(d.subscribersCount) : undefined
             }
           }));
         }
       }, (err) => console.warn("Could not load creator profile:", err));
       unsubs.push(unsub);
     } catch (err) {
       console.warn("Could not listen to creator profile:", err);
     }
   });
   return () => {
     unsubs.forEach(u => u());
   };
 }, [dbFunnels]);

 useEffect(() => {
   if (auth.currentUser?.uid) {
     const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
       if (docSnap.exists()) {
         const d = docSnap.data();
         setUserBalance(Number(d.balance) || 0);
       } else {
         setUserBalance(0);
       }
     });
     return () => unsub();
   } else {
     setUserBalance(0);
   }
 }, []);

 // Pull-to-refresh state
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [pullDistance, setPullDistance] = useState(0);
 const touchStartY = useRef<number>(0);
 const scrollContainerRef = useRef<HTMLDivElement>(null);

 const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 15) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

 const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current > 0 && !isRefreshing) {
      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;
      if (distance > 0 && scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 15) {
        setPullDistance(Math.min(distance * 0.5, 100));
      } else {
        setPullDistance(0);
      }
    }
  };

 const handleTouchEnd = () => {
    if (pullDistance >= 55 && !isRefreshing) {
      triggerHaptic('medium');
      setIsRefreshing(true);
      setPullDistance(60);
      
      const q = query(collection(db, 'funnels'), orderBy('createdAt', 'desc'));
      getDocs(q).then((snapshot) => {
        const funs = snapshot.docs.map(doc => doc.data()).filter(data => data.status !== 'under_review' && data.status !== 'banned');
        setDbFunnels(funs);
      }).catch(err => {
        console.error("Refresh error:", err);
      }).finally(() => {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          triggerHaptic('success');
          handleToast("Feed refreshed");
        }, 850);
      });
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

 useEffect(() => {
 const q = query(collection(db, 'funnels'), orderBy('createdAt', 'desc'));
 const start = Date.now();
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const funs = snapshot.docs.map(doc => doc.data()).filter(data => data.status !== 'under_review' && data.status !== 'banned');
 setDbFunnels(funs);
 const elapsed = Date.now() - start;
 const minDelay = 750; // 750ms minimum loading delay for smooth skeleton experience
 if (elapsed < minDelay) {
 setTimeout(() => setIsLoading(false), minDelay - elapsed);
 } else {
 setIsLoading(false);
 }
 }, (error) => {
 console.warn("Feed funnels listener inactive:", error);
 setIsLoading(false);
 });
 return () => unsubscribe();
 }, []);

 const getSlugFromUrl = () => {
 const path = window.location.pathname;
 if (path.includes('/bio/')) {
 return path.split('/bio/')[1].split('?')[0];
 }
 if (path.includes('/video/')) {
 return path.split('/video/')[1].split('?')[0];
 }
 if (path.includes('/clip/')) {
 return path.split('/clip/')[1].split('?')[0];
 }
 const cleanPath = path.replace(/^\/+/, '');
 const segments = cleanPath.split('/').filter(Boolean);
 if (segments.length >= 2) {
 return segments[1].split('?')[0];
 }
 const params = new URLSearchParams(window.location.search);
 return params.get('video') || params.get('clip') || params.get('series') || params.get('bio') || params.get('slug') || params.get('climer');
 };

 const targetSlug = getSlugFromUrl();

 useEffect(() => {
 if (targetSlug && dbFunnels.length > 0) {
   const decodedTarget = decodeURIComponent(targetSlug).toLowerCase().trim();
   const matching = dbFunnels.find(f => {
     const titleSlugDash = (f.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
     const titleSlugUnderscore = (f.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
     return f.slug === targetSlug || 
            f.id === targetSlug || 
            titleSlugDash === decodedTarget ||
            titleSlugUnderscore === decodedTarget ||
            (f.title && f.title.toLowerCase().trim() === decodedTarget);
   });
   if (matching) {
     handleToast(`🎬 Loaded climer: "${matching.title}"! Watch the free preview; the climax will prompt you to unlock automatically!`);
   }
 }
 }, [dbFunnels, targetSlug]);

 const customSeriesList = dbFunnels.map(funnel => {
   const cp = creatorProfiles[funnel.creatorId] || {};
   const effectiveCreatorName = cp.displayName || funnel.creatorName || funnel.creatorHandle || "Creator";
   const effectiveCreatorHandle = cp.handle 
     ? (cp.handle.startsWith('@') ? cp.handle : `@${cp.handle}`)
     : (funnel.creatorHandle || (effectiveCreatorName ? `@${effectiveCreatorName.toLowerCase().replace(/\s+/g, '_')}` : "@creator"));
   const effectiveAvatar = cp.photoURL || funnel.creatorAvatar || funnel.creatorPhotoURL || (auth.currentUser?.uid === funnel.creatorId ? auth.currentUser.photoURL : "") || "";
   const isVerified = cp.verified ?? funnel.creatorVerified ?? false;
   const realViews = Number(funnel.views !== undefined ? funnel.views : (funnel.visits !== undefined ? funnel.visits : (funnel.plays !== undefined ? funnel.plays : 0)));

   return {
     id: funnel.id,
     title: funnel.title,
     slug: funnel.slug,
     thumbnailUrl: funnel.thumbnailUrl,
     description: funnel.description || `Watch the free preview, then unlock to watch the full climax.`,
     creator: effectiveCreatorHandle.replace(/^@/, ''),
     creatorName: effectiveCreatorName,
     creatorHandle: effectiveCreatorHandle,
     creatorId: funnel.creatorId,
     creatorEmail: funnel.creatorEmail,
     creatorAvatar: effectiveAvatar,
     creatorVerified: isVerified,
     views: realViews,
     unlocksCount: cp.unlocksCount !== undefined ? cp.unlocksCount : (funnel.unlocksCount !== undefined ? funnel.unlocksCount : '0'),
     supportsCount: cp.supportsCount !== undefined ? cp.supportsCount : (funnel.supportsCount !== undefined ? funnel.supportsCount : (funnel.likesCount !== undefined ? funnel.likesCount : '0')),
     subscribersCount: cp.subscribersCount !== undefined ? cp.subscribersCount : (funnel.subscribersCount !== undefined ? funnel.subscribersCount : '0'),
     subscribePrice: (Number(cp.subscribePrice || funnel.subscribePrice || funnel.creatorSubscribePrice) > 0 ? Number(cp.subscribePrice || funnel.subscribePrice || funnel.creatorSubscribePrice) : 15.00),
     creatorSubscribePrice: (Number(cp.subscribePrice || funnel.subscribePrice || funnel.creatorSubscribePrice) > 0 ? Number(cp.subscribePrice || funnel.subscribePrice || funnel.creatorSubscribePrice) : 15.00),
     episodes: Array.isArray(funnel.episodes) && funnel.episodes.length > 0 ? funnel.episodes.map((ep: any) => ({
       ...ep,
       creatorId: ep.creatorId || funnel.creatorId,
       creatorEmail: ep.creatorEmail || funnel.creatorEmail,
       creatorHandle: ep.creatorHandle || effectiveCreatorHandle,
       creatorName: ep.creatorName || effectiveCreatorName,
       views: Number(ep.views !== undefined ? ep.views : (ep.plays !== undefined ? ep.plays : realViews))
     })) : [
       {
         id: funnel.id,
         title: funnel.title,
         videoUrl: funnel.videoUrl || '',
         isLocked: true,
         isClimer: true,
         lockTime: Number(funnel.lockTime) || 10.0,
         price: Number(funnel.price) || 2.00,
         slug: funnel.slug || funnel.id,
         creatorId: funnel.creatorId,
         creatorEmail: funnel.creatorEmail,
         creatorHandle: effectiveCreatorHandle,
         creatorName: effectiveCreatorName,
         views: realViews
       }
     ]
   };
 });

 const isSignedUser = !!auth.currentUser;
 let combinedSeries = isSignedUser
   ? customSeriesList
   : (customSeriesList.length > 0 ? [...customSeriesList, ...mockSeries.filter(m => !customSeriesList.some(c => c.id === m.id))] : mockSeries);

 if (targetSlug) {
   const decodedTarget = decodeURIComponent(targetSlug).toLowerCase().trim();
   const isTargetMatch = (item: any) => {
     const titleSlugDash = (item.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
     const titleSlugUnderscore = (item.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
     return item.slug === targetSlug || 
            item.id === targetSlug || 
            titleSlugDash === decodedTarget || 
            titleSlugUnderscore === decodedTarget || 
            (item.title && item.title.toLowerCase().trim() === decodedTarget) ||
            (item.episodes && item.episodes.some((e: any) => 
              e.id === targetSlug || 
              e.slug === targetSlug || 
              (e.title && (e.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') === decodedTarget || e.title.toLowerCase().trim() === decodedTarget))
            ));
   };

   combinedSeries = combinedSeries.sort((a: any, b: any) => {
     const aMatch = isTargetMatch(a);
     const bMatch = isTargetMatch(b);
     if (aMatch && !bMatch) return -1;
     if (!aMatch && bMatch) return 1;
     return 0;
   });
 }

 const filteredSeries = combinedSeries.filter(s => {
   const q = searchQuery.toLowerCase().trim();
   if (!q) return true;
   const cleanQ = q.replace(/^#+/, '');
   const titleMatch = s.title && s.title.toLowerCase().includes(q);
   const creatorMatch = s.creator && s.creator.toLowerCase().includes(q);
   const descMatch = (s.description && s.description.toLowerCase().includes(q)) || (s.subtitle && s.subtitle.toLowerCase().includes(q));
   const tagMatch = Array.isArray(s.tags) && s.tags.some((t: any) => typeof t === 'string' && (t.toLowerCase().includes(q) || t.toLowerCase().includes(cleanQ)));
   const epMatch = s.episodes && s.episodes.some((ep: any) => 
     (ep.title && ep.title.toLowerCase().includes(q)) ||
     (ep.description && ep.description.toLowerCase().includes(q)) ||
     (Array.isArray(ep.tags) && ep.tags.some((t: any) => typeof t === 'string' && (t.toLowerCase().includes(q) || t.toLowerCase().includes(cleanQ))))
   );
   return titleMatch || creatorMatch || descMatch || tagMatch || epMatch;
 });

 const handleToast = (message: string) => {
 toast.success(message);
 };

 const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

 const scrollToVideo = (targetIndex: number) => {
   if (targetIndex < 0 || targetIndex >= filteredSeries.length) return;
   const targetElement = document.getElementById("feed-post-" + targetIndex);
   if (targetElement) {
     targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
     setCurrentVideoIndex(targetIndex);
     triggerHaptic("selection");
   } else if (scrollContainerRef.current) {
     const itemHeight = scrollContainerRef.current.clientHeight;
     scrollContainerRef.current.scrollTo({
       top: targetIndex * itemHeight,
       behavior: "smooth"
     });
     setCurrentVideoIndex(targetIndex);
     triggerHaptic("selection");
   }
 };

 // Keep currentVideoIndex updated when user scrolls naturally
 useEffect(() => {
   const container = scrollContainerRef.current;
   if (!container) return;

   let ticking = false;
   const handleScroll = () => {
     if (!ticking) {
       window.requestAnimationFrame(() => {
         if (!container) return;
         const scrollTop = container.scrollTop;
         const clientHeight = container.clientHeight;
         if (clientHeight > 0) {
           const index = Math.round(scrollTop / clientHeight);
           const clamped = Math.max(0, Math.min(index, filteredSeries.length - 1));
           setCurrentVideoIndex(clamped);
         }
         ticking = false;
       });
       ticking = true;
     }
   };

   container.addEventListener("scroll", handleScroll, { passive: true });
   return () => container.removeEventListener("scroll", handleScroll);
 }, [filteredSeries.length]);

 // Keyboard navigation for scrolling videos with Up/Down arrows on desktop and tablet
 useEffect(() => {
   const handleKeyDown = (e: KeyboardEvent) => {
     const activeEl = document.activeElement;
     if (
       activeEl && 
       (activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        (activeEl as HTMLElement).isContentEditable)
     ) {
       return;
     }

     if (e.key === "ArrowDown" || e.key === "PageDown") {
       e.preventDefault();
       scrollToVideo(currentVideoIndex + 1);
     } else if (e.key === "ArrowUp" || e.key === "PageUp") {
       e.preventDefault();
       scrollToVideo(currentVideoIndex - 1);
     }
   };

   window.addEventListener("keydown", handleKeyDown);
   return () => window.removeEventListener("keydown", handleKeyDown);
 }, [currentVideoIndex, filteredSeries.length]);

 return (
 <div 
 ref={scrollContainerRef}
 onTouchStart={handleTouchStart}
 onTouchMove={handleTouchMove}
 onTouchEnd={handleTouchEnd}
 className="h-[100dvh] w-full bg-[#080808] overflow-y-auto no-scrollbar relative snap-y snap-mandatory"
 >
 {/* Pull to refresh indicator */}
  <div 
    className="fixed top-12 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none transition-all duration-300 ease-out"
    style={{ 
      opacity: isRefreshing ? 1 : (pullDistance > 10 ? Math.min(pullDistance / 40, 1) : 0),
      transform: `translateY(${isRefreshing ? 20 : Math.min(pullDistance * 0.7, 75)}px) scale(${isRefreshing ? 1 : Math.min(0.6 + pullDistance / 90, 1)})`
    }}
  >
    <div className="bg-zinc-900/95 backdrop-blur-xl text-white border border-white/20 shadow-2xl rounded-full px-4 py-2 flex items-center gap-2.5 text-xs font-bold tracking-wide">
      <RefreshCw 
        className={`w-4 h-4 text-red-500 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
        style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
      />
      <span className="text-zinc-100">
        {isRefreshing ? 'Refreshing feed...' : pullDistance >= 55 ? 'Release to refresh' : 'Pull down to refresh'}
      </span>
    </div>
  </div>

 
 {/* Top Navigation Bar */}
 <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-black/90 via-black/40 to-transparent px-3 sm:px-6 py-2 pointer-events-none">
 <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 pointer-events-auto">
  <div className="font-bold text-xs text-white flex items-center gap-1.5 select-none">
    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
    <span>Pultanc</span>
  </div>
 
 <div className="flex items-center justify-end flex-1 transition-all">
 {isOwner && (
 <button onClick={() => onNavigateToTab && onNavigateToTab('wallet')} className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10 transition-transform hover:scale-105 active:scale-95 max-w-[130px]">
 <Wallet className="w-3 h-3 text-[#ff0514] shrink-0"/>
 <div className="flex flex-col items-end overflow-hidden">
 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none truncate w-full text-right">Wallet</span>
 <span className="text-[10px] font-bold text-white leading-none mt-0.5 truncate w-full text-right">GHS {userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
 </div>
 </button>
 )}
 </div>
 </div>
 </div>
 {/* Main Feed Container */}
 <div className="w-full">
 {isLoading ? (
 <div className="h-[100dvh] w-full bg-[#080808] relative overflow-hidden flex flex-col justify-end p-6 select-none">
 {/* Pulsing views indicator top-right */}
 <div className="absolute top-12 right-4 flex flex-col items-end gap-1.5 animate-pulse">
 <div className="h-7 w-28 bg-zinc-900/80 rounded-full border border-zinc-800/50"/>
 </div>
 
 {/* Shimmer gradient */}
 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"/>

 {/* Glowing background hint */}
 <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-500/5 rounded-full blur-3xl animate-pulse"/>

 {/* Action Bar Shimmer */}
 <div className="space-y-4 max-w-2xl mx-auto w-full animate-pulse">
 <div className="flex items-center gap-5">
 <div className="h-6 w-16 bg-zinc-900 rounded-full"/>
 <div className="h-6 w-16 bg-zinc-900 rounded-full"/>
 <div className="h-6 w-8 bg-zinc-900 rounded-full"/>
 <div className="h-6 w-8 bg-zinc-900 rounded-full"/>
 </div>

 {/* Creator & Meta info */}
 <div className="space-y-3.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-zinc-850"/>
 <div className="h-4 w-32 bg-zinc-850 rounded-md"/>
 </div>
 <div className="h-6 w-24 bg-zinc-850 rounded-full"/>
 </div>

 {/* Title & Description Shimmers */}
 <div className="h-5 w-1/2 bg-zinc-850 rounded-md"/>
 <div className="space-y-2">
 <div className="h-3.5 w-11/12 bg-zinc-900 rounded-md"/>
 <div className="h-3.5 w-2/3 bg-zinc-900 rounded-md"/>
 </div>
 </div>

 {/* Comments box preview shimmer */}
 <div className="bg-zinc-950/50 backdrop-blur border border-zinc-900 rounded-xl p-3 h-14 w-full flex items-center justify-between">
 <div className="h-3 w-1/3 bg-zinc-900 rounded"/>
 <div className="h-3 w-4 bg-zinc-900 rounded-full"/>
 </div>
 </div>
 </div>
 ) : filteredSeries.length > 0 ? (
 filteredSeries.map((series, index) => (
 <FeedPost 
 key={series.id} 
 id={`feed-post-${index}`}
 isActive={index === currentVideoIndex}
 series={series} 
 onToast={handleToast} 
 onNavigateToProfile={onNavigateToProfile}
 onRequireAuth={onRequireAuth}
 onNavigateToTab={onNavigateToTab}
 />
 ))
 ) : (
 <div className="h-[100dvh] w-full flex items-center justify-center text-center text-gray-400 p-6 select-none">
 {isSignedUser ? (
   <div className="max-w-xs flex flex-col items-center">
     <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 text-red-500">
       <Film className="w-7 h-7" />
     </div>
     <p className="text-sm font-extrabold text-white mb-1">No Creator Climers Uploaded Yet</p>
     <p className="text-xs text-gray-400 leading-relaxed mb-5">
       You are signed in! Upload your first climax video in Climer Studio to see it playing on the feed.
     </p>
     <button
       onClick={() => onNavigateToTab && onNavigateToTab('funnels')}
       className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
     >
       <Plus className="w-4 h-4 stroke-[2.5]" />
       <span>Open Climer Studio</span>
     </button>
   </div>
 ) : (
   <div>
     <p className="text-xs font-medium text-white mb-2">No content found</p>
     <p>Try adjusting your search terms.</p>
   </div>
 )}
 </div>
 )}
 </div>

 {/* Desktop & Tablet Floating Arrow Navigator (Scroll & Shift Videos) */}
 {filteredSeries.length > 1 && (
   <div className="fixed right-3 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col items-center gap-2 p-2 bg-black/75 hover:bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl transition-all duration-200 select-none">
     {/* Scroll to Previous Video (Up Arrow) */}
     <button
       type="button"
       onClick={() => scrollToVideo(currentVideoIndex - 1)}
       disabled={currentVideoIndex <= 0}
       className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
         currentVideoIndex <= 0
           ? 'opacity-25 cursor-not-allowed text-white/40'
           : 'text-white hover:bg-white/15 active:scale-95 cursor-pointer hover:text-red-400'
       }`}
       title="Previous Video (Scroll Up / Key: ↑)"
       aria-label="Previous Video"
     >
       <ChevronUp className="w-6 h-6 stroke-[2.5]" />
     </button>

     {/* Video Counter Badge */}
     <div className="flex flex-col items-center justify-center py-1 px-1.5 min-w-[36px] text-center">
       <span className="text-xs font-mono font-extrabold text-white tracking-tight leading-none">
         {String(currentVideoIndex + 1).padStart(2, '0')}
       </span>
       <div className="w-3 h-0.5 bg-white/20 my-1 rounded-full" />
       <span className="text-[10px] font-mono text-white/50 leading-none">
         {String(filteredSeries.length).padStart(2, '0')}
       </span>
     </div>

     {/* Scroll to Next Video (Down Arrow) */}
     <button
       type="button"
       onClick={() => scrollToVideo(currentVideoIndex + 1)}
       disabled={currentVideoIndex >= filteredSeries.length - 1}
       className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
         currentVideoIndex >= filteredSeries.length - 1
           ? 'opacity-25 cursor-not-allowed text-white/40'
           : 'text-white hover:bg-white/15 active:scale-95 cursor-pointer hover:text-red-400'
       }`}
       title="Next Video (Scroll Down / Key: ↓)"
       aria-label="Next Video"
     >
       <ChevronDown className="w-6 h-6 stroke-[2.5]" />
     </button>

     {/* Keyboard Shortcut Hint */}
     <div className="pt-1 border-t border-white/10 flex flex-col items-center w-full">
       <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest text-center">
         Keys
       </span>
       <span className="text-[9px] font-mono text-white/70">
         ↑ ↓
       </span>
     </div>
   </div>
 )}

 </div>
 );
}
