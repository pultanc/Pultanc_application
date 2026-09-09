import { drawCanvasWatermark } from "../../utils/watermarkUtility";
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableClip } from './SortableClip';
import { Copy, ExternalLink, Upload, Download, Play, Square, Video, Link2, ScanLine, Share2, Save, Sparkles, Pin } from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
// Cloud storage upload removed for temporary card drafts

const TEMP_GOAL_DRAFT_KEY = 'pultanc_temp_goal_draft';

interface TempGoalDraft {
  goalTitle: string;
  goalSubtitle: string;
  taskText?: string;
  aspectRatio: '9:16' | '4:5';
  clips: { id: string; file?: File; url: string; isImage?: boolean }[];
  updatedAt: number;
}

let sessionGoalCardDraft: TempGoalDraft | null = null;

export default function TaskerCardStudio({ onNavigateToTab }: { onNavigateToTab?: (tab: string, creatorHandle?: string | null) => void }) {
  const [clips, setClips] = useState<{ id: string; file?: File; url: string; isImage?: boolean }[]>(() => sessionGoalCardDraft?.clips || []);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  const [goalTitle, setGoalTitle] = useState(() => sessionGoalCardDraft?.goalTitle || 'My Creator Goal');
  const [goalSubtitle, setGoalSubtitle] = useState(() => sessionGoalCardDraft?.goalSubtitle || sessionGoalCardDraft?.taskText || 'Get 100 subscribers today on Pultanc!');
  const [taskText, setTaskText] = useState(() => sessionGoalCardDraft?.taskText || '');
  const getInitialHandle = () => {
    try {
      const stored = localStorage.getItem('pultanc_creator_handle') || localStorage.getItem('pultanc_user_handle');
      if (stored) return stored.toLowerCase().replace(/[^a-z0-9_]/g, '');
    } catch (e) {}
    if (auth.currentUser) {
      return (auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    return 'creator';
  };

  const [creatorName, setCreatorName] = useState<string>(getInitialHandle);
  const [creatorId, setCreatorId] = useState<string>(() => auth.currentUser?.uid || '');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '4:5'>(() => sessionGoalCardDraft?.aspectRatio || '9:16');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Keep temporary in-progress draft in memory so leaving the screen doesn't lose work
  useEffect(() => {
    sessionGoalCardDraft = {
      goalTitle,
      goalSubtitle,
      taskText,
      aspectRatio,
      clips,
      updatedAt: Date.now()
    };
  }, [goalTitle, goalSubtitle, taskText, aspectRatio, clips]);

  const handleSaveTempDraft = () => {
    sessionGoalCardDraft = {
      goalTitle,
      goalSubtitle,
      taskText,
      aspectRatio,
      clips,
      updatedAt: Date.now()
    };
    toast.success('Goal Card draft saved!');
  };

  const handleResetDraft = () => {
    sessionGoalCardDraft = null;
    setClips([]);
    setGoalTitle('My Creator Goal');
    setGoalSubtitle('Get 100 subscribers today on Pultanc!');
    setTaskText('');
    setAspectRatio('9:16');
    toast.success('Goal card draft reset');
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCreatorId(user.uid);
        const defaultTag = (user.displayName || user.email?.split("@")[0] || "creator")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");
        setCreatorName(defaultTag);
        try {
          localStorage.setItem("pultanc_creator_handle", defaultTag);
        } catch (e) {}

        const userDocRef = doc(db, "users", user.uid);
        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const clean = (data.username || data.handle?.replace(/^@/, "") || data.name || defaultTag)
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "");
            if (clean) {
              setCreatorName(clean);
              try {
                localStorage.setItem("pultanc_creator_handle", clean);
              } catch (e) {}
            }
          }
        }, (err) => console.warn("Failed to listen to profile in TaskerCardStudio:", err));

        return () => unsubProfile();
      }
    });

    return () => unsubAuth();
  }, []);

 const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active && over && active.id !== over.id) {
      setClips((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeClip = (id: string) => {
    setClips(clips.filter(c => c.id !== id));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      files.forEach(file => {
        if (file.size > 60 * 1024 * 1024) {
          toast.error('File exceeds 60MB size limit.');
          return;
        }
        const isImg = file.type.startsWith('image/');
        const localUrl = URL.createObjectURL(file);
        const newClip = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          url: localUrl,
          isImage: isImg
        };
        setClips(prev => [...prev, newClip]);
        toast.success(isImg ? 'Image added to Goal Card!' : 'Video clip added to Goal Card!');

// Temporary working draft keeps local URL - no permanent cloud storage write
      });
    }
  };

  const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

 const drawQRCode = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, text: string) => {
 ctx.fillStyle = '#ffffff';
 ctx.fillRect(x, y, size, size);
 ctx.fillStyle = '#000000';
 const numCells = 25;
 const cellSize = size / numCells;
 
 let seed = 1;
 for (let i = 0; i < text.length; i++) {
 seed += text.charCodeAt(i);
 }

 const random = () => {
 const x = Math.sin(seed++) * 10000;
 return x - Math.floor(x);
 };

 for (let row = 0; row < numCells; row++) {
 for (let col = 0; col < numCells; col++) {
 const isFinder = (row < 7 && col < 7) || 
 (row < 7 && col >= numCells - 7) || 
 (row >= numCells - 7 && col < 7);
 
 if (isFinder) {
 const isOuter = row === 0 || row === 6 || col === 0 || col === 6 || 
 (row === numCells - 1) || (row === numCells - 7) ||
 (col === numCells - 1) || (col === numCells - 7);
 const isInner = row >= 2 && row <= 4 && col >= 2 && col <= 4 ||
 (row >= numCells - 5 && row <= numCells - 3 && col >= 2 && col <= 4) ||
 (row >= 2 && row <= 4 && col >= numCells - 5 && col <= numCells - 3);
 
 if (isOuter || isInner) {
 ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
 }
 } else {
 if (random() > 0.55) {
 ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
 }
 }
 }
 }
 };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pultanc.com';
  const cleanHandle = (creatorName || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
  const displayLink = `pultanc.com/@${cleanHandle}`;
  const referralUrl = `${origin}/@${cleanHandle}?card=goal`;

  const handleOpenConsumerPublicPage = () => {
    const clean = (cleanHandle || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
    const targetUrl = `/@${clean}?card=goal`;
    try {
      window.history.pushState({}, '', targetUrl);
      window.dispatchEvent(new CustomEvent('pultanc_card_view', { detail: { card: 'goal', creator: clean } }));
    } catch (e) {}
    if (onNavigateToTab) {
      onNavigateToTab('profile', clean);
    }
  };

 const renderFrame = () => {
 const canvas = canvasRef.current;
 const video = videoRef.current;
 if (!canvas || !video) return;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 // Draw video covering canvas (assume 1080x1920 for 9:16)
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 
 const vRatio = canvas.width / video.videoWidth;
 const hRatio = canvas.height / video.videoHeight;
 const ratio = Math.max(vRatio, hRatio);
 const centerShift_x = (canvas.width - video.videoWidth * ratio) / 2;
 const centerShift_y = (canvas.height - video.videoHeight * ratio) / 2; 

 ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
 centerShift_x, centerShift_y, video.videoWidth * ratio, video.videoHeight * ratio);

 // Dark overlay
 ctx.fillStyle = 'rgba(0,0,0,0.4)';
 ctx.fillRect(0, 0, canvas.width, canvas.height);

 // App Logo (Top Right)
 
 
 

 // Draw task text
 ctx.fillStyle = '#ffffff';
 ctx.textAlign = 'center';
 ctx.font = 'bold 48px system-ui, sans-serif';
 
 // Wrap text if needed
 const words = taskText.split(' ');
 let line = '';
 let y = 300;
 for(let n = 0; n < words.length; n++) {
 const testLine = line + words[n] + ' ';
 const metrics = ctx.measureText(testLine);
 const testWidth = metrics.width;
 if (testWidth > canvas.width - 100 && n > 0) {
 ctx.fillText(line, canvas.width / 2, y);
 line = words[n] + ' ';
 y += 60;
 }
 else {
 line = testLine;
 }
 }
 ctx.fillText(line, canvas.width / 2, y);

 // Draw footer background
 ctx.fillStyle = 'rgba(0,0,0,0.7)';
 ctx.fillRect(0, canvas.height - 300, canvas.width, 300);

 // Draw QR Code
 const qrSize = 200;
 const qrX = 80;
 const qrY = canvas.height - 250;
 
 ctx.fillStyle = '#ffffff';
 ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
 drawQRCode(ctx, qrX, qrY, qrSize, referralUrl);

 // Draw Creator Link
 ctx.textAlign = 'left';
	ctx.fillStyle = '#ef4444'; // brand red-500
 ctx.font = 'bold 28px monospace';
	ctx.fillText('SCAN TO WATCH EXCLUSIVE SERIES', qrX + qrSize + 40, qrY + 60);

 ctx.fillStyle = '#ffffff';
	ctx.fillText(displayLink, qrX + qrSize + 40, qrY + 120);

  // Creator username watermark on generated goal / tasker video card
  drawCanvasWatermark(ctx, canvas.width, canvas.height, {
    creatorHandle: `@${cleanHandle}`,
    creatorName,
    showPoweredBy: true,
    position: "top-right",
    scale: canvas.width / 720
  });

  if (isRecording || !video.paused) {
    requestAnimationFrame(renderFrame);
  }
 };

 useEffect(() => {
 if (clips.length > 0 && clips[0].url && !isRecording && videoRef.current) {
 // Just render first frame initially
 videoRef.current.onloadeddata = () => {
 renderFrame();
 }
 renderFrame();
 }
 }, [clips, goalTitle, goalSubtitle, taskText, creatorName, aspectRatio]);

 
 const handleShare = () => {
 if (!videoRef.current || !canvasRef.current) return;
 
 const canvas = canvasRef.current;
 const video = videoRef.current;
 
 try {
 // @ts-ignore
 const stream = canvas.captureStream(30);
 const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
 mediaRecorderRef.current = mediaRecorder;
 chunksRef.current = [];
 
 mediaRecorder.ondataavailable = (e) => {
 if (e.data.size > 0) {
 chunksRef.current.push(e.data);
 }
 };
 
 mediaRecorder.onstop = async () => {
 const blob = new Blob(chunksRef.current, { type: 'video/webm' });
 const file = new File([blob], `${creatorName}_tasker_card.webm`, { type: 'video/webm' });
 
 setIsRecording(false);

 if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
   try {
     await navigator.share({
       title: 'My Task',
       text: taskText,
       files: [file]
     });
   } catch (err) {
     console.error('Share failed', err);
     // Fallback to download
     handleGenerate();
   }
 } else {
   handleGenerate();
 }
 };
 
 setIsRecording(true);
 video.currentTime = 0;
 video.play().then(() => {
 mediaRecorder.start();
 renderFrame();
 });
 
 video.onended = () => {
 mediaRecorder.stop();
 };
 } catch (e) {
 console.error(e);
 alert('Video generation is not supported in this browser.');
 setIsRecording(false);
 }
 };


 const handleGenerate = () => {
 if (!videoRef.current || !canvasRef.current) return;
 
 const canvas = canvasRef.current;
 const video = videoRef.current;
 
 try {
 // Set up recording
 // @ts-ignore
 const stream = canvas.captureStream(30); // 30 fps
 const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
 mediaRecorderRef.current = mediaRecorder;
 chunksRef.current = [];
 
 mediaRecorder.ondataavailable = (e) => {
 if (e.data.size > 0) {
 chunksRef.current.push(e.data);
 }
 };
 
 mediaRecorder.onstop = () => {
 const blob = new Blob(chunksRef.current, { type: 'video/webm' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.style.display = 'none';
 a.href = url;
 a.download = `${creatorName}_tasker_card.webm`;
 document.body.appendChild(a);
 a.click();
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
        toast.success('Media downloaded successfully!');
 };
 
 setIsRecording(true);
 video.currentTime = 0;
 video.play().then(() => {
 mediaRecorder.start();
 renderFrame(); // start the loop
 });
 
 video.onended = () => {
 mediaRecorder.stop();
 };
 } catch (e) {
 console.error(e);
 alert('Video generation is not supported in this browser.');
 }
 };

 return (
 <div className="layered-container p-5 md:p-8 pb-16 space-y-6 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-zinc-800 rounded-3xl max-w-5xl mx-auto shadow-sm">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-zinc-850">
 <div>
 <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
 My Goal Card
 </h2>
 <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
 Create a short video card with your goal overlay and referral QR code to share on socials.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
 {/* Left Side: Controls */}
 <div className="lg:col-span-7 space-y-6">
 <div>
 <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-2">
 1. Upload Video (Max 25MB)
 </label>
 <div className="relative">
 <input
 type="file"
 accept="video/*"
 multiple
 onChange={handleVideoUpload}
 className="hidden"
 id="tasker-video-upload"
 />
 <label
 htmlFor="tasker-video-upload"
 className="w-full h-28 border-2 border-dashed border-gray-300 dark:border-zinc-700/80 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer bg-gray-50/50 dark:bg-neutral-900/40"
 >
 <Upload className="w-6 h-6 mb-1.5 text-gray-400 dark:text-zinc-500"/>
 <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">Click to select video clip</span>
 <span className="text-[10px] text-gray-400 mt-0.5">Supports MP4, WebM (Max 25MB)</span>
 </label>
 </div>
 </div>

 <div>
 <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-2">
 2. Your Goal Description (Max 100 chars)
 </label>
 <input
 type="text"
 maxLength={100}
 value={taskText}
 onChange={(e) => { setTaskText(e.target.value); renderFrame(); }}
 placeholder="e.g., Get 100 subscribers today!"
 className="w-full bg-gray-50/80 dark:bg-neutral-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
 />
 <div className="text-right text-[10px] text-gray-400 mt-1 font-mono">
 {taskText.length}/100
 </div>
 </div>

 {/* Format Toggle */}
 <div className="space-y-2">
 <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
 3. Layout Format
 </label>
 <div className="grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => setAspectRatio('9:16')}
 className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
 aspectRatio === '9:16'
 ? 'bg-red-600 border-red-600 text-white shadow-sm'
 : 'bg-gray-50/50 dark:bg-neutral-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
 }`}
 >
 9:16 Story / Reel
 </button>
 <button
 type="button"
 onClick={() => setAspectRatio('4:5')}
 className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
 aspectRatio === '4:5'
 ? 'bg-red-600 border-red-600 text-white shadow-sm'
 : 'bg-gray-50/50 dark:bg-neutral-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
 }`}
 >
 4:5 Feed Post
 </button>
 </div>
 </div>
 </div>

 {/* Right Side: Preview */}
 <div className="lg:col-span-5 flex flex-col items-center justify-start lg:sticky lg:top-6 space-y-4 bg-gray-50/50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/60">

 <div className="relative w-full max-w-[200px] overflow-hidden bg-zinc-950 rounded-2xl border-2 border-zinc-800 shadow-xl flex items-center justify-center p-2">
 {clips.length === 0 ? (
 <div className={`w-full flex flex-col items-center justify-center text-zinc-600 py-8 ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
 <Video className="w-10 h-10 mb-2 opacity-40"/>
 <span className="text-[9px] font-bold uppercase tracking-widest text-center px-2">Upload Video To Preview</span>
 </div>
 ) : (
 <>
 <video 
 ref={videoRef} 
 src={clips[currentClipIndex]?.url || undefined} 
 className="hidden"
 muted 
 playsInline 
 crossOrigin="anonymous"
 onSeeked={renderFrame}
 onLoadedData={renderFrame}
 />
 <canvas
 ref={canvasRef}
 width={1080}
 height={aspectRatio === '9:16' ? 1920 : 1350}
 className={`w-full h-auto bg-black rounded-xl max-h-[350px] object-contain transition-all ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}
 />
 </>
 )}
 </div>

        {/* Separate Copy Link Section */}
        <div className="w-full max-w-[220px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 rounded-xl p-2.5 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-wider">Consumer Public Link</span>
          <div className="flex items-center gap-1.5">
            <input 
              type="text" 
              readOnly 
              value={referralUrl} 
              onClick={handleOpenConsumerPublicPage}
              className="flex-1 bg-transparent border-none outline-none text-[11px] text-black dark:text-zinc-100 font-mono font-bold truncate cursor-pointer hover:underline"
              title="Click to visit consumer public profile page"
            />
            <button 
              type="button"
              onClick={handleOpenConsumerPublicPage}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors text-gray-500 hover:text-red-500"
              title="Open consumer public page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                toast.success("Consumer public card link copied!");
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white"
              title="Copy Link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

 {/* Action Row */}
 <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
 <div className="grid grid-cols-3 gap-2 w-full">
 <button
 type="button"
 onClick={handleShare}
 disabled={clips.length === 0 || isRecording}
 title="Share Card"
 className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
 >
 {isRecording ? <Square className="w-4 h-4 animate-pulse text-red-500"/> : <Share2 className="w-4 h-4"/>}
 </button>
 <button
 type="button"
 onClick={handleGenerate}
 disabled={clips.length === 0 || isRecording}
 title="Download Video Card"
 className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 transition-all shadow-sm"
 >
 <Download className="w-4 h-4"/>
 </button>
               <button
                type="button"
                title="Keep Temporary Draft"
                disabled={clips.length === 0 || isRecording}
                onClick={handleSaveTempDraft}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                <Save className="w-4 h-4"/>
              </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
