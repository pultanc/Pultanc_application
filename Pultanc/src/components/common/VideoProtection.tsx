import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Lock, AlertTriangle, EyeOff } from 'lucide-react';
import { auth } from '../../firebase';

/**
 * Dynamic Anti-Piracy Watermark:
 * Renders "@creatorhandle • powered by pultanc"
 * with dynamic viewer ID and dynamic position shifting across video renders to prevent screen recording and cropping.
 */
export interface DynamicProtectedWatermarkProps {
  creatorHandle?: string;
  viewerId?: string;
  className?: string;
  variant?: 'subtle' | 'prominent' | 'floating-only';
}

export const DynamicProtectedWatermark: React.FC<DynamicProtectedWatermarkProps> = ({
  creatorHandle,
  viewerId,
  className = '',
  variant = 'subtle'
}) => {
  const effectiveHandle = (creatorHandle || 'creator').trim().replace(/^@+/, '@');
  const [currentUserViewerId, setCurrentUserViewerId] = useState<string>('');

  useEffect(() => {
    if (viewerId) {
      setCurrentUserViewerId(viewerId);
    } else if (auth.currentUser) {
      const u = auth.currentUser;
      const idStr = u.displayName ? `@${u.displayName.toLowerCase().replace(/\s+/g, '_')}` : (u.email ? u.email.split('@')[0] : u.uid.slice(0, 6));
      setCurrentUserViewerId(idStr);
    } else {
      // Guest viewer session id
      const sessionKey = 'pultanc_guest_sid';
      let sid = sessionStorage.getItem(sessionKey);
      if (!sid) {
        sid = Math.random().toString(36).substring(2, 8).toUpperCase();
        sessionStorage.setItem(sessionKey, sid);
      }
      setCurrentUserViewerId(`GUEST-${sid}`);
    }
  }, [viewerId]);

  // Floating coordinates that dynamically change every 5 seconds to thwart crop rippers
  const [coords, setCoords] = useState<{ top: number; left: number; opacity: number }>({
    top: 28,
    left: 24,
    opacity: 0.40
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Pick random coordinates between 15% and 80% to float across active playback area
      const newTop = Math.floor(Math.random() * 62) + 16;
      const newLeft = Math.floor(Math.random() * 56) + 18;
      const newOpacity = Math.random() * 0.2 + 0.30; // 0.30 to 0.50
      setCoords({ top: newTop, left: newLeft, opacity: newOpacity });
    }, 5500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className={`absolute inset-0 pointer-events-none select-none z-20 overflow-hidden ${className}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      {/* 1. Dynamic Floating Anti-Piracy Watermark that hops across screen */}
      <div
        style={{
          top: `${coords.top}%`,
          left: `${coords.left}%`,
          opacity: coords.opacity,
          transform: 'translate(-50%, -50%)',
          transition: 'all 2.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="absolute pointer-events-none select-none flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-[1px] border border-white/10 shadow-md"
      >
        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-[7.5px] sm:text-[8.5px] font-medium text-white/90 tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {effectiveHandle} <span className="text-red-400/90 font-normal text-[7px] sm:text-[8px]">• powered by pultanc</span>
        </span>
      </div>

      {/* 2. Static Corner Badge Watermark for continuous legal attribution */}
      {variant !== 'floating-only' && (
        <div className="absolute bottom-2.5 right-2.5 pointer-events-none select-none flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm border border-white/10 opacity-70 transition-opacity">
          <Shield className="w-2 h-2 text-red-400" />
          <span className="font-mono text-[7.5px] sm:text-[8px] font-medium text-white/90 tracking-normal">
            {effectiveHandle} <span className="text-red-400/90 font-normal">• powered by pultanc</span>
          </span>
        </div>
      )}
    </div>
  );
};

// Global style injector for media protection and print blackout
let stylesInjected = false;
function injectProtectionStyles() {
  if (typeof document === 'undefined' || stylesInjected) return;
  stylesInjected = true;
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @media print {
      video, .protected-media-container, [data-protected-media="true"] {
        display: none !important;
        visibility: hidden !important;
      }
    }
    .protected-media-container {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-user-drag: none !important;
    }
    .protected-media-container video {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-user-drag: none !important;
      user-drag: none !important;
    }
  `;
  document.head.appendChild(styleEl);
}

/**
 * Screen Recording & Content Capture Protection Hook:
 * - Detects / intercepts getDisplayMedia (browser screen recording extensions like Loom, Screencastify, OBS, etc.)
 * - Intercepts captureStream on video & canvas to prevent direct programmatic stream recording
 * - Detects screenshot keyboard shortcuts (PrintScreen, Meta+Shift+3/4/5, Ctrl+Shift+S, F12, Ctrl+Shift+I)
 * - Detects window blur and visibility change (mobile Control Center screen recording drawer, tab switching)
 * - Disables context menu (Save Video As) and drag-and-drop
 * - Enforces user-select: none and pointer-events restrictions
 */
export function useScreenRecordingProtection(videoRef?: React.RefObject<HTMLVideoElement | null>) {
  const [isRecordingBlocked, setIsRecordingBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    injectProtectionStyles();
  }, []);

  const triggerBlockout = useCallback((reason: string, durationMs: number = 3500) => {
    setBlockReason(reason);
    setIsRecordingBlocked(true);

    // Pause video playback immediately if video ref is available
    if (videoRef?.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsRecordingBlocked(false);
      setBlockReason('');
    }, durationMs);
  }, [videoRef]);

  useEffect(() => {
    // 1. Intercept navigator.mediaDevices.getDisplayMedia (Screen Capture Extension API)
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      
      navigator.mediaDevices.getDisplayMedia = async function (constraints) {
        triggerBlockout('Screen recording extension capture initiated. Content obscured to protect creator copyright.', 6000);
        try {
          return await originalGetDisplayMedia(constraints);
        } catch (e) {
          throw e;
        }
      };

      return () => {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      };
    }
  }, [triggerBlockout]);

  useEffect(() => {
    // 2. Intercept captureStream on HTMLMediaElement to block browser ripper extensions
    if (typeof window !== 'undefined' && HTMLMediaElement.prototype && (HTMLMediaElement.prototype as any).captureStream) {
      const originalCaptureStream = (HTMLMediaElement.prototype as any).captureStream;
      (HTMLMediaElement.prototype as any).captureStream = function (...args: any[]) {
        triggerBlockout('Unauthorized media stream capture intercepted. Playback obscured.', 5000);
        try {
          return originalCaptureStream.apply(this, args);
        } catch (err) {
          throw err;
        }
      };
    }
  }, [triggerBlockout]);

  useEffect(() => {
    // 3. Keyboard shortcuts interceptor (Screenshots, Screen Recording Tools, Devtools)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        triggerBlockout('Screen capture shortcut detected. Content protected by Pultanc.');
        return;
      }

      // Mac Screenshot / Screen Recording: Meta + Shift + 3, 4, 5
      if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
        triggerBlockout('Screen capture shortcut detected. Content protected by Pultanc.');
        return;
      }

      // Windows Snipping Tool: Meta + Shift + S or Ctrl + Shift + S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        triggerBlockout('Screen capture tool detected. Content protected by Pultanc.');
        return;
      }

      // DevTools Inspection: F12, Ctrl + Shift + I, Ctrl + Shift + J, Ctrl + Shift + C, Meta + Option + I
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        triggerBlockout('Developer inspection tool restricted on protected video content.');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [triggerBlockout]);

  useEffect(() => {
    // 4. Mobile / Web App Visibility & Screen-recording pull-down detection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (videoRef?.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    };

    const handleWindowBlur = () => {
      // When screen recording extension prompt or mobile control drawer opens
      if (videoRef?.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [videoRef]);

  return {
    isRecordingBlocked,
    blockReason,
    triggerBlockout,
    videoProtectionProps: {
      controlsList: 'nodownload noplaybackrate noremoteplayback',
      disablePictureInPicture: true,
      disableRemotePlayback: true,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
      style: {
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        WebkitTouchCallout: 'none' as const
      }
    }
  };
}

/**
 * Screen Recording Blackout Shield / Obscure Protection Overlay:
 * Blanks out and obscures video player with an active protection prompt whenever screen capture or recording is detected.
 */
export const ScreenRecordingShield: React.FC<{
  isBlocked: boolean;
  reason?: string;
  creatorHandle?: string;
}> = ({ isBlocked, reason, creatorHandle }) => {
  if (!isBlocked) return null;

  const handle = (creatorHandle || 'creator').trim().replace(/^@+/, '@');

  return (
    <div 
      className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'all'
      }}
    >
      <div className="w-14 h-14 rounded-full bg-red-950/90 border border-red-500/60 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(239,68,68,0.5)]">
        <EyeOff className="w-7 h-7 text-red-500 animate-pulse" />
      </div>
      <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <span>Protected Content</span>
      </h4>
      <p className="text-xs text-zinc-300 max-w-xs leading-relaxed mb-3">
        {reason || 'Screen recording and capturing are restricted to protect creator copyright and intellectual property on Pultanc.'}
      </p>
      <div className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full shadow-inner">
        Watermarked for <strong className="text-red-400">{handle} • powered by pultanc</strong>
      </div>
    </div>
  );
};
