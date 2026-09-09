import { doc, updateDoc, increment, collection, addDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface PaymentRecordOptions {
  reference: string;
  payerId?: string;
  payerName?: string;
  recipientId: string;
  recipientName?: string;
  amount: number; // Amount in GHS
  type: 'tip' | 'support' | 'subscribe' | 'episode' | 'funnel' | 'ticket' | string;
  title: string;
  seriesId?: string;
  episodeId?: string;
  funnelId?: string;
  contentId?: string;
}

export async function recordPaymentTransaction(options: PaymentRecordOptions) {
  const {
    reference,
    recipientId,
    recipientName = 'Creator',
    amount,
    type,
    title,
    seriesId,
    episodeId,
    funnelId,
    contentId
  } = options;

  const currentUserId = auth.currentUser?.uid || options.payerId || 'guest';
  const currentUserName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || options.payerName || 'Supporter';

  const numericAmount = Number(amount) || 0;
  const earnings = numericAmount * 0.70;
  const timestamp = Date.now();

  try {
    // 1. Credit creator's balance, totalEarnings & counts in Firestore
    if (recipientId) {
      const creatorRef = doc(db, 'users', recipientId);
      const isTip = type === 'tip' || type === 'support';
      const isSub = type === 'subscribe' || type === 'subscription';
      const isUnlock = type === 'episode' || type === 'funnel' || type === 'ticket' || type === 'paywall' || type === 'clip';

      const updatePayload: any = {
        balance: increment(earnings),
        totalEarnings: increment(earnings)
      };

      if (isTip) {
        updatePayload.supportsCount = increment(1);
        updatePayload.support_count = increment(1);
      }
      if (isSub) {
        updatePayload.subscribersCount = increment(1);
        updatePayload.subscribe_count = increment(1);
      }
      if (isUnlock) {
        updatePayload.unlocksCount = increment(1);
        updatePayload.unlock_count = increment(1);
      }

      await updateDoc(creatorRef, updatePayload).catch(() => {
        // Fallback setDoc if user doc is not yet created
        setDoc(creatorRef, {
          balance: earnings,
          totalEarnings: earnings,
          supportsCount: isTip ? 1 : 0,
          support_count: isTip ? 1 : 0,
          subscribersCount: isSub ? 1 : 0,
          subscribe_count: isSub ? 1 : 0,
          unlocksCount: isUnlock ? 1 : 0,
          unlock_count: isUnlock ? 1 : 0
        }, { merge: true }).catch(() => {});
      });

      // Also update specific content stats in Firestore for Content Analytics Studio
      if (seriesId) {
        updateDoc(doc(db, 'series', seriesId), {
          unlocks: increment(1),
          revenue: increment(numericAmount)
        }).catch(() => {});
      }
      if (funnelId) {
        updateDoc(doc(db, 'funnels', funnelId), {
          unlocks: increment(1),
          revenue: increment(numericAmount)
        }).catch(() => {});
      }
      if (contentId) {
        updateDoc(doc(db, 'clips', contentId), {
          unlocks: increment(1),
          revenue: increment(numericAmount)
        }).catch(() => {});
      }

      // 2. Record top supporter entry in creator's supporters subcollection
      if (currentUserId && currentUserId !== 'guest') {
        const supporterDocRef = doc(db, 'users', recipientId, 'supporters', currentUserId);
        await setDoc(supporterDocRef, {
          id: currentUserId,
          username: currentUserName,
          supportValue: increment(numericAmount),
          totalSpent: increment(numericAmount),
          vipStatus: numericAmount >= 100 ? 'Diamond' : numericAmount >= 50 ? 'Gold' : 'Silver',
          vipCode: `VIP-${currentUserId.slice(0, 4).toUpperCase()}`,
          lastActive: timestamp
        }, { merge: true }).catch((e) => console.warn('Failed to record supporter subcollection:', e));
      }

      // 3. Record subscriber entry if subscription
      if (isSub && currentUserId && currentUserId !== 'guest') {
        const subscriberDocRef = doc(db, 'users', recipientId, 'subscribers', currentUserId);
        await setDoc(subscriberDocRef, {
          id: currentUserId,
          username: currentUserName,
          amount: numericAmount,
          status: 'active',
          subscribedAt: timestamp
        }, { merge: true }).catch((e) => console.warn('Failed to record subscriber subcollection:', e));

        const payerSubDocRef = doc(db, 'users', currentUserId, 'subscriptions', recipientId);
        await setDoc(payerSubDocRef, {
          creatorId: recipientId,
          creatorName: recipientName,
          amount: numericAmount,
          status: 'active',
          subscribedAt: timestamp
        }, { merge: true }).catch((e) => console.warn('Failed to record payer subscription:', e));
      }

      // 4. Add notification for creator
      const notifRef = collection(db, 'users', recipientId, 'notifications');
      await addDoc(notifRef, {
        title: isTip ? 'New Support Tip!' : isSub ? 'New Subscriber!' : 'New Content Unlock!',
        text: `Payment of GHS ${numericAmount.toFixed(2)} received from ${currentUserName} for "${title}". Net earnings of GHS ${earnings.toFixed(2)} credited to your account.`,
        timestamp,
        read: false,
        type: 'general'
      }).catch((e) => console.warn('Failed to add creator notification:', e));

      // 5. Add to recipient's subcollection transactions
      const recipientTxRef = collection(db, 'users', recipientId, 'transactions');
      await addDoc(recipientTxRef, {
        reference,
        type: 'credit',
        category: type,
        title,
        amount: numericAmount,
        netAmount: earnings,
        creatorSplit: earnings,
        platformSplit: numericAmount - earnings,
        payerId: currentUserId,
        payerName: currentUserName,
        recipientId,
        recipientName,
        seriesId: seriesId || '',
        episodeId: episodeId || '',
        status: 'completed',
        timestamp
      }).catch((e) => console.warn('Recipient tx record error:', e));
    }

    // 6. Add to payer's subcollection transactions if logged in
    if (currentUserId && currentUserId !== 'guest') {
      const payerTxRef = collection(db, 'users', currentUserId, 'transactions');
      await addDoc(payerTxRef, {
        reference,
        type: 'debit',
        category: type,
        title,
        amount: numericAmount,
        payerId: currentUserId,
        payerName: currentUserName,
        recipientId,
        recipientName,
        seriesId: seriesId || '',
        episodeId: episodeId || '',
        status: 'completed',
        timestamp
      }).catch((e) => console.warn('Payer tx record error:', e));
    }

    // 7. Add to top-level transactions collection
    const globalTxRef = collection(db, 'transactions');
    await addDoc(globalTxRef, {
      reference,
      userId: currentUserId,
      payerId: currentUserId,
      payerName: currentUserName,
      creatorId: recipientId,
      recipientId,
      recipientName,
      seriesId: seriesId || '',
      episodeId: episodeId || '',
      amount: numericAmount,
      netAmount: earnings,
      creatorSplit: earnings,
      platformSplit: numericAmount - earnings,
      type,
      title,
      status: 'completed',
      timestamp
    }).catch((e) => console.warn('Global tx record error:', e));

    console.log(`[TransactionRecorder] Successfully recorded payment ${reference} from ${currentUserName} to ${recipientName} for GHS ${amount}.`);
  } catch (err) {
    console.error('[TransactionRecorder] Failed to record payment transaction:', err);
  }
}
