import React, { useState } from 'react';
import { 
  ArrowRight, 
  ChevronRight 
} from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from '../Logo';
import { triggerHaptic } from '../../utils/haptics';

interface LandingPageProps {
  onEnterFeed: () => void;
  onSignUp?: () => void;
}

export function LandingPage({ onEnterFeed, onSignUp }: LandingPageProps) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const diff = touchStartX - touchEndX;
    if (diff > 45 || diff < -45) {
      triggerHaptic('swipe');
      onEnterFeed();
    }
  };

  const items = [
    {
      title: 'Sign Up for Free',
      description: 'Create your creator profile in under 1 minute.',
      onClick: () => {
        if (onSignUp) onSignUp();
        else onEnterFeed();
      }
    },
    {
      title: 'Upload and Set up Pricing',
      description: 'Set up Pay-Per-Clip unlock, Climer series, or Monthly Subscriptions.'
    },
    {
      title: 'Generate Video-Image Link & QR Cards',
      description: 'Share your dynamic video-image links directly to TikTok, Instagram Reels, YouTube Shorts, WhatsApp, or your website'
    },
    {
      title: 'Instant Local Payouts',
      description: 'Collect your earnings instantly and withdraw directly to your Mobile Money wallet (MTN, Telecel, AT) or bank account.'
    }
  ];

  return (
    <div 
      className="w-full h-full min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col justify-between overflow-y-auto selection:bg-red-500/20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Banner */}
      <div className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 px-4 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
        <span>Only original productions and creations</span>
      </div>

      {/* Main Content Area */}
      <div className="max-w-md w-full mx-auto px-5 py-6 sm:py-8 flex-1 flex flex-col justify-center space-y-5">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-black rounded-[10px] flex items-center justify-center">
                <Logo className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white leading-none">Pultanc</h1>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Only original productions and creations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onEnterFeed();
              }}
              className="text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <span>Feeds</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 4 Core Steps */}
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick}
              className={`p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-white/10 text-left transition-all ${
                item.onClick ? 'cursor-pointer hover:border-red-500/50 active:scale-[0.99]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white leading-snug">
                  {item.title}
                </h2>
                {item.onClick && (
                  <ChevronRight className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5" />
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Enter Feed Icon Button */}
        <div className="pt-2 flex flex-col items-center justify-center space-y-2">
          <button
            onClick={() => {
              triggerHaptic('swipe');
              onEnterFeed();
            }}
            aria-label="Enter feeds"
            className="w-12 h-12 rounded-full bg-[#ff0514] hover:bg-[#ff0514]/90 active:scale-90 text-white shadow-lg flex items-center justify-center transition-all cursor-pointer hover:shadow-[#ff0514]/30 hover:shadow-xl"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-[10px] text-center text-neutral-500">
            Swipe anywhere or tap to start watching
          </p>
        </div>

      </div>

      {/* Subtle Footer */}
      <div className="py-3 text-center text-[10px] text-neutral-500 dark:text-neutral-600 border-t border-neutral-200 dark:border-white/5">
        Pultanc • Only original productions and creations
      </div>
    </div>
  );
}
