import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Smartphone, Video, User, Settings, Wallet, LogIn, LogOut, Link2, Share2, Mail, Bell, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Logo } from '../Logo';
import { toast } from 'sonner';

interface SidebarProps {
  activeTab: 'landing' | 'consumer' | 'matrix' | 'creator' | 'profile' | 'live' | 'accountProfile' | 'settings' | 'wallet' | 'funnels' | 'social' | 'tasker' | 'notifications';
  setActiveTab: (tab: any) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isOwner: boolean;
  setIsOwner: (owner: boolean) => void;
  onLoginClick?: () => void;
  onContactClick?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen, isOwner, setIsOwner, onLoginClick, onContactClick }: SidebarProps) {
  const [userUser, setUserUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, u => {
      setUserUser(u);
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      if (u) {
        // Real-time Firestore document listener to instantly capture avatar & profile updates
        const userRef = doc(db, 'users', u.uid);
        unsubDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          }
        }, (err) => {
          console.warn('Sidebar user profile sync error:', err);
        });
      } else {
        setUserProfile(null);
      }
    });

    // Instant local custom events for 0ms reactivity when uploading avatar or updating profile
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUserProfile((prev: any) => ({
          ...prev,
          avatarUrl: e.detail.avatarUrl || e.detail.photoURL || prev?.avatarUrl,
          photoURL: e.detail.photoURL || e.detail.avatarUrl || prev?.photoURL,
          ...(e.detail.displayName ? { displayName: e.detail.displayName } : {}),
          ...(e.detail.name ? { name: e.detail.name } : {}),
        }));
      }
    };

    window.addEventListener('pultanc_avatar_updated', handleProfileUpdate);
    window.addEventListener('user_profile_updated', handleProfileUpdate);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      window.removeEventListener('pultanc_avatar_updated', handleProfileUpdate);
      window.removeEventListener('user_profile_updated', handleProfileUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[55] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`fixed inset-y-0 left-0 z-[60] w-64 max-w-[80vw] h-[100dvh] border-r border-gray-200/80 bg-white flex flex-col justify-between transition-transform duration-300 md:translate-x-0 md:static md:w-56 md:h-auto shrink-0 shadow-2xl md:shadow-none ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="overflow-y-auto no-scrollbar flex-1 pb-4">
          {/* Header block with Logo and the Two Navigation Dots representing the Public views */}
          <div className="p-3.5 pb-2.5 border-b border-gray-100 flex flex-col items-start gap-2.5">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <Logo className="w-5 h-5"/>
                <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">Pultanc</span>
              </div>
              {!isOnline && (
                <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full" title="No internet connection">
                  <WifiOff className="w-3 h-3 animate-pulse" />
                  Offline
                </span>
              )}
            </div>

            {/* Public Section (Three Dots below the app name) */}
            <div className="w-full">
              <div className="flex items-center gap-1.5">
                <motion.button 
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => { setActiveTab('consumer'); setIsMobileOpen(false); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg border text-[11px] font-bold transition-all relative ${
                    activeTab === 'consumer' 
                      ? 'bg-red-50/80 text-red-700 border-red-100 shadow-xs' 
                      : 'bg-white text-gray-600 border-gray-200/80 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-transform ${activeTab === 'consumer' ? 'bg-red-500 scale-110' : 'bg-gray-300'}`} />
                  <span className="truncate">Feeds</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => {
                    setActiveTab('live'); 
                    setIsMobileOpen(false); 
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg border text-[11px] font-bold transition-all relative ${
                    activeTab === 'live' 
                      ? 'bg-red-50/80 text-red-700 border-red-100 shadow-xs' 
                      : 'bg-white text-gray-600 border-gray-200/80 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-transform ${activeTab === 'live' ? 'bg-red-500 scale-110' : 'bg-gray-300'}`} />
                  <span className="truncate">Live</span>
                </motion.button>
              </div>
            </div>
          </div>
          
          {/* Main workspace navigation - Creator / Internal features raised closer to the top */}
          <div className="px-2.5 py-1.5 space-y-1">
            <div className="px-2 pt-0.5 pb-0.5">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Creator Space</div>
              <p className="text-[9px] text-gray-400">Private hub for owner tools</p>
            </div>
            
            <div className="space-y-0.5 bg-gray-50/70 p-1.5 rounded-xl border border-gray-100/80">
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('profile'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <User className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'profile' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">My Page</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('creator'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'creator' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Video className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'creator' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Creator Portal</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('funnels'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'funnels' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Link2 className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'funnels' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Climer</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('social'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'social' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Share2 className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'social' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">My Social Card</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('tasker'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'tasker' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Video className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'tasker' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">My Goal Card</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('matrix'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'matrix' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'matrix' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Analytics</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('accountProfile'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'accountProfile' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <User className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'accountProfile' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Account Portal</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('wallet'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'wallet' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Wallet className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'wallet' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Wallet</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('notifications'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'notifications' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Bell className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'notifications' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">Notifications</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => { setActiveTab('settings'); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white text-gray-900 border border-gray-200/80 shadow-xs font-semibold' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
              >
                <Settings className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'settings' ? 'scale-110 text-red-500' : 'opacity-70'}`} />
                <span className="font-medium text-xs">App Settings</span>
              </motion.button>
              <motion.button 
                whileHover={{ x: 3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => {
                  if (onContactClick) onContactClick();
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all text-gray-600 hover:bg-white hover:text-gray-900`}
              >
                <Mail className="w-3.5 h-3.5 shrink-0 opacity-70"/>
                <span className="font-medium text-xs">Contact & Updates</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* User Profile & Logout section at the bottom - pushed forward on mobile */}
        <div className="p-3.5 pb-20 md:pb-6 border-t border-gray-200/80 shrink-0 bg-gray-50/90 shadow-xs relative z-10">
          {userUser ? (() => {
            const effectiveAvatar = userProfile?.avatarUrl || userProfile?.photoURL || userUser?.photoURL || '';
            const effectiveName = userProfile?.displayName || userProfile?.name || userUser?.displayName || userUser?.email?.split('@')[0] || 'My Account';
            return (
              <div className="flex items-center gap-2.5">
                <div 
                  onClick={() => {
                    if (setActiveTab) setActiveTab('accountProfile');
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-85 hover:scale-105 transition-all shadow-xs relative group"
                  title="View Profile"
                >
                  {effectiveAvatar ? (
                    <img 
                      src={effectiveAvatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p 
                    onClick={() => {
                      if (setActiveTab) setActiveTab('accountProfile');
                    }}
                    className="text-xs font-bold text-gray-900 leading-tight truncate hover:text-red-600 transition-colors cursor-pointer"
                    title="View Profile"
                  >
                    {effectiveName}
                  </p>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await signOut(auth);
                        toast.success('Logged out successfully', {
                          description: 'You have been signed out of your account.'
                        });
                        if (setActiveTab) setActiveTab('consumer');
                      } catch (err: any) {
                        toast.error('Logout error: ' + (err.message || 'Failed to log out'));
                      }
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5 mt-1 transition-colors cursor-pointer active:scale-95 py-0.5"
                    title="Log Out"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            );
          })() : (
            <div>
              <motion.div 
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => {
                  if (onLoginClick) onLoginClick();
                }}
                className="flex items-center gap-2.5 mb-2.5 cursor-pointer hover:opacity-85 transition-opacity group"
                title="Click to Sign In / Create Account"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 shrink-0 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 leading-tight truncate group-hover:text-red-600 transition-colors">
                    {isOwner ? 'System Admin' : 'Guest User'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono tracking-tight mt-0.5 truncate">
                    Click to Sign In
                  </p>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => {
                  if (onLoginClick) onLoginClick();
                }}
                className="w-full text-xs font-semibold bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-xl transition-all border border-red-600 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-white" />
                <span>Sign In / Register</span>
              </motion.button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
