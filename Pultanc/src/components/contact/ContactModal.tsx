import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mail, Send, CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ContactModalProps {
 onClose: () => void;
}

export function ContactModal({ onClose }: ContactModalProps) {
 const [email, setEmail] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [success, setSuccess] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!email) return;

 setIsSubmitting(true);
 try {
 await addDoc(collection(db, 'contact_emails'), {
 email,
 timestamp: serverTimestamp()
 });
 setSuccess(true);
 setTimeout(() => {
 onClose();
 }, 2000);
 } catch (err) {
 console.error("Error submitting email:", err);
 alert("Failed to submit. Please try again or email us directly.");
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"onClick={onClose}>
 <motion.div 
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden"
 onClick={e => e.stopPropagation()}
 >
 <div className="p-6">
 <button 
 onClick={onClose}
 className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/10 p-1.5 rounded-full transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>
 
 <div className="flex justify-center mb-4">
 <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
 <Mail className="w-6 h-6 text-red-600 dark:text-red-400"/>
 </div>
 </div>
 
 <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Contact & Updates</h2>
 <p className="text-xs text-center text-gray-600 dark:text-gray-400 mb-6">
 Join our newsletter for the latest updates, or reach out to us directly for support, inquiries, and to give us feedback.
 </p>

 {success ? (
 <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
 <CheckCircle2 className="w-8 h-8 text-red-500 mb-2"/>
 <p className="font-bold text-red-700 dark:text-red-400">Thank you!</p>
 <p className="text-xs text-red-600 dark:text-red-500 mt-1">We've received your email.</p>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Your Email</label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="hello@example.com"
 required
 className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-red-500 dark:focus:border-red-500 transition-colors"
 />
 </div>
 <button
 type="submit"
 disabled={isSubmitting || !email}
 className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-black font-bold py-1.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
 >
 {isSubmitting ? (
 <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"/>
 ) : (
 <>
 <Send className="w-4 h-4"/>
 Subscribe to Updates
 </>
 )}
 </button>
 </form>
 )}

 <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 text-center">
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-bold tracking-wider">Email Us Directly</p>
 <a 
 href="mailto:contact@pultanc.com"
 className="inline-flex items-center justify-center gap-2 text-xs font-medium text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors"
 >
 contact@pultanc.com
 </a>
 </div>
 </div>
 </motion.div>
 </div>
 );
}
