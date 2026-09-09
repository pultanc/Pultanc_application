import { doc, updateDoc, increment, collection, addDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import { recordPaymentTransaction } from './transactionRecorder';

export interface PendingPayment {
  reference: string;
  tab: string; // e.g. 'consumer', 'funnels', 'live', 'accountProfile', 'wallet'
  type?: 'episode' | 'subscribe' | 'tip' | 'funnel' | 'ticket' | string;
  seriesId?: string;
  episodeId?: string;
  funnelSlug?: string;
  creatorId?: string;
  recipientName?: string;
  title?: string;
  amount?: number;
  currency?: string;
  timestamp: number;
}

export interface PaymentSuccessPopupDetails {
  amount: number;
  currency?: string;
  recipientName?: string;
  paymentFor?: string;
  reference?: string;
  tab?: string;
  type?: string;
  appName?: string;
  companyName?: string;
  date?: string;
}

export function showPaymentSuccessPopup(details: PaymentSuccessPopupDetails) {
  const fullDetails: PaymentSuccessPopupDetails = {
    appName: 'PULTANC',
    companyName: 'Tuita Nouvelle Ltd',
    currency: 'GHS',
    date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    ...details
  };
  const event = new CustomEvent('pultanc_payment_success', { detail: fullDetails });
  window.dispatchEvent(event);
}

const STORAGE_KEY = 'pultanc_pending_payment';
const TAB_KEY = 'pultanc_pending_tab';

export function savePendingPayment(info: Omit<PendingPayment, 'timestamp'>) {
  const data: PendingPayment = {
    ...info,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(TAB_KEY, info.tab);
  } catch (e) {
    console.warn('Failed to save pending payment to localStorage', e);
  }
}

export function getPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TAB_KEY);
  } catch (e) {
    console.warn('Failed to clear pending payment', e);
  }
}

export async function checkAndVerifyPaymentReturn(
  onReturnToTab?: (tab: string) => void,
  onUnlockSuccess?: (info: PendingPayment) => void
) {
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('reference') || urlParams.get('trxref') || urlParams.get('paystack_ref');
  const urlTab = urlParams.get('tab');

  const pending = getPendingPayment();
  const targetTab = urlTab || pending?.tab || localStorage.getItem(TAB_KEY);

  // If we have a target tab saved from checkout, restore it right away
  if (targetTab && onReturnToTab) {
    onReturnToTab(targetTab);
  }

  const activeRef = reference || pending?.reference;
  if (!activeRef) return;

  try {
    let data: any = null;
    try {
      const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(activeRef)}`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (fetchErr) {
      console.warn('Backend verification fetch error:', fetchErr);
    }

    if (data && data.status && data.data?.status === 'success') {
      // Process Firestore records if creator/unlock metadata exists
      if (pending) {
        const { creatorId, amount, type, recipientName, title } = pending;
        if (creatorId && amount) {
          try {
            await recordPaymentTransaction({
              reference: activeRef,
              recipientId: creatorId,
              recipientName: recipientName || 'Creator',
              amount: Number(amount),
              type: type || 'unlock',
              title: title || 'Content Access'
            });
          } catch (err) {
            console.warn('Error recording payment transaction:', err);
          }
        }

        if (type === 'subscribe' && auth.currentUser && creatorId) {
          try {
            const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', creatorId);
            await setDoc(subRef, {
              creatorId,
              subscribedAt: Date.now(),
              active: true
            }, { merge: true });
          } catch (err) {
            console.warn('Error recording subscription:', err);
          }
        }
      }

      toast.success('🎉 Payment verified! Returned to your page.');
      
      const paidAmount = pending?.amount || (data.data?.amount ? Number(data.data.amount) / 100 : 0);
      const recipient = pending?.recipientName || 'Creator';
      const itemTitle = pending?.title || (pending?.type ? `${pending.type.toUpperCase()} Access` : 'Content Unlock');

      showPaymentSuccessPopup({
        amount: paidAmount,
        currency: 'GHS',
        recipientName: recipient,
        paymentFor: itemTitle,
        reference: activeRef,
        tab: targetTab || 'consumer',
        type: pending?.type
      });

      if (onUnlockSuccess && pending) {
        onUnlockSuccess(pending);
      }

      // Clean up search params from address bar without reloading
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      clearPendingPayment();
    }
  } catch (err) {
    console.error('Error verifying returning payment:', err);
  }
}
