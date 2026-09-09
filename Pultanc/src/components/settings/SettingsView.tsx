import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Share2, Moon, Sun, Settings, User, Bell, ChevronRight, Shield, BadgeCheck, CheckCircle2, Clock, XCircle, Lock, Unlock, Key, Eye, EyeOff, CheckCircle, LogOut, X, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { LegalDrawer } from '../legal/LegalDrawer';
import { LEGAL_DOCS } from '../../data/legal';
import { auth, db, handleFirestoreError, OperationType } from '../../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { VerificationRequests } from '../matrix/VerificationRequests';
import { PayoutRequestsManager } from '../matrix/PayoutRequestsManager';
import { ReportsManager } from '../matrix/ReportsManager';
import { IDSubmissionModal } from '../auth/IDSubmissionModal';

interface SettingsViewProps { 
  onContactClick?: () => void; 
}

export default function SettingsView({ onContactClick }: SettingsViewProps) {
  const { theme, toggleTheme } = useTheme();
 const [isViralBaitEnabled, setIsViralBaitEnabled] = useState(false);
 const [legalDrawerContent, setLegalDrawerContent] = useState<{title: string, content: string} | null>(null);
 const [showIdModal, setShowIdModal] = useState(false);

 // Notification Preferences States
 const [notifPrefs, setNotifPrefs] = useState({
 payoutAlerts: true,
 verificationAlerts: true,
 newReleaseAlerts: true,
 liveAlerts: true
 });
 const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);




 // Sync / Load Notification preferences
 useEffect(() => {
 const unsub = onAuthStateChanged(auth, (user) => {
 if (!user) return;
 
 // Load from localStorage for instantaneous UI load
 const saved = localStorage.getItem(`notif_prefs_${user.uid}`);
 if (saved) {
 try {
 setNotifPrefs(JSON.parse(saved));
 } catch (e) {
 console.warn("Could not parse cached notification preferences", e);
 }
 }

 // Sync/Fetch from Firestore
 const userRef = doc(db, 'users', user.uid);
 getDoc(userRef).then((snap) => {
 if (snap.exists()) {
 const data = snap.data();
 


          if (data.notificationPreferences) {
 setNotifPrefs(data.notificationPreferences);
 localStorage.setItem(`notif_prefs_${user.uid}`, JSON.stringify(data.notificationPreferences));
 }
 }
 }).catch(err => console.warn("Could not load preferences from Firestore:", err));
 });
 return unsub;
 }, []);

 


  const handleTogglePref = async (key: keyof typeof notifPrefs) => {
 const user = auth.currentUser;
 if (!user) return;

 const updated = {
 ...notifPrefs,
 [key]: !notifPrefs[key]
 };
 setNotifPrefs(updated);
 localStorage.setItem(`notif_prefs_${user.uid}`, JSON.stringify(updated));

 // Save to Firestore
 try {
 const userRef = doc(db, 'users', user.uid);
 await setDoc(userRef, {
 notificationPreferences: updated
 }, { merge: true });
 } catch (err) {
 console.warn("Could not save preferences to Firestore:", err);
 }
 };

 // Admin Verification & Payout Console State
 const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
 const [adminPassword, setAdminPassword] = useState('');
 const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
 const [adminError, setAdminError] = useState('');
 const [adminTab, setAdminTab] = useState<'overview' | 'verifications' | 'payouts' | 'reports'>('overview');
 const [totalUsers, setTotalUsers] = useState<number>(0);
 const [monthlyUsers, setMonthlyUsers] = useState<number>(0);

 useEffect(() => {
 if (isAdminAuthenticated) {
 const fetchStats = async () => {
 try {
 const usersCol = collection(db, 'users');
 const totalSnap = await getCountFromServer(usersCol);
 setTotalUsers(totalSnap.data().count);

 const startOfMonth = new Date();
 startOfMonth.setDate(1);
 startOfMonth.setHours(0, 0, 0, 0);

 const monthQuery = query(usersCol, where('createdAt', '>=', startOfMonth.getTime()));
 const monthSnap = await getCountFromServer(monthQuery);
 setMonthlyUsers(monthSnap.data().count);
 } catch (e) {
 console.error('Error fetching user stats', e);
 }
 };
 fetchStats();
 }
 }, [isAdminAuthenticated]);

 const handleAdminLogin = (e: React.FormEvent) => {
 e.preventDefault();
 if (adminPassword === 'Tightenradio&56=sun') {
 setIsAdminAuthenticated(true);
 setShowAdminAuthModal(false);
 setAdminError('');
 } else {
 setAdminError('Invalid authorization credentials');
 }
 };

 return (
 <div className="h-full w-full bg-white lg:p-8 overflow-y-auto transition-colors duration-200">
 <div className="max-w-4xl mx-auto pb-12">
 
 {/* Header */}
 <div className="bg-white p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md">
 <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-4 pl-20 sm:pl-0">
 <h1 className="text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl flex items-center gap-2">
 <Settings className="w-6 h-6 text-red-500"/>
 Settings & Growth
 </h1>
 </div>
 </div>

 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
 className="space-y-8 px-3 lg:px-0"
 >
 {/* App Configuration */}
 <div className="layered-container p-6 space-y-4">
 <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-2">
 SYSTEM SETTINGS
 </h3>
 
 {/* Standard Settings Items */}
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
 <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors">
 <div className="flex items-center gap-3 text-gray-900">
 <User className="w-5 h-5 text-gray-400"/>
 <span className="font-medium">Account & Security</span>
 </div>
 <ChevronRight className="w-4 h-4 text-gray-400"/>
 </button>
 
 <button 
 onClick={() => setShowIdModal(true)}
 className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
 >
 <div className="flex items-center gap-3 text-gray-900">
 <BadgeCheck className="w-5 h-5 text-gray-400"/>
 <span className="font-medium">Request Verification (ID)</span>
 </div>
 <ChevronRight className="w-4 h-4 text-gray-400"/>
 </button>

 
 <button 
 onClick={() => setShowNotificationPrefs(!showNotificationPrefs)}
 className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors text-left cursor-pointer"
 >
 <div className="flex items-center gap-3 text-gray-900">
 <Bell className="w-5 h-5 text-gray-400"/>
 <div>
 <span className="font-medium block">Notification Preferences</span>
 <span className="text-[10px] text-gray-500 font-normal">Manage payout, verification, and weekly release alerts</span>
 </div>
 </div>
 <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showNotificationPrefs ? 'rotate-90' : ''}`} />
 </button>

 {showNotificationPrefs && (
 <div className="bg-gray-50/50 dark:bg-neutral-900/50 p-4 space-y-3 border-t border-gray-100/80 animate-in fade-in slide-in-from-top-2">
 {/* Payout Alerts */}
 <div className="flex items-center justify-between gap-4 py-1.5">
 <div className="flex-1">
 <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">Payout Settlement Alerts</span>
 <span className="text-[10px] text-gray-500 block">Instantly notify me when my payout request is approved and processed</span>
 </div>
 <button 
 onClick={() => handleTogglePref('payoutAlerts')}
 className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${notifPrefs.payoutAlerts ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notifPrefs.payoutAlerts ? 'translate-x-5' : 'translate-x-1'}`} />
 </button>
 </div>

 <div className="h-px bg-gray-200/50 w-full"/>

 {/* ID Verification */}
 <div className="flex items-center justify-between gap-4 py-1.5">
 <div className="flex-1">
 <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">ID Verification Updates</span>
 <span className="text-[10px] text-gray-500 block">Notify me immediately when the admin approves or rejects my ID document</span>
 </div>
 <button 
 onClick={() => handleTogglePref('verificationAlerts')}
 className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${notifPrefs.verificationAlerts ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notifPrefs.verificationAlerts ? 'translate-x-5' : 'translate-x-1'}`} />
 </button>
 </div>

 <div className="h-px bg-gray-200/50 w-full"/>

 {/* New Releases */}
 <div className="flex items-center justify-between gap-4 py-1.5">
 <div className="flex-1">
 <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">New Clip Releases</span>
 <span className="text-[10px] text-gray-500 block">Get notified when creators drop new micro-clips or new content</span>
 </div>
 <button 
 onClick={() => handleTogglePref('newReleaseAlerts')}
 className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${notifPrefs.newReleaseAlerts ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notifPrefs.newReleaseAlerts ? 'translate-x-5' : 'translate-x-1'}`} />
 </button>
 </div>

 <div className="h-px bg-gray-200/50 w-full"/>

 {/* Live broadcasts */}
 <div className="flex items-center justify-between gap-4 py-1.5">
 <div className="flex-1">
 <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">Live Broadcast Alerts</span>
 <span className="text-[10px] text-gray-500 block">Alert me instantly when subscribed creators begin a vertical live show</span>
 </div>
 <button 
 onClick={() => handleTogglePref('liveAlerts')}
 className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${notifPrefs.liveAlerts ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notifPrefs.liveAlerts ? 'translate-x-5' : 'translate-x-1'}`} />
 </button>
 </div>
 </div>
 )}
 
 <div className="flex items-center justify-between p-4">
 <div className="flex items-center gap-3 text-gray-900">
 {theme === 'dark' ? <Moon className="w-5 h-5 text-red-500"/> : <Sun className="w-5 h-5 text-gray-500"/>}
 <span className="font-medium">Dark Mode <span className="text-xs text-gray-500 font-normal ml-2">High-contrast theme</span></span>
 </div>
 <button 
 onClick={toggleTheme}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${theme === 'dark' ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 </div>
 </div>
 </div>

 {/* Security & Defense Protocols */}
 <div className="layered-container p-6 space-y-4">
 <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-2">
 <Shield className="w-5 h-5 text-red-500"/>
 Security & Defense
 </h3>
 
 <div className="flex flex-col p-4 bg-white border border-gray-200 rounded-xl space-y-4">
 {/* 2FA */}
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3 text-gray-900">
 <Shield className="w-5 h-5 text-gray-400 mt-0.5"/>
 <div>
 <div className="font-medium flex items-center gap-2">
 Two-Factor Authentication (2FA)
 <span className="bg-gray-500/10 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Required by Admin</span>
 </div>
 <div className="text-xs text-gray-500 mt-1 max-w-sm">
 Requires an OTP sent to your registered mobile number for all untrusted device logins. Highly recommended for cyber crime prevention.
 </div>
 </div>
 </div>
 <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-red-500 shrink-0 opacity-70 cursor-not-allowed">
 <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6"/>
 </div>
 </div>

 <div className="h-px bg-white w-full my-2"></div>

 {/* Login Alerts */}
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3 text-gray-900">
 <Bell className="w-5 h-5 text-gray-400 mt-0.5"/>
 <div>
 <div className="font-medium flex items-center gap-2">
 Suspicious Login & Incident Alerts
 </div>
 <div className="text-xs text-gray-500 mt-1 max-w-sm">
 Instantly alerts you via SMS and Email if a login attempt occurs from a new geographical location, flagged IP, or TOR node.
 </div>
 </div>
 </div>
 <button 
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 bg-red-500`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6`} />
 </button>
 </div>

 <div className="h-px bg-white w-full my-2"></div>

 {/* Advanced Threat Protection */}
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3 text-gray-900">
 <Shield className="w-5 h-5 text-gray-400 mt-0.5"/>
 <div>
 <div className="font-medium flex items-center gap-2">
 Advanced Bot & Cyber Attack Protection
 </div>
 <div className="text-xs text-gray-500 mt-1 max-w-sm">
 Automatically enables localized IP bans and drops connections from suspected scraping networks, DDoS bots, and replay attacks.
 </div>
 </div>
 </div>
 <button 
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 bg-red-500`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6`} />
 </button>
 </div>
 </div>
 </div>

 {/* Growth Settings */}
 <div className="layered-container p-6 space-y-4">
 <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-2">
 Growth Configuration
 </h3>
 
 <div className="flex flex-col p-4 bg-white border border-gray-200 rounded-xl space-y-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3 text-gray-900">
 <Share2 className="w-5 h-5 text-red-500 mt-0.5"/>
 <div>
 <div className="font-medium flex items-center gap-2">
 Viral Bait (Wave Views)
 <span className="bg-red-500/20 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">New</span>
 </div>
 <div className="text-xs text-gray-500 mt-1 max-w-sm">
 When users hit a locked clip, allow them to unlock it for free by sharing a tracking-encrypted 15s teaser to socials that generates 5 unique clicks.
 </div>
 </div>
 </div>
 <button 
 onClick={() => setIsViralBaitEnabled(!isViralBaitEnabled)}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${isViralBaitEnabled ? 'bg-red-500' : 'bg-gray-300'}`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isViralBaitEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 </div>

 {isViralBaitEnabled && (
 <div className="pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
 <label className="block text-xs font-medium text-gray-900 mb-2">
 Select Eligible Clips for Social Unlock
 </label>
 <select className="w-full bg-white border border-gray-200 text-gray-900 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none">
 <option value="all_locked">All Locked Clips</option>
 <option value="ep2">The Landlord's Secret - Clip 2</option>
 <option value="ep3">The Landlord's Secret - Clip 3</option>
 <option value="ep2_h">Accra Hustle - Clip 2</option>
 </select>
 <p className="text-[11px] text-gray-500 mt-2">
 Selected clips will display the"Unlock for Free"button alongside the standard"Unlock to Continue"(Pay) option when a user encounters the paywall.
 </p>
 </div>
 )}
 </div>
 </div>

 <div className="pt-10 pb-8">
 <div className="flex items-center gap-4 mb-6">
 <div className="h-px bg-gray-300 flex-1"></div>
 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">
 Legal & Protocols
 </h3>
 <div className="h-px bg-gray-300 flex-1"></div>
 </div>
 
 <div className="space-y-3">
 <button onClick={() => setLegalDrawerContent(LEGAL_DOCS.terms)} className="w-full flex items-center justify-between p-3 bg-white/50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
 <span className="text-xs font-medium text-gray-700">Terms of Service</span>
 <ChevronRight className="w-4 h-4 text-gray-400"/>
 </button>
 <button onClick={() => setLegalDrawerContent(LEGAL_DOCS.privacy)} className="w-full flex items-center justify-between p-3 bg-white/50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
 <span className="text-xs font-medium text-gray-700">Privacy Policy & Data Encryption</span>
 <ChevronRight className="w-4 h-4 text-gray-400"/>
 </button>
 <button onClick={() => setLegalDrawerContent(LEGAL_DOCS.merchant)} className="w-full flex items-center justify-between p-3 bg-white/50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
 <span className="text-xs font-medium text-gray-700">Payout & Refund Policy</span>
 <ChevronRight className="w-4 h-4 text-gray-400"/>
 </button>
 </div>

 {isAdminAuthenticated && (
 <motion.div 
 initial={{ opacity: 0, y: 15 }} 
 animate={{ opacity: 1, y: 0 }}
 className="layered-container p-6 space-y-6 border border-red-500/30 mt-8 bg-zinc-950 dark:bg-neutral-900 rounded-2xl"
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 dark:border-white/10 pb-4 gap-4">
 <div>
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-red-500 text-black rounded-lg">
 <Shield className="w-5 h-5 text-zinc-950"/>
 </div>
 <div>
 <h3 className="text-base font-bold text-gray-900 dark:text-white">
 Admin Console
 </h3>
 <p className="text-[10px] text-gray-500 dark:text-gray-400">
 Authorized secure platform gatekeeping protocol
 </p>
 </div>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button 
 onClick={() => setAdminTab('overview')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${adminTab === 'overview' ? 'bg-red-500 text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'}`}
 >
 Overview
 </button>
 <button 
 onClick={() => setAdminTab('verifications')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${adminTab === 'verifications' ? 'bg-red-500 text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'}`}
 >
 ID Verifications
 </button>
 <button 
 onClick={() => setAdminTab('payouts')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${adminTab === 'payouts' ? 'bg-red-500 text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'}`}
 >
 Payout Requests
 </button>
 <button 
 onClick={() => setAdminTab('reports')}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${adminTab === 'reports' ? 'bg-red-500 text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'}`}
 >
 Reports
 </button>
 <button 
 onClick={() => setIsAdminAuthenticated(false)}
 className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all ml-2 cursor-pointer"
 >
 Lock
 </button>
 </div>
 </div>

 <div className="space-y-4">
 {adminTab === 'overview' ? (
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
 <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2">Total Users</div>
 <div className="text-4xl font-bold text-white">{totalUsers}</div>
 </div>
 <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
 <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2">New This Month</div>
 <div className="text-4xl font-bold text-red-400">{monthlyUsers}</div>
 </div>
 </div>
 ) : adminTab === 'verifications' ? (
 <VerificationRequests />
 ) : adminTab === 'payouts' ? (
 <PayoutRequestsManager />
 ) : (
 <ReportsManager />
 )}
 </div>
 </motion.div>
 )}

 <p 
 onClick={() => {
 if (!isAdminAuthenticated) {
 setShowAdminAuthModal(true);
 }
 }}
 className="text-center text-xs text-gray-400 mt-8 cursor-pointer hover:text-red-500 transition-all duration-200 flex flex-col items-center justify-center gap-1.5 select-none"
 >
 <span className="flex items-center justify-center gap-1.5">
 <span>© 2026 Pultanc by Tuita Nouvelle Ltd</span>
 {isAdminAuthenticated && (
 <span className="text-red-500 text-[9px] bg-red-500/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
 Console Active
 </span>
 )}
 </span>
 <span className="text-gray-500 hover:underline mt-1"onClick={(e) => { e.stopPropagation(); if (onContactClick) { onContactClick(); } else { window.location.href = 'mailto:contact@pultanc.com'; } }}>
 Email us: contact@pultanc.com
 </span>
 </p>
 </div>

 </motion.div>
 </div>

 <LegalDrawer 
 isOpen={legalDrawerContent !== null}
 onClose={() => setLegalDrawerContent(null)}
 title={legalDrawerContent?.title || ''}
 content={legalDrawerContent?.content || ''}
 />

 <IDSubmissionModal
 isOpen={showIdModal}
 onClose={() => setShowIdModal(false)}
 onSuccess={() => {
 alert('Verification request submitted successfully. The admin will review it shortly.');
 }}
 userName={auth.currentUser?.displayName || auth.currentUser?.email || 'Creator'}
 />

 {showAdminAuthModal && (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-sm overflow-hidden p-6 relative text-gray-900 dark:text-white"
 >
 <button 
 onClick={() => {
 setShowAdminAuthModal(false);
 setAdminError('');
 }}
 className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
 >
 <ChevronRight className="w-5 h-5 rotate-90"/>
 </button>

 <div className="flex flex-col items-center text-center space-y-3 mt-2">
 <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20">
 <Lock className="w-6 h-6"/>
 </div>
 <div>
 <h3 className="text-base font-bold">Administration Console</h3>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 Input key to gain supervisor privileges.
 </p>
 </div>
 </div>

 <form onSubmit={handleAdminLogin} className="space-y-4 mt-6">
 <div>
 <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
 Supervisor Authorization Key
 </label>
 <input 
 type="password"
 placeholder=""
 value={adminPassword}
 onChange={(e) => setAdminPassword(e.target.value)}
 className="w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-sm focus:outline-none focus:border-red-500 transition-colors"
 autoFocus
 />
 {adminError && (
 <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
 • {adminError}
 </p>
 )}
 </div>

 <button 
 type="submit"
 className="w-full bg-red-500 hover:bg-red-600 text-black font-bold text-xs py-1.5 rounded-xl transition-all cursor-pointer"
 >
 Authorize Console Access
 </button>
 </form>
 </motion.div>
 </div>
 )}
 </div>
 );
}
