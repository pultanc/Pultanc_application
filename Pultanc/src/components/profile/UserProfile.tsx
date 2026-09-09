import React, { useState, useEffect, useRef } from 'react';
import { User, Eye, Shield, ShieldCheck, MessageSquare, Video, Link2, FileCheck, Upload, CreditCard, CheckCircle2, AlertCircle, FileImage, Grid, Heart, LayoutDashboard, PlayCircle, Globe, Smartphone, Copy, Link, Moon, Sun, Bookmark, Users, UserCheck, Share2, Folder, FolderPlus, ArrowLeft, Trash2, Edit3, Film, Plus, X, Flag, LogOut, Camera, AtSign, Check, Download, Lock, Sparkles, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COUNTRIES } from '../../countries';
import { mockSeries } from '../../data';
import { useTheme } from '../../contexts/ThemeContext';
import { LegalDrawer } from '../legal/LegalDrawer';
import { LEGAL_DOCS } from '../../data/legal';
import { usePricing } from '../../usePricing';
import { auth, db, storage, handleFirestoreError, OperationType } from '../../firebase';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs, runTransaction, where, addDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { savePendingPayment, showPaymentSuccessPopup } from '../../utils/paymentSession';
import { recordPaymentTransaction } from '../../utils/transactionRecorder';
import { uploadFastAvatar, optimizeMediaImage } from '../../utils/mediaOptimizer';
import { DynamicProtectedWatermark, ScreenRecordingShield, useScreenRecordingProtection } from '../common/VideoProtection';

