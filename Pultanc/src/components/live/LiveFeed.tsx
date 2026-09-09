import React, { useState, useEffect, useRef } from 'react';
import { Radio, Users, Lock, Unlock, PlayCircle, X, Smartphone, CheckCircle2, MessageCircle, Send, Heart, ShieldCheck, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockLiveCreators } from '../../data';
import { LiveCreator } from '../../types';
import { usePricing } from '../../usePricing';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { savePendingPayment, showPaymentSuccessPopup } from '../../utils/paymentSession';
import { recordPaymentTransaction } from '../../utils/transactionRecorder';

export default function LiveFeed({ onRequireAuth, onNavigateToTab }: { onRequireAuth?: () => void, onNavigateToTab?: (tab: string) => void }) {
 const { livePrice } = usePricing();
 const [creators, setCreators] = useState<LiveCreator[]>(mockLiveCreators);
 const [activeStream, setActiveStream] = useState<LiveCreator | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 const timer = setTimeout(() => {
 setIsLoading(false);
 }, 900);
 return () => clearTimeout(timer);
 }, []);
 
 const [isProcessing, setIsProcessing] = useState(false);
 const [unlockSuccess, setUnlockSuccess] = useState(false);
 const [paystackReference, setPaystackReference] = useState<string | null>(null);

 const [chatMessage, setChatMessage] = useState('');
 const [messages, setMessages] = useState<{id: string, user: string, text: string}[]>([]);
 const [streamHeartCount, setStreamHeartCount] = useState(0);

 const [floatingHearts, setFloatingHearts] = useState<{id: number, left: number}[]>([]);
 const chatContainerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (chatContainerRef.current) {
 chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
 }
 }, [messages]);

 useEffect(() => {
 if (!activeStream || !activeStream.isSubscribed) return;

 // Listen to messages
 const q = query(
 collection(db, 'streams', activeStream.id, 'messages'),
 orderBy('timestamp', 'asc'),
 limit(100)
 );

 const unsubscribeMessages = onSnapshot(q, (snapshot) => {
 const newMessages = snapshot.docs.map(doc => ({
 id: doc.id,
 user: doc.data().userName || 'Anonymous',
 text: doc.data().text || ''
 }));
 setMessages(newMessages);
 }, (error) => {
 handleFirestoreError(error, OperationType.GET, `streams/${activeStream.id}/messages`);
 });

 // Listen to hearts
 const heartDocRef = doc(db, 'streams', activeStream.id, 'stats', 'hearts');
 const unsubscribeHearts = onSnapshot(heartDocRef, (doc) => {
 if (doc.exists()) {
 const count = doc.data().count || 0;
 // If count increased, show some floating hearts
 if (count > streamHeartCount) {
 const newHeart = { id: Date.now() + Math.random(), left: Math.random() * 20 - 10 };
 setFloatingHearts(prev => [...prev.slice(-10), newHeart]);
 }
 setStreamHeartCount(count);
 }
 }, (error) => {
 console.error(error);
 });

 return () => {
 unsubscribeMessages();
 unsubscribeHearts();
 };
 }, [activeStream]);

 const handleManualVerify = async (refInput?: string) => {
 const ref = refInput || paystackReference;
 if (!ref) return false;
 try {
 let verifyData: any = null;
 try {
 const verifyRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
 const contentType = verifyRes.headers.get("content-type");
 if (contentType && contentType.includes("application/json")) {
 verifyData = await verifyRes.json();
 }
 } catch (e) {
 console.warn("Live pass verification network error:", e);
 }
 
 if (verifyData && verifyData.status && verifyData.data?.status === 'success') {
 setIsProcessing(false);
 setPaystackReference(null);
 setUnlockSuccess(true);
 toast.success('Live pass unlocked successfully!');
 showPaymentSuccessPopup({
   amount: livePrice,
   currency: 'GHS',
   recipientName: activeStream?.name || 'Creator',
   paymentFor: activeStream?.liveTitle ? `Live Pass: ${activeStream.liveTitle}` : 'Live Pass Ticket',
   reference: ref,
   tab: 'live',
   type: 'ticket'
 });
 if (activeStream) {
 recordPaymentTransaction({
 reference: ref,
 recipientId: activeStream.creator || activeStream.handle || activeStream.id || 'creator',
 recipientName: activeStream.name || 'Streamer',
 amount: livePrice,
 type: 'ticket',
 title: `Live Stream Ticket: ${activeStream.liveTitle || 'Live Pass'}`
 }).catch(err => console.warn("Failed to record live pass transaction:", err));
 
 setTimeout(() => {
 setCreators(prev => prev.map(c => c.id === activeStream.id ? { ...c, isSubscribed: true } : c));
 setActiveStream(prev => prev ? { ...prev, isSubscribed: true } : null);
 setUnlockSuccess(false);
 }, 1500);
 }
 return true;
 }
 if (!refInput) {
 alert('Payment is not completed yet. Please complete checkout on the other tab.');
 }
 return false;
 } catch (e) {
 console.error('Manual verification error:', e);
 if (!refInput) {
 alert('Verification failed. Try again.');
 }
 return false;
 }
 };

 const handleSubscribeClick = async () => {
 setIsProcessing(true);
 
    const paymentWindow = window.open("", "_blank");
 try {
 const amountGHS = livePrice;

	const targetCreatorId = activeStream?.creatorId || activeStream?.id || '';
	const targetContentId = activeStream?.id || '';
	const response = await fetch('/api/paystack/initialize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: auth.currentUser?.email || 'user@example.com',
			transaction_type: 'unlock',
			creator_id: targetCreatorId,
			user_id: auth.currentUser?.uid || '',
			content_id: targetContentId,
			callback_url: `${window.location.origin}/?tab=live`,
			currency: 'GHS',
			metadata: {
				transaction_type: 'unlock',
				creator_id: targetCreatorId,
				user_id: auth.currentUser?.uid || '',
				content_id: targetContentId
			}
		})
	});

 const data = await response.json();
 
 if (data.status && data.data?.authorization_url) {
 const reference = data.data.reference;
 setPaystackReference(reference);
 savePendingPayment({
 reference,
 tab: 'live',
 type: 'ticket',
 recipientName: activeStream?.name || 'Creator',
 title: activeStream?.liveTitle ? `Live Pass: ${activeStream.liveTitle}` : 'Live Pass Ticket',
 amount: amountGHS
 });

        if (paymentWindow) paymentWindow.location.href = data.data.authorization_url;
        else window.location.href = data.data.authorization_url;

 // Start polling for payment success (ultra-fast 1200ms checks)
 const pollInterval = setInterval(async () => {
 try {
 const isVerified = await handleManualVerify(reference);
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
    if (paymentWindow) paymentWindow.close();
 throw new Error(data.error || 'Failed to initialize payment');
 }
 } catch (error) {
    if (paymentWindow) paymentWindow.close();
 console.error('Payment initialization error:', error);
 setIsProcessing(false);
 }
 };

 const sendMessage = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!chatMessage.trim() || !activeStream) return;
 const msg = chatMessage;
 setChatMessage('');
 
 try {
 await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
 userId: auth.currentUser?.uid || 'anon',
 userName: auth.currentUser?.displayName || 'User',
 text: msg,
 timestamp: serverTimestamp()
 });
 } catch (error) {
 handleFirestoreError(error, OperationType.CREATE, `streams/${activeStream.id}/messages`);
 }
 };

 const handleSendHeart = async () => {
 // Show one locally immediately for snappy feedback
 const newHeart = { id: Date.now() + Math.random(), left: Math.random() * 20 - 10 };
 setFloatingHearts(prev => [...prev.slice(-10), newHeart]);
 setTimeout(() => {
 setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
 }, 2000);

 if (!activeStream) return;
 
 const heartDocRef = doc(db, 'streams', activeStream.id, 'stats', 'hearts');
 try {
 await updateDoc(heartDocRef, {
 count: increment(1),
 updatedAt: serverTimestamp()
 });
 } catch (error: any) {
 if (error.code === 'not-found') {
 // Document doesn't exist, create it
 try {
 await setDoc(heartDocRef, {
 count: 1,
 updatedAt: serverTimestamp()
 });
 } catch (setErr) {
 handleFirestoreError(setErr, OperationType.CREATE, `streams/${activeStream.id}/stats/hearts`);
 }
 } else {
 console.error(error);
 }
 }
 };

 return (
 <div className="h-full w-full bg-white lg:p-8 overflow-y-auto relative">
 <div className="max-w-7xl mx-auto space-y-8 pb-12">
 
 {/* Header */}
  <div className="bg-white p-4 sm:p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md flex items-center justify-center px-4 sm:px-8">
    <div className="text-center">
      <h1 className="text-xl sm:text-3xl font-bold text-gray-950 dark:text-white flex items-center justify-center gap-2">
        <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 animate-pulse"/>
        Xclusive live content
      </h1>
    </div>
  </div>

 {/* Live Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {isLoading ? (
 Array.from({ length: 3 }).map((_, i) => (
 <div 
 key={i}
 className="layered-container-sm overflow-hidden select-none animate-pulse bg-white border border-gray-100"
 >
 {/* Shimmer Preview Area */}
 <div className="relative h-48 w-full bg-gray-100 flex items-center justify-center">
 <div className="absolute top-3 left-3 bg-gray-200/80 h-5 w-14 rounded"/>
 <div className="absolute top-3 right-3 bg-gray-200/80 h-5 w-12 rounded"/>
 </div>

 {/* Shimmer Info Area */}
 <div className="p-4 flex gap-3 items-start">
 <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"/>
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-gray-200 rounded w-5/6"/>
 <div className="h-3 bg-gray-100 rounded w-1/2"/>
 </div>
 </div>
 </div>
 ))
 ) : creators.length === 0 ? (
 <div className="col-span-full py-20 text-center flex items-center justify-center">
 <p className="text-gray-500 font-medium text-sm">No Active Streams</p>
 </div>
 ) : (
 creators.map(creator => (
 <div 
 key={creator.id}
 onClick={() => { setActiveStream(creator); }}
 className="layered-container-sm layered-container-sm-interactive overflow-hidden group"
 >
 {/* Preview Image */}
 <div className="relative h-48 w-full overflow-hidden">
 <img 
 src={creator.previewImage} 
 alt={creator.liveTitle} 
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"/>
 
 <div className="absolute top-3 left-3 bg-red-500 text-gray-900 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
 </div>
 
 <div className="absolute top-3 right-3 bg-white/60 backdrop-blur text-gray-900 text-[10px] font-medium px-2 py-1 rounded flex items-center gap-1">
 <Users className="w-3 h-3"/> {creator.viewerCount.toLocaleString()}
 </div>

 {!creator.isSubscribed && (
 <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
 <div className="bg-red-500 text-white font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
 <Lock className="w-4 h-4"/> Unlock Live Event
 </div>
 </div>
 )}
 {creator.isSubscribed && (
 <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
 <div className="bg-white/20 backdrop-blur text-gray-900 border border-white/40 font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
 <PlayCircle className="w-5 h-5 fill-white text-black"/> Enter Room
 </div>
 </div>
 )}
 </div>

 {/* Info */}
 <div className="p-4 flex gap-3 items-start">
		{creator.avatar ? (
			<img src={creator.avatar} alt={creator.name} className="w-10 h-10 rounded-full border border-gray-300 shrink-0 object-cover"/>
		) : (
			<div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center shrink-0">
				<User className="w-5 h-5 text-gray-400" />
			</div>
		)}
 <div>
 <h3 className="text-gray-900 font-bold text-xs line-clamp-1">{creator.liveTitle}</h3>
 <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
 {creator.name} 
 {creator.isVerified && (
 <ShieldCheck className="w-3.5 h-3.5 fill-[#ff0514] text-white"/>
 )}
 <span className="text-gray-600">{creator.handle}</span>
 </p>
 </div>
 </div>
 </div>
 ))
 )}
 </div>

 </div>

 {/* Live Content Room Modal */}
 <AnimatePresence>
 {activeStream && (
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 20 }}
 className="fixed inset-0 z-[100] bg-white flex items-center justify-center"
 >
 <div className="relative w-full h-full md:max-w-[400px] bg-white overflow-hidden flex flex-col mx-auto border-x border-gray-900">
 
 <button 
 onClick={() => { setActiveStream(null); }}
 className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/40 hover:bg-white/80 backdrop-blur border border-white/10 rounded-full flex items-center justify-center text-gray-900 transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>

 {/* Video Area */}
 <div className="flex-1 relative bg-white flex flex-col h-full">
 <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
 <div className="bg-red-500 text-gray-900 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
 LIVE
 </div>
 <div className="bg-white/60 backdrop-blur text-gray-900 text-[10px] font-medium px-2 py-1 rounded flex items-center gap-1">
 <Users className="w-3 h-3"/> {activeStream.viewerCount.toLocaleString()}
 </div>
 </div>

 <div 
 className={`absolute inset-0 bg-cover bg-center ${!activeStream.isSubscribed ? 'blur-xl scale-110 opacity-50' : ''}`}
 style={{ backgroundImage: `url(${activeStream.previewImage})` }}
 />
 
 {/* Paywall Overlay */}
 {!activeStream.isSubscribed && (
 <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-white/40">
 {/* Pultanc App Checkout Header */}
 <div className="flex items-center gap-2 mb-6 bg-white/90 border border-gray-200/80 rounded-xl px-3 py-1.5">
 <span className="font-bold text-xs tracking-wider text-gray-900 uppercase">Pultanc Secure Checkout</span>
 </div>

		<div className="w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-red-500 flex items-center justify-center bg-gray-100">
		{activeStream.avatar ? (
			<img src={activeStream.avatar} alt={activeStream.name} className="w-full h-full object-cover"/>
		) : (
			<User className="w-10 h-10 text-gray-400" />
		)}
 </div>
 <h2 className="text-2xl font-bold text-gray-900 mb-2">
 {unlockSuccess ? 'Access Granted!' : `Unlock ${activeStream.name}'s Live Event`}
 </h2>
 <p className="text-gray-700 mb-8 max-w-sm">
 {unlockSuccess ? 'Payment successful. Entering live room...' : 'Purchase a live content ticket to access this xclusive live content and interact directly with the creator.'}
 </p>
 
 <div className="w-full max-w-sm">
 <button 
 onClick={handleSubscribeClick}
 disabled={isProcessing || unlockSuccess}
 className={`w-full font-bold py-1.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-70 ${unlockSuccess ? 'bg-red-500 text-black scale-105 -[0_0_20px_rgba(132,204,22,0.4)]' : 'bg-red-500 hover:bg-red-600 text-white'}`}
 >
 {isProcessing ? (
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 Connecting Checkout...
 </div>
 ) : unlockSuccess ? (
 <>
 <CheckCircle2 className="w-5 h-5"/>
 Access Granted!
 </>
 ) : (
 <>
 <Unlock className="w-5 h-5"/>
 Unlock Live Event for GHS {livePrice.toFixed(2)}
 </>
 )}
 </button>

 {isProcessing && (
 <div className="mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-center animate-pulse mb-2">
 <div className="flex items-center justify-center gap-2 mb-1 text-red-600 font-bold text-xs uppercase">
 <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0"/>
 <span>Verifying Payment...</span>
 </div>
 <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
 Completing transaction in other tab? You can also trigger an instant verification check below:
 </p>
 <button 
 onClick={() => handleManualVerify()}
 className="w-full py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl uppercase transition-all active:scale-95 cursor-pointer"
 >
 Verify Payment Now ⚡
 </button>
 </div>
 )}
 <div className="flex gap-2 mt-4">
 <div className="h-8 flex-1 bg-[#1eb53a]/20 border border-[#1eb53a]/30 rounded flex items-center justify-center font-bold text-[#1eb53a] text-xs">Mobile Money</div>
 <div className="h-8 flex-1 bg-gray-200 border border-gray-300 rounded flex items-center justify-center font-bold text-gray-700 text-xs">Credit Card</div>
 </div>
 </div>
 </div>
 )}
 
 {/* Chat and Interaction Overlay (Visible only when subscribed) */}
 {activeStream.isSubscribed && (
 <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end">
 
 {/* Floating Hearts Animation Container */}
 <div className="absolute right-6 bottom-32 w-10 h-64 pointer-events-none overflow-hidden">
 <AnimatePresence>
 {floatingHearts.map(heart => (
 <motion.div
 key={heart.id}
 initial={{ y: 200, opacity: 1, x: heart.left }}
 animate={{ y: -50, opacity: 0, x: heart.left + (Math.random() * 20 - 10) }}
 exit={{ opacity: 0 }}
 transition={{ duration: 1.5, ease:"easeOut"}}
 className="absolute bottom-0 text-red-500"
 >
 <Heart className="w-6 h-6 fill-red-500"/>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>

 {/* Chat Messages Area */}
 <div className="w-full px-3 pb-20 pt-10 bg-gradient-to-t from-white/90 via-white/40 to-transparent flex flex-col justify-end">
 <div 
 ref={chatContainerRef}
 className="max-h-64 overflow-y-auto space-y-1.5 pointer-events-auto flex flex-col"
 style={{ scrollBehavior: 'smooth' }}
 >
 {/* Empty spacer to push content down */}
 <div className="mt-auto"></div>
 {messages.map((msg, idx) => (
 <motion.div 
 initial={{opacity: 0, x: -10}} 
 animate={{opacity: 1, x: 0}} 
 key={idx} 
 className="text-[10px] sm:text-xs bg-white/40 backdrop-blur-sm px-2 py-1 rounded-lg w-fit max-w-[85%] border border-white/10"
 >
 <span className={`font-bold mr-1.5 ${msg.user === 'You' ? 'text-red-400' : 'text-gray-700'}`}>{msg.user}:</span>
 <span className="text-gray-900 font-medium">{msg.text}</span>
 </motion.div>
 ))}
 </div>
 </div>

 {/* Input Area */}
 <div className="absolute bottom-0 w-full p-4 pointer-events-auto flex items-center gap-3">
 <form onSubmit={sendMessage} className="relative flex-1">
 <input 
 type="text"
 placeholder="Say something..."
 value={chatMessage}
 onChange={(e) => setChatMessage(e.target.value)}
 className="w-full bg-white/50 backdrop-blur-md border border-white/20 rounded-full py-1.5 pl-4 pr-12 text-sm text-gray-900 focus:outline-none focus:border-red-500 focus:bg-white/70 transition-all"
 />
 <button 
 type="submit"
 disabled={!chatMessage.trim()}
 className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
 >
 <Send className="w-4 h-4"/>
 </button>
 </form>
 
 <button 
 onClick={handleSendHeart}
 className="w-12 h-12 rounded-full bg-white/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-red-500 hover:bg-white/80 transition-colors shrink-0"
 >
 <Heart className="w-6 h-6"/>
 </button>
 </div>

 </div>
 )}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 </div>
 );
}

