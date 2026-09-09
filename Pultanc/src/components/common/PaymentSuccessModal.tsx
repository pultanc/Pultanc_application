import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles, X, Clock } from 'lucide-react';

export interface PaymentSuccessDetails {
  amount: number;
  currency?: string;
  recipientName?: string;
  paymentFor?: string;
  reference?: string;
  tab?: string;
  type?: 'episode' | 'subscribe' | 'tip' | 'funnel' | 'ticket' | string;
  appName?: string;
  companyName?: string;
  date?: string;
}

interface PaymentSuccessModalProps {
  isOpen: boolean;
  details: PaymentSuccessDetails | null;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  details,
  onClose,
  onNavigateToTab
}) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen || !details) return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleReturnAndOpen();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, details]);

  if (!isOpen || !details) return null;

  const appName = details.appName || 'PULTANC';
  const companyName = details.companyName || 'Tuita Nouvelle Ltd';
  const currency = details.currency || 'GHS';
  const formattedAmount = `${currency} ${(details.amount || 0).toFixed(2)}`;
  const recipient = details.recipientName || 'Creator Account';
  const itemTitle = details.paymentFor || 'Content Unlock & Subscription';
  const reference = details.reference || `PUL-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleReturnAndOpen = () => {
    if (details.tab && onNavigateToTab) {
      onNavigateToTab(details.tab);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative w-full max-w-xs sm:max-w-sm bg-neutral-950 border border-zinc-800 shadow-2xl rounded-2xl overflow-hidden text-white"
          >
            {/* Top Glowing Header Background */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent pointer-events-none" />

            {/* Close Icon */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded-full transition-colors z-10 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5 space-y-3.5 relative z-10">
              {/* Success Badge & Compact Animated Check */}
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Successful
                  </div>
                  <h3 className="text-base font-bold text-white">Payment Successful!</h3>
                </div>
              </div>

              {/* Amount Display */}
              <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 text-center">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Amount Paid
                </span>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight leading-tight">
                  {formattedAmount}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Paid to <span className="font-bold text-white">{recipient}</span>
                </div>
              </div>

              {/* Compact Receipt Details */}
              <div className="bg-neutral-900 border border-zinc-800/80 rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Item:</span>
                  <span className="font-bold text-emerald-400 truncate max-w-[170px]">
                    {itemTitle}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Ref:</span>
                  <span className="text-zinc-300 font-mono text-[10px]">{reference}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Merchant:</span>
                  <span className="text-zinc-300 text-[10px]">{companyName}</span>
                </div>
              </div>

              {/* Automatic Redirect Callback Banner */}
              <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-2.5 flex items-center justify-between text-[10px] font-medium text-emerald-300">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Redirecting to destination in <strong>{countdown}s</strong></span>
                </div>
                <div className="w-12 bg-emerald-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Footer Return & Unlock Button */}
              <div className="space-y-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleReturnAndOpen}
                  className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Proceed Now <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center justify-center gap-1 text-[9px] text-zinc-500 font-mono text-center">
                  <ShieldCheck className="w-3 h-3 text-emerald-500/80" /> Verified Settlement Callback
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
