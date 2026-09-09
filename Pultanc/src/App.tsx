import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import DiscoverView from './components/discover/DiscoverView';
import MessagesView from './components/messages/MessagesView';
import ConsumerFeed from './components/consumer/ConsumerFeed';
import ControlMatrix from './components/matrix/ControlMatrix';
import CreatorPortal from './components/creator/CreatorPortal';
import UserProfile from './components/profile/UserProfile';
import LiveFeed from './components/live/LiveFeed';
import SettingsView from './components/settings/SettingsView';
import WalletView from './components/wallet/WalletView';
import BioFunnels from './components/funnels/BioFunnels';
import SocialShareStudio from './components/matrix/SocialShareStudio';
import TaskerCardStudio from './components/matrix/TaskerCardStudio';
import { Sidebar } from './components/layout/Sidebar';
import { AuthModal } from './components/auth/AuthModal';
import { AuthGateway } from './components/auth/AuthGateway';
import { ContactModal } from './components/contact/ContactModal';
import { Toaster } from 'sonner';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Menu, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './components/Logo';
import { triggerHaptic } from './utils/haptics';

import { Notifications } from "./components/notifications/Notifications";
import { checkAndVerifyPaymentReturn } from "./utils/paymentSession";
import { PaymentSuccessModal, PaymentSuccessDetails } from './components/common/PaymentSuccessModal';