export default function UserProfile({ 
  viewType = 'public', 
  isOwner = false, 
  selectedCreatorHandle = null,
  onNavigateToTab 
}: { 
  viewType?: 'public' | 'private', 
  isOwner?: boolean, 
  selectedCreatorHandle?: string | null,
  onNavigateToTab?: (tab: string) => void 
}) {
 const { subscribePrice } = usePricing();
 const { theme, toggleTheme } = useTheme();
 const [activeTab, setActiveTab] = useState<'climers' | 'series' | 'saved' | 'community' | 'settings'>(viewType === 'private' ? 'saved' : 'climers');
 const [communityFilter, setCommunityFilter] = useState<'subscribers' | 'supporters' | 'subscribed'>('subscribers');
 
 // Custom Collections and Saved Clips State
 const [collections, setCollections] = useState<any[]>([]);
 const [savedClips, setSavedClips] = useState<any[]>([]);
 const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
 const [isCreatingFolder, setIsCreatingFolder] = useState(false);
 const [newFolderName, setNewFolderName] = useState('');
 const [newFolderDesc, setNewFolderDesc] = useState('');
 
 const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
 const [editingFolderName, setEditingFolderName] = useState('');
 const [editingFolderDesc, setEditingFolderDesc] = useState('');
 const [selectedPlayClip, setSelectedPlayClip] = useState<any | null>(null);
 const [clipCurrentTime, setClipCurrentTime] = useState(0);
 const [isClipUnlocked, setIsClipUnlocked] = useState(false);
 const clipVideoRef = useRef<HTMLVideoElement | null>(null);
 const { isRecordingBlocked, blockReason, videoProtectionProps } = useScreenRecordingProtection(clipVideoRef);

 const handleOpenVideo = (item: any, isClimer: boolean = false) => {
   const slug = item?.slug || item?.id || 'climer';
   if (onNavigateToTab) {
     const url = new URL(window.location.href);
     url.searchParams.set('video', slug);
     window.history.pushState({}, '', url.toString());
     onNavigateToTab('consumer');
     return;
   }
   setClipCurrentTime(0);
   const isAlreadyUnlocked = isSubscribed || savedClips.some(sc => sc.id === item.id || sc.episodeId === item.id || sc.contentId === item.id || sc.id === `${item.funnelId}_${item.id}` || sc.id === `${item.id}_${item.id}`);
   setIsClipUnlocked(isAlreadyUnlocked);
   setSelectedPlayClip({
     ...item,
     videoUrl: item.videoUrl,
     clipTitle: item.clipTitle || item.title || 'Video',
     seriesTitle: item.seriesTitle || item.title || 'Video',
     creatorName: item.creatorName || profileData.name || 'Creator',
     creatorHandle: item.creatorHandle || effectiveHandle || '@creator',
     creatorAvatar: item.creatorAvatar || profileData.avatarUrl,
     isClimer: isClimer,
     lockTime: Number(item.lockTime) || 10,
     price: Number(item.price) || 2.0,
     slug: slug
   });
 };

 const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'uploading' | 'processing' | 'verified'>('unverified');
 const [isFirebaseVerified, setIsFirebaseVerified] = useState(false);
 const [liveVoteCount, setLiveVoteCount] = useState(0);
 const [hasVotedForLive, setHasVotedForLive] = useState(false);
 const [sliderValue, setSliderValue] = useState(0);

 const [watchHistory, setWatchHistory] = useState<any[]>([]);

 const [dbFunnels, setDbFunnels] = useState<any[]>([]);
 const [dbClips, setDbClips] = useState<any[]>([]);
 const [subscribersList, setSubscribersList] = useState<any[]>([]);
 const [supportersList, setSupportersList] = useState<any[]>([]);
 const [subscribedCreatorsList, setSubscribedCreatorsList] = useState<any[]>([]);

 useEffect(() => {
 const q = query(collection(db, 'funnels'), orderBy('createdAt', 'desc'));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const funs = snapshot.docs.map(doc => doc.data()).filter(data => data.status !== 'under_review' && data.status !== 'banned');
 setDbFunnels(funs);
 }, (error) => {
 console.warn("Profile funnels listener inactive:", error);
 });
 return () => unsubscribe();
 }, []);

 useEffect(() => {
 const q = query(collection(db, 'clips'), orderBy('createdAt', 'desc'));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const clips = snapshot.docs.map(doc => doc.data()).filter(data => data.status !== 'under_review' && data.status !== 'banned' && !data.isClimer && data.type !== 'climer');
 setDbClips(clips);
 }, (error) => {
 console.warn("Profile clips listener inactive:", error);
 });
 return () => unsubscribe();
 }, []);

 const [idFront, setIdFront] = useState<File | null>(null);
 const [idBack, setIdBack] = useState<File | null>(null);
 const [isViralBaitEnabled, setIsViralBaitEnabled] = useState(false);
 const [isMerchantAgreed, setIsMerchantAgreed] = useState(false);
 const [legalDrawerContent, setLegalDrawerContent] = useState<{title: string, content: string} | null>(null);
 const [sharedCardType, setSharedCardType] = useState<'social' | 'goal' | null>(null);
 const [sharedHandle, setSharedHandle] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const profileParam = params.get('profile') || params.get('u') || params.get('creator') || params.get('user');
			const cardParam = params.get('card');

			if (cardParam === 'social' || cardParam === 'goal') {
				setSharedCardType(cardParam as 'social' | 'goal');
			}

			const path = window.location.pathname.replace(/^\/+/, '');
			const pathHandle = path.startsWith('@') ? path.substring(1) : (path && !['bio', 'video', 'api', 'dist', 'index.html'].includes(path.split('/')[0]) ? path : null);
			const resolved = profileParam || pathHandle || selectedCreatorHandle;

			if (resolved) {
				const decoded = decodeURIComponent(resolved);
				setSharedHandle(decoded);
				const formattedName = decoded
					.replace(/_/g, ' ')
					.replace(/-/g, ' ')
					.replace(/\w/g, l => l.toUpperCase());

				if (viewType === 'public') {
					setProfileData(prev => ({
						...prev,
						name: formattedName
					}));
				}
			}
		}
	}, [viewType, selectedCreatorHandle]);

 const [isEditingProfile, setIsEditingProfile] = useState(false);
 const [isSavingProfile, setIsSavingProfile] = useState(false);

 const [profileData, setProfileData] = useState<any>({
  name: "",
  displayName: "",
  username: "",
  country: "",
  phoneNumber: "",
  avatarUrl: "",
  bio: "",
  paymentType: "Mobile Money",
  paymentNumber: "",
  bankName: "",
  branchName: "",
  unlocksCount: 0,
  supportsCount: 0,
  subscribersCount: 0
 });

 const effectiveHandle = selectedCreatorHandle || sharedHandle;

 const isSelfAccount = Boolean(
  auth.currentUser && (
   (profileData.id && profileData.id === auth.currentUser.uid) ||
   (profileData.uid && profileData.uid === auth.currentUser.uid) ||
   (effectiveHandle && (
    effectiveHandle === auth.currentUser.uid ||
    effectiveHandle.toLowerCase().replace(/^@/, '') === (profileData.username || '').toLowerCase().replace(/^@/, '') ||
    effectiveHandle.toLowerCase().replace(/^@/, '') === (auth.currentUser.email?.split('@')[0] || '').toLowerCase()
   ))
  )
 );

 // isAccountOwner controls private owner editing and account management views
 const isAccountOwner = Boolean(
  auth.currentUser && (
   viewType === 'private' ||
   (!effectiveHandle && isOwner)
  )
 );

 useEffect(() => {
  if (viewType === 'public' && effectiveHandle) {
    const clean = effectiveHandle.toLowerCase().replace(/^@/, '');
    const formattedName = clean.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

    const matchingFunnel = dbFunnels.find(f => 
      f.creatorId === effectiveHandle ||
      (f.creatorHandle && f.creatorHandle.toLowerCase().replace(/^@/, '') === clean) ||
      (f.creatorName && f.creatorName.toLowerCase() === clean)
    );

    const matchingMock = mockSeries.find(s => 
      s.id === effectiveHandle ||
      s.creatorId === effectiveHandle ||
      (s.creatorHandle && s.creatorHandle.toLowerCase().replace(/^@/, '') === clean) ||
      (s.creatorName && s.creatorName.toLowerCase() === clean) ||
      (s.creator && s.creator.toLowerCase() === clean)
    );

    let unsubSnapshot: (() => void) | null = null;

    const resolveAndSubscribeCreator = async () => {
      let targetUid = matchingFunnel?.creatorId || (effectiveHandle.length >= 20 ? effectiveHandle : null);
      let userDocRefToWatch: any = null;

      if (targetUid) {
        try {
          const uSnap = await getDoc(doc(db, 'users', targetUid));
          if (uSnap.exists()) {
            userDocRefToWatch = uSnap.ref;
          }
        } catch (e) {}
      }

      if (!userDocRefToWatch) {
        try {
          const q = query(collection(db, 'users'), where('username', '==', clean), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            userDocRefToWatch = qSnap.docs[0].ref;
          }
        } catch (e) {}
      }

      if (!userDocRefToWatch) {
        try {
          const q2 = query(collection(db, 'users'), where('handle', 'in', ['@' + clean, clean]), limit(1));
          const qSnap2 = await getDocs(q2);
          if (!qSnap2.empty) {
            userDocRefToWatch = qSnap2.docs[0].ref;
          }
        } catch (e) {}
      }

      if (!userDocRefToWatch && auth.currentUser) {
        const myUid = auth.currentUser.uid;
        try {
          const mySnap = await getDoc(doc(db, 'users', myUid));
          if (mySnap.exists()) {
            const myData = mySnap.data();
            const myHandle = (myData.username || myData.handle?.replace(/^@/, '') || myData.name || '').toLowerCase();
            if (myHandle === clean || myUid === effectiveHandle) {
              userDocRefToWatch = mySnap.ref;
            }
          }
        } catch (e) {}
      }

      if (userDocRefToWatch) {
        unsubSnapshot = onSnapshot(userDocRefToWatch, async (uSnap) => {
          if (uSnap.exists()) {
            const uData = uSnap.data();
            let isUserVerified = !!(uData.isVerified || uData.creatorVerified || uData.verificationStatus === 'verified');
            if (!isUserVerified) {
              const vSnap = await getDoc(doc(db, 'verifications', uSnap.id)).catch(() => null);
              if (vSnap && vSnap.exists() && vSnap.data()?.status === 'approved') {
                isUserVerified = true;
              }
            }
            setProfileData((prev: any) => ({
              ...prev,
              id: uSnap.id,
              uid: uSnap.id,
              name: uData.displayName || uData.name || formattedName,
              displayName: uData.displayName || uData.name || formattedName,
              username: uData.username || clean,
              avatarUrl: uData.avatarUrl || uData.photoURL || matchingFunnel?.creatorAvatar || prev.avatarUrl,
              bio: uData.bio || matchingFunnel?.creatorBio || (isUserVerified ? 'Verified Creator on Climer' : 'Creator on Climer'),
              isVerified: isUserVerified,
              unlocksCount: uData.unlocksCount !== undefined ? Number(uData.unlocksCount) : (matchingFunnel?.unlocksCount || prev.unlocksCount || 0),
              supportsCount: uData.supportsCount !== undefined ? Number(uData.supportsCount) : (matchingFunnel?.supportsCount || prev.supportsCount || 0),
              subscribersCount: uData.subscribersCount !== undefined ? Number(uData.subscribersCount) : (matchingFunnel?.subscribersCount || prev.subscribersCount || 0),
              subscribePrice: Number(uData.subscribePrice || uData.creatorSubscribePrice || matchingFunnel?.subscribePrice) || prev.subscribePrice || 15.00
            }));
          }
        });
      } else if (matchingFunnel) {
        const isVerified = matchingFunnel.creatorVerified ?? false;
        setProfileData((prev: any) => ({
          ...prev,
          id: matchingFunnel.creatorId || effectiveHandle,
          name: matchingFunnel.creatorName || matchingFunnel.creatorHandle || clean,
          displayName: matchingFunnel.creatorName || matchingFunnel.creatorHandle || clean,
          username: (matchingFunnel.creatorHandle || clean).replace(/^@/, ''),
          avatarUrl: matchingFunnel.creatorAvatar || matchingFunnel.creatorPhotoURL || prev.avatarUrl || "",
          bio: matchingFunnel.creatorBio || (isVerified ? 'Verified Creator on Climer' : 'Creator on Climer'),
          isVerified,
          unlocksCount: matchingFunnel.unlocksCount !== undefined ? matchingFunnel.unlocksCount : (prev.unlocksCount || 0),
          supportsCount: matchingFunnel.supportsCount !== undefined ? matchingFunnel.supportsCount : (prev.supportsCount || 0),
          subscribersCount: matchingFunnel.subscribersCount !== undefined ? matchingFunnel.subscribersCount : (prev.subscribersCount || 0),
          subscribePrice: Number(matchingFunnel.subscribePrice || matchingFunnel.creatorSubscribePrice) || prev.subscribePrice || 15.00
        }));
      } else if (matchingMock) {
        const isVerified = matchingMock.creatorVerified ?? false;
        setProfileData((prev: any) => ({
          ...prev,
          id: matchingMock.id,
          name: matchingMock.creatorName || matchingMock.creator,
          displayName: matchingMock.creatorName || matchingMock.creator,
          username: (matchingMock.creatorHandle || matchingMock.creator).replace(/^@/, ''),
          avatarUrl: matchingMock.creatorAvatar || prev.avatarUrl || "",
          bio: matchingMock.description || (isVerified ? 'Verified Creator on Climer' : 'Creator on Climer'),
          isVerified,
          unlocksCount: matchingMock.unlocksCount || '12.4K',
          supportsCount: matchingMock.supportsCount || '24.5K',
          subscribersCount: matchingMock.subscribersCount || '1.2K',
        }));
      } else {
        setProfileData((prev: any) => ({
          ...prev,
          id: effectiveHandle,
          name: formattedName,
          displayName: formattedName,
          username: clean,
          avatarUrl: prev.avatarUrl || "",
          bio: 'Creator on Climer',
          isVerified: false
        }));
      }
    };

    resolveAndSubscribeCreator();
    return () => {
      if (unsubSnapshot) unsubSnapshot();
    };
  }
 }, [viewType, effectiveHandle, dbFunnels]);

 const [isDragOver, setIsDragOver] = useState(false);
 const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const uploadImageFile = async (file: File): Promise<string> => {
   if (!auth.currentUser) throw new Error("Not authenticated");
   const userId = auth.currentUser.uid;
   const { url } = await uploadFastAvatar(file, userId);
   return url;
 };

 const processAvatarImage = async (file: File) => {
   if (!auth.currentUser) {
     toast.error("Please sign in to update your profile picture");
     return;
   }

   const userId = auth.currentUser.uid;
   setIsUploadingAvatar(true);

   // 1. Instant optimistic local preview (0ms delay)
   const localPreviewUrl = URL.createObjectURL(file);
   setProfileData((prev: any) => ({ ...prev, avatarUrl: localPreviewUrl }));
   setLoggedInUser((prev) => ({ ...prev, avatarUrl: localPreviewUrl }));

   // Dispatch immediate local event so sidebar and bottom nav update instantly
   window.dispatchEvent(new CustomEvent('pultanc_avatar_updated', {
     detail: { avatarUrl: localPreviewUrl, photoURL: localPreviewUrl, uid: userId }
   }));

   try {
     // 2. Fast compressed upload (<200ms)
     const { url } = await uploadFastAvatar(file, userId);
     setProfileData((prev: any) => ({ ...prev, avatarUrl: url, photoURL: url }));
     setLoggedInUser((prev) => ({ ...prev, avatarUrl: url }));
     
     // 3. Save to Firestore
     const userRef = doc(db, 'users', userId);
     await setDoc(userRef, {
       avatarUrl: url,
       photoURL: url,
       updatedAt: serverTimestamp()
     }, { merge: true });

     // 4. Update Firebase Auth photoURL
     try {
       await updateProfile(auth.currentUser, { photoURL: url });
     } catch (e) {
       console.warn("Could not update auth photoURL:", e);
     }

     // 5. Broadcast to sidebar and all navigation components
     const syncDetail = { avatarUrl: url, photoURL: url, uid: userId };
     window.dispatchEvent(new CustomEvent('pultanc_avatar_updated', { detail: syncDetail }));
     window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: syncDetail }));

     toast.success("Profile picture updated!");
   } catch (err) {
     console.error("Failed to upload avatar:", err);
     toast.error("Failed to upload avatar image.");
   } finally {
     setIsUploadingAvatar(false);
   }
 };

 const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files[0]) {
 processAvatarImage(e.target.files[0]);
 }
 };

 const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 setIsDragOver(false);
 if (e.dataTransfer.files && e.dataTransfer.files[0]) {
 processAvatarImage(e.dataTransfer.files[0]);
 }
 };

 const handleSaveProfile = async () => {
 if (!auth.currentUser) return;
 setIsSavingProfile(true);
 try {
 const rawUsername = profileData.username || profileData.name || auth.currentUser.email?.split('@')[0] || 'user';
 const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
 const cleanDisplayName = (profileData.name || profileData.displayName || cleanUsername).trim();

 const userRef = doc(db, 'users', auth.currentUser.uid);
 await setDoc(userRef, {
 name: cleanDisplayName,
 displayName: cleanDisplayName,
 username: cleanUsername,
 handle: `@${cleanUsername}`,
 country: profileData.country || '',
 phoneNumber: profileData.phoneNumber || '',
 avatarUrl: profileData.avatarUrl || '',
 photoURL: profileData.avatarUrl || '',
 bio: profileData.bio || '',
 updatedAt: serverTimestamp()
 }, { merge: true });

 try {
 await updateProfile(auth.currentUser, {
 displayName: cleanDisplayName,
 photoURL: profileData.avatarUrl || auth.currentUser.photoURL || undefined
 });
 } catch (e) {
 console.warn("Could not update auth profile directly", e);
 }

 setProfileData((prev: any) => ({
 ...prev,
 name: cleanDisplayName,
 displayName: cleanDisplayName,
 username: cleanUsername
 }));

 // Broadcast update to sync avatar and name everywhere (Sidebar, logout area, nav)
 const syncDetail = {
   avatarUrl: profileData.avatarUrl || '',
   photoURL: profileData.avatarUrl || '',
   displayName: cleanDisplayName,
   name: cleanDisplayName,
   username: cleanUsername,
   uid: auth.currentUser.uid
 };
 window.dispatchEvent(new CustomEvent('pultanc_avatar_updated', { detail: syncDetail }));
 window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: syncDetail }));

 setIsEditingProfile(false);
 toast.success('Profile picture & username updated successfully!');
 } catch (e: any) {
 console.error(e);
 toast.error('Failed to save profile changes: ' + (e.message || 'Unknown error'));
 } finally {
 setIsSavingProfile(false);
 }
 };

  const [loggedInUser, setLoggedInUser] = useState<{ name: string; handle: string; avatarUrl: string }>({
    name: auth.currentUser?.displayName || "Supporter",
    handle: auth.currentUser?.email ? `@${auth.currentUser.email.split("@")[0]}` : "@user",
    avatarUrl: auth.currentUser?.photoURL || ""
  });

  useEffect(() => {
    if (auth.currentUser?.uid) {
      const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setLoggedInUser({
            name: d.name || auth.currentUser?.displayName || "Supporter",
            handle: d.handle || (d.username ? `@${d.username}` : (auth.currentUser?.email ? `@${auth.currentUser.email.split("@")[0]}` : "@user")),
            avatarUrl: d.avatarUrl || d.photoURL || auth.currentUser?.photoURL || ""
          });
        }
      });
      return () => unsub();
    }
  }, []);

  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | ''>('');
  const [isProcessingTip, setIsProcessingTip] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [tipReference, setTipReference] = useState<string | null>(null);
  const [tipPaystackUrl, setTipPaystackUrl] = useState<string | null>(null);
  const [isCheckingTip, setIsCheckingTip] = useState(false);

  const [isProcessingClipUnlock, setIsProcessingClipUnlock] = useState(false);
  const [clipPaystackUrl, setClipPaystackUrl] = useState<string | null>(null);
  const [clipPaystackRef, setClipPaystackRef] = useState<string | null>(null);
  const [isCheckingClipUnlock, setIsCheckingClipUnlock] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
 const [reportDetails, setReportDetails] = useState('');
 const [reportSubmitting, setReportSubmitting] = useState(false);

 const submitReport = async () => {
 setReportSubmitting(true);
 try {
 const reporterId = auth.currentUser?.uid;
 if (!reporterId) {
 alert('You must be logged in to report content.');
 return;
 }
 
 const contentId = profileData?.id || (isAccountOwner ? auth.currentUser?.uid : (effectiveHandle || 'creator'));

 // 1. Check for Duplicate Reports
 const reportsRef = collection(db, 'reports');
 const q = query(reportsRef, where('reporterId', '==', reporterId), where('contentId', '==', contentId));
 const querySnapshot = await getDocs(q);
 
 if (!querySnapshot.empty) {
 alert('You have already reported this profile.');
 setShowReportModal(false);
 return;
 }
 
 const contentRef = doc(db, 'users', contentId);
 
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

 const [isSubscribed, setIsSubscribed] = useState(false);

 // Listen to subscription status in real-time if viewing public profile
 useEffect(() => {
   if (!auth.currentUser?.uid || isAccountOwner) return;
   const targetCreatorId = profileData?.id || effectiveHandle;
   if (!targetCreatorId) return;
   const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', targetCreatorId);
   const unsub = onSnapshot(subRef, (snap) => {
     if (snap.exists() && snap.data()?.active !== false) {
       setIsSubscribed(true);
     }
   }, (err) => console.warn(err));
   return () => unsub();
 }, [auth.currentUser?.uid, isAccountOwner, profileData?.id, effectiveHandle]);

 const [showSubscribeModal, setShowSubscribeModal] = useState(false);
 const [selectedSubTier, setSelectedSubTier] = useState<number>(15);

 const [isProcessingSubscribe, setIsProcessingSubscribe] = useState(false);
 const [subscribeReference, setSubscribeReference] = useState<string | null>(null);
 const [subscribePaystackUrl, setSubscribePaystackUrl] = useState<string | null>(null);
 const [isCheckingSubscribe, setIsCheckingSubscribe] = useState(false);

 const handleSubscribeClick = () => {
  const creatorSub = Number(profileData?.subscribePrice || profileData?.creatorSubscribePrice);
  if ([5, 15, 50].includes(creatorSub)) {
   setSelectedSubTier(creatorSub);
  } else {
   setSelectedSubTier(15);
  }
  setShowSubscribeModal(true);
 };

 const handleVerifySubscribe = async (refInput?: string) => {
 const ref = refInput || subscribeReference;
 if (!ref) return false;
 setIsCheckingSubscribe(true);
 try {
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (e) {
 console.warn("Subscribe verification network error:", e);
 }
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 setIsProcessingSubscribe(false);
 setSubscribeReference(null);
 setSubscribePaystackUrl(null);
 setIsCheckingSubscribe(false);
 setShowSubscribeModal(false);
 toast.success('Subscription completed successfully!');

 // Calculate earnings, record transaction, and update analytics
 const effectiveSubPrice = Number(profileData?.subscribePrice || profileData?.creatorSubscribePrice || subscribePrice || 15);
 const creatorId = profileData?.id || (isAccountOwner ? auth.currentUser?.uid : (effectiveHandle || 'creator'));
 if (creatorId) {
 recordPaymentTransaction({
 reference: ref,
 recipientId: creatorId,
 recipientName: profileData?.displayName || profileData?.username || 'Creator',
 amount: effectiveSubPrice,
 type: 'subscribe',
 title: `Monthly Creator Subscription to ${profileData?.displayName || 'Creator'}`
 }).catch(err => console.warn("Failed to record subscription transaction:", err));
 }

 if (auth.currentUser && creatorId) {
 const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', creatorId);
 setDoc(subRef, {
 creatorId: creatorId,
 subscribedAt: Date.now(),
 amountPaid: effectiveSubPrice,
 active: true
 }, { merge: true }).catch(err => console.warn('Failed to save subscription:', err));
 }
 setIsSubscribed(true);
 toast.success('Thank you! Your monthly creator subscription has been unlocked successfully! 🚀');

 setProfileData((prev: any) => ({
 ...prev,
 subscribersCount: (Number(prev.subscribersCount) || 0) + 1
 }));

 showPaymentSuccessPopup({
   amount: effectiveSubPrice,
   currency: 'GHS',
   recipientName: profileData?.displayName || profileData?.username || 'Creator',
   paymentFor: 'Monthly Creator Subscription',
   reference: ref,
   tab: 'accountProfile',
   type: 'subscribe'
 });
 return true;
 }
 if (!refInput) {
 toast.error('We checked, but the payment is not completed yet on the payment tab.');
 }
 return false;
 } catch (e) {
 console.error(e);
 if (!refInput) toast.error('Verification check failed. Try again.');
 return false;
 } finally {
 setIsCheckingSubscribe(false);
 }
 };

 const handleVerifyTip = async (refInput?: string) => {
 const ref = refInput || tipReference;
 if (!ref) return false;
 setIsCheckingTip(true);
 try {
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (e) {
 console.warn("Support verification network error:", e);
 }
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 setIsProcessingTip(false);
 setTipReference(null);
 setTipPaystackUrl(null);
 setIsCheckingTip(false);
 setTipSuccess(true);
 toast.success('Support sent successfully!');

 showPaymentSuccessPopup({
   amount: Number(tipAmount),
   currency: 'GHS',
   recipientName: profileData?.displayName || profileData?.username || 'Creator',
   paymentFor: `Support to ${profileData?.displayName || 'Creator'}`,
   reference: ref,
   tab: 'accountProfile',
   type: 'support'
 });

 const creatorId = profileData?.id || (isAccountOwner ? auth.currentUser?.uid : (effectiveHandle || 'creator'));
 if (creatorId && tipAmount) {
 recordPaymentTransaction({
 reference: ref,
 recipientId: creatorId,
 recipientName: profileData?.displayName || profileData?.username || 'Creator',
 amount: Number(tipAmount),
 type: 'support',
 title: `Support to ${profileData?.displayName || 'Creator'}`
 }).catch(err => console.warn("Failed to record support transaction:", err));
 }

 setProfileData((prev: any) => ({
 ...prev,
 supportsCount: (Number(prev.supportsCount) || 0) + 1
 }));

 setTimeout(() => {
 setShowTipModal(false);
 setTipAmount('');
 setTipSuccess(false);
 }, 1500);
 return true;
 }
 if (!refInput) {
 toast.error('We checked, but the payment is not completed yet on the payment tab.');
 }
 return false;
 } catch (e) {
 console.error(e);
 if (!refInput) toast.error('Verification check failed. Try again.');
 return false;
 } finally {
 setIsCheckingTip(false);
 }
 };

 const handleConfirmSubscribe = async () => {
 setIsProcessingSubscribe(true);
 let paymentWindow: Window | null = null;
 try {
 paymentWindow = window.open("", "_blank");
 } catch (e) {
 console.warn("Popup blocked:", e);
 }

 const price = [5, 15, 50].includes(selectedSubTier) ? selectedSubTier : Number(profileData?.subscribePrice || profileData?.creatorSubscribePrice || subscribePrice || 15);
 const userEmail = (auth.currentUser?.email && auth.currentUser.email.includes('@'))
   ? auth.currentUser.email
   : `subscriber_${auth.currentUser?.uid || Date.now()}@pultanc.com`;

 try {
	const targetCreatorId = profileData?.uid || profileData?.id || '';
	const response = await fetch('/api/paystack/initialize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: userEmail,
			transaction_type: 'subscribe',
			creator_id: targetCreatorId,
			user_id: auth.currentUser?.uid || '',
			content_id: targetCreatorId,
			price: price,
			subscribePrice: price,
			amount: price,
			callback_url: `${window.location.origin}/?tab=accountProfile`,
			currency: 'GHS',
			metadata: {
				transaction_type: 'subscribe',
				creator_id: targetCreatorId,
				user_id: auth.currentUser?.uid || '',
				content_id: targetCreatorId,
				price: price,
				subscribePrice: price,
				amount: price
			}
		})
	});

 const data = await response.json();
 if (data.status && data.data?.authorization_url) {
 const reference = data.data.reference;
 setSubscribeReference(reference);
 setSubscribePaystackUrl(data.data.authorization_url);

 savePendingPayment({
 reference,
 tab: 'accountProfile',
 type: 'subscribe',
 creatorId: profileData?.uid || profileData?.id,
 recipientName: profileData?.displayName || profileData?.username || 'Creator',
 title: 'Monthly Creator Subscription',
 amount: price
 });

 let opened = false;
 if (paymentWindow && !paymentWindow.closed) {
 try {
 paymentWindow.location.href = data.data.authorization_url;
 opened = true;
 } catch (e) {
 console.warn("Could not set popup location:", e);
 }
 }
 if (!opened) {
 try {
 const win = window.open(data.data.authorization_url, '_blank', 'noopener,noreferrer');
 if (win) opened = true;
 } catch (e) {}
 }
 
 // Start automatic rapid polling (1200ms)
 const pollInterval = setInterval(async () => {
 try {
 const isVerified = await handleVerifySubscribe(reference);
 if (isVerified) {
 clearInterval(pollInterval);
 }
 } catch (e) {
 console.error('Polling error:', e);
 }
 }, 1200);

 setTimeout(() => {
 clearInterval(pollInterval);
 }, 5 * 60 * 1000);
 } else {
 if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
 toast.error(data.error || 'Failed to initialize subscription checkout.');
 setIsProcessingSubscribe(false);
 }
 } catch (err) {
 console.error('Failed to initialize subscription:', err);
 if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
 toast.error('Failed to initialize payment.');
 setIsProcessingSubscribe(false);
 }
 };

 const handleTipSubmit = async () => {
   if (!tipAmount || Number(tipAmount) <= 0) {
     toast.error("Please enter a valid support amount.");
     return;
   }
   if (profileData?.status === "under_review" || profileData?.status === "banned") {
     toast.error("This account is currently under review and cannot receive payments.");
     return;
   }
   let paymentWindow: Window | null = null;
   try {
     paymentWindow = window.open("", "_blank");
   } catch (e) {
     console.warn("Popup blocked:", e);
   }
   setIsProcessingTip(true);

   const userEmail = (auth.currentUser?.email && auth.currentUser.email.includes('@'))
     ? auth.currentUser.email
     : `supporter_${auth.currentUser?.uid || Date.now()}@pultanc.com`;

   try {
      const targetCreatorId = profileData?.uid || profileData?.id || '';
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          transaction_type: 'support',
          creator_id: targetCreatorId,
          user_id: auth.currentUser?.uid || '',
          content_id: targetCreatorId,
          amount: Number(tipAmount),
          support_amount: Number(tipAmount),
          callback_url: `${window.location.origin}/?tab=accountProfile`,
          currency: 'GHS',
          metadata: {
            transaction_type: 'support',
            creator_id: targetCreatorId,
            user_id: auth.currentUser?.uid || '',
            content_id: targetCreatorId
          }
        })
      });

     const data = await response.json();
     if (data.status && data.data?.authorization_url) {
       const reference = data.data.reference;
       setTipReference(reference);
       setTipPaystackUrl(data.data.authorization_url);

       savePendingPayment({
         reference,
         tab: "accountProfile",
         type: "support",
         creatorId: profileData?.uid || profileData?.id,
         recipientName: profileData?.displayName || profileData?.username || "Creator",
         title: `Support to ${profileData?.displayName || "Creator"}`,
         amount: Number(tipAmount)
       });

       let opened = false;
       if (paymentWindow && !paymentWindow.closed) {
         try {
           paymentWindow.location.href = data.data.authorization_url;
           opened = true;
         } catch (e) {
           console.warn("Could not set popup location:", e);
         }
       }
       if (!opened) {
         try {
           const win = window.open(data.data.authorization_url, '_blank', 'noopener,noreferrer');
           if (win) opened = true;
         } catch (e) {}
       }

       const pollInterval = setInterval(async () => {
         try {
           const isVerified = await handleVerifyTip(reference);
           if (isVerified) {
             clearInterval(pollInterval);
           }
         } catch (e) {
           console.error("Polling error:", e);
         }
       }, 1200);

       setTimeout(() => {
         clearInterval(pollInterval);
       }, 5 * 60 * 1000);
     } else {
       if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
       toast.error(data.error || "Failed to initialize support checkout.");
       setIsProcessingTip(false);
     }
   } catch (err) {
     console.error("Failed to initialize support:", err);
     if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
     toast.error("Failed to initialize payment.");
     setIsProcessingTip(false);
   }
 };

 const handleVerifyClipUnlock = async (refInput?: string) => {
   const ref = refInput || clipPaystackRef;
   if (!ref) return false;
   setIsCheckingClipUnlock(true);
   try {
     let verifyData: any = null;
     try {
       const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
       const contentType = verifyRes.headers.get("content-type");
       if (contentType && contentType.includes("application/json")) {
         verifyData = await verifyRes.json();
       }
     } catch (e) {
       console.warn("Clip unlock verify fetch error:", e);
     }

     if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
       setIsProcessingClipUnlock(false);
       setClipPaystackRef(null);
       setClipPaystackUrl(null);
       setIsCheckingClipUnlock(false);
       setIsClipUnlocked(true);
       toast.success("Payment verified by Paystack! Climax unlocked.");

       if (clipVideoRef.current) {
         clipVideoRef.current.play().catch(() => {});
       }

       const pricePaid = selectedPlayClip?.price || 2.0;
       const targetCreatorId = selectedPlayClip?.creatorId || profileData?.id || (isAccountOwner ? auth.currentUser?.uid : (effectiveHandle || 'creator'));

       recordPaymentTransaction({
         reference: ref,
         recipientId: targetCreatorId,
         recipientName: selectedPlayClip?.creatorName || profileData?.displayName || profileData?.name || 'Creator',
         amount: pricePaid,
         type: 'clip',
         title: `Unlocked Climer: ${selectedPlayClip?.clipTitle || 'Climax Video'}`,
         funnelId: selectedPlayClip?.funnelId,
         contentId: selectedPlayClip?.id
       }).catch(err => console.warn("Failed to record clip transaction:", err));

       setProfileData((prev: any) => ({
         ...prev,
         unlocksCount: (Number(prev.unlocksCount) || 0) + 1
       }));

       if (auth.currentUser && selectedPlayClip) {
         const clipDocId = selectedPlayClip.funnelId ? `${selectedPlayClip.funnelId}_${selectedPlayClip.id}` : `${selectedPlayClip.id}_${selectedPlayClip.id}`;
         const savedDocRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', clipDocId);
         setDoc(savedDocRef, {
           id: clipDocId,
           seriesId: selectedPlayClip.funnelId || selectedPlayClip.id,
           episodeId: selectedPlayClip.id,
           climerTitle: selectedPlayClip.clipTitle || selectedPlayClip.title,
           clipTitle: selectedPlayClip.clipTitle || selectedPlayClip.title,
           title: selectedPlayClip.clipTitle || selectedPlayClip.title,
           type: selectedPlayClip.isClimer ? 'climer' : 'clip',
           isClimer: !!selectedPlayClip.isClimer,
           creatorName: selectedPlayClip.creatorName || profileData?.displayName || profileData?.name || 'Creator',
           thumbnail: selectedPlayClip.thumbnail || '',
           savedAt: Date.now(),
           isAutoSavedPaid: true
         }).catch(err => console.warn('Failed to auto-save paid item on profile:', err));
       }

       showPaymentSuccessPopup({
         amount: pricePaid,
         currency: 'GHS',
         recipientName: selectedPlayClip?.creatorName || profileData?.displayName || 'Creator',
         paymentFor: `Unlocked Climer: ${selectedPlayClip?.clipTitle || 'Climax Video'}`,
         reference: ref,
         tab: 'accountProfile',
         type: 'clip'
       });

       return true;
     }
     if (!refInput) {
       toast.error('Payment not yet completed on Paystack.');
     }
     return false;
   } catch (err) {
     console.error(err);
     if (!refInput) toast.error('Verification check failed. Try again.');
     return false;
   } finally {
     setIsCheckingClipUnlock(false);
   }
 };

 const handleUnlockClip = async () => {
   if (!selectedPlayClip) return;
   setIsProcessingClipUnlock(true);
   let paymentWindow: Window | null = null;
   try {
     paymentWindow = window.open("", "_blank");
   } catch (e) {
     console.warn("Popup blocked:", e);
   }

   const price = selectedPlayClip.price || 2.0;
   const userEmail = (auth.currentUser?.email && auth.currentUser.email.includes('@'))
     ? auth.currentUser.email
     : `unlocker_${auth.currentUser?.uid || Date.now()}@pultanc.com`;

   try {
      const targetCreatorId = selectedPlayClip.creatorId || profileData?.id || '';
      const targetContentId = selectedPlayClip.id || selectedPlayClip.funnelId || '';
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          transaction_type: 'unlock',
          creator_id: targetCreatorId,
          user_id: auth.currentUser?.uid || '',
          content_id: targetContentId,
          callback_url: `${window.location.origin}/?tab=accountProfile`,
          currency: 'GHS',
          metadata: {
            transaction_type: 'unlock',
            type: 'clip',
            clipId: selectedPlayClip.id,
            funnelId: selectedPlayClip.funnelId,
            content_id: targetContentId,
            creator_id: targetCreatorId,
            creatorId: targetCreatorId,
            user_id: auth.currentUser?.uid || ''
          }
        })
      });

     const data = await response.json();
     if (data.status && data.data?.authorization_url) {
       const reference = data.data.reference;
       setClipPaystackRef(reference);
       setClipPaystackUrl(data.data.authorization_url);

       savePendingPayment({
         reference,
         tab: 'accountProfile',
         type: 'clip',
         funnelSlug: selectedPlayClip.slug,
         creatorId: selectedPlayClip.creatorId || profileData?.id,
         recipientName: selectedPlayClip.creatorName || profileData?.name || 'Creator',
         title: `Unlocked Climer: ${selectedPlayClip.clipTitle || 'Climax Video'}`,
         amount: price
       });

       let opened = false;
       if (paymentWindow && !paymentWindow.closed) {
         try {
           paymentWindow.location.href = data.data.authorization_url;
           opened = true;
         } catch (e) {
           console.warn("Could not set popup location:", e);
         }
       }
       if (!opened) {
         try {
           const win = window.open(data.data.authorization_url, '_blank', 'noopener,noreferrer');
           if (win) opened = true;
         } catch (e) {}
       }

       const pollInterval = setInterval(async () => {
         try {
           const ok = await handleVerifyClipUnlock(reference);
           if (ok) {
             clearInterval(pollInterval);
           }
         } catch (e) {
           console.error("Polling error:", e);
         }
       }, 1200);

       setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
     } else {
       if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
       toast.error(data.error || "Failed to initialize Paystack payment.");
       setIsProcessingClipUnlock(false);
     }
   } catch (e) {
     if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
     toast.error("Payment initialization failed.");
     setIsProcessingClipUnlock(false);
   }
 };

 const handleDrop = (e: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
 e.preventDefault();
 if (e.dataTransfer.files && e.dataTransfer.files[0]) {
 if (side === 'front') setIdFront(e.dataTransfer.files[0]);
 if (side === 'back') setIdBack(e.dataTransfer.files[0]);
 }
 };

 const handleValidation = async () => {
 if (!auth.currentUser) {
 alert("Please login first.");
 return;
 }
 if (!idFront || !idBack) {
 alert("Please provide both front and back of your ID.");
 return;
 }
 setVerificationStatus('uploading');

 try {
 const userId = auth.currentUser.uid;
 let downloadURL = "";
 let fallbackDataUrl: string | null = null;

  try {
    let uploadDocFile = idFront;
    try {
      const optimized = await optimizeMediaImage(idFront, 1200, 0.85);
      uploadDocFile = optimized.file;
      fallbackDataUrl = optimized.dataUrl;
    } catch (e) {
      console.warn("ID compression skipped:", e);
    }
    const storageRef = ref(storage, `id_verifications/${userId}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, uploadDocFile);
    downloadURL = await getDownloadURL(storageRef);
  } catch (storageErr) {
    console.warn("Storage upload failed, falling back to compact data url", storageErr);
    if (fallbackDataUrl) {
      downloadURL = fallbackDataUrl;
    } else {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(idFront);
      });
      downloadURL = base64;
    }
  }

 await setDoc(doc(db, 'verifications', auth.currentUser.uid), {
 userId: auth.currentUser.uid,
 status: 'pending',
 timestamp: new Date().toISOString(),
 email: auth.currentUser.email || '',
 name: profileData.name || auth.currentUser.displayName || 'Creator',
 documentUrl: downloadURL
 });
 setVerificationStatus('processing');
 } catch (error) {
 console.error(error);
 setVerificationStatus('unverified');
 }
 };

 useEffect(() => {
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (!user) return;
 
 const userDocRef = doc(db, 'users', user.uid);
 const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
 if (docSnap.exists()) {
 const data = docSnap.data();
 setProfileData((prev: any) => ({
 ...prev,
 id: user.uid,
 uid: user.uid,
 name: data.displayName || data.name || prev.name,
 displayName: data.displayName || data.name || prev.displayName,
 username: data.username || prev.username || (data.name ? data.name.toLowerCase().replace(/\s+/g, '_') : user.email?.split('@')[0] || 'user'),
 bio: data.bio || prev.bio || '',
 country: data.country || prev.country,
 phoneNumber: data.phoneNumber || prev.phoneNumber,
 avatarUrl: data.avatarUrl || data.photoURL || prev.avatarUrl,
 paymentType: data.paymentType || prev.paymentType,
 paymentNumber: data.paymentNumber || prev.paymentNumber,
 bankName: data.bankName || prev.bankName,
 branchName: data.branchName || prev.branchName,
 unlocksCount: Number(data.unlocksCount) || 0,
 supportsCount: Number(data.supportsCount) || 0,
 subscribersCount: Number(data.subscribersCount) || 0
 }));
 } else {
 setProfileData((prev: any) => ({
 ...prev,
 id: user.uid,
 uid: user.uid,
 name: user.displayName || user.email?.split('@')[0] || "New User",
 displayName: user.displayName || user.email?.split('@')[0] || "New User",
 username: user.email?.split('@')[0] || "user",
 avatarUrl: user.photoURL || "",
 unlocksCount: 0,
 supportsCount: 0,
 subscribersCount: 0
 }));
 }
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
 });

 const unsubVerif = onSnapshot(doc(db, 'verifications', user.uid), (docSnap) => {
 if (docSnap.exists()) {
 const d = docSnap.data();
 if (d.status === 'approved') {
 setIsFirebaseVerified(true);
 setVerificationStatus('verified');
 } else if (d.status === 'pending') {
 setVerificationStatus('processing');
 setIsFirebaseVerified(false);
 } else {
 setVerificationStatus('unverified');
 setIsFirebaseVerified(false);
 }
 } else {
 setVerificationStatus('unverified');
 setIsFirebaseVerified(false);
 }
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `verifications/${user.uid}`);
 });

 const historyRef = collection(db, 'users', user.uid, 'watchHistory');
 const q = query(historyRef, orderBy('updatedAt', 'desc'), limit(10));
 const unsubHistory = onSnapshot(q, (snapshot) => {
 const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setWatchHistory(historyData);
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `users/${user.uid}/watchHistory`);
 });

 // Listen to saved Collections/folders
 const collectionsRef = collection(db, 'users', user.uid, 'savedCollections');
 const collectionsQuery = query(collectionsRef, orderBy('createdAt', 'desc'));
 const unsubCollections = onSnapshot(collectionsQuery, (snap) => {
 const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
 setCollections(list);
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `users/${user.uid}/savedCollections`);
 });

 // Listen to saved clips
 const savedClipsRef = collection(db, 'users', user.uid, 'savedEpisodes');
 const savedClipsQuery = query(savedClipsRef, orderBy('savedAt', 'desc'));
 const unsubSavedClips = onSnapshot(savedClipsQuery, (snap) => {
 const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
 setSavedClips(list);
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `users/${user.uid}/savedClips`);
 });

 const targetCreatorId = isOwner && user ? user.uid : (profileData?.id || user.uid);
 const subsRef = collection(db, 'users', targetCreatorId, 'subscribers');
 const unsubSubs = onSnapshot(subsRef, (snap) => {
 setSubscribersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
 }, (err) => console.warn(err));

 const supsRef = collection(db, 'users', targetCreatorId, 'supporters');
 const unsubSups = onSnapshot(supsRef, (snap) => {
 setSupportersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
 }, (err) => console.warn(err));

 const mySubsRef = collection(db, 'users', user.uid, 'subscriptions');
 const unsubMySubs = onSnapshot(mySubsRef, (snap) => {
 setSubscribedCreatorsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
 }, (err) => console.warn(err));

 return () => {
 unsubProfile();
 unsubVerif();
 unsubHistory();
 unsubCollections();
 unsubSavedClips();
 unsubSubs();
 unsubSups();
 unsubMySubs();
 };
 });

 // Public realtime listener for live votes
 let currentCreatorId = isOwner && auth.currentUser ? auth.currentUser.uid : (profileData?.id || auth.currentUser?.uid || 'system_creator');
 const unsubVotes = onSnapshot(doc(db, 'streams', `${currentCreatorId}_live_votes`), (docSnap) => {
 if (docSnap.exists()) {
 const d = docSnap.data();
 setLiveVoteCount(d.count || 0);
 if (auth.currentUser && d.voters && d.voters[auth.currentUser.uid]) {
 setHasVotedForLive(true);
 }
 }
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, `streams/${currentCreatorId}_live_votes`);
 });

 return () => {
 unsubscribeAuth();
 unsubVotes();
 };
 }, [isOwner]);

 const handleVoteForLive = async () => {
 if (!auth.currentUser) {
 alert("Please login first to cast a vote.");
 return;
 }
 if (hasVotedForLive) return;
 const targetCreatorId = isAccountOwner ? auth.currentUser.uid : (effectiveHandle || profileData?.id || 'creator');
 const voteRef = doc(db, 'streams', `${targetCreatorId}_live_votes`);
 try {
 setHasVotedForLive(true); // Optimistic
 await updateDoc(voteRef, {
 count: increment(1),
 [`voters.${auth.currentUser.uid}`]: true,
 updatedAt: serverTimestamp()
 });
 } catch (error: any) {
 if (error.code === 'not-found') {
 await setDoc(voteRef, {
 count: 1,
 voters: { [auth.currentUser.uid]: true },
 updatedAt: serverTimestamp()
 });
 } else {
 console.error("Failed to cast vote:", error);
 setHasVotedForLive(false); // Revert optimistic if error
 }
 }
 };

 // Create organization folder
 const handleCreateCollection = async () => {
 if (!auth.currentUser) return;
 if (!newFolderName.trim()) {
 alert("Please enter a collection folder name.");
 return;
 }
 try {
 const colId = `folder_${Date.now()}`;
 await setDoc(doc(db, 'users', auth.currentUser.uid, 'savedCollections', colId), {
 name: newFolderName.trim(),
 description: newFolderDesc.trim(),
 createdAt: serverTimestamp()
 });
 setNewFolderName('');
 setNewFolderDesc('');
 setIsCreatingFolder(false);
 } catch (err) {
 console.error("Error creating folder collection:", err);
 alert("Failed to create folder.");
 }
 };

 // Trigger updating collection folders
 const handleUpdateCollection = async (folderId: string) => {
 if (!auth.currentUser) return;
 if (!editingFolderName.trim()) {
 alert("Please enter a name for the folder.");
 return;
 }
 try {
 await updateDoc(doc(db, 'users', auth.currentUser.uid, 'savedCollections', folderId), {
 name: editingFolderName.trim(),
 description: editingFolderDesc.trim()
 });
 setEditingFolderId(null);
 } catch (err) {
 console.error("Error updating folder:", err);
 alert("Could not update folder details.");
 }
 };

 // Delete folder. Associated clips are moved back to uncategorized (collectionId = null) for safety
 const handleDeleteCollection = async (folderId: string, folderName: string) => {
 if (!auth.currentUser) return;
 if (!confirm(`Are you sure you want to delete"${folderName}"? Clips in this folder will be kept under 'All Saved'.`)) return;
 try {
 // Find all clips inside it and unassign them
 const clipsInFolder = savedClips.filter(ep => ep.collectionId === folderId);
 for (const ep of clipsInFolder) {
 await updateDoc(doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', ep.id), {
 collectionId: null
 });
 }
 // Delete the folder itself
 const folderRef = doc(db, 'users', auth.currentUser.uid, 'savedCollections', folderId);
 
 await deleteDoc(folderRef);
 if (activeCollectionId === folderId) {
 setActiveCollectionId(null);
 }
 } catch (err) {
 console.error("Error deleting folder:", err);
 alert("Could not delete folder.");
 }
 };

 // Check if a clip or climer is already in saved list
 const isItemSaved = (itemId?: string, itemTitle?: string) => {
  if (!itemId && !itemTitle) return false;
  return savedClips.some(sc => 
   (itemId && (sc.id === itemId || sc.episodeId === itemId || sc.slug === itemId)) ||
   (itemTitle && (sc.clipTitle === itemTitle || sc.episodeTitle === itemTitle || sc.title === itemTitle))
  );
 };

 // Toggle saving a clip or climer to user's saved collection
 const handleToggleSaveItem = async (item: {
  id?: string;
  title: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  creatorName?: string;
  creatorHandle?: string;
  creatorAvatar?: string;
  price?: number;
  lockTime?: number;
  isClimer?: boolean;
  slug?: string;
 }) => {
  if (!auth.currentUser) {
   toast.error("Please sign in to save clips and climers.");
   return;
  }
  const rawId = item.id || item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `clip_${Date.now()}`;
  const cleanId = rawId.replace(/\//g, '_');
  const savedDocRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', cleanId);
  const alreadySaved = isItemSaved(cleanId, item.title);

  try {
   if (alreadySaved) {
    await deleteDoc(savedDocRef);
    toast.success("Removed from Saves");
   } else {
    await setDoc(savedDocRef, {
     id: cleanId,
     episodeId: cleanId,
     episodeTitle: item.title,
     clipTitle: item.title,
     title: item.title,
     seriesId: cleanId,
     seriesTitle: item.title,
     creatorName: item.creatorName || (isOwner ? profileData.name : "Creator"),
     creatorHandle: item.creatorHandle || effectiveHandle || "@creator",
     creatorAvatar: item.creatorAvatar || profileData.avatarUrl || "",
     videoUrl: item.videoUrl || "",
     thumbnail: item.thumbnailUrl || (item.videoUrl ? "" : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=400"),
     price: Number(item.price) || 0,
     lockTime: Number(item.lockTime) || 0,
     isClimer: !!item.isClimer || !!item.lockTime,
     slug: item.slug || cleanId,
     savedAt: serverTimestamp(),
     collectionId: null
    });
    toast.success("Saved to Saves", {
     action: {
      label: "View Saves",
      onClick: () => setActiveTab('saved')
     }
    });
   }
  } catch (err) {
   console.error("Error toggling save for item:", err);
   toast.error("Could not update saves");
  }
 };

 // Remove saved clip from bookmarked favorites list
 const handleDeleteSavedClip = async (savedId: string) => {
 if (!auth.currentUser) return;
 try {
 
 await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', savedId));
 } catch (err) {
 console.error("Error removing saved clip:", err);
 alert("Could not remove clip.");
 }
 };

 // Move saved clip to another folder
 const handleMoveClip = async (savedId: string, newColId: string | null) => {
 if (!auth.currentUser) return;
 try {
 await updateDoc(doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', savedId), {
 collectionId: newColId
 });
 } catch (err) {
 console.error("Error moving clip:", err);
 alert("Could not move clip.");
 }
 };

 const renderSavedTab = () => {
 return (
 <div id="saved-videos-profile-section" className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
  <Bookmark className="w-4 h-4 text-red-500 fill-red-500/20" />
  Saves
 </h3>
 <p className="text-[11px] text-gray-500 dark:text-gray-400">Quick access to all your bookmarked clips & scenes.</p>
 </div>
 <span className="p-1 px-2.5 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-mono tracking-wider">
 {savedClips.length} {savedClips.length === 1 ? 'Video' : 'Videos'}
 </span>
 </div>

 {savedClips.length > 0 ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-transparent">
 {savedClips.map((ep) => {
   const isClimerItem = ep.isClimer || Boolean(ep.lockTime && Number(ep.lockTime) > 0);
   return (
 <div 
 key={ep.id}
 className="group border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden relative hover:border-red-500/40 transition-all flex flex-col justify-between"
 >
 {/* Visual top thumb */}
 <div className="aspect-[3/4] bg-black relative overflow-hidden flex items-center justify-center">
 {ep.videoUrl ? (
   <video 
     src={ep.videoUrl} 
     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" 
     muted 
     playsInline 
     preload="metadata"
   />
 ) : (
   <img 
     src={ep.thumbnail || `https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=300`} 
     alt={ep.clipTitle || ep.title} 
     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
   />
 )}

 {/* Climer / Clip Type Badge */}
 <div className="absolute top-2 left-2 z-10">
   {isClimerItem ? (
     <span className="text-[8.5px] font-mono font-bold bg-red-600 text-white px-2 py-0.5 rounded-full shadow-md uppercase">
       CLIMER {ep.price ? `• GHS ${Number(ep.price).toFixed(2)}` : ''}
     </span>
   ) : (
     <span className="text-[8.5px] font-mono font-bold bg-black/70 backdrop-blur-md text-zinc-200 border border-white/20 px-2 py-0.5 rounded-full shadow-md uppercase">
       CLIP
     </span>
   )}
 </div>

 {/* Play Overlay */}
 <button 
 onClick={() => handleOpenVideo(ep, isClimerItem)}
 className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
 title="Play saved video"
 >
 <PlayCircle className="w-12 h-12 text-red-500 fill-black scale-95 group-hover:scale-100 transition-transform duration-300"/>
 </button>

 <button 
 onClick={(e) => {
   e.stopPropagation();
   handleDeleteSavedClip(ep.id);
 }}
 className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer z-20"
 title="Remove bookmark"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 </button>
 </div>

 {/* Clip details */}
 <div className="p-3 space-y-1 bg-white dark:bg-neutral-900 flex-1 flex flex-col justify-between">
 <div>
 <span className="text-[9px] font-mono font-bold uppercase text-red-500 tracking-wider block truncate">
 {ep.creatorName || 'Creator'}
 </span>
 <h4 
 onClick={() => handleOpenVideo(ep, isClimerItem)}
 className="font-bold text-xs truncate text-gray-900 dark:text-white hover:text-red-500 cursor-pointer"
 title={ep.clipTitle || ep.title}
 >
 {ep.clipTitle || ep.title}
 </h4>
 <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
 Context: <span className="font-medium text-gray-700 dark:text-zinc-300">{ep.seriesTitle || ep.title}</span>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl">
 <Bookmark className="w-10 h-10 text-gray-400 mx-auto mb-2 animate-pulse"/>
 <p className="text-xs font-medium text-gray-700 dark:text-gray-300">No saves yet</p>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
 Tap the save bookmark icon on any clip or climer across the feeds or creators' profiles to save them right here!
 </p>
 </div>
 )}
 </div>
 );
 };

 const renderCommunityTab = () => {
 return (
 <div id="community-profile-section" className="space-y-6 animate-fade-in">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/60 dark:border-white/10 pb-4">
 <div>
 <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
 <Users className="w-4 h-4 text-red-500" />
 Community & Network
 </h3>
 </div>

 {/* Sub-filter tabs */}
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800/80 p-1 rounded-xl self-start sm:self-auto border border-gray-200/50 dark:border-white/5">
 <button
 type="button"
 onClick={() => setCommunityFilter('subscribers')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
 communityFilter === 'subscribers'
 ? 'bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-xs'
 : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
 }`}
 >
 Subscribers ({subscribersList.length})
 </button>
 <button
 type="button"
 onClick={() => setCommunityFilter('supporters')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
 communityFilter === 'supporters'
 ? 'bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-xs'
 : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
 }`}
 >
 Supporters ({supportersList.length})
 </button>
 <button
 type="button"
 onClick={() => setCommunityFilter('subscribed')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
 communityFilter === 'subscribed'
 ? 'bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-xs'
 : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
 }`}
 >
 Subscribed ({subscribedCreatorsList.length})
 </button>
 </div>
 </div>

 {/* Content based on sub-filter */}
 {communityFilter === 'subscribers' && (
 subscribersList.length === 0 ? (
 <div className="py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
 No subscribers yet. Share your channel subscription link on socials to start earning!
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {subscribersList.map((sub) => (
 <div key={sub.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 transition-all">
 <div className="flex items-center gap-3 min-w-0">
 {(sub.avatar || sub.avatarUrl) ? (
 <img src={sub.avatar || sub.avatarUrl} alt={sub.name} className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-200 dark:border-white/10" />
 ) : (
 <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
 <User className="w-5 h-5 text-gray-400" />
 </div>
 )}
 <div className="min-w-0">
 <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{sub.name || 'Supporter'}</h4>
 <p className="text-[11px] text-gray-500 font-mono dark:text-gray-400">{sub.handle || '@fan'}</p>
 <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub.plan || 'Monthly Pass'} • Joined {sub.joinedDate || 'recently'}</p>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-mono border border-emerald-200 dark:border-emerald-800/40">
 {sub.amount || `GHS ${subscribePrice.toFixed(2)}/mo`}
 </span>
 </div>
 </div>
 ))}
 </div>
 )
 )}

 {communityFilter === 'supporters' && (
 supportersList.length === 0 ? (
 <div className="py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
 No supporters yet. Fans who tip or unlock your exclusive content will appear here!
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {supportersList.map((sup) => (
 <div key={sup.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 transition-all">
 <div className="flex items-center gap-3 min-w-0">
 {(sup.avatar || sup.avatarUrl) ? (
 <img src={sup.avatar || sup.avatarUrl} alt={sup.name} className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-200 dark:border-white/10" />
 ) : (
 <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
 <User className="w-5 h-5 text-gray-400" />
 </div>
 )}
 <div className="min-w-0">
 <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{sup.name || 'Supporter'}</h4>
 <p className="text-[11px] text-gray-500 font-mono dark:text-gray-400">{sup.handle || '@fan'}</p>
 <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{sup.type || 'Direct Support'}: {sup.title || 'Creator Tip'}</p>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 font-mono border border-amber-200 dark:border-amber-800/40">
 + GHS {Number(sup.amount || 0).toFixed(2)}
 </span>
 <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sup.date || 'Recent'}</p>
 </div>
 </div>
 ))}
 </div>
 )
 )}

 {communityFilter === 'subscribed' && (
 subscribedCreatorsList.length === 0 ? (
 <div className="py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
 Not subscribed to any creators yet. Explore the feed and support creators!
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {subscribedCreatorsList.map((creator) => (
 <div key={creator.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 transition-all">
 <div className="flex items-center gap-3 min-w-0">
 {(creator.avatar || creator.avatarUrl) ? (
 <img src={creator.avatar || creator.avatarUrl} alt={creator.name} className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-200 dark:border-white/10" />
 ) : (
 <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
 <User className="w-5 h-5 text-gray-400" />
 </div>
 )}
 <div className="min-w-0">
 <div className="flex items-center gap-1">
 <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{creator.name || 'Creator'}</h4>
 {(creator.creatorVerified || creator.isVerified) && (
   <ShieldCheck className="w-3.5 h-3.5 text-red-500 fill-current shrink-0" />
 )}
 </div>
 <p className="text-[11px] text-gray-500 font-mono dark:text-gray-400">{creator.handle || '@creator'}</p>
 <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{creator.status || 'Active Member'}</p>
 </div>
 </div>
 <button
 type="button"
 className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-white transition-colors shrink-0"
 >
 Subscribed
 </button>
 </div>
 ))}
 </div>
 )
 )}
 </div>
 );
 };

 return (
 <div 
 className="h-full w-full bg-white dark:bg-zinc-950 lg:p-8 overflow-y-auto overscroll-y-contain transition-colors duration-200"
 >
 <div className="max-w-4xl mx-auto pb-36 sm:pb-16 min-h-full">
 
 {/* Header */}
 {viewType === 'private' && (
 <div className="bg-white dark:bg-zinc-950 p-6 lg:rounded-b-2xl border-b border-gray-200 dark:border-white/10 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md">
 <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-4 pl-20 sm:pl-0">
 <h1 className="text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl flex items-center gap-2">
 Account Portal
 </h1>
 </div>
 <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
 <button onClick={() => onNavigateToTab && onNavigateToTab('profile')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <User className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">My Page</span>
 </button>
 <button onClick={() => onNavigateToTab && onNavigateToTab('creator')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <Video className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">Creator Portal</span>
 </button>
 <button onClick={() => onNavigateToTab && onNavigateToTab('funnels')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <Link2 className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">Climer</span>
 </button>
 <button onClick={() => onNavigateToTab && onNavigateToTab('social')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <Smartphone className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">My Social Card</span>
 </button>
 <button onClick={() => onNavigateToTab && onNavigateToTab('tasker')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <FileCheck className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">My Goal Card</span>
 </button>
 <button onClick={() => onNavigateToTab && onNavigateToTab('matrix')} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
 <LayoutDashboard className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
 <span className="text-xs font-bold text-gray-800 dark:text-white">Analytics</span>
 </button>
 </div>
 </div>
 )}

 {viewType === 'public' && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
 className="space-y-8 px-3 lg:px-0"
 >
 {sharedCardType && (
 <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-r from-neutral-900 via-zinc-900 to-black border border-red-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-lg text-white">
 <div className="flex items-center gap-3.5 w-full sm:w-auto">
 <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 group cursor-pointer bg-zinc-800 flex items-center justify-center">
									{profileData.avatarUrl ? (
										<img 
											src={profileData.avatarUrl} 
											alt="Video Preview"
											className="w-full h-full object-cover group-hover:scale-105 transition-transform"
										/>
									) : (
										<User className="w-8 h-8 text-zinc-500" />
									)}
 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
 <PlayCircle className="w-6 h-6 text-red-500 fill-black/60" />
 </div>
 </div>
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
 <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
 {sharedCardType === 'social' ? 'Exclusive Video Card' : 'Goal Video Card'}
 </span>
 </div>
 <p className="font-bold text-sm text-white">
 Series & Episodes by @{sharedHandle || profileData.name || 'creator'}
 </p>
 <p className="text-[11px] text-zinc-400">
 {profileData.isVerified ? 'Verified creator video link • Tap to watch teaser & unlock full episodes' : 'Creator video link • Tap to watch teaser & unlock full episodes'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
 <button 
 onClick={() => {
 const climerEl = document.getElementById('public-climers-grid');
 if (climerEl) climerEl.scrollIntoView({ behavior: 'smooth' });
 }}
 className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
 >
 <Video className="w-3.5 h-3.5" />
 Watch Clips
 </button>
 <button 
 onClick={() => setSharedCardType(null)} 
 className="text-zinc-400 hover:text-white text-[11px] font-bold px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0 cursor-pointer"
 >
 Dismiss
 </button>
 </div>
 </div>
 )}
  {/* Public Creator Header */}
  <div className="relative mb-6 mt-4 px-2 sm:px-3">
    <div className="w-full max-w-4xl mx-auto">

      {/* MOBILE LAYOUT (< sm): Avatar & Name on Left, Counts on Right; Action Buttons on Right directly beneath counts */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Top Row: Left (Avatar + Name & Handle) | Right (Unlock, Subscribe, Support counts) */}
        <div className="flex items-center justify-between gap-2.5 w-full">
          {/* Avatar & Name on the Left */}
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <div className="w-14 h-14 rounded-full p-0.5 bg-white dark:bg-neutral-950 shrink-0 shadow-xs border border-gray-200/80 dark:border-white/10">
              <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                {profileData.avatarUrl ? (
                  <img 
                    src={profileData.avatarUrl} 
                    alt={profileData.displayName || "Profile"} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500">
                    <User className="w-1/2 h-1/2" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex flex-col justify-center text-left">
              <div className="flex items-center gap-1 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1 truncate">
                  {viewType === 'public' ? (profileData.displayName || profileData.name || (effectiveHandle ? effectiveHandle.replace(/^@/, '') : "Creator")) : (profileData.displayName || profileData.name || "My Account")}
                  {((isAccountOwner ? (isFirebaseVerified || profileData.isVerified || verificationStatus === 'verified') : profileData.isVerified)) && (
                    <ShieldCheck className="w-3.5 h-3.5 text-white fill-[#ff0514] shrink-0" title="Verified Creator" />
                  )}
                </h2>
              </div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                @{viewType === 'public' ? (profileData.username || (effectiveHandle ? effectiveHandle.replace(/^@/, '') : 'creator')) : (profileData.username || 'user')}
              </p>
            </div>
          </div>

          {/* Right Side Counts: Unlock, Subscribe, and Support metrics arranged neatly on the right in compact, high-contrast badges */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {/* Unlock Count */}
            <div className="flex flex-col items-center justify-center min-w-[50px] px-2 py-1 rounded-xl bg-gray-100/90 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 select-none">
              <span className="text-xs font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                {profileData.unlocksCount !== undefined ? profileData.unlocksCount : 0}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wider">
                Unlocks
              </span>
            </div>

            {/* Subscribe Count */}
            <button
              type="button"
              onClick={() => {
                if (isAccountOwner) {
                  setActiveTab('community');
                  setCommunityFilter('subscribers');
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[50px] px-2 py-1 rounded-xl bg-gray-100/90 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 ${
                isAccountOwner ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors' : ''
              }`}
            >
              <span className="text-xs font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                {subscribersList.length > 0 ? subscribersList.length : (profileData.subscribersCount !== undefined ? profileData.subscribersCount : 0)}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wider">
                Subscribe
              </span>
            </button>

            {/* Support Count */}
            <button
              type="button"
              onClick={() => {
                if (isAccountOwner) {
                  setActiveTab('community');
                  setCommunityFilter('supporters');
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[50px] px-2 py-1 rounded-xl bg-gray-100/90 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 ${
                isAccountOwner ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors' : ''
              }`}
            >
              <span className="text-xs font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                {supportersList.length > 0 ? supportersList.length : (profileData.supportsCount !== undefined ? profileData.supportsCount : 0)}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wider">
                Support
              </span>
            </button>
          </div>
        </div>

        {/* Right Side Action Buttons: Message, Support, and Subscribe buttons aligned to the right side directly beneath the counts on mobile */}
        <div className="flex items-center justify-end gap-1.5 w-full pt-0.5">
          {/* Message Button */}
          <button 
            type="button"
            onClick={() => {
              if (profileData) {
                try {
                  localStorage.setItem('pultanc_open_chat_user', JSON.stringify({
                    uid: profileData.uid || profileData.id || '',
                    name: profileData.name || profileData.displayName || profileData.username || 'Creator',
                    username: profileData.username || profileData.handle || '',
                    avatarUrl: profileData.avatarUrl || profileData.photoURL || '',
                  }));
                } catch (e) {
                  console.warn('Failed to store chat recipient:', e);
                }
              }
              onNavigateToTab?.("messages");
            }}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 text-[11px] font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <MessageSquare className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span>Message</span>
          </button>

          {/* Support Button */}
          <button 
            type="button"
            onClick={() => setShowTipModal(true)}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 text-[11px] font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>Support</span>
          </button>

          {/* Subscribe Button */}
          <button 
            type="button"
            onClick={handleSubscribeClick}
            className="inline-flex items-center justify-center gap-1 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <span>Subscribe</span>
          </button>
        </div>

        {/* Bio on Mobile */}
        {profileData.bio && (
          <p className="text-[11px] text-gray-600 dark:text-zinc-400 line-clamp-2 px-0.5">
            {profileData.bio}
          </p>
        )}
      </div>

      {/* DESKTOP LAYOUT (sm: and up) - NOT pushed or stacked to the right side */}
      <div className="hidden sm:flex items-start gap-6 p-5 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
        {/* Left: Avatar */}
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full p-0.5 bg-white dark:bg-neutral-950 shrink-0 shadow-sm border border-gray-200/80 dark:border-white/10 group">
          <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
            {profileData.avatarUrl ? (
              <img 
                src={profileData.avatarUrl} 
                alt={profileData.displayName || "Profile"} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500">
                <User className="w-1/2 h-1/2" />
              </div>
            )}
          </div>
        </div>

        {/* Content Column: Name, Stats Row, Bio, and Action Buttons (all naturally aligned to the left) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center text-left space-y-2.5">
          {/* Header Name & Handle */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1 truncate">
                {viewType === 'public' ? (profileData.displayName || profileData.name || (effectiveHandle ? effectiveHandle.replace(/^@/, '') : "Creator")) : (profileData.displayName || profileData.name || "My Account")}
                {((isAccountOwner ? (isFirebaseVerified || profileData.isVerified || verificationStatus === 'verified') : profileData.isVerified)) && (
                  <ShieldCheck className="w-5 h-5 text-white fill-[#ff0514] shrink-0" title="Verified Creator" />
                )}
              </h2>
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate mt-0.5">
              @{viewType === 'public' ? (profileData.username || (effectiveHandle ? effectiveHandle.replace(/^@/, '') : 'creator')) : (profileData.username || 'user')}
            </p>
          </div>

          {/* Desktop Stats Row: Unlocks, Subscribers, Support */}
          <div className="flex items-center gap-6 py-0.5 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1.5 select-none">
              <span className="font-extrabold text-gray-900 dark:text-white text-base">
                {profileData.unlocksCount !== undefined ? profileData.unlocksCount : 0}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Unlocks</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isAccountOwner) {
                  setActiveTab('community');
                  setCommunityFilter('subscribers');
                }
              }}
              className={`flex items-center gap-1.5 ${
                isAccountOwner ? 'cursor-pointer hover:text-red-500 transition-colors' : ''
              }`}
            >
              <span className="font-extrabold text-gray-900 dark:text-white text-base">
                {subscribersList.length > 0 ? subscribersList.length : (profileData.subscribersCount !== undefined ? profileData.subscribersCount : 0)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Subscribers</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAccountOwner) {
                  setActiveTab('community');
                  setCommunityFilter('supporters');
                }
              }}
              className={`flex items-center gap-1.5 ${
                isAccountOwner ? 'cursor-pointer hover:text-red-500 transition-colors' : ''
              }`}
            >
              <span className="font-extrabold text-gray-900 dark:text-white text-base">
                {supportersList.length > 0 ? supportersList.length : (profileData.supportsCount !== undefined ? profileData.supportsCount : 0)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Supporters</span>
            </button>
          </div>

          {/* Bio */}
          {profileData.bio && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 line-clamp-2 max-w-xl">
              {profileData.bio}
            </p>
          )}

          {/* Desktop Action Buttons (Left-aligned, intuitive and spacious) */}
          <div className="flex items-center gap-3 pt-1">
            <button 
              type="button"
              onClick={() => {
                if (profileData) {
                  try {
                    localStorage.setItem('pultanc_open_chat_user', JSON.stringify({
                      uid: profileData.uid || profileData.id || '',
                      name: profileData.name || profileData.displayName || profileData.username || 'Creator',
                      username: profileData.username || profileData.handle || '',
                      avatarUrl: profileData.avatarUrl || profileData.photoURL || '',
                    }));
                  } catch (e) {
                    console.warn('Failed to store chat recipient:', e);
                  }
                }
                onNavigateToTab?.("messages");
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <span>Message</span>
            </button>

            <button 
              type="button"
              onClick={() => setShowTipModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              <span>Support</span>
            </button>

            <button 
              type="button"
              onClick={handleSubscribeClick}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <span>Subscribe</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>

{/* Fan Vote for Exclusive Content */}
 <div className="bg-gray-50/75 dark:bg-neutral-900/50 border border-gray-100 dark:border-gray-500/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
 <div className="flex flex-col items-center text-center">
 <span className="text-xs text-gray-700 dark:text-gray-300 font-medium mt-1">
 {liveVoteCount} {liveVoteCount === 1 ? 'Fan wants' : 'Fans want'} Exclusive Drops & Live Shows!
 </span>
 </div>

 <div className="w-full mt-1">
 {hasVotedForLive ? (
 <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-center text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 animate-bounce">
 <CheckCircle2 className="w-4 h-4 text-red-500"/>
 <span>You voted successfully! 🎉</span>
 </div>
 ) : (
 <div className="relative w-full h-11 bg-gray-100/80 dark:bg-zinc-800 rounded-full overflow-hidden border border-gray-200/50 dark:border-white/5 flex items-center justify-between px-1.5 select-none">
 {/* Filled track progress */}
 <div 
 className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-gray-400 to-gray-500 transition-all duration-75"
 style={{ width: `${Math.max(sliderValue, 8)}%`, borderRadius: '9999px' }}
 />
 
 {/* Sliding label instruction */}
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider animate-pulse">
 {sliderValue > 80 ? 'Release to cast vote!' : 'Slide right to vote'}
 </span>
 </div>

 {/* HTML Slider Input overlaid for perfect cross-platform interaction */}
 <input 
 type="range"
 min="0"
 max="100"
 value={sliderValue} 
 onChange={(e) => {
 const val = parseInt(e.target.value);
 setSliderValue(val);
 }}
 onMouseUp={() => {
 if (sliderValue >= 85) {
 handleVoteForLive();
 }
 setSliderValue(0);
 }}
 onTouchEnd={() => {
 if (sliderValue >= 85) {
 handleVoteForLive();
 }
 setSliderValue(0);
 }}
 className="absolute inset-0 opacity-0 cursor-grab active:cursor-grabbing w-full h-full z-10"
 />

 {/* Beautiful custom handle visual */}
 <div 
 className="h-8 w-8 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center text-gray-600 border border-gray-200/50 dark:border-white/5 transition-all pointer-events-none z-0"
 style={{ 
 transform: `translateX(${sliderValue * 0.78}%)`, // Adjust slider path
 marginLeft: '2px'
 }}
 >
 <Heart className={`w-3.5 h-3.5 fill-[#ff0514] text-gray-500 ${sliderValue > 50 ? 'scale-125 animate-pulse' : ''}`} />
 </div>
 
 <div className="text-gray-500 dark:text-gray-400 font-bold text-xs pr-3 pointer-events-none z-0">
 🔥
 </div>
 </div>
 )}
 </div>
 </div>


 {/* Profile Content Tabs */}
 <div className="pt-8 w-full border-t border-gray-200/50 dark:border-white/10 mt-4">
 <div className="flex items-center justify-center overflow-x-auto gap-2 mb-6 w-full pb-2 no-scrollbar">
 {[
 { id: 'climers', label: 'Climers', icon: Link2 },
 { id: 'series', label: 'Clips', icon: Film },
 { id: 'saved', label: 'Saves', icon: Bookmark },
 ...(isOwner ? [{ id: 'community', label: 'Community', icon: Users }] : []),
 ].map((tab) => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
 isActive
 ? 'bg-red-500 text-white shadow-xs scale-105'
 : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
 }`}
 >
 <Icon className="w-3.5 h-3.5" />
 <span>{tab.label}</span>
 </button>
 );
 })}
 </div>
 
  {activeTab === 'climers' && (() => {
 const clean = effectiveHandle ? effectiveHandle.toLowerCase().replace(/^@/,'') : '';
 const matchingMock = mockSeries.find(s => 
   s.id === effectiveHandle ||
   s.creatorId === effectiveHandle ||
   (s.creatorHandle && s.creatorHandle.toLowerCase().replace(/^@/, '') === clean) ||
   (s.creatorName && s.creatorName.toLowerCase() === clean) ||
   (s.creator && s.creator.toLowerCase() === clean)
 );

 const customClimers = dbFunnels.filter(f => 
   (f.creatorHandle && f.creatorHandle.toLowerCase().replace(/^@/,'') === clean) || 
   (f.creatorName && f.creatorName.toLowerCase() === clean) || 
   f.creatorId === effectiveHandle
 );

 const mockClimers = matchingMock ? matchingMock.episodes.filter(ep => ep.isLocked || ep.isClimer).map((ep, i) => ({
   id: ep.id || `mock_climer_${i}`,
   title: ep.title,
   price: ep.price || 5.0,
   lockTime: 10,
   videoUrl: ep.videoUrl,
   thumbnailUrl: matchingMock.thumbnailUrl,
   creatorName: matchingMock.creatorName || matchingMock.creator,
   creatorHandle: matchingMock.creatorHandle
 })) : [];

 const displayedClimers = isAccountOwner && auth.currentUser
   ? dbFunnels.filter(f => f.creatorId === auth.currentUser?.uid || f.creatorEmail === auth.currentUser?.email)
   : (effectiveHandle 
       ? [...customClimers, ...(customClimers.length === 0 ? mockClimers : [])]
       : []);

 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 px-1 sm:px-0">
 {/* Dynamic Custom Funnels (Climers) */}
 {displayedClimers.length === 0 ? (
 <div className="col-span-full py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
 No climers uploaded yet.
 </div>
 ) : (
 displayedClimers.map((fun, idx) => (
 <div 
 key={fun.id || idx} 
 onClick={() => handleOpenVideo(fun, true)}
 className="aspect-[3/4] bg-neutral-900 sm:rounded-xl overflow-hidden relative group cursor-pointer border border-red-500/25 flex flex-col justify-end animate-fade-in"
 >
  {/* Save / Bookmark Button */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleToggleSaveItem({
        id: fun.id || fun.slug,
        title: fun.title,
        videoUrl: fun.videoUrl,
        thumbnailUrl: fun.thumbnailUrl,
        creatorName: fun.creatorName || profileData.name || "Creator",
        creatorHandle: fun.creatorHandle || effectiveHandle || "@creator",
        creatorAvatar: fun.creatorAvatar || profileData.avatarUrl,
        price: Number(fun.price) || 2.0,
        lockTime: Number(fun.lockTime) || 10,
        isClimer: true,
        slug: fun.slug || fun.id
      });
    }}
    className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
      isItemSaved(fun.id || fun.slug, fun.title)
        ? 'bg-red-600 text-white border border-red-400 shadow-red-600/30'
        : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
    }`}
    title={isItemSaved(fun.id || fun.slug, fun.title) ? "Saved to Saves (Click to remove)" : "Save to Saves"}
  >
    <Bookmark className={`w-3.5 h-3.5 transition-all ${isItemSaved(fun.id || fun.slug, fun.title) ? 'fill-white text-white' : 'text-white'}`} />
  </button>
 {fun.videoUrl ? (
 <video 
 src={fun.videoUrl} 
 className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
 muted
 playsInline
 preload="metadata"
 />
 ) : (
 <img 
 src={fun.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400`} 
 alt="Thumbnail" 
 className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-65"
 />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none"/>
 <div className="relative p-3 z-10 space-y-1">
 <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-widest bg-red-950/80 px-2 py-0.5 rounded border border-red-500/30">
 GHS {(Number(fun.price) || 2.0).toFixed(2)}
 </span>
 <h4 className="text-xs font-bold text-white line-clamp-1">{fun.title}</h4>
 <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1">
 <PlayCircle className="w-3.5 h-3.5 text-red-500"/> Locked at {(Number(fun.lockTime) || 10).toFixed(1)}s
 </span>
 </div>
 </div>
 ))
 )}
 </div>
 );
 })()}

 {activeTab === 'series' && (() => {
 const clean = effectiveHandle ? effectiveHandle.toLowerCase().replace(/^@/,'') : '';
 const matchingMock = mockSeries.find(s => 
   s.id === effectiveHandle ||
   s.creatorId === effectiveHandle ||
   (s.creatorHandle && s.creatorHandle.toLowerCase().replace(/^@/, '') === clean) ||
   (s.creatorName && s.creatorName.toLowerCase() === clean) ||
   (s.creator && s.creator.toLowerCase() === clean)
 );

 const customClips = [
   ...dbClips.filter(c => !c.isClimer && c.type !== 'climer'),
   ...dbFunnels.filter(f => f.isClimer === false && f.type === 'clip')
 ].filter(f => 
   (f.creatorHandle && f.creatorHandle.toLowerCase().replace(/^@/,'') === clean) || 
   (f.creatorName && f.creatorName.toLowerCase() === clean) || 
   f.creatorId === effectiveHandle
 );

 const mockClips = matchingMock ? matchingMock.episodes
   .filter(ep => !ep.isClimer && !ep.isLocked)
   .map((ep, i) => ({
   id: ep.id || `mock_clip_${i}`,
   title: ep.title,
   price: 0,
   videoUrl: ep.videoUrl,
   thumbnailUrl: matchingMock.thumbnailUrl,
   creatorName: matchingMock.creatorName || matchingMock.creator,
   creatorHandle: matchingMock.creatorHandle,
   isClimer: false
 })) : [];

 const displayedClips = isAccountOwner && auth.currentUser
   ? [
       ...dbClips.filter(c => (c.creatorId === auth.currentUser?.uid || c.creatorEmail === auth.currentUser?.email) && !c.isClimer && c.type !== 'climer'),
       ...dbFunnels.filter(f => (f.creatorId === auth.currentUser?.uid || f.creatorEmail === auth.currentUser?.email) && f.isClimer === false && f.type === 'clip')
     ]
   : (effectiveHandle 
       ? [...customClips, ...(customClips.length === 0 ? mockClips : [])]
       : []);

 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 px-1 sm:px-0">
 {displayedClips.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                  No video clips published yet. Upload your first clip in the Creator Portal.
                </div>
              ) : (
                displayedClips.map((fun, idx) => (
                  <div 
                    key={fun.id || idx} 
                    onClick={() => handleOpenVideo(fun, false)}
                    className="aspect-[3/4] bg-neutral-900 sm:rounded-xl overflow-hidden relative group cursor-pointer border border-gray-200 dark:border-white/10 flex flex-col justify-end animate-fade-in"
                  >
                    {/* Save / Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSaveItem({
                          id: fun.id || fun.slug,
                          title: fun.title,
                          videoUrl: fun.videoUrl,
                          thumbnailUrl: fun.thumbnailUrl,
                          creatorName: fun.creatorName || (isOwner ? profileData.name : "Creator"),
                          creatorHandle: fun.creatorHandle || effectiveHandle || "@creator",
                          creatorAvatar: fun.creatorAvatar || profileData.avatarUrl,
                          price: Number(fun.price || 0),
                          isClimer: false,
                          slug: fun.slug || fun.id
                        });
                      }}
                      className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
                        isItemSaved(fun.id || fun.slug, fun.title)
                          ? 'bg-red-600 text-white border border-red-400 shadow-red-600/30'
                          : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
                      }`}
                      title={isItemSaved(fun.id || fun.slug, fun.title) ? "Saved to Saves (Click to remove)" : "Save to Saves"}
                    >
                      <Bookmark className={`w-3.5 h-3.5 transition-all ${isItemSaved(fun.id || fun.slug, fun.title) ? 'fill-white text-white' : 'text-white'}`} />
                    </button>
                    {fun.videoUrl ? (
                      <video 
                        src={fun.videoUrl} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img 
                        src={fun.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400`} 
                        alt="Thumbnail" 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none"/>
                    <div className="relative p-3 z-10 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-widest bg-zinc-800/80 px-2 py-0.5 rounded border border-white/10">
                        Clip
                      </span>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{fun.title}</h4>
                      <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1">
                        <Film className="w-3.5 h-3.5 text-red-500"/> Clip
                      </span>
                    </div>
                  </div>
                ))
              )}
 </div>
 );
 })()}

 {activeTab === 'saved' && renderSavedTab()}
 {activeTab === 'community' && isOwner && renderCommunityTab()}


 </div>
 </motion.div>
 )}

 {viewType === 'private' && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
 className="space-y-8 px-3 lg:px-0"
 >
 {/* Account Profile Tabs */}
 <div className="flex items-center justify-center overflow-x-auto gap-2 mb-6 w-full pb-2 no-scrollbar">
 {[
 { id: 'climers', label: 'Climers', icon: Link2 },
 { id: 'series', label: 'Clips', icon: Film },
 { id: 'saved', label: 'Saves', icon: Bookmark },
 { id: 'community', label: 'Community', icon: Users },
 ].map((tab) => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
 isActive
 ? 'bg-red-500 text-white shadow-xs scale-105'
 : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
 }`}
 >
 <Icon className="w-3.5 h-3.5" />
 <span>{tab.label}</span>
 </button>
 );
 })}
 </div>

  {activeTab === 'climers' && (() => {
 const displayedClimers = isAccountOwner && auth.currentUser
   ? dbFunnels.filter(f => f.creatorId === auth.currentUser?.uid || f.creatorEmail === auth.currentUser?.email)
   : (effectiveHandle 
       ? dbFunnels.filter(f => (f.creatorHandle && f.creatorHandle.toLowerCase().replace(/^@/,'') === effectiveHandle.toLowerCase().replace(/^@/,'')) || (f.creatorName && f.creatorName.toLowerCase() === effectiveHandle.toLowerCase()) || f.creatorId === effectiveHandle)
       : []);

 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 px-1 sm:px-0">
 {/* Dynamic Custom Funnels (Climers) */}
 {displayedClimers.length === 0 ? (
 <div className="col-span-full py-12 text-center text-gray-500 text-xs">
 No climers uploaded yet.
 </div>
 ) : (
 displayedClimers.map((fun, idx) => (
 <div 
 key={fun.id || idx} 
 onClick={() => handleOpenVideo(fun, true)}
 className="aspect-[3/4] bg-neutral-900 sm:rounded-xl overflow-hidden relative group cursor-pointer border border-red-500/25 flex flex-col justify-end animate-fade-in"
 >
  {/* Save / Bookmark Button */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleToggleSaveItem({
        id: fun.id || fun.slug,
        title: fun.title,
        videoUrl: fun.videoUrl,
        thumbnailUrl: fun.thumbnailUrl,
        creatorName: fun.creatorName || profileData.name || "Creator",
        creatorHandle: fun.creatorHandle || effectiveHandle || "@creator",
        creatorAvatar: fun.creatorAvatar || profileData.avatarUrl,
        price: Number(fun.price) || 2.0,
        lockTime: Number(fun.lockTime) || 10,
        isClimer: true,
        slug: fun.slug || fun.id
      });
    }}
    className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
      isItemSaved(fun.id || fun.slug, fun.title)
        ? 'bg-red-600 text-white border border-red-400 shadow-red-600/30'
        : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
    }`}
    title={isItemSaved(fun.id || fun.slug, fun.title) ? "Saved to Saves (Click to remove)" : "Save to Saves"}
  >
    <Bookmark className={`w-3.5 h-3.5 transition-all ${isItemSaved(fun.id || fun.slug, fun.title) ? 'fill-white text-white' : 'text-white'}`} />
  </button>
 {fun.videoUrl ? (
 <video 
 src={fun.videoUrl} 
 className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
 muted
 playsInline
 preload="metadata"
 />
 ) : (
 <img 
 src={fun.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400`} 
 alt="Thumbnail"
 className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-65"
 />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none"/>
 <div className="relative p-3 z-10 space-y-1">
 <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-widest bg-red-950/80 px-2 py-0.5 rounded border border-red-500/30">
 GHS {Number(fun.price || 0).toFixed(2)}
 </span>
 <h4 className="text-xs font-bold text-white line-clamp-1">{fun.title}</h4>
 <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1">
 <PlayCircle className="w-3.5 h-3.5 text-red-500"/> Locked at {Number(fun.lockTime || 0).toFixed(1)}s
 </span>
 </div>
 </div>
 ))
 )}
 </div>
 );
 })()}

 {activeTab === 'series' && (() => {
 const displayedClips = isAccountOwner && auth.currentUser
   ? [
       ...dbClips.filter(c => (c.creatorId === auth.currentUser?.uid || c.creatorEmail === auth.currentUser?.email) && !c.isClimer && c.type !== 'climer'),
       ...dbFunnels.filter(f => (f.creatorId === auth.currentUser?.uid || f.creatorEmail === auth.currentUser?.email) && f.isClimer === false && f.type === 'clip')
     ]
   : (effectiveHandle 
       ? [
           ...dbClips.filter(c => ((c.creatorHandle && c.creatorHandle.toLowerCase().replace(/^@/,'') === effectiveHandle.toLowerCase().replace(/^@/,'')) || (c.creatorName && c.creatorName.toLowerCase() === effectiveHandle.toLowerCase()) || c.creatorId === effectiveHandle) && !c.isClimer && c.type !== 'climer'),
           ...dbFunnels.filter(f => ((f.creatorHandle && f.creatorHandle.toLowerCase().replace(/^@/,'') === effectiveHandle.toLowerCase().replace(/^@/,'')) || (f.creatorName && f.creatorName.toLowerCase() === effectiveHandle.toLowerCase()) || f.creatorId === effectiveHandle) && f.isClimer === false && f.type === 'clip')
         ]
       : []);

 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 px-1 sm:px-0">
 {displayedClips.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500 text-xs bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                  No video clips published yet. Upload your first clip in the Creator Portal.
                </div>
              ) : (
                displayedClips.map((fun, idx) => (
                  <div 
                    key={fun.id || idx} 
                    onClick={() => handleOpenVideo(fun, false)}
                    className="aspect-[3/4] bg-neutral-900 sm:rounded-xl overflow-hidden relative group cursor-pointer border border-gray-200 dark:border-white/10 flex flex-col justify-end animate-fade-in"
                  >
                    {/* Save / Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSaveItem({
                          id: fun.id || fun.slug,
                          title: fun.title,
                          videoUrl: fun.videoUrl,
                          thumbnailUrl: fun.thumbnailUrl,
                          creatorName: fun.creatorName || (isOwner ? profileData.name : "Creator"),
                          creatorHandle: fun.creatorHandle || effectiveHandle || "@creator",
                          creatorAvatar: fun.creatorAvatar || profileData.avatarUrl,
                          price: Number(fun.price || 0),
                          isClimer: false,
                          slug: fun.slug || fun.id
                        });
                      }}
                      className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
                        isItemSaved(fun.id || fun.slug, fun.title)
                          ? 'bg-red-600 text-white border border-red-400 shadow-red-600/30'
                          : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
                      }`}
                      title={isItemSaved(fun.id || fun.slug, fun.title) ? "Saved to Saves (Click to remove)" : "Save to Saves"}
                    >
                      <Bookmark className={`w-3.5 h-3.5 transition-all ${isItemSaved(fun.id || fun.slug, fun.title) ? 'fill-white text-white' : 'text-white'}`} />
                    </button>
                    {fun.videoUrl ? (
                      <video 
                        src={fun.videoUrl} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img 
                        src={fun.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400`} 
                        alt="Thumbnail" 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none"/>
                    <div className="relative p-3 z-10 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-widest bg-zinc-800/80 px-2 py-0.5 rounded border border-white/10">
                        Clip
                      </span>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{fun.title}</h4>
                      <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1">
                        <Film className="w-3.5 h-3.5 text-red-500"/> Clip
                      </span>
                    </div>
                  </div>
                ))
              )}
 </div>
 );
 })()}

 {activeTab === 'saved' && renderSavedTab()}
 {activeTab === 'community' && renderCommunityTab()}

 {activeTab === 'settings' && (
 <>
 {/* User Info Overview */}
 <div className="layered-container p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 relative">
 <div 
 onClick={() => fileInputRef.current?.click()}
 onDragOver={(e) => {
 e.preventDefault();
 setIsDragOver(true);
 }}
 onDragLeave={() => setIsDragOver(false)}
 onDrop={handleAvatarDrop}
 className={`w-24 h-24 rounded-full bg-gray-200 border-2 shrink-0 overflow-hidden relative group cursor-pointer transition-all ${isDragOver ? 'border-red-500 ring-2 ring-red-400' : 'border-gray-300'}`}
 >
 {profileData.avatarUrl ? (
									<img 
										src={profileData.avatarUrl} 
										alt="Profile avatar"
										className="w-full h-full object-cover"
									/>
								) : (
									<User className="w-10 h-10 text-gray-400 dark:text-zinc-500" />
								)}
 <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
 <Upload className="w-6 h-6 text-white"/>
 </div>
 {isUploadingAvatar && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
 <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"/>
 </div>
 )}
 <input 
 type="file"
 ref={fileInputRef} 
 onChange={handleAvatarChange} 
 accept="image/*"
 className="hidden"
 />
 </div>

 {isEditingProfile ? (
 <div className="flex-1 space-y-3 w-full">
 <div>
 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">User Name</label>
 <input 
 type="text"
 value={profileData.name}
 onChange={(e) => setProfileData({...profileData, name: e.target.value})}
 className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
 />
 </div>
 <div className="flex gap-3">
 <div className="flex-1">
 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Country</label>
 <select
 value={profileData.country}
 onChange={(e) => setProfileData({...profileData, country: e.target.value})}
 className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-gray-900"
 >
 {COUNTRIES.map(c => (
 <option key={c} value={c}>{c}</option>
 ))}
 </select>
 </div>
 <div className="flex-1">
 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Phone Number</label>
 <input
 type="tel"
 value={profileData.phoneNumber}
 onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})}
 placeholder="e.g. +233 24 123 4567"
 className="w-full max-w-xs bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
 />
 </div>
 </div>
 <div className="pt-2 flex gap-2">
 <button 
 onClick={handleSaveProfile} 
 disabled={isSavingProfile}
 className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg transition-colors text-[11px] flex items-center gap-1.5 disabled:bg-gray-400 cursor-pointer shadow-xs active:scale-95"
 >
 {isSavingProfile ? (
 <>
 <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 Saving...
 </>
 ) : 'Save Changes'}
 </button>
 </div>
 </div>
 ) : (
 <div className="flex-1 space-y-1 w-full">
 <div className="flex justify-between items-start">
 <h2 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
 {profileData.name}
 {verificationStatus === 'verified' && (
 <ShieldCheck className="w-5 h-5 text-white fill-[#ff0514]"/>
 )}
 </h2>
 <button onClick={() => setIsEditingProfile(true)} className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors border border-gray-300 bg-white hover:bg-gray-100 px-3 py-1 rounded-lg">
 Edit Profile
 </button>
 </div>
 <p className="text-gray-600 text-xs flex items-center gap-2 font-mono">
 @{profileData.username || (profileData.name ? profileData.name.toLowerCase().replace(/\s+/g, '_') : 'user')}
 {verificationStatus === 'verified' && (
 <span className="bg-red-500/20 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
 <ShieldCheck className="w-3 h-3 text-white fill-[#ff0514]"/> Verified
 </span>
 )}
 </p>
 <div className="pt-3 flex flex-col sm:flex-row gap-3">
 <button 
 onClick={() => {
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pultanc.com';
                const tag = (profileData.name || 'creator').toLowerCase().replace(/\s+/g, '-');
                const link = `${origin}?profile=${encodeURIComponent(tag)}`;
                try {
                  navigator.clipboard.writeText(link);
                  toast.success('Public profile link copied to clipboard!');
                } catch (err) {
                  const textArea = document.createElement("textarea");
                  textArea.value = link;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand("copy");
                  textArea.remove();
                  toast.success('Public profile link copied to clipboard!');
                }
 }}
 className="text-gray-650 hover:text-gray-900 text-xs font-mono bg-white hover:bg-gray-200 border border-gray-200 flex items-center gap-2 px-3 py-1 rounded w-fit transition-colors"
 title="Copy public profile link"
 >
 <Link className="w-3 h-3"/>
 {`${typeof window !== 'undefined' ? window.location.host : 'pultanc.com'}?profile=${encodeURIComponent((profileData.name || 'creator').toLowerCase().replace(/\s+/g, '-'))}`}
 <Copy className="w-3 h-3 text-gray-400"/>
 </button>
 </div>
 </div>
 )}
 </div>

 {/* KYC Verification Section */}
 <div className="layered-container p-6 mt-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
 <ShieldCheck className="w-5 h-5 text-white fill-[#ff0514]"/>
 Identity Verification (KYC)
 </h3>
 <p className="text-gray-600 text-xs mt-1">Required for creator payouts and extended limits.</p>
 </div>
 {verificationStatus === 'verified' && (
 <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-full">
 <CheckCircle2 className="w-6 h-6"/>
 </div>
 )}
 </div>

 <AnimatePresence mode="wait">
 {verificationStatus === 'unverified' || verificationStatus === 'rejected' ? (
 <motion.div 
 key="unverified"
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="space-y-6"
 >
 <div className="p-4 bg-white border border-gray-200 rounded-xl flex gap-3 text-xs text-gray-700 mb-6">
 <AlertCircle className="w-5 h-5 text-gray-500 shrink-0"/>
 <p>Please upload clear photos of your valid Government ID (Ghana Card, Passport, or Driver's License).</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* ID Front Upload */}
 <label 
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => handleDrop(e, 'front')}
 className={`relative block border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${idFront ? 'border-red-500/50 bg-red-500/5' : 'border-gray-300 bg-white hover:border-red-400'}`}
 >
 {!idFront ? (
 <div className="flex flex-col items-center">
 <CreditCard className="w-8 h-8 text-gray-400 mb-2"/>
 <span className="text-xs font-medium text-gray-900">ID Card Front</span>
 <span className="text-xs text-gray-500 mt-1">Drag file or click to browse</span>
 <input type="file"className="hidden"accept="image/*"onChange={(e) => { if(e.target.files) setIdFront(e.target.files[0]) }} />
 </div>
 ) : (
 <div className="flex flex-col items-center relative z-10">
 <FileImage className="w-8 h-8 text-red-500 mb-2"/>
 <span className="text-xs font-medium text-gray-900 truncate max-w-full">{idFront.name}</span>
 <button type="button"onClick={(e) => { e.preventDefault(); setIdFront(null); }} className="text-xs text-red-500 hover:text-red-600 font-medium mt-2 z-20 relative">Remove</button>
 </div>
 )}
 </label>

 {/* ID Back Upload */}
 <label 
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => handleDrop(e, 'back')}
 className={`relative block border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${idBack ? 'border-red-500/50 bg-red-500/5' : 'border-gray-300 bg-white hover:border-red-400'}`}
 >
 {!idBack ? (
 <div className="flex flex-col items-center">
 <CreditCard className="w-8 h-8 text-gray-400 mb-2 opacity-70"/>
 <span className="text-xs font-medium text-gray-900">ID Card Back</span>
 <span className="text-xs text-gray-500 mt-1">Drag file or click to browse</span>
 <input type="file"className="hidden"accept="image/*"onChange={(e) => { if(e.target.files) setIdBack(e.target.files[0]) }} />
 </div>
 ) : (
 <div className="flex flex-col items-center relative z-10">
 <FileImage className="w-8 h-8 text-red-500 mb-2"/>
 <span className="text-xs font-medium text-gray-900 truncate max-w-full">{idBack.name}</span>
 <button type="button"onClick={(e) => { e.preventDefault(); setIdBack(null); }} className="text-xs text-red-500 hover:text-red-600 font-medium mt-2 z-20 relative">Remove</button>
 </div>
 )}
 </label>
 </div>

 <div className="flex flex-col py-1.5 text-xs pt-6 mt-6 border-t border-gray-100">
 <label className="flex items-start gap-3 cursor-pointer group p-3 bg-white rounded-xl border border-gray-200">
 <input 
 type="checkbox"
 checked={isMerchantAgreed}
 onChange={(e) => setIsMerchantAgreed(e.target.checked)}
 className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
 />
 <span className="text-gray-700">
 I agree to the{' '}
 <button 
 type="button"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setLegalDrawerContent(LEGAL_DOCS.merchant);
 }}
 className="text-gray-900 font-bold underline decoration-gray-400 hover:text-black transition-colors"
 >
 Creator Merchant Agreement with Tuita Nouvelle Ltd
 </button>{' '}
 which outlines platform fee percentage, payment settlement cycles, and content copyright rules.
 </span>
 </label>
 </div>

 <div className="pt-2 flex flex-col items-center gap-3">
 <button 
 onClick={handleValidation}
 disabled={!idFront || !idBack || !isMerchantAgreed}
 className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white font-bold py-1.5 px-5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
 >
 <Upload className="w-5 h-5"/> Submit for Verification
 </button>
 </div>
 </motion.div>
 ) : verificationStatus === 'uploading' || verificationStatus === 'processing' ? (
 <motion.div 
 key="processing"
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="py-12 flex flex-col items-center text-center"
 >
 <motion.div
 animate={{ rotate: 360 }}
 transition={{ repeat: Infinity, duration: 2, ease:"linear"}}
 className="w-16 h-16 border-4 border-gray-200 border-t-red-500 rounded-full mb-6"
 />
 <h3 className="text-xl font-bold text-gray-900 mb-2">
 Review in Progress...
 </h3>
 <p className="text-gray-600 text-xs max-w-sm mx-auto">
 Your ID is currently under manual review by the administration.
 </p>
 </motion.div>
 ) : (
 <motion.div 
 key="verified"
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="py-8"
 >
 <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 flex items-start gap-4">
 <div className="bg-red-500/20 p-2 rounded-full shrink-0">
 <CheckCircle2 className="w-6 h-6 text-red-500"/>
 </div>
 <div>
 <h4 className="text-red-400 font-bold mb-1">Identity Verified Successfully</h4>
 <p className="text-gray-600 text-xs mb-4">Your account is fully approved for creator payouts and elevated streaming limits.</p>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </>
 )}
 </motion.div>
 )}

 {showTipModal && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowTipModal(false)}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative border border-gray-200 shadow-2xl"
      >
        <div className="p-6">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button onClick={() => { setShowTipModal(false); setShowReportModal(true); }} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:border-red-300 text-red-500 hover:text-red-600 shadow-xs flex items-center justify-center transition-all p-1 cursor-pointer" title="Report issue">
              <Flag className="w-3.5 h-3.5 fill-current"/>
            </button>
            <button onClick={() => setShowTipModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors p-1 cursor-pointer">
              <X className="w-5 h-5"/>
            </button>
          </div>
          
          {/* Pultanc Support Checkout Header */}
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
            <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center shrink-0 shadow-xs">
              <Heart className="w-3.5 h-3.5 text-white fill-white"/>
            </div>
            <span className="font-bold text-xs tracking-wider text-gray-900 uppercase">Pultanc Support Checkout</span>
          </div>

          {/* User & Creator Profile Banner */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 mb-5 flex items-center justify-between">
            {/* Supporter (User) */}
            <div className="flex items-center gap-2 text-left min-w-0">
              {loggedInUser.avatarUrl ? (
                <img 
                  src={loggedInUser.avatarUrl} 
                  alt="User Avatar" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-red-500/20 shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-red-500/20 flex items-center justify-center text-gray-500 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Supporter</div>
                <div className="text-xs font-bold text-gray-900 truncate">{loggedInUser.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{loggedInUser.handle}</div>
              </div>
            </div>

            {/* Heart Icon */}
            <div className="px-1.5 shrink-0">
              <div className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center shadow-xs">
                <Heart className="w-3.5 h-3.5 fill-red-500" />
              </div>
            </div>

            {/* Creator Being Supported */}
            <div className="flex items-center gap-2 text-right justify-end min-w-0">
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Creator</div>
                <div className="text-xs font-bold text-gray-900 truncate">{isAccountOwner ? (profileData.displayName || profileData.name) : (profileData.displayName || profileData.name || "Creator")}</div>
                <div className="text-[10px] text-red-500 font-semibold truncate">@{isAccountOwner ? (profileData.username || profileData.name?.toLowerCase().replace(/\s+/g, "_")) : (profileData.username || effectiveHandle?.replace(/^@/, '') || "creator")}</div>
              </div>
              {profileData.avatarUrl ? (
                <img 
                  src={profileData.avatarUrl} 
                  alt="Creator Avatar" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-red-500 shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-red-500 flex items-center justify-center text-gray-500 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-900 mb-1 text-center">Support Creator directly</h3>
          <p className="text-gray-500 text-xs mb-4 text-center">Send custom support to boost {isAccountOwner ? profileData.name : (profileData.displayName || profileData.name || "Creator")}</p>

          {/* Custom Support Amount Input */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 text-left">
              Support Amount (GHS)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">GHS</span>
              <input 
                type="number"
                min="1"
                step="1"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl py-2.5 pl-12 pr-3 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="Enter custom amount in GHS..."
              />
            </div>
          </div>

          {/* Ghana Mobile Money Networks */}
          <div className="flex items-center justify-center gap-2 py-2 mb-3 bg-gray-50 border border-gray-100 rounded-xl text-[9px] font-bold text-gray-600">
            <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">MTN MoMo</span>
            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">Telecel Cash</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">AT Money</span>
          </div>

          {tipPaystackUrl && (
            <a
              href={tipPaystackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all mb-3 cursor-pointer shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Paystack Checkout Tab
            </a>
          )}
          
          <button 
            onClick={handleTipSubmit}
            disabled={isProcessingTip || tipSuccess || !tipAmount || Number(tipAmount) <= 0}
            className={`w-full font-bold text-xs py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2 cursor-pointer ${tipSuccess ? "bg-red-500 text-white scale-105" : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"}`}
          >
            {isProcessingTip ? "Connecting to Paystack..." : tipSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4"/>
                Thank you for supporting!
              </>
            ) : `Send Support (GHS ${Number(tipAmount) || 0})`}
          </button>

          {isProcessingTip && (
            <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-1.5 text-red-600 font-bold text-xs">
                <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0"/>
                <span>Waiting for Paystack confirmation...</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal mb-2.5">
                Complete the payment on Paystack. We will automatically detect and record it!
              </p>
              <button 
                onClick={() => handleVerifyTip()}
                disabled={isCheckingTip}
                className="w-full py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-[10px] uppercase rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isCheckingTip ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    Checking with Paystack...
                  </>
                ) : (
                  <span>Verify Payment Now ⚡</span>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )}

  {showReportModal && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"onClick={() => setShowReportModal(false)}>
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 onClick={(e) => e.stopPropagation()}
 className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative border border-gray-200 shadow-2xl text-gray-900"
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
 className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
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
 </div>
 )}

 {showSubscribeModal && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"onClick={() => setShowSubscribeModal(false)}>
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 onClick={(e) => e.stopPropagation()}
 className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative border border-gray-200"
 >
 <div className="p-6">
 <div className="absolute top-4 right-4 flex items-center gap-2">
 <button onClick={() => { setShowSubscribeModal(false); setShowReportModal(true); }} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:border-red-300 text-red-500 hover:text-red-600 shadow-xs flex items-center justify-center transition-all p-1 cursor-pointer" title="Report issue">
 <Flag className="w-3.5 h-3.5 fill-current"/>
 </button>
 <button onClick={() => setShowSubscribeModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors p-1">
 <X className="w-5 h-5"/>
 </button>
 </div>
 
 {/* Pultanc App Checkout Header */}
 <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
 <span className="font-bold text-xs tracking-wider text-gray-900 uppercase">Pultanc Secure Checkout</span>
 </div>

 <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-3">
 <UserCheck className="w-6 h-6"/>
 </div>
 <h2 className="text-xl font-bold text-gray-900 mb-1">GHS {selectedSubTier.toFixed(2)}/mo</h2>
 <p className="text-gray-600 text-xs mb-4">
 Select your monthly subscription plan to unlock exclusive clips, drops, and series:
 </p>

 {/* 3 Subscription Tiers: 5, 15, 50 */}
 <div className="grid grid-cols-3 gap-2 mb-4">
 {[5, 15, 50].map((tier) => (
 <button
 key={tier}
 type="button"
 onClick={() => setSelectedSubTier(tier)}
 className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
 selectedSubTier === tier
 ? 'bg-red-50 border-red-500 text-red-600 shadow-sm ring-1 ring-red-500'
 : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
 }`}
 >
 <span className="text-xs font-extrabold">GHS {tier}</span>
 <span className={`text-[9px] font-semibold ${selectedSubTier === tier ? 'text-red-500' : 'text-gray-400'}`}>
 {tier === 5 ? 'Basic' : tier === 15 ? 'Standard' : 'VIP'}
 </span>
 </button>
 ))}
 </div>

 <div className="mb-4 p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
 <div className="text-left">
 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedSubTier === 5 ? 'Basic Pass' : selectedSubTier === 15 ? 'Standard Pass' : 'VIP Pass'}</div>
 <div className="text-xs font-bold text-gray-900">Monthly All-Access Subscription</div>
 </div>
 <div className="text-right">
 <div className="text-xs font-bold text-red-600">GHS {selectedSubTier.toFixed(2)}</div>
 <div className="text-[10px] text-gray-400">Billed monthly</div>
 </div>
 </div>

 {/* Ghana Mobile Money Networks */}
 <div className="flex items-center justify-center gap-2 py-2 mb-3 bg-gray-50 border border-gray-100 rounded-xl text-[9px] font-bold text-gray-600">
   <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">MTN MoMo</span>
   <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">Telecel Cash</span>
   <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">AT Money</span>
 </div>

 {subscribePaystackUrl && (
   <a
     href={subscribePaystackUrl}
     target="_blank"
     rel="noopener noreferrer"
     className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all mb-3 cursor-pointer shadow-sm"
   >
     <ExternalLink className="w-3.5 h-3.5" />
     Open Paystack Checkout Tab
   </a>
 )}
 
 <button 
 onClick={handleConfirmSubscribe}
 disabled={isProcessingSubscribe || selectedSubTier <= 0}
 className="w-full bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2 cursor-pointer shadow-lg shadow-red-500/25"
 >
 {isProcessingSubscribe ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 Connecting to Paystack...
 </>
 ) : `Confirm & Pay GHS ${selectedSubTier.toFixed(2)}`}
 </button>

 {isProcessingSubscribe && (
 <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
 <div className="flex items-center justify-center gap-2 mb-1.5 text-red-600 font-bold text-xs">
 <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0"/>
 <span>Waiting for Paystack confirmation...</span>
 </div>
 <p className="text-[10px] text-gray-500 leading-normal mb-2.5">
 Complete your subscription payment on Paystack.
 </p>
 <button 
 onClick={() => handleVerifySubscribe()}
 disabled={isCheckingSubscribe}
 className="w-full py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-[10px] uppercase rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
 >
 {isCheckingSubscribe ? (
   <>
     <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
     Checking with Paystack...
   </>
 ) : (
   <span>Verify Subscription Now ⚡</span>
 )}
 </button>
 </div>
 )}
 </div>
 </motion.div>
 </div>
 )}

 </div>
 
 {/* Inline Video Player Overlay Modal - accessible in both public/private views */}
 {selectedPlayClip && (
 <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
 <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl">
 <div className="absolute top-3 right-3 flex items-center gap-2 z-30">
 <button 
 onClick={() => setShowReportModal(true)}
 className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95"
 title="Report Clip"
 aria-label="Report Clip"
 >
 <Flag className="w-3.5 h-3.5 text-red-600 fill-current"/>
 </button>
 <button 
 onClick={() => setSelectedPlayClip(null)}
 className="text-white bg-white/20 hover:bg-white/35 p-1.5 rounded-full transition-colors z-10 cursor-pointer"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
        <div className="aspect-[9/16] max-h-[72vh] w-full bg-black relative flex items-center justify-center overflow-hidden select-none">
          <video 
            ref={clipVideoRef}
            src={selectedPlayClip.videoUrl || ''} 
            controls={!selectedPlayClip.isClimer || isClipUnlocked || clipCurrentTime < (selectedPlayClip.lockTime || 10)} 
            controlsList="nodownload nofullscreen noplaybackrate"
            disablePictureInPicture
            autoPlay 
            crossOrigin="anonymous"
            playsInline
            {...videoProtectionProps}
            onTimeUpdate={(e) => {
              const cur = e.currentTarget.currentTime;
              setClipCurrentTime(cur);
              const isLockedContent = (selectedPlayClip.isClimer || selectedPlayClip.isLocked) && !isClipUnlocked;
              const lockLimit = Number(selectedPlayClip.lockTime) || (selectedPlayClip.isClimer ? 10 : 0);
              if (isLockedContent && lockLimit > 0 && cur >= lockLimit) {
                e.currentTarget.pause();
                e.currentTarget.currentTime = lockLimit;
              }
            }}
            className="w-full h-full object-contain pointer-events-auto"
          />

          {/* Dynamic Anti-Piracy Watermark with Viewer ID */}
          <DynamicProtectedWatermark 
            creatorHandle={selectedPlayClip.creatorHandle || (isOwner ? profileData.handle || profileData.name : 'creator')} 
          />

          {/* Screen Recording Blackout Shield */}
          <ScreenRecordingShield 
            isBlocked={isRecordingBlocked} 
            reason={blockReason} 
            creatorHandle={selectedPlayClip.creatorHandle || profileData.name || 'creator'} 
          />

          {/* If Climer and not locked: Show Video Details HUD Overlay */}
          {selectedPlayClip.isClimer && (!selectedPlayClip.lockTime || isClipUnlocked || clipCurrentTime < selectedPlayClip.lockTime) && (
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-md pointer-events-auto">
                  {selectedPlayClip.creatorAvatar ? (
                    <img 
                      src={selectedPlayClip.creatorAvatar} 
                      alt={selectedPlayClip.creatorHandle || selectedPlayClip.creatorName} 
                      className="w-4 h-4 rounded-full object-cover border border-red-500/60 shrink-0" 
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-zinc-800 border border-red-500/60 flex items-center justify-center shrink-0">
                      <User className="w-2.5 h-2.5 text-zinc-400" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-white leading-none">
                    {selectedPlayClip.creatorHandle?.startsWith('@') ? selectedPlayClip.creatorHandle : `@${selectedPlayClip.creatorHandle || 'creator'}`}
                  </span>
                  {(selectedPlayClip.creatorVerified || selectedPlayClip.isVerified) && (
                    <ShieldCheck className="w-3 h-3 text-red-400 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-1 bg-red-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-md border border-white/30">
                  <span>GHS {(selectedPlayClip.price || 2.0).toFixed(2)}</span>
                </div>
              </div>

              {!isClipUnlocked && selectedPlayClip.lockTime && (
                <div className="space-y-1 mb-1 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/15 pointer-events-auto max-w-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-white flex items-center gap-1 truncate">
                      <span>🎬</span>
                      <span>{selectedPlayClip.clipTitle}</span>
                    </span>
                  </div>
                  <div className="text-[7.5px] font-mono text-zinc-400">
                    pultanc.com/{(selectedPlayClip.creatorHandle || effectiveHandle || '@creator').trim().replace(/^@*/, '@')}/{(selectedPlayClip.clipTitle || selectedPlayClip.title || selectedPlayClip.slug || 'climer').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'climer'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paywall Card directly on the video when locked clip or climer hits lock point or is locked */}
          {((selectedPlayClip.isClimer || selectedPlayClip.isLocked) && !isClipUnlocked && (!selectedPlayClip.lockTime || clipCurrentTime >= (Number(selectedPlayClip.lockTime) || (selectedPlayClip.isClimer ? 10 : 0)))) && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-20 flex flex-col items-center justify-between p-4 text-center overflow-y-auto">
              {/* Top Lock Badge - Orange Theme */}
              <div className="flex items-center gap-1.5 bg-orange-950/80 border border-orange-500/60 px-3 py-1 rounded-full shadow-lg">
                <Lock className="w-3.5 h-3.5 text-orange-400 animate-bounce" />
                <span className="text-[9px] font-bold text-orange-300 tracking-wider uppercase">
                  {selectedPlayClip.isClimer ? 'CLIMAX LOCKED' : 'CLIP LOCKED'} {selectedPlayClip.lockTime ? `• ${selectedPlayClip.lockTime}s` : ''}
                </span>
              </div>

              <div className="space-y-2 max-w-sm my-auto w-full">
                {/* Creator Avatar & Handle */}
                <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 mx-auto">
                  {selectedPlayClip.creatorAvatar ? (
                    <img 
                      src={selectedPlayClip.creatorAvatar} 
                      alt={selectedPlayClip.creatorHandle || selectedPlayClip.creatorName} 
                      className="w-5 h-5 rounded-full object-cover border border-orange-500/50 shrink-0" 
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-orange-500/50 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-zinc-400" />
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-white leading-none">
                    {selectedPlayClip.creatorHandle?.startsWith('@') ? selectedPlayClip.creatorHandle : `@${selectedPlayClip.creatorHandle || 'creator'}`}
                  </span>
                  {(selectedPlayClip.creatorVerified || selectedPlayClip.isVerified) && (
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  )}
                </div>

                <h3 className="text-xs font-extrabold text-white leading-tight line-clamp-2">
                  "{selectedPlayClip.clipTitle}"
                </h3>

                {/* Price Box - Orange Theme */}
                <div className="py-2 px-3 rounded-2xl bg-orange-500/15 border border-orange-500/30">
                  <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Unlock Full Video</div>
                  <div className="text-base font-black text-orange-400">
                    GHS {(selectedPlayClip.price || 2.0).toFixed(2)}
                  </div>
                </div>

                {/* Mobile Money Networks - Orange style */}
                <div className="flex items-center justify-center gap-1.5 text-[8px] font-bold py-0.5 text-zinc-300">
                  <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-md border border-orange-500/30">MTN MoMo</span>
                  <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md border border-red-500/30">Telecel</span>
                  <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30">AT Money</span>
                </div>

                {clipPaystackUrl && (
                  <a
                    href={clipPaystackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all mb-1 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Paystack Tab
                  </a>
                )}

                {/* Interactive Unlock CTA - Orange Theme */}
                <button
                  type="button"
                  onClick={() => {
                    if (clipPaystackRef) {
                      handleVerifyClipUnlock();
                    } else {
                      handleUnlockClip();
                    }
                  }}
                  disabled={isProcessingClipUnlock || isCheckingClipUnlock}
                  className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-orange-500/25 disabled:opacity-50"
                >
                  {isCheckingClipUnlock ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                      <span>Verifying with Paystack...</span>
                    </>
                  ) : isProcessingClipUnlock ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                      <span>Connecting Paystack...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-black"/>
                      <span>Unlock Climax • GHS {(selectedPlayClip.price || 2.0).toFixed(2)}</span>
                    </>
                  )}
                </button>

                {/* Climer link copy */}
                <div 
                  onClick={() => {
                    const handle = (selectedPlayClip.creatorHandle || effectiveHandle || '@creator').trim().replace(/^@*/, '@');
                    const climerTitle = (selectedPlayClip.clipTitle || selectedPlayClip.title || selectedPlayClip.slug || 'climer').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'climer';
                    navigator.clipboard?.writeText(`https://pultanc.com/${handle}/${climerTitle}`);
                    toast.success("Climer link copied!");
                  }}
                  className="text-[8.5px] font-mono text-zinc-300 hover:text-white bg-black/50 border border-white/10 rounded-lg py-1 px-2 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Click to copy climer link"
                >
                  <span>🔗 pultanc.com/{(selectedPlayClip.creatorHandle || effectiveHandle || '@creator').trim().replace(/^@*/, '@')}/{(selectedPlayClip.clipTitle || selectedPlayClip.title || selectedPlayClip.slug || 'climer').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'climer'}</span>
                  <Copy className="w-3 h-3 text-zinc-400 shrink-0" />
                </div>
              </div>

              <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider">
                Instant MoMo Auto-Unlock • Secure Gateway
              </p>
            </div>
          )}
        </div>

        <div className="p-5 text-white space-y-3 bg-neutral-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-red-400 font-bold uppercase">
                {selectedPlayClip.creatorName}
              </span>
              {selectedPlayClip.isClimer && (
                <span className="text-[8px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-bold uppercase">
                  Climer Video
                </span>
              )}
            </div>
            <h3 className="text-xs font-bold text-white leading-snug truncate">
              {selectedPlayClip.clipTitle}
            </h3>
            <p className="text-xs text-neutral-400 font-sans font-medium">
              Clip Context: <span className="text-white">{selectedPlayClip.seriesTitle}</span>
            </p>
          </div>

          {/* Save / Bookmark Button in Modal */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedPlayClip) return;
                handleToggleSaveItem({
                  id: selectedPlayClip.id || selectedPlayClip.slug || selectedPlayClip.episodeId,
                  title: selectedPlayClip.clipTitle || selectedPlayClip.title || 'Clip',
                  videoUrl: selectedPlayClip.videoUrl,
                  thumbnailUrl: selectedPlayClip.thumbnail || selectedPlayClip.thumbnailUrl,
                  creatorName: selectedPlayClip.creatorName || 'Creator',
                  creatorHandle: selectedPlayClip.creatorHandle || '@creator',
                  creatorAvatar: selectedPlayClip.creatorAvatar,
                  price: Number(selectedPlayClip.price) || 0,
                  lockTime: Number(selectedPlayClip.lockTime) || 0,
                  isClimer: !!selectedPlayClip.isClimer,
                  slug: selectedPlayClip.slug || selectedPlayClip.id
                });
              }}
              className={`font-bold py-2 px-3.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                isItemSaved(selectedPlayClip.id || selectedPlayClip.slug || selectedPlayClip.episodeId, selectedPlayClip.clipTitle || selectedPlayClip.title)
                  ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/20'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
              }`}
              title={isItemSaved(selectedPlayClip.id || selectedPlayClip.slug || selectedPlayClip.episodeId, selectedPlayClip.clipTitle || selectedPlayClip.title) ? "Saved to Saves (Click to remove)" : "Save to Saves"}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isItemSaved(selectedPlayClip.id || selectedPlayClip.slug || selectedPlayClip.episodeId, selectedPlayClip.clipTitle || selectedPlayClip.title) ? 'fill-white text-white' : 'text-white'}`} />
              <span>{isItemSaved(selectedPlayClip.id || selectedPlayClip.slug || selectedPlayClip.episodeId, selectedPlayClip.clipTitle || selectedPlayClip.title) ? 'Saves' : 'Save to Saves'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

 {/* Edit Profile Picture & Username Modal Dialog (OWN ACCOUNT ONLY) */}
 <AnimatePresence>
 {isEditingProfile && isAccountOwner && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)}>
 <motion.div 
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 transition={{ duration: 0.15 }}
 onClick={(e) => e.stopPropagation()}
 className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden relative border border-gray-200 dark:border-white/10 shadow-2xl"
 >
 <div className="p-6">
 <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-white/5">
 <div>
 <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit Profile</h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">Update your profile picture and username</p>
 </div>
 <button 
 onClick={() => setIsEditingProfile(false)} 
 className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 {/* Avatar Upload Section */}
 <div className="flex flex-col items-center justify-center mb-6">
 <div className="relative group">
 <div 
 onClick={() => fileInputRef.current?.click()}
 onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
 onDragLeave={() => setIsDragOver(false)}
 onDrop={handleAvatarDrop}
 className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 bg-gray-100 dark:bg-neutral-800 relative cursor-pointer transition-all shadow-md ${isDragOver ? 'border-red-500 ring-4 ring-red-400/20' : 'border-gray-200 dark:border-neutral-700'}`}
 >
 {profileData.avatarUrl ? (
							<img 
								src={profileData.avatarUrl} 
								alt="Profile preview"
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
							/>
						) : (
							<User className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
						)}
 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
 <Camera className="w-6 h-6"/>
 <span className="text-[10px] font-bold">Change</span>
 </div>
 {isUploadingAvatar && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
 <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"/>
 </div>
 )}
 </div>
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg border-2 border-white dark:border-neutral-900 flex items-center justify-center transition-all cursor-pointer"
 title="Upload photo"
 >
 <Camera className="w-4 h-4" />
 </button>
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleAvatarChange} 
 accept="image/*" 
 className="hidden" 
 />
 </div>
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="mt-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-1"
 >
 <Upload className="w-3.5 h-3.5" />
 <span>Upload New Picture</span>
 </button>
 </div>

 {/* Profile Form Inputs */}
 <div className="space-y-4">
 <div>
 <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
 Display Name
 </label>
 <div className="relative">
 <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
 <input 
 type="text"
 value={profileData.name || profileData.displayName || ""}
 onChange={(e) => setProfileData((prev: any) => ({ ...prev, name: e.target.value, displayName: e.target.value }))}
 placeholder="e.g. Akosua Safoa"
 className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
 />
 </div>
 </div>

 <div>
 <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
 Username
 </label>
 <div className="relative">
 <AtSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
 <input 
 type="text"
 value={profileData.username || ""}
 onChange={(e) => {
   const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
   setProfileData((prev: any) => ({ ...prev, username: val }));
 }}
 placeholder="username (e.g. akosuasafoa)"
 className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
 />
 </div>
 <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
 Profile link: pultanc.com?profile={profileData.username || 'username'}
 </p>
 </div>

 <div className="flex gap-3">
 <div className="flex-1">
 <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
 Country
 </label>
 <select
 value={profileData.country || ""}
 onChange={(e) => setProfileData((prev: any) => ({ ...prev, country: e.target.value }))}
 className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-red-500 transition-all"
 >
 <option value="">Select Country</option>
 {COUNTRIES.map(c => (
 <option key={c} value={c}>{c}</option>
 ))}
 </select>
 </div>
 <div className="flex-1">
 <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
 Phone Number
 </label>
 <input
 type="tel"
 value={profileData.phoneNumber || ""}
 onChange={(e) => setProfileData((prev: any) => ({ ...prev, phoneNumber: e.target.value }))}
 placeholder="+233 24 123 4567"
 className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500 transition-all font-mono"
 />
 </div>
 </div>
 </div>

 {/* Modal Action Buttons */}
 <div className="flex justify-end items-center gap-2 mt-5 pt-3 border-t border-gray-100 dark:border-white/5">
 <button
 type="button"
 onClick={() => setIsEditingProfile(false)}
 className="py-1.5 px-3.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleSaveProfile}
 disabled={isSavingProfile}
 className="py-1.5 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-[11px] font-semibold text-white transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
 >
 {isSavingProfile ? (
 <>
 <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 <span>Saving...</span>
 </>
 ) : (
 <>
 <Check className="w-3.5 h-3.5" />
 <span>Save Changes</span>
 </>
 )}
 </button>
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 <LegalDrawer 
 isOpen={legalDrawerContent !== null}
 onClose={() => setLegalDrawerContent(null)}
 title={legalDrawerContent?.title || ''}
 content={legalDrawerContent?.content || ''}
 />
 </div>
 );
}
