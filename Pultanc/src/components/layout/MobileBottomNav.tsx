import React, { useState, useEffect } from 'react';
import { Home, Compass, MessageCircle, Wallet, User, WifiOff, Wifi } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOwner: boolean;
}

export function MobileBottomNav({ activeTab, setActiveTab, isOwner }: MobileBottomNavProps) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState<boolean>(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      if (user) {
        setAvatarUrl(user.photoURL || '');
        const userRef = doc(db, 'users', user.uid);
        unsubDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setAvatarUrl(data.avatarUrl || data.photoURL || user.photoURL || '');
          }
        });
      } else {
        setAvatarUrl('');
      }
    });

    const handleAvatarSync = (e: any) => {
      if (e.detail?.avatarUrl || e.detail?.photoURL) {
        setAvatarUrl(e.detail.avatarUrl || e.detail.photoURL);
      }
    };
    window.addEventListener('pultanc_avatar_updated', handleAvatarSync);
    window.addEventListener('user_profile_updated', handleAvatarSync);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);
      const timer = setTimeout(() => {
        setShowReconnectedBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      window.removeEventListener('pultanc_avatar_updated', handleAvatarSync);
      window.removeEventListener('user_profile_updated', handleAvatarSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTabClick = (tab: string) => {
    triggerHaptic('selection');
    setActiveTab(tab);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      {/* Offline Mode Alert Bar */}
      {!isOnline && (
        <div className="bg-amber-600/95 backdrop-blur-md text-white text-[11px] font-medium px-4 py-1.5 flex items-center justify-center gap-1.5 shadow-md border-t border-amber-500/30 pointer-events-auto animate-fadeIn">
          <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-200" />
          <span>Offline Mode — Some features may be unavailable</span>
        </div>
      )}

      {/* Back Online Toast Notification */}
      {isOnline && showReconnectedBanner && (
        <div className="bg-emerald-600/95 backdrop-blur-md text-white text-[11px] font-medium px-4 py-1.5 flex items-center justify-center gap-1.5 shadow-md border-t border-emerald-500/30 pointer-events-auto transition-all animate-fadeIn">
          <Wifi className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
          <span>Connection restored — You're back online</span>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-white/10 flex items-center justify-between px-6 py-3 safe-area-bottom pointer-events-auto shadow-lg">
        <button 
          onClick={() => handleTabClick('consumer')}
          className={`flex flex-col items-center gap-1 transition-transform active:scale-95 ${activeTab === 'consumer' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <Home className="w-5 h-5"/>
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button 
          onClick={() => handleTabClick('discover')}
          className={`flex flex-col items-center gap-1 transition-transform active:scale-95 ${activeTab === 'discover' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <Compass className="w-5 h-5"/>
          <span className="text-[10px] font-medium">Discover</span>
        </button>

        <button 
          onClick={() => handleTabClick('messages')}
          className={`flex flex-col items-center gap-1 transition-transform active:scale-95 ${activeTab === 'messages' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <MessageCircle className="w-5 h-5"/>
          <span className="text-[10px] font-medium">Chat</span>
        </button>

        <button 
          onClick={() => handleTabClick('wallet')}
          className={`flex flex-col items-center gap-1 transition-transform active:scale-95 ${activeTab === 'wallet' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <Wallet className="w-5 h-5"/>
          <span className="text-[10px] font-medium">Wallet</span>
        </button>

        <button 
          onClick={() => handleTabClick('accountProfile')}
          className={`flex flex-col items-center gap-1 transition-transform active:scale-95 relative ${activeTab === 'accountProfile' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <div className="relative">
            {avatarUrl ? (
              <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-300 dark:border-zinc-700 flex items-center justify-center">
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <User className="w-5 h-5"/>
            )}
            {!isOnline && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-zinc-950 animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
}