export default function App() {
  const getInitialRouting = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryCreator = params.get('profile') || params.get('u') || params.get('creator') || params.get('user');
      const path = window.location.pathname.replace(/^\/+/, '');
      const segments = path.split('/').filter(Boolean);

      // Check if this is a direct climer video link:
      // Examples: /@creator/my-slug, /bio/my-slug, /video/my-slug, /clip/my-slug, ?climer=...
      const isClimerVideo = 
        (segments.length >= 2 && segments[0].startsWith('@')) ||
        path.startsWith('bio/') || 
        path.startsWith('video/') || 
        path.startsWith('clip/') || 
        params.has('climer') || 
        params.has('video') || 
        params.has('clip') || 
        params.has('series');

      if (isClimerVideo) {
        return { tab: 'consumer', creator: null };
      }

      if (params.get('funnel')) {
        return { tab: 'funnels', creator: null };
      }

      let pathCreator: string | null = null;
      if (segments.length >= 1 && segments[0].startsWith('@')) {
        pathCreator = decodeURIComponent(segments[0].substring(1));
      } else if (path && !['bio', 'video', 'clip', 'api', 'dist', 'index.html'].includes(path.split('/')[0])) {
        pathCreator = decodeURIComponent(path.split('/')[0]);
      }
      const fallbackCreator = typeof window !== 'undefined' ? (localStorage.getItem('pultanc_creator_handle') || localStorage.getItem('pultanc_user_handle') || null) : null;
      const resolvedCreator = queryCreator || pathCreator || (params.get('card') ? fallbackCreator : null);
      if (resolvedCreator || params.get('card')) {
        return { tab: 'profile', creator: resolvedCreator };
      }
      if (params.get('tab')) {
        return { tab: params.get('tab')!, creator: null };
      }
    }
    return { tab: 'landing', creator: null };
  };

  const initialRoute = getInitialRouting();
  const [history, setHistory] = useState<string[]>([initialRoute.tab]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [navDirection, setNavDirection] = useState<number>(1);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('signup');
  const [showContactModal, setShowContactModal] = useState(false);
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState<PaymentSuccessDetails | null>(null);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<string | null>(initialRoute.creator);

  const activeTab = history[historyIndex];

  const handleSetTab = (tab: string, creatorHandle?: string | null) => {
    if (creatorHandle !== undefined) {
      setSelectedProfileCreator(creatorHandle);
    } else if (tab !== 'profile') {
      setSelectedProfileCreator(null);
    }
    if (tab === activeTab && (!creatorHandle || creatorHandle === selectedProfileCreator)) return;

    triggerHaptic('selection');
    setNavDirection(tab === 'consumer' ? -1 : 1);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(tab);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  useEffect(() => {
    checkAndVerifyPaymentReturn(handleSetTab);
    const onFocus = () => checkAndVerifyPaymentReturn(handleSetTab);
    window.addEventListener('focus', onFocus);

    const handlePaymentSuccessEvent = (e: CustomEvent<PaymentSuccessDetails>) => {
      if (e.detail) {
        setPaymentSuccessDetails(e.detail);
      }
    };
    window.addEventListener('pultanc_payment_success' as any, handlePaymentSuccessEvent);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pultanc_payment_success' as any, handlePaymentSuccessEvent);
    };
  }, []);

  // Responsive spring configuration for swipe gestures
  const springTransition = {
    type: "spring" as const,
    stiffness: 360,
    damping: 32,
    mass: 0.8
  };

  // Swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchEndY(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart - touchEnd;
    const distanceY = (touchStartY && touchEndY) ? Math.abs(touchStartY - touchEndY) : 0;
    
    // Only trigger horizontal navigation if horizontal gesture dominates vertical scroll
    if (Math.abs(distanceX) < minSwipeDistance || (distanceY > 0 && Math.abs(distanceX) < distanceY * 1.1)) {
      return;
    }

    // Only allow screen-wide horizontal swipe navigation on landing and consumer feed.
    // In creator studios (creator portal, climers, goal card, social studio, etc.), horizontal swipes/drags must never hijack navigation.
    if (activeTab !== 'landing' && activeTab !== 'consumer') {
      return;
    }

    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    if (isLeftSwipe) {
      triggerHaptic('swipe');
      if (activeTab === 'landing') {
        handleSetTab('consumer');
      } else if (activeTab === 'consumer') {
        handleSetTab('profile');
      } else if (activeTab === 'profile' || activeTab === 'accountProfile') {
        handleSetTab('consumer');
      } else {
        handleForward();
      }
    }
    if (isRightSwipe) {
      triggerHaptic('swipe');
      if (activeTab === 'consumer') {
        handleSetTab('landing');
      } else if (activeTab === 'profile' || activeTab === 'accountProfile') {
        handleSetTab('consumer');
      } else {
        handleBack();
      }
    }
  };

  useEffect(() => {
    // Safety fallback: ensure UI renders promptly even if auth resolution delays in sandboxed iframes
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 1200);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(safetyTimer);
      setUser(u);
      setIsOwner(!!u);
      setAuthLoading(false);
      if (u) {
        try {
          const userDocRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            await updateDoc(userDocRef, {
              lastLoginAt: Date.now()
            }).catch(() => {});
          } else {
            // Initializing user record if first detected via session
            await setDoc(userDocRef, {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || u.email?.split('@')[0] || 'User',
              username: (u.displayName || u.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, ''),
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
              isFirstTimer: false,
              role: 'user',
              balance: 0,
              totalEarnings: 0,
              unlocksCount: 0,
              supportsCount: 0,
              subscribersCount: 0,
              photoURL: u.photoURL || ''
            }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.warn("User login sync error:", err);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' || 
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.key.toLowerCase() === 's')) ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')
      ) {
        e.preventDefault();
        document.body.style.display = 'none';
        setTimeout(() => {
          document.body.style.display = '';
        }, 1000);
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
    };
  }, []);

  const handleBack = () => {
    if (historyIndex > 0) {
      triggerHaptic('swipe');
      setNavDirection(-1);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      triggerHaptic('swipe');
      setNavDirection(1);
      setHistoryIndex(historyIndex + 1);
    }
  };

  if (authLoading) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Logo className="w-16 h-16 animate-pulse text-white/50" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-neutral-950 text-white selection:bg-red-500/30 overflow-hidden font-sans">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'landing' ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, x: navDirection > 0 ? -40 : 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: navDirection > 0 ? -40 : 40, scale: 0.98 }}
              transition={springTransition}
              className="h-full w-full"
            >
              <LandingPage 
                onEnterFeed={() => {
                  triggerHaptic('swipe');
                  handleSetTab('consumer');
                }} 
                onSignUp={() => {
                  setAuthInitialMode('signup');
                  setShowAuthModal(true);
                }}
              />
            </motion.div>
          ) : activeTab === 'consumer' ? (
            <motion.div
              key="consumer"
              initial={{ opacity: 0, x: navDirection > 0 ? -40 : 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: navDirection > 0 ? -40 : 40, scale: 0.98 }}
              transition={springTransition}
              className="h-full w-full"
            >
              <ConsumerFeed 
                onNavigateToProfile={(creator?: string) => {
                  triggerHaptic('swipe');
                  handleSetTab('profile', creator || null);
                }} 
                onRequireAuth={() => setShowAuthModal(true)} 
                onNavigateToTab={handleSetTab} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, x: navDirection > 0 ? 40 : -40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: navDirection > 0 ? 40 : -40, scale: 0.98 }}
              transition={springTransition}
              className="flex h-screen w-full bg-white text-gray-900 overflow-hidden font-sans relative transition-colors duration-200"
            >
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setIsMobileOpen(true);
                }}
                className="md:hidden fixed top-3.5 right-3.5 z-40 w-6 h-6 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md flex items-center justify-center text-gray-800 shadow-xs active:scale-95 transition-transform"
                aria-label="Open menu"
              >
                <Menu className="w-3.5 h-3.5"/>
              </button>

              <Sidebar 
                activeTab={activeTab as any} 
                setActiveTab={handleSetTab} 
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                isOwner={isOwner}
                setIsOwner={setIsOwner}
                onLoginClick={() => {
                  setAuthInitialMode('login');
                  setShowAuthModal(true);
                }}
                onContactClick={() => setShowContactModal(true)}
              />

              {/* Main Content Area */}
              <main 
                className="flex-1 h-full relative overflow-hidden bg-white outline outline-1 outline-gray-800/50 flex flex-col transition-colors duration-200"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                
                {activeTab !== 'consumer' && activeTab !== 'live' && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 opacity-30 hover:opacity-100 transition-opacity">
                    <button 
                      onClick={handleBack} 
                      disabled={historyIndex === 0}
                      className="w-8 h-1 bg-gray-500 rounded-full disabled:opacity-0 transition-opacity"
                    />
                    <button 
                      onClick={handleForward} 
                      disabled={historyIndex === history.length - 1}
                      className="w-8 h-1 bg-gray-500 rounded-full disabled:opacity-0 transition-opacity"
                    />
                  </div>
                )}

                <div className="flex-1 h-full overflow-hidden relative">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: navDirection > 0 ? 30 : -30, scale: 0.99 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: navDirection > 0 ? -30 : 30, scale: 0.99 }}
                      transition={springTransition}
                      className="w-full h-full flex flex-col overflow-hidden"
                    >
                      {activeTab === 'discover' ? (
                        <DiscoverView />
                      ) : activeTab === 'messages' ? (
                        <MessagesView onNavigateToTab={handleSetTab} />
                      ) : activeTab === 'matrix' ? (
                        <ControlMatrix />
                      ) : activeTab === 'creator' ? (
                        <CreatorPortal onNavigateToTab={handleSetTab} />
                      ) : activeTab === 'funnels' ? (
                        <BioFunnels />
                      ) : activeTab === 'social' ? (
                        <div className="p-4 md:p-8 overflow-y-auto w-full h-full">
                          <SocialShareStudio onNavigateToTab={handleSetTab} />
                        </div>
                      ) : activeTab === 'tasker' ? (
                        <div className="p-4 md:p-8 overflow-y-auto w-full h-full">
                          <TaskerCardStudio onNavigateToTab={handleSetTab} />
                        </div>
                      ) : activeTab === 'notifications' ? (
                        <Notifications />
                      ) : activeTab === 'wallet' ? (
                        <WalletView />
                      ) : activeTab === 'live' ? (
                        <LiveFeed onRequireAuth={() => setShowAuthModal(true)} onNavigateToTab={handleSetTab} />
                      ) : activeTab === 'accountProfile' ? (
                        <UserProfile viewType="private" isOwner={isOwner} onNavigateToTab={handleSetTab} />
                      ) : activeTab === 'settings' ? (
                        <SettingsView onContactClick={() => setShowContactModal(true)} />
                      ) : (
                        <UserProfile viewType="public" isOwner={isOwner} selectedCreatorHandle={selectedProfileCreator} onNavigateToTab={handleSetTab} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                
              </main>
            </motion.div>
          )}
          <Toaster position="top-center" richColors />
        </AnimatePresence>

        {/* Global Modals rendered at root level */}
        <AuthModal 
          isOpen={showAuthModal} 
          initialMode={authInitialMode}
          onClose={() => setShowAuthModal(false)} 
        />
        {showContactModal && (
          <ContactModal onClose={() => setShowContactModal(false)} />
        )}
        <PaymentSuccessModal
          isOpen={!!paymentSuccessDetails}
          details={paymentSuccessDetails}
          onClose={() => setPaymentSuccessDetails(null)}
          onNavigateToTab={handleSetTab}
        />
      </div>
      <MobileBottomNav activeTab={activeTab} setActiveTab={handleSetTab} isOwner={isOwner} />
    </>
  );
}
