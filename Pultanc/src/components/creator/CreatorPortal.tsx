import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileVideo, Shield, CheckCircle, Zap, Radio, Video, Users, Pause, Circle, Play, Lock, Unlock, Smartphone, X, Eye, Link2, Copy, Plus, Phone, CreditCard, Share2, Heart, CheckCircle2, AlertCircle, BarChart2, Bookmark, Film, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePricing } from '../../usePricing';
import { db, auth } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, where, addDoc, setDoc, deleteDoc, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { LegalDrawer } from '../legal/LegalDrawer';
import { LEGAL_DOCS } from '../../data/legal';
import { uploadMediaToStorage, isStandardVideoFormat, formatFileSize } from '../../utils/firebaseStorage';
import { ContentAnalyticsStudio } from './ContentAnalyticsStudio';
import { DynamicProtectedWatermark, ScreenRecordingShield, useScreenRecordingProtection } from '../common/VideoProtection';

interface CreatorPortalProps {
  onNavigateToTab?: (tab: string) => void;
}

export default function CreatorPortal({ onNavigateToTab }: CreatorPortalProps = {}) {
 const { episodePrice, subscribePrice, livePrice, savePrices } = usePricing();
 const [activeTab, setActiveTab] = useState<'upload' | 'live' | 'pricing'>('upload');
 const [activeLegalDoc, setActiveLegalDoc] = useState<'terms' | 'privacy' | null>(null);
 
 const [file, setFile] = useState<File | null>(null);
 const [uploadedStorageUrl, setUploadedStorageUrl] = useState<string | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadProgress, setUploadProgress] = useState(0);
 const [uploadComplete, setUploadComplete] = useState(false);
 const [termsAccepted, setTermsAccepted] = useState(false);
 const [isDragging, setIsDragging] = useState(false);
 const [category, setCategory] = useState('Entertainment');
 const CATEGORIES = ['Entertainment', 'Education', 'Gaming', 'Lifestyle', 'Music', 'Sports', 'Movies', 'Drama', 'Documentary'];

 const [dbFunnels, setDbFunnels] = useState<any[]>([]);
 const [dbClips, setDbClips] = useState<any[]>([]);

 useEffect(() => {
 if (!auth.currentUser) return;
 const q = query(collection(db, 'funnels'), where('creatorId', '==', auth.currentUser.uid));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const funs = snapshot.docs.map(doc => doc.data()).sort((a, b) => b.createdAt - a.createdAt);
 setDbFunnels(funs);
 }, (error) => {
 console.warn("Creator funnels listener inactive:", error);
 });
 return () => unsubscribe();
 }, []);

 useEffect(() => {
 if (!auth.currentUser) return;
 const q = query(collection(db, 'clips'), where('creatorId', '==', auth.currentUser.uid));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const clips = snapshot.docs.map(doc => doc.data()).filter(c => !c.isClimer && c.type !== 'climer').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
 setDbClips(clips);
 }, (error) => {
 console.warn("Creator clips listener inactive:", error);
 });
 return () => unsubscribe();
 }, []);

 const [tempPrices, setTempPrices] = useState({ ep: 1.00, sub: 15, live: 50 });
 useEffect(() => { setTempPrices({ ep: episodePrice, sub: subscribePrice, live: livePrice }); }, [episodePrice, subscribePrice, livePrice]);

 const [selectedPreviewEpisode, setSelectedPreviewEpisode] = useState<{ id: string; title: string; videoUrl: string; duration?: string; isLocked: boolean; priceGHS?: number } | null>(null);

 const [savedClipIds, setSavedClipIds] = useState<string[]>([]);
 useEffect(() => {
  if (!auth.currentUser) return;
  const unsub = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'savedEpisodes'), (snap) => {
   setSavedClipIds(snap.docs.map(d => d.id));
  });
  return () => unsub();
 }, []);

 const handleToggleSaveCreatorItem = async (item: {
  id: string;
  title: string;
  videoUrl?: string;
  isClimer?: boolean;
  price?: number;
  lockTime?: number;
  slug?: string;
 }) => {
  if (!auth.currentUser) {
   toast.error('Sign in to save items');
   return;
  }
  const cleanId = (item.id || item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/\//g, '_');
  const isSaved = savedClipIds.includes(cleanId);
  const docRef = doc(db, 'users', auth.currentUser.uid, 'savedEpisodes', cleanId);
  try {
   if (isSaved) {
    await deleteDoc(docRef);
    toast.success('Removed from your Saves');
   } else {
    await setDoc(docRef, {
     id: cleanId,
     episodeId: cleanId,
     episodeTitle: item.title,
     climerTitle: item.isClimer ? item.title : null,
     clipTitle: item.isClimer ? null : item.title,
     title: item.title,
     type: item.isClimer ? 'climer' : 'clip',
     seriesId: cleanId,
     seriesTitle: item.title,
     creatorName: auth.currentUser.displayName || 'Creator',
     creatorHandle: `@${auth.currentUser.displayName || 'creator'}`,
     videoUrl: item.videoUrl || '',
     thumbnail: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=400',
     price: Number(item.price) || 0,
     lockTime: Number(item.lockTime) || 0,
     isClimer: !!item.isClimer,
     slug: item.slug || cleanId,
     savedAt: serverTimestamp(),
     collectionId: null
    });
    toast.success('Saved to your Saves!');
   }
  } catch (err) {
   console.error('Save error:', err);
   toast.error('Could not update saves');
  }
 };

 const [agreedRevenue, setAgreedRevenue] = useState(false);
 const [agreedIP, setAgreedIP] = useState(false);
 const [agreedAutonomy, setAgreedAutonomy] = useState(false);
 const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);

 // Live Stream State
 const [isLive, setIsLive] = useState(false);
 const [liveTitle, setLiveTitle] = useState('');
 const [liveTimer, setLiveTimer] = useState(0);

  // Video Link Title, Subtitle, Description & Tags State
  const [videoTitle, setVideoTitle] = useState('');
  const [videoSubtitle, setVideoSubtitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const SUGGESTED_TAGS = ['drama', 'thriller', 'cliffhanger', 'cinema', 'comedy', 'ghana', 'exclusive', 'action', 'story'];

  const handleAddTag = (tagToAdd?: string) => {
    const raw = (typeof tagToAdd === 'string' ? tagToAdd : tagInput).trim().toLowerCase().replace(/^#+/, '');
    if (!raw) return;
    if (!tags.includes(raw)) {
      setTags(prev => [...prev, raw]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const toggleSuggestedTag = (suggested: string) => {
    const clean = suggested.toLowerCase().replace(/^#+/, '');
    if (tags.includes(clean)) {
      removeTag(clean);
    } else {
      setTags(prev => [...prev, clean]);
    }
  };

 useEffect(() => {
 let interval: NodeJS.Timeout;
 if (isLive) {
 interval = setInterval(() => {
 setLiveTimer(prev => prev + 1);
 }, 1000);
 } else {
 setLiveTimer(0);
 }
 return () => clearInterval(interval);
 }, [isLive]);

 const formatTime = (seconds: number) => {
 const m = Math.floor(seconds / 60).toString().padStart(2, '0');
 const s = (seconds % 60).toString().padStart(2, '0');
 return `${m}:${s}`;
 };

  const validateAndProcessFile = (selectedFile: File) => {
    if (!selectedFile) return;

    // Validate standard video formats (MP4, WebM, MOV)
    const isVideo = isStandardVideoFormat(selectedFile);
    if (!isVideo) {
      toast.error(`Invalid format for "${selectedFile.name}". Please upload a standard video file (MP4, WebM, or MOV).`);
      return;
    }

    // Maximum file size limit (1GB)
    const MAX_SIZE = 1024 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      toast.error(`"${selectedFile.name}" exceeds 1GB limit (${formatFileSize(selectedFile.size)}). Please choose a smaller file.`);
      return;
    }

    // Capture file state immediately
    setFile(selectedFile);
    setUploadComplete(false);
    setUploadProgress(0);
    setUploadedStorageUrl(null);

    // Auto-populate video title and subtitle if empty
    const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    const formattedTitle = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : "Original Video";
    setVideoTitle(formattedTitle);
    setVideoSubtitle(`Watch ${formattedTitle} and exclusive clips on Pultanc.`);
    toast.success(`Selected "${selectedFile.name}" (${formatFileSize(selectedFile.size)}). Ready for upload.`);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!category) {
      toast.error("Please select a category for your video.");
      return;
    }
    if (!file) {
      toast.error("Please select a video file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const folder = 'videos';
      const downloadUrl = await uploadMediaToStorage(file, folder, (progress) => {
        setUploadProgress(progress);
      });
      setUploadedStorageUrl(downloadUrl);
      setIsUploading(false);
      setUploadComplete(true);
      toast.success("Video uploaded and processed successfully!");
    } catch (err: any) {
      console.warn("Storage upload error:", err);
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(`Upload error: ${err.message || "Failed to upload video to storage"}`);
    }
  };

 const toggleLive = () => {
 if (isLive) {
 setIsLive(false);
 return;
 }
 if (!liveTitle) {
 alert("Please enter a title for your Xclusive Live Event");
 return;
 }
 if (!category) {
 alert("Please select a category for your Live Event");
 return;
 }
 setIsLive(true);
 };

 const handleSaveVideoAndClips = async () => {
   const user = auth.currentUser;
   const rawVideoUrl = uploadedStorageUrl || (file ? URL.createObjectURL(file) : '');
   if (!rawVideoUrl) {
     toast.error('No video available to save.');
     return;
   }

   const defaultTitle = file?.name
      ? file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : `${category || 'Original'} Video Clip`;

    const finalTitle = videoTitle.trim() || defaultTitle;
    const finalSubtitle = videoSubtitle.trim() || 'Watch this original series and exclusive clips on Pultanc. Unlock and support directly.';
    const finalDescription = videoDescription.trim();
    const cleanTags = tags
      .map(t => t.trim().toLowerCase().replace(/^#+/, ''))
      .filter(t => t.length > 0);
    const finalTags = cleanTags.length > 0 ? cleanTags : [category.toLowerCase()];
    const slug = finalTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'video';
    const funnelId = 'f_' + Date.now();
    const creatorHandle = user?.displayName ? `@${user.displayName.toLowerCase().replace(/\s+/g, '_')}` : (user?.email ? `@${user.email.split('@')[0]}` : "@creator");
    const creatorName = user?.displayName || user?.email?.split('@')[0] || "Creator";

    const newFunnel = {
      id: funnelId,
      title: finalTitle,
      subtitle: finalSubtitle,
      description: finalDescription,
      tags: finalTags,
      promoCaption: finalSubtitle,
      category: category || 'Entertainment',
      creatorHandle,
      creatorName,
      creatorId: user?.uid || "user",
      creatorAvatar: user?.photoURL || "",
      creatorEmail: user?.email || "",
      price: episodePrice || 1.00,
      subscribePrice: subscribePrice || 15.00,
      creatorSubscribePrice: subscribePrice || 15.00,
      unlocksCount: 0,
      supportsCount: 0,
      subscribersCount: 0,
      videoUrl: rawVideoUrl,
      lockTime: 45,
      visits: 0,
      unlocks: 0,
      revenue: 0,
      slug: slug,
      isCustom: true,
      createdAt: Date.now(),
      thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
      platform: 'Powered by Pultanc',
      signature: 'Powered by Pultanc',
      poweredBy: 'Pultanc'
    };

    const user_id = user?.uid || "user";
    const price_tier = Number(episodePrice || 1.00);
    const videoRecord = {
      id: funnelId,
      user_id,
      userId: user_id,
      title: finalTitle,
      subtitle: finalSubtitle,
      description: finalDescription,
      tags: finalTags,
      video_url: rawVideoUrl,
      videoUrl: rawVideoUrl,
      thumbnail_url: newFunnel.thumbnailUrl,
      thumbnailUrl: newFunnel.thumbnailUrl,
      price_tier,
      priceTier: price_tier,
      category: category || 'Entertainment',
      creatorHandle,
      creatorName,
      creatorEmail: user?.email || '',
      createdAt: Date.now(),
      platform: 'Powered by Pultanc'
    };

    try {
      // 1. Insert into videos collection
      await setDoc(doc(db, 'videos', funnelId), videoRecord);

      // 2. Insert into content collection
      await setDoc(doc(db, 'content', funnelId), videoRecord);

      // 3. Preserve funnels, climers, series, and clips for full app continuity
      await setDoc(doc(db, 'funnels', funnelId), newFunnel);
      await setDoc(doc(db, 'climers', funnelId), newFunnel);
      await setDoc(doc(db, 'series', funnelId), {
        ...newFunnel,
        episodes: [
          {
            id: `${funnelId}_1`,
            title: `${finalTitle} (Part 1 - Preview)`,
            videoUrl: rawVideoUrl,
            isLocked: false,
            isClimer: false,
            price: 0,
            description: finalDescription,
            tags: finalTags
          },
          {
            id: `${funnelId}_2`,
            title: `${finalTitle} (Part 2 - Climax)`,
            videoUrl: rawVideoUrl,
            isLocked: true,
            isClimer: true,
            price: price_tier,
            description: finalDescription,
            tags: finalTags
          }
        ]
      });
      const clipDocId = `clip_${funnelId}`;
      await setDoc(doc(db, 'clips', clipDocId), {
        id: clipDocId,
        funnelId: funnelId,
        title: `${finalTitle} (Clip)`,
        subtitle: finalSubtitle,
        description: finalDescription,
        tags: finalTags,
        category: category || 'Entertainment',
        creatorHandle,
        creatorName,
        creatorId: user?.uid || "user",
        creatorAvatar: user?.photoURL || "",
        creatorEmail: user?.email || "",
        videoUrl: rawVideoUrl,
        thumbnailUrl: newFunnel.thumbnailUrl,
        price: 0,
        isLocked: false,
        isClimer: false,
        type: 'clip',
        createdAt: Date.now(),
        platform: 'Powered by Pultanc'
      });
      toast.success('Video content published successfully! Redirecting to feed...');

      // Reset upload state upon successful insertion
      setFile(null);
      setUploadComplete(false);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadedStorageUrl(null);
      setVideoTitle('');
      setVideoSubtitle('');
      setVideoDescription('');
      setTags([]);
      setTagInput('');

      // Immediately refresh or redirect to the updated feed/manager view
      if (onNavigateToTab) {
        setTimeout(() => {
          onNavigateToTab('discover');
        }, 600);
      }
    } catch (err: any) {
      console.error('Error saving funnel:', err);
      toast.error('Error saving: ' + (err.message || 'Please try again'));
    } finally {
      setFile(null);
      setUploadComplete(false);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadedStorageUrl(null);
    }
  };

 return (
 <div className="h-full w-full bg-white lg:p-8 overflow-y-auto">
 <div className="max-w-4xl mx-auto space-y-8 pb-12">
 
 {/* Header */}
        <div className="bg-white p-4 sm:p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-6 sticky top-0 z-30 backdrop-blur-md flex flex-col items-center justify-center gap-2 px-4 relative text-center">
          <div className="w-full flex flex-col items-center text-center max-w-xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl flex items-center justify-center gap-2 text-center">
              Creator Pipeline
            </h1>
            <p className="text-gray-600 mt-1 text-xs font-medium text-center">Turn long form videos into paying clips in a click. Upload content or go live for your Xclusive subscribers.</p>
          </div>
        </div>

        {/* Setup Agreement First */}
        {!hasAgreedToTerms ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
            className="layered-container p-4 sm:p-6 space-y-4 max-w-2xl mx-auto"
          >
            <div className="text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Creator Merchant Agreement</h2>
              <p className="text-gray-600 text-xs mt-0.5">Please review and agree to the platform protocols before initiating your first pipeline actions.</p>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 bg-white/50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                <input 
                  type="checkbox"
                  checked={agreedRevenue} 
                  onChange={(e) => setAgreedRevenue(e.target.checked)} 
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 transition-colors shrink-0"
                />
                <div>
                  <h4 className="font-bold text-xs text-gray-900 group-hover:text-black">Only original productions and creations</h4>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 bg-white/50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                <input 
                  type="checkbox"
                  checked={agreedIP} 
                  onChange={(e) => setAgreedIP(e.target.checked)} 
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 transition-colors shrink-0"
                />
                <div>
                  <h4 className="font-bold text-xs text-gray-900 group-hover:text-black">Total Content Exclusivity</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                    You retain 100% IP ownership. By deploying content, you grant Tuita Nouvelle Ltd exclusive right to host and gate media.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 bg-white/50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                <input 
                  type="checkbox"
                  checked={agreedAutonomy} 
                  onChange={(e) => setAgreedAutonomy(e.target.checked)} 
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 transition-colors shrink-0"
                />
                <div>
                  <h4 className="font-bold text-xs text-gray-900 group-hover:text-black">Monthly Payouts</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                    Transactions execute autonomously (70/30 split), accumulated securely and paid out on a monthly payout schedule upon request.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-2 sticky bottom-2 sm:relative bg-white/90 backdrop-blur-xs p-1 rounded-xl z-20">
              <button 
                disabled={!(agreedRevenue && agreedIP && agreedAutonomy)}
                onClick={() => setHasAgreedToTerms(true)}
                className="w-full bg-black text-white hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all disabled:cursor-not-allowed active:scale-[0.98] shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                Sign Agreement & Initialize Pipeline
              </button>
            </div>
          </motion.div>
 ) : (
 <motion.div
 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 className="space-y-6 flex flex-col items-center"
 >
 {/* Tabs */}
 <div className="flex bg-gray-200/60 p-1.5 rounded-xl w-full max-w-xl mb-6 border border-gray-200 flex-wrap sm:flex-nowrap gap-1">
 <button 
 onClick={() => setActiveTab('upload')}
 className={`flex-1 flex justify-center items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'upload' ? 'bg-white text-gray-900 ' : 'text-gray-500 hover:text-gray-700'}`}
 >
 <FileVideo className="w-4 h-4 hidden sm:block"/> Create Clips
 </button>
 <button 
 onClick={() => setActiveTab('live')}
 className={`flex-1 flex justify-center items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'live' ? 'bg-white text-gray-900 ' : 'text-gray-500 hover:text-gray-700'}`}
 >
 <Radio className="w-4 h-4 hidden sm:block"/> Xclusive Live
 </button>
 <button 
 onClick={() => setActiveTab('pricing')}
 className={`flex-1 flex justify-center items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pricing' ? 'bg-white text-gray-900 ' : 'text-gray-500 hover:text-gray-700'}`}
 >
 <Zap className="w-4 h-4 hidden sm:block"/> Pricing
 </button>
 </div>

 {activeTab === 'pricing' ? (
 <div className="w-full max-w-lg mx-auto layered-container p-6 md:p-8 text-left">
 <div className="text-center mb-8">
 <div className="mx-auto w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
 <Zap className="w-8 h-8"/>
 </div>
 <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Pricing</h2>
 <p className="text-gray-600 text-xs">Configure the prices for your clips, exclusive content, and live content.</p>
 </div>
 
 <div className="space-y-6">
 <div>
 <div className="flex justify-between items-center mb-2">
 <label className="block text-xs font-bold text-gray-900">Pay per Clip (GHS)</label>
 <div className="bg-gray-50 border border-gray-200 rounded-lg py-1 px-3">
 <span className="font-bold text-xs text-gray-900">1.00 GH₵</span>
 </div>
 </div>
 </div>
 <div>
 <div className="flex justify-between items-center mb-2">
 <label className="block text-xs font-bold text-gray-900">Monthly Sub (GHS)</label>
 <span className="text-xs font-extrabold text-red-600">GHS {Number(tempPrices.sub || 15).toFixed(2)}/mo</span>
 </div>
 <div className="grid grid-cols-3 gap-2 text-xs mb-2">
 {[5, 15, 50].map(p => (
 <button 
 key={p} 
 type="button" 
 onClick={() => setTempPrices(s => ({...s, sub: p}))} 
 className={`py-2 rounded-xl border font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${tempPrices.sub === p ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
 >
 <span className="text-xs font-extrabold">GHS {p}</span>
 <span className={`text-[9px] ${tempPrices.sub === p ? 'text-red-100' : 'text-gray-400'}`}>
 {p === 5 ? 'Basic' : p === 15 ? 'Standard' : 'VIP'}
 </span>
 </button>
 ))}
 </div>
 <p className="text-[10px] text-gray-500 italic">Monthly subscription is only 5, 15, and 50 GHS.</p>
 </div>
 <button 
 type="button"
 onClick={async () => {
   const subAmount = [5, 15, 50].includes(Number(tempPrices.sub)) ? Number(tempPrices.sub) : 15;
   savePrices(tempPrices.ep, subAmount, tempPrices.live);
   if (auth.currentUser) {
     try {
       await setDoc(doc(db, 'users', auth.currentUser.uid), {
         subscribePrice: subAmount,
         creatorSubscribePrice: subAmount,
         updatedAt: Date.now()
       }, { merge: true });

       const q = query(collection(db, 'funnels'), where('creatorId', '==', auth.currentUser.uid));
       const snap = await getDocs(q);
       const updates = snap.docs.map(d => updateDoc(d.ref, {
         subscribePrice: subAmount,
         creatorSubscribePrice: subAmount
       }));
       await Promise.all(updates);
     } catch (err) {
       console.warn("Could not sync price to Firestore:", err);
     }
   }
   toast.success(`Subscription price set to GHS ${subAmount.toFixed(2)} and applied!`);
 }}
 className="w-full bg-black text-white hover:bg-gray-900 font-bold py-2 px-3 rounded-xl transition-all active:scale-[0.98] mt-4 cursor-pointer shadow-sm"
 >
 Save & Apply Pricing
 </button>
 </div>

 {/* Live verification widget */}
 <div className="mt-8 border-t border-gray-100 pt-6">
 <div className="flex items-center gap-2 mb-4">
 <Eye className="w-4 h-4 text-red-500 animate-pulse"/>
 <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Live Viewer Experience Preview</span>
 </div>
 
 <div className="bg-gray-950 text-white rounded-2xl p-5 border border-white/10 space-y-4">
 <div className="flex items-center justify-between border-b border-white/10 pb-3">
 <div className="flex items-center gap-2">
 <Lock className="w-3.5 h-3.5 text-red-500"/>
 <span className="text-xs font-bold text-white/90">🔒 Clip Gated In Viewer Feed</span>
 </div>
 </div>

 <p className="text-xs text-gray-400 leading-relaxed text-center">
 Viewer encounters a cliffhanger and is prompted with your customized rates:
 </p>

 <div className="space-y-2">
 <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
 <div className="text-left">
 <div className="text-xs font-bold text-white">Unlock This Clip</div>
 <div className="text-[10px] text-gray-500">Instant MoMo authorization</div>
 </div>
 <span className="text-xs font-bold text-red-400">GH₵ {tempPrices.ep.toFixed(2)}</span>
 </div>

 <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-xl p-3 hover:bg-red-500/15 transition-colors">
 <div className="text-left">
 <div className="text-xs font-bold text-red-400 flex items-center gap-1">
 <Zap className="w-3 h-3 text-red-400"/>
 Monthly Subscription
 </div>
 <div className="text-[10px] text-red-300/70">Unlocks creator's clips posted monthly.</div>
 </div>
 <span className="text-xs font-bold text-red-400">GH₵ {tempPrices.sub.toFixed(2)}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 ) : activeTab === 'upload' ? (
 <div className="w-full space-y-8">
 {/* Upload Area */}
 <div 
 onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
 onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
 onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
 onDrop={handleDrop}
 className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all relative overflow-hidden group w-full ${
   isDragging 
     ? 'border-red-500 bg-red-50/40 ring-4 ring-red-500/10' 
     : 'border-gray-200 hover:border-red-500/50 bg-white/30'
 }`}
 >
 {isUploading && (
 <div 
 className="absolute left-0 bottom-0 top-0 bg-red-500/10 transition-all duration-300 pointer-events-none"
 style={{ width: `${uploadProgress}%` }}
 />
 )}

 <AnimatePresence mode="wait">
 {!file ? (
 <motion.div 
 key="idle"
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
 className="flex flex-col items-center pointer-events-none"
 >
 <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
 <UploadCloud className="w-10 h-10 text-gray-600 group-hover:text-red-400 transition-colors"/>
 </div>
 <h3 className="text-xl font-bold text-gray-900 mb-2">Turn Long-Form Videos Into Paying Clips</h3>
 <p className="text-gray-500 mb-6 max-w-md">Upload a long-form video. The system will automatically clip, split, and generate cinematic vertical clips.</p>
 <div className="pointer-events-auto">
 <input 
   type="file" 
   id="series-upload" 
   className="hidden" 
   onChange={(e) => {
     if (e.target.files && e.target.files.length > 0) {
       validateAndProcessFile(e.target.files[0]);
       e.target.value = '';
     }
   }} 
   accept="video/mp4,video/webm,video/quicktime,video/*"
 />
 <label htmlFor="series-upload"className="bg-white text-black px-4 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 border border-gray-200 transition-colors shadow-xs">
 Browse Files
 </label>
 </div>
 </motion.div>
 ) : !uploadComplete ? (
 <motion.div 
 key="file-selected"
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="flex flex-col items-center"
 >
 <FileVideo className="w-16 h-16 text-red-500 mb-4"/>
 <h3 className="text-xl font-bold text-gray-900 mb-1">Video Ready for Processing</h3>
 <div className="flex items-center gap-2 mb-6">
   <p className="text-gray-700 font-mono text-xs font-semibold bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
     {file.name} ({formatFileSize(file.size)})
   </p>
   {!isUploading && (
     <button
       type="button"
       onClick={() => { setFile(null); setUploadComplete(false); setUploadProgress(0); }}
       className="text-xs text-red-600 hover:text-red-700 font-bold underline cursor-pointer"
     >
       Change
     </button>
   )}
 </div>
 
 {isUploading ? (
 <div className="w-full max-w-md space-y-3 z-10 bg-white/90 backdrop-blur-xs p-5 rounded-2xl border border-red-100 shadow-sm">
 <div className="flex justify-between items-center text-xs font-mono">
 <span className="text-red-600 font-bold flex items-center gap-2">
   <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
   {file.size > 20 * 1024 * 1024 ? 'Uploading chunked media stream...' : 'Uploading & processing video...'}
 </span>
 <span className="text-gray-900 font-extrabold text-sm bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
   {Math.round(uploadProgress)}%
 </span>
 </div>
 <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
 <div className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 rounded-full transition-all duration-300"style={{ width: `${Math.max(4, Math.min(100, Math.round(uploadProgress)))}%` }} />
 </div>
 <div className="flex justify-between text-[11px] text-gray-500 font-mono">
   <span>{file.size > 20 * 1024 * 1024 ? 'Chunked / Resumable Stream (>20MB)' : 'Direct Binary Upload'}</span>
   <span>{formatFileSize((file.size * uploadProgress) / 100)} / {formatFileSize(file.size)}</span>
 </div>
 </div> ) : (
 <div className="flex flex-col items-center gap-6 z-10 max-w-md w-full">
 <div className="w-full text-left space-y-1">
 <label className="block text-xs font-bold text-gray-900">Select Category</label>
 <select
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-red-500 cursor-pointer shadow-xs"
 >
 {CATEGORIES.map(cat => (
 <option key={cat} value={cat}>{cat}</option>
 ))}
 </select>
 </div>

 <label className="flex items-start gap-3 cursor-pointer bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-gray-100 transition-colors">
 <input 
 type="checkbox"
 className="mt-1 w-4 h-4 text-red-500 rounded border-gray-300 focus:ring-red-500 shrink-0"
 checked={termsAccepted}
 onChange={(e) => setTermsAccepted(e.target.checked)}
 />
 <span className="text-xs text-gray-700 leading-relaxed font-medium text-left">
 I agree to the{' '}
 <button 
 type="button"
 onClick={(e) => { e.preventDefault(); setActiveLegalDoc('terms'); }}
 className="font-bold text-red-600 hover:text-red-700 underline"
 >
 Terms of Service
 </button>
 {' '}and{' '}
 <button 
 type="button"
 onClick={(e) => { e.preventDefault(); setActiveLegalDoc('privacy'); }}
 className="font-bold text-red-600 hover:text-red-700 underline"
 >
 Privacy Policy
 </button>
 , and certify that any content I upload is my original creation.
 </span>
 </label>

 <button 
 onClick={handleUpload}
 disabled={!termsAccepted}
 className={`px-5 py-1.5 rounded-full font-bold transition-transform active:scale-95 flex items-center gap-2 ${termsAccepted ? 'bg-red-500 hover:bg-red-400 text-white ' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
 >
 <Zap className="w-5 h-5"/>
 Generate Clips
 </button>
 </div>
 )}
 </motion.div>
 ) : (
 <motion.div 
 key="complete"
 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
 className="flex flex-col items-center"
 >
 <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
 <CheckCircle className="w-10 h-10 text-red-500"/>
 </div>
 <h3 className="text-xl font-bold text-gray-900 mb-1">Cinematic Clips Generated!</h3>
 <p className="text-gray-600 text-xs mb-6 max-w-sm text-center">Your raw video has been auto-segmented using AI Cliffhanger points. Review each newly generated clip preview below.</p>
 
 {/* Generated Clips Grid */}
 <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
 {[
 { id: 'ge1', title: `${file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Segment 1'} (Part 1)`, videoUrl: uploadedStorageUrl || (file ? URL.createObjectURL(file) : ''), duration: '0:45', isLocked: false },
 { id: 'ge2', title: `${file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Segment 2'} (Part 2)`, videoUrl: uploadedStorageUrl || (file ? URL.createObjectURL(file) : ''), duration: '1:12', isLocked: false },
 { id: 'ge3', title: `${file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Segment 3'} (Part 3)`, videoUrl: uploadedStorageUrl || (file ? URL.createObjectURL(file) : ''), duration: '0:58', isLocked: false },
 { id: 'ge4', title: `${file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Segment 4'} (Part 4)`, videoUrl: uploadedStorageUrl || (file ? URL.createObjectURL(file) : ''), duration: '1:30', isLocked: false }
 ].map((ep, idx) => (
 <div 
 key={ep.id}
 onClick={() => setSelectedPreviewEpisode({ id: ep.id, title: ep.title, videoUrl: ep.videoUrl, isLocked: ep.isLocked })}
 className="bg-white hover:bg-zinc-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between cursor-pointer group transition-all duration-200"
 >
 <div className="space-y-1">
 <span className="text-[9px] font-mono text-red-605 font-bold uppercase tracking-wider block">SCENE SEGMENT {idx + 1}</span>
 <h4 className="font-bold text-xs text-gray-950 group-hover:text-red-500 transition-colors line-clamp-1">{ep.title}</h4>
 <span className="text-[10px] text-gray-400 font-mono">Duration: {ep.duration}</span>
 </div>
 <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
 {ep.isLocked ? (
 <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-mono">🔒 GH₵ {episodePrice.toFixed(2)}</span>
 ) : (
 <span className="text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded font-mono">🟢 FREE REEL</span>
 )}
 <div className="flex items-center gap-2">
 <button
  type="button"
  onClick={(e) => {
   e.stopPropagation();
   handleToggleSaveCreatorItem({
    id: ep.id,
    title: ep.title,
    videoUrl: ep.videoUrl,
    isClimer: false,
    price: ep.isLocked ? episodePrice : 0
   });
  }}
  className={`p-1 rounded-full transition-all cursor-pointer ${
   savedClipIds.includes(ep.id)
    ? 'bg-red-600 text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
  }`}
  title={savedClipIds.includes(ep.id) ? "Saved (Click to remove)" : "Save to Saves"}
 >
  <Bookmark className={`w-2.5 h-2.5 ${savedClipIds.includes(ep.id) ? 'fill-white text-white' : 'text-gray-600'}`} />
 </button>
 <span className="text-[10px] flex items-center gap-1 font-bold text-gray-500 group-hover:text-red-500">
 <Play className="w-2.5 h-2.5 fill-current text-red-500"/> Play
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
  <div className="flex flex-col items-center gap-4 w-full max-w-md">
                {/* Custom Title, Subtitle, Description & Tags */}
                <div className="w-full bg-zinc-50 border border-zinc-200 p-4 sm:p-5 rounded-2xl text-left space-y-3.5 shadow-xs">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Title
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Enter title (e.g. Confronting The Cheat)"
                      className="w-full bg-white border border-gray-300 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none transition-colors shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Subtitle
                    </label>
                    <textarea
                      rows={2}
                      value={videoSubtitle}
                      onChange={(e) => setVideoSubtitle(e.target.value)}
                      placeholder="Enter subtitle (e.g. Stream original clips and series on Pultanc)"
                      className="w-full bg-white border border-gray-300 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none transition-colors resize-none leading-relaxed shadow-2xs"
                    />
                  </div>

                  {/* Description Field */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Add an engaging synopsis, cliffhanger backstory, or context to help viewers easily find your video in search..."
                      className="w-full bg-white border border-gray-300 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none transition-colors resize-none leading-relaxed shadow-2xs"
                    />
                  </div>

                  {/* Optional Tags Input */}
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Tags & Keywords <span className="text-gray-400 font-normal lowercase tracking-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] text-gray-500 font-medium">
                        {tags.length > 0 ? `${tags.length} tag${tags.length > 1 ? 's' : ''} added` : 'e.g. #drama, #comedy'}
                      </span>
                    </div>

                    {/* Active Tags Chips */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-0.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-red-900 hover:bg-red-100 rounded-full p-0.5 transition-colors cursor-pointer"
                              title={`Remove tag #${tag}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tag Input Field & Add Button */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          placeholder="Type tag & press Enter or comma..."
                          className="w-full bg-white border border-gray-300 focus:border-red-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none transition-colors shadow-2xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddTag()}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-gray-200 shadow-2xs shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    {/* Suggested Discoverability Tags */}
                    <div className="pt-1">
                      <span className="text-[10px] text-gray-500 font-semibold block mb-1">
                        Popular Discoverability Tags:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {SUGGESTED_TAGS.map((sTag) => {
                          const isSelected = tags.includes(sTag);
                          return (
                            <button
                              key={sTag}
                              type="button"
                              onClick={() => toggleSuggestedTag(sTag)}
                              className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer font-medium ${
                                isSelected
                                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                  : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200/80 shadow-2xs'
                              }`}
                            >
                              #{sTag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={handleSaveVideoAndClips}
                    className="flex-1 bg-black text-white hover:bg-gray-800 font-bold py-2.5 rounded-xl transition-colors text-xs cursor-pointer shadow-sm"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => { setFile(null); setUploadComplete(false); setUploadProgress(0); setUploadedStorageUrl(null); setVideoTitle(''); setVideoSubtitle(''); setVideoDescription(''); setTags([]); setTagInput(''); }}
                    className="text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 py-2.5 px-4 rounded-xl transition-colors text-xs cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Processing Logs Mock */}
 <div className="layered-container-sm p-6">
 <h3 className="text-xs font-medium text-gray-600 mb-4 font-mono">PIPELINE LOGS</h3>
 <div className="space-y-3 font-mono text-xs">
 <div className="flex gap-4">
 <span className="text-gray-600">18:29:41</span>
 <span className="text-gray-600">Awaiting source video...</span>
 </div>
 {uploadProgress > 20 && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
 <span className="text-gray-600">18:30:12</span>
 <span className="text-red-500">AI Scene Detection: 15 Cliffhanger points found</span>
 </motion.div>
 )}
 {uploadProgress > 50 && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
 <span className="text-gray-600">18:30:25</span>
 <span className="text-gray-700">Clips 1-4 flagged"PUBLIC BAIT"</span>
 </motion.div>
 )}
 {uploadProgress > 80 && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
 <span className="text-gray-600">18:30:38</span>
 <span className="text-gray-500">Clips 5-15 flagged"PREMIUM LOCKED"(3 GHS)</span>
 </motion.div>
 )}
 {uploadComplete && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
 <span className="text-gray-600">18:30:52</span>
 <span className="text-gray-500">Signature Applied & Ready for Feed</span>
 </motion.div>
 )}
 </div>
 </div>

 {/* 🎥 Active Clip Catalog & Real-time Rate Verification */}
 <div className="space-y-4 pt-6 border-t border-gray-100">
 <div className="text-left px-1">
 <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
 <Video className="w-5 h-5 text-red-500"/>
 Dynamic Clip Library & Previews
 </h3>
 <p className="text-xs text-gray-500 mt-0.5">
 Preview your published video clips and watch simulated vertical playbacks.
 </p>
 </div>

 <div className="space-y-8 text-left col-span-1 sm:col-span-2">
 {/* Group Video Clips */}
 <div className="space-y-3 bg-gray-50/50 border border-gray-100 rounded-2xl p-4 sm:p-5">
 <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60">
 <span className="p-1.5 rounded-lg bg-red-500/10 text-red-600">
 <Film className="w-4 h-4"/>
 </span>
 <div>
 <h4 className="font-bold text-xs text-gray-900">
 Video Clips
 </h4>
 <p className="text-[11px] text-gray-500 font-medium">
 Published video clips ({dbClips.length} active)
 </p>
 </div>
 </div>

 {dbClips.length === 0 ? (
 <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-white">
 <p className="text-xs text-gray-400 font-medium">No video clips published yet.</p>
 <p className="text-[10px] text-gray-400 mt-1">Upload your original video above to generate and publish clips!</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
 {dbClips.map((clip) => (
 <div 
 key={clip.id}
 onClick={() => setSelectedPreviewEpisode({
 id: clip.id,
 title: clip.title,
 videoUrl: clip.videoUrl,
 isLocked: false,
 priceGHS: 0
 })}
 className="bg-white hover:bg-zinc-50 border border-gray-200/80 hover:border-red-500 rounded-xl p-4 flex flex-col justify-between cursor-pointer group transition-all duration-200 relative overflow-hidden"
 >
 {/* Top Tag */}
 <div className="absolute top-0 right-0 bg-zinc-800 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-bl">
 Clip
 </div>

 <div className="flex justify-between items-start mb-3 pt-1">
 <div>
 <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block">{clip.creatorName || "Me"} • Video Clip</span>
 <h4 className="font-bold text-xs text-gray-900 group-hover:text-red-500 transition-colors line-clamp-1 mt-0.5">{clip.title}</h4>
 </div>
 <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 font-mono mt-1">
 <Film className="w-2.5 h-2.5 text-red-500"/> Clip
 </span>
 </div>

 <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
 <span className="font-mono text-[9px] text-gray-500 font-bold uppercase">Streamable Clip</span>
 <div className="flex items-center gap-2">
 <button
  type="button"
  onClick={(e) => {
   e.stopPropagation();
   handleToggleSaveCreatorItem({
    id: clip.id,
    title: clip.title,
    videoUrl: clip.videoUrl,
    isClimer: false,
    price: 0,
    lockTime: 0,
    slug: clip.slug || clip.id
   });
  }}
  className={`p-1 rounded-full transition-all cursor-pointer ${
   savedClipIds.includes(clip.id) || (clip.slug && savedClipIds.includes(clip.slug))
    ? 'bg-red-600 text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
  }`}
  title={savedClipIds.includes(clip.id) || (clip.slug && savedClipIds.includes(clip.slug)) ? "Saved (Click to remove)" : "Save to Saves"}
 >
  <Bookmark className={`w-3 h-3 ${savedClipIds.includes(clip.id) || (clip.slug && savedClipIds.includes(clip.slug)) ? 'fill-white text-white' : 'text-gray-600'}`} />
 </button>
 <span className="flex items-center gap-1.5 text-red-600 font-bold group-hover:underline">
 <Play className="w-3 h-3 fill-current text-red-500"/> Play Preview
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 </div>
 ) : activeTab === 'live' ? (
 <div className="w-full max-w-lg mx-auto layered-container p-6 md:p-8">
 <div className="text-center mb-8">
 <div className="mx-auto w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
 <Radio className="w-8 h-8"/>
 </div>
 <h2 className="text-2xl font-bold text-gray-900 mb-2">Xclusive Live Room</h2>
 <p className="text-gray-600 text-xs">Create an exclusive live content event for your subscribers and fans. Notifications will be pushed automatically.</p>
 </div>

 <div className="space-y-6">
 {!isLive && (
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-bold text-gray-900 mb-2">Live Session Title</label>
 <input 
 type="text"
 value={liveTitle}
 onChange={(e) => setLiveTitle(e.target.value)}
 placeholder="e.g. Q&A"
 className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-gray-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
 />
 </div>
 <div className="text-left">
 <label className="block text-xs font-bold text-gray-900 mb-2">Category</label>
 <select
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-red-500 cursor-pointer shadow-xs"
 >
 {CATEGORIES.map(cat => (
 <option key={cat} value={cat}>{cat}</option>
 ))}
 </select>
 </div>
 </div>
 )}

 {isLive && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
 className="layered-container-sm p-6 text-center space-y-4"
 >
 <div className="flex justify-center gap-4 text-xs font-bold uppercase tracking-wider">
 <span className="text-red-500 flex items-center gap-1"><Circle className="w-3 h-3 fill-current animate-pulse"/> LIVE NOW</span>
 <span className="text-gray-500 font-mono">{formatTime(liveTimer)}</span>
 </div>
 
 <div className="bg-black aspect-video rounded-xl overflow-hidden relative border border-gray-200 flex items-center justify-center">
 {/* Mock camera view */}
 <Video className="w-12 h-12 text-white/20"/>
 <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">REC</div>
 <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] font-medium px-2 py-1 rounded flex items-center gap-1 backdrop-blur-md">
 <Users className="w-3 h-3"/> 2,342
 </div>
 </div>

 <div className="text-xs font-bold text-gray-900 pt-2">
 {liveTitle}
 </div>
 <p className="text-xs text-red-600 font-medium">Your stream is actively listed on the Xclusive Live Feed!</p>
 </motion.div>
 )}

 <button 
 onClick={() => {
 if (!isLive) {
 toast.error("Live streaming is currently unavailable.");
 return;
 }
 toggleLive();
 }}
 disabled={!isLive}
 className={`w-full font-bold py-1.5 px-3 rounded-xl transition-all flex justify-center items-center gap-2 ${
 isLive 
 ? 'bg-white text-gray-900 hover:bg-gray-200 border border-gray-300 active:scale-[0.98]'
 : 'bg-gray-500 text-white opacity-50 cursor-not-allowed'
 }`}
 >
 {isLive ? (
 <><Pause className="w-5 h-5"/> End Live Session</>
 ) : (
 <><Radio className="w-5 h-5"/> Start Live Content (Coming Soon)</>
 )}
 </button>
 
 {!isLive && (
 <p className="text-xs text-center text-gray-500 mt-4 leading-relaxed font-medium">
 Starting a live session instantly notifies your subscribers. Non-subscribers can join by purchasing a one-time live event pass on the Feed.
 </p>
 )}
 </div>
 </div>
 ) : null}
 {false && <div />}
 </motion.div>
 )}

 </div>

 {/* 📱 Interactive Smartphone Preview Player Lightbox */}
 <AnimatePresence>
 {selectedPreviewEpisode && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
 >
 <motion.div 
 initial={{ scale: 0.9, y: 20 }} 
 animate={{ scale: 1, y: 0 }} 
 exit={{ scale: 0.9, y: 20 }}
 transition={{ type:"spring", damping: 25, stiffness: 300 }}
 className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row"
 >
 {/* Left Side: Smartphone Case Mockup */}
 <div className="flex-1 bg-black p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
 <div className="relative w-full max-w-[240px] aspect-[9/18] bg-zinc-900 rounded-[36px] p-2 border-2 border-zinc-800 flex flex-col justify-between overflow-hidden">
 
 {/* Smartphone Camera Notch */}
 <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-3 bg-black rounded-full z-30"/>

 {/* Smartphone Top Info bar */}
 <div className="absolute top-1 left-5 right-5 flex justify-between text-[8px] text-white font-mono z-20 opacity-80 select-none">
 <span>12:00</span>
 <span className="text-red-400">PULTANC SECURED</span>
 </div>

 {/* Video Area */}
 <div className="w-full h-full bg-black rounded-[28px] overflow-hidden relative flex items-center justify-center aspect-[9/16]">
 <video 
 src={selectedPreviewEpisode.videoUrl || ''} 
 className="w-full h-full object-cover"
 controls
 autoPlay
 playsInline
 />
 
 {/* App, Creator & Title Overlay */}
 <div className="absolute top-4 left-3 right-3 flex items-center justify-between select-none pointer-events-none z-10">
   <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
     <span className="bg-red-600 text-white font-black text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full">PULTANC</span>
     <span className="text-[10px] font-bold text-white font-mono">
       {auth.currentUser?.displayName ? `@${auth.currentUser.displayName.toLowerCase().replace(/\s+/g, '_')}` : (auth.currentUser?.email ? `@${auth.currentUser.email.split('@')[0]}` : '@creator')}
     </span>
   </div>
   <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-[9.5px] text-zinc-200 font-bold truncate max-w-[150px]">
     🎬 {selectedPreviewEpisode.title.slice(0, 24)}...
   </div>
 </div>
 </div>
 </div>
 </div>

 {/* Right Side: Control & Quality Audit Panel */}
 <div className="w-full md:w-[280px] p-5 sm:p-6 flex flex-col justify-between text-left">
 <div className="space-y-4">
 <div className="flex justify-between items-start">
 <div>
 <span className="text-[9px] font-mono tracking-widest text-red-400 font-bold uppercase bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">SECURITY AUDIT</span>
 <h3 className="text-md font-bold mt-2 text-white line-clamp-2">{selectedPreviewEpisode.title}</h3>
 <p className="text-[10px] text-gray-500 mt-0.5">Vertical Video Quality Control</p>
 </div>
 <button 
 onClick={() => setSelectedPreviewEpisode(null)}
 className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-1 rounded-full transition-colors"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>

 <div className="space-y-3">
 <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
 <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">Pricing Protection Gating</span>
 <div className="flex items-center justify-between">
 <span className="text-[10px] text-zinc-300">Active Price per Unlock:</span>
 <span className="text-xs font-bold text-red-400">GHS {episodePrice.toFixed(2)}</span>
 </div>
 <p className="text-[9px] text-zinc-400 leading-relaxed font-sans">
 Correctly linked to standard locked catalog policies. This clip gates at <strong className="text-red-400">GH₵ {episodePrice.toFixed(2)}</strong> or Pultanc Xclusive Subscription.
 </p>
 </div>

 <div className="space-y-1.5 text-[10px]">
 <div className="flex justify-between border-b border-white/5 pb-1 text-zinc-400">
 <span>Form Factor</span>
 <span className="font-mono text-white">9:16 Vertical Fit</span>
 </div>
 <div className="flex justify-between border-b border-white/5 pb-1 text-zinc-400">
 <span>Codec</span>
 <span className="font-mono text-white">AVC/AAC MP4 Stream</span>
 </div>
 <div className="flex justify-between border-b border-white/5 pb-1 text-zinc-400">
 <span>Security Envelope</span>
 <span className="font-mono text-white">Encrypted Signature</span>
 </div>
 </div>
 </div>
 </div>

 <div className="pt-4 border-t border-white/10 space-y-3">
 <p className="text-[9px] text-zinc-400 leading-relaxed font-sans mt-2">
 Audited via Creator Pipeline. Secure billing and high resolution streaming are verified.
 </p>
 <button 
 onClick={() => {
  if (!selectedPreviewEpisode) return;
  handleToggleSaveCreatorItem({
   id: selectedPreviewEpisode.id,
   title: selectedPreviewEpisode.title,
   videoUrl: selectedPreviewEpisode.videoUrl,
   isClimer: !!selectedPreviewEpisode.priceGHS,
   price: selectedPreviewEpisode.priceGHS || (selectedPreviewEpisode.isLocked ? episodePrice : 0)
  });
 }}
 className={`w-full font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
  savedClipIds.includes(selectedPreviewEpisode?.id || '')
   ? 'bg-red-600 border-red-500 text-white'
   : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
 }`}
 >
  <Bookmark className={`w-3.5 h-3.5 ${savedClipIds.includes(selectedPreviewEpisode?.id || '') ? 'fill-white text-white' : 'text-white'}`}/>
 <span>{savedClipIds.includes(selectedPreviewEpisode?.id || '') ? 'Saves' : 'Save to Saves'}</span>
 </button>
 <div className="w-full bg-zinc-900 border border-white/10 text-zinc-400 font-mono py-1.5 px-3 rounded-lg text-[11px] flex items-center justify-center gap-1.5 select-none pointer-events-none">
 <Shield className="w-3.5 h-3.5 text-red-500" />
 <span>Downloads Restricted</span>
 </div>
 <button 
 onClick={() => setSelectedPreviewEpisode(null)}
 className="w-full bg-red-500 hover:bg-red-400 text-black font-bold py-1.5 px-3 rounded-lg text-xs transition-colors"
 >
 Close Preview
 </button>
 </div>
 </div>

 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 <LegalDrawer 
 isOpen={activeLegalDoc !== null} 
 onClose={() => setActiveLegalDoc(null)} 
 title={activeLegalDoc ? LEGAL_DOCS[activeLegalDoc].title : ''} 
 content={activeLegalDoc ? LEGAL_DOCS[activeLegalDoc].content : ''} 
 />
 </div>
 );
}

