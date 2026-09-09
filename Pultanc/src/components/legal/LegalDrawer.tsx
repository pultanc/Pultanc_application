import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface LegalDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 title: string;
 content: string;
}

export function LegalDrawer({ isOpen, onClose, title, content }: LegalDrawerProps) {
 return (
 <AnimatePresence>
 {isOpen && (
 <>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={onClose}
 className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
 />
 <motion.div
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
 className="fixed bottom-0 left-0 w-full h-[85vh] bg-[#0A0A0A] z-[101] rounded-t-3xl border-t border-gray-800 flex flex-col items-center"
 >
 <div className="w-full max-w-3xl flex-1 flex flex-col h-full">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-gray-900 shrink-0">
 <h2 className="text-white font-mono text-xs uppercase tracking-widest font-bold">
 {title}
 </h2>
 <button
 onClick={onClose}
 className="p-2 hover:bg-gray-900 rounded-full transition-colors group"
 >
 <X className="w-5 h-5 text-gray-400 group-hover:text-white"/>
 </button>
 </div>

 {/* Scrollable Content */}
 <div className="p-6 md:p-8 overflow-y-auto flex-1 font-sans text-gray-300 text-xs leading-relaxed tracking-wide">
 <div className="max-w-prose mx-auto whitespace-pre-wrap whitespace-normal">
 {content}
 </div>
 </div>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
}
