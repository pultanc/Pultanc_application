import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Banknote, History, ExternalLink, Activity, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, Calendar, Clock, Sparkles, AlertTriangle, Info, Check } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';

function AnimatedCounter({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    latest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.5, ease: 'easeOut' });
    return controls.stop;
  }, [count, value]);

  return <motion.span>{rounded}</motion.span>;
}

export default function WalletView() {
  const [activeTab, setActiveTab] = useState<'balance' | 'activity' | 'payouts' | 'settings'>('balance');
  const [paymentType, setPaymentType] = useState('Mobile Money');
  const [providerNetwork, setProviderNetwork] = useState('MTN');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [hasBonusHook, setHasBonusHook] = useState(false);
  const [bonusDeducted, setBonusDeducted] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [dbPayouts, setDbPayouts] = useState<any[]>([]); // Raw payout records from DB
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic calculations strictly from verified completed transactions:
  const creditTransactions = useMemo(() => {
    return userTransactions.filter(tx => 
      (tx.type === 'credit' || !tx.type || tx.type === 'tip' || tx.type === 'subscribe' || tx.type === 'episode' || tx.type === 'funnel' || tx.type === 'ticket') && 
      (tx.status === 'completed' || tx.status === 'cleared')
    );
  }, [userTransactions]);

  const verifiedGrossRevenue = useMemo(() => {
    return creditTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [creditTransactions]);

  const verifiedNetEarnings = useMemo(() => {
    return creditTransactions.reduce((sum, tx) => {
      const net = tx.netAmount !== undefined ? Number(tx.netAmount) : (tx.creatorSplit !== undefined ? Number(tx.creatorSplit) : (Number(tx.amount || 0) * 0.70));
      return sum + net;
    }, 0);
  }, [creditTransactions]);

  // Total paid out so far:
  const totalPaidOut = useMemo(() => {
    return dbPayouts
      .filter(p => p.status === 'processed' || p.status === 'completed')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [dbPayouts]);

  // Total pending payouts:
  const totalPendingPayouts = useMemo(() => {
    return dbPayouts
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [dbPayouts]);

  const verifiedAvailableBalance = Math.max(0, verifiedNetEarnings - totalPaidOut - totalPendingPayouts);

  const grossRevenue = creditTransactions.length > 0 ? verifiedGrossRevenue : 0;
  const share70 = creditTransactions.length > 0 ? verifiedNetEarnings : 0;
  const targetThreshold2x = 200.00;
  const isEligible2x = !hasBonusHook || bonusDeducted || grossRevenue >= targetThreshold2x;

  const oneTimeBonusDeduction = 0.00;
  const netCalculatedPayout = creditTransactions.length > 0 ? verifiedAvailableBalance : balance;

  const getMonthStatus = (monthName: string, defaultAmount: number) => {
    if (creditTransactions.length === 0) {
      return { status: 'accruing', amount: 0 };
    }

    const monthPayouts = dbPayouts.filter(p => p.month === monthName);
    if (monthPayouts.length > 0) {
      const hasPending = monthPayouts.some(p => p.status === 'pending');
      if (hasPending) return { status: 'pending', amount: monthPayouts[0].amount };
      const hasProcessed = monthPayouts.some(p => p.status === 'processed');
      if (hasProcessed) return { status: 'completed', amount: monthPayouts[0].amount };
    }
    
    const isJuneRequested = dbPayouts.some(p => p.month === 'June 2026');
    const currentDay = new Date().getDate();
    const isPayoutDayReached = currentDay >= 25;

    if (monthName === 'July 2026') {
      if (isJuneRequested) {
        return { status: 'accruing', amount: netCalculatedPayout };
      } else {
        return { status: 'accruing', amount: 0 };
      }
    }
    
    if (monthName === 'June 2026') {
      return { 
        status: isPayoutDayReached ? 'available' : 'accruing', 
        amount: netCalculatedPayout 
      };
    }
    
    if (monthName === 'May 2026') {
      if (netCalculatedPayout > 0) {
        return { status: 'available', amount: netCalculatedPayout };
      }
      return { status: 'accruing', amount: 0 };
    }
    
    return { status: 'accruing', amount: 0 };
  };

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubPayouts: (() => void) | null = null;
    let unsubTx: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubPayouts) { unsubPayouts(); unsubPayouts = null; }
      if (unsubTx) { unsubTx(); unsubTx = null; }

      if (!user) return;
      
      const userRef = doc(db, 'users', user.uid);
      unsubUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data();
          if (uData.balance !== undefined) setBalance(uData.balance);
          if (uData.totalEarnings !== undefined) setTotalEarnings(uData.totalEarnings);
          if (uData.hasBonusHook !== undefined) setHasBonusHook(uData.hasBonusHook);
          if (uData.bonusDeducted !== undefined) setBonusDeducted(uData.bonusDeducted);
          if (uData.paymentType) setPaymentType(uData.paymentType);
          if (uData.paymentNumber) setPaymentNumber(uData.paymentNumber);
          if (uData.accountName) setAccountName(uData.accountName);
          if (uData.providerNetwork) setProviderNetwork(uData.providerNetwork);
          if (uData.bankName) setBankName(uData.bankName);
          if (uData.branchName) setBranchName(uData.branchName);
        } else {
          setDoc(userRef, { balance: 0, totalEarnings: 0, hasBonusHook: false, bonusDeducted: false }, { merge: true }).catch(err => console.warn(err));
        }
      });
      
      const q = query(
        collection(db, 'payouts'),
        where('creatorId', '==', user.uid)
      );

      unsubPayouts = onSnapshot(q, (snapshot) => {
        const payouts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        payouts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setDbPayouts(payouts);

        const formattedHistory = payouts.map((p: any) => {
          const d = new Date(p.timestamp);
          
          let statusLabel = 'Pending';
          if (p.status === 'processed' || p.status === 'completed') {
            statusLabel = 'Completed';
          } else if (p.status === 'processing') {
            statusLabel = 'Processing';
          } else if (p.status === 'rejected' || p.status === 'failed') {
            statusLabel = 'Failed';
          }

          return {
            id: p.id,
            month: p.month || 'June 2026',
            date: d.toLocaleDateString(),
            time: d.toLocaleTimeString(),
            amount: `GHS ${p.amount.toFixed(2)}`,
            status: statusLabel,
            route: p.paymentType || 'Mobile Money', 
          };
        });
        setHistory(formattedHistory);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payouts');
      });

      // Listen to user payment transactions (both received credits and sent debits)
      const txRef = collection(db, 'users', user.uid, 'transactions');
      const txQuery = query(txRef, orderBy('timestamp', 'desc'));
      unsubTx = onSnapshot(txQuery, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUserTransactions(txs);
      }, (err) => {
        console.warn('Error fetching user transactions:', err);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubPayouts) unsubPayouts();
      if (unsubTx) unsubTx();
    };
  }, []);

  const handleSavePaymentRoute = async () => {
    if (!auth.currentUser) return;
    setIsSavingRoute(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        paymentType,
        paymentNumber,
        accountName,
        providerNetwork,
        bankName,
        branchName
      }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving payment route:", err);
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleRequestMonthPayout = async (monthName: string, amountToWithdraw: number) => {
    if (!auth.currentUser) {
      alert("Please login first to request payout.");
      return;
    }
    setErrorMessage('');

    if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
      setErrorMessage('Please enter a valid payout amount.');
      return;
    }

    setIsRequesting(true);
    try {
      let cName = auth.currentUser.displayName || "Unknown Creator";
      let cEmail = auth.currentUser.email || "no-email@example.com";
      let pType = paymentType || "Mobile Money";
      let pNumber = paymentNumber || "+233 54 123 4592";

      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          if (uData.name) cName = uData.name;
          if (uData.paymentType) pType = uData.paymentType;
          if (uData.paymentNumber) pNumber = uData.paymentNumber;
          if (uData.accountName) cName = uData.accountName;
        }
      } catch (e) {
        console.warn("Could not fetch user profile details:", e);
      }

      await addDoc(collection(db, 'payouts'), {
        creatorId: auth.currentUser.uid,
        creatorName: accountName || cName,
        creatorEmail: cEmail,
        amount: amountToWithdraw,
        grossRevenue: grossRevenue,
        hasBonusHook: hasBonusHook,
        bonusDeductedAmount: oneTimeBonusDeduction,
        status: 'pending',
        timestamp: new Date().toISOString(),
        paymentType: pType,
        paymentNumber: pNumber,
        accountName: accountName || cName,
        month: monthName
      });

      if (hasBonusHook && !bonusDeducted) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, { bonusDeducted: true });
        setBonusDeducted(true);
      }

      setRequestSuccess(true);
      setTimeout(() => setRequestSuccess(false), 3000);
      setActiveTab('payouts');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payouts');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8 pb-32">
        {/* Header */}
        <div className="bg-white p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md flex flex-col items-center justify-center gap-4 pl-12 md:pl-0 text-center">
          <div className="w-full flex flex-col items-center">
            <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl flex items-center gap-2">
              <Wallet className="w-8 h-8 text-red-500"/>
              Creator Wallet
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 font-sans overflow-x-auto">
          <button 
            onClick={() => setActiveTab('balance')}
            className={`px-4 py-2 font-bold text-xs tracking-wide transition-colors relative shrink-0 ${activeTab === 'balance' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Balance & Payout
            {activeTab === 'balance' && <motion.div layoutId="walletTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"/>}
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 font-bold text-xs tracking-wide transition-colors relative shrink-0 flex items-center gap-1.5 ${activeTab === 'activity' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Payment Activity
            {userTransactions.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 font-bold rounded-full">
                {userTransactions.length}
              </span>
            )}
            {activeTab === 'activity' && <motion.div layoutId="walletTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"/>}
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-bold text-xs tracking-wide transition-colors relative shrink-0 ${activeTab === 'settings' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Payment Methods
            {activeTab === 'settings' && <motion.div layoutId="walletTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"/>}
          </button>
          <button 
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 font-bold text-xs tracking-wide transition-colors relative shrink-0 ${activeTab === 'payouts' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}
          >
            History
            {activeTab === 'payouts' && <motion.div layoutId="walletTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"/>}
          </button>
        </div>

        {activeTab === 'balance' && (
          <div className="space-y-6">
            {(() => {
              const julyStatus = getMonthStatus('July 2026', 0.00);
              const juneStatus = getMonthStatus('June 2026', netCalculatedPayout);
              const mayStatus = getMonthStatus('May 2026', netCalculatedPayout);

              const activeMonths = [
                { 
                  id: 'july_2026', 
                  name: 'July 2026', 
                  data: julyStatus, 
                  badge: 'Accruing',
                  helpText: 'Settles on Aug 1st'
                },
                { 
                  id: 'june_2026', 
                  name: 'June 2026', 
                  data: juneStatus, 
                  badge: juneStatus.status === 'available' 
                    ? 'Ready to Withdraw' 
                    : juneStatus.status === 'pending' 
                    ? 'Requested' 
                    : juneStatus.status === 'completed' 
                    ? 'Disbursed' 
                    : 'Accruing (Opens 25th)',
                  helpText: 'Opens on June 25th'
                },
                { 
                  id: 'may_2026', 
                  name: 'May 2026', 
                  data: mayStatus, 
                  badge: mayStatus.status === 'available' 
                    ? 'Ready to Withdraw' 
                    : mayStatus.status === 'pending' 
                    ? 'Requested' 
                    : 'Disbursed',
                  helpText: 'Settled on June 1st'
                }
              ];

              return (
                <div className="space-y-6">
                  
                  {/* Total Balance Card */}
                  <div className="bg-black text-white p-8 rounded-3xl relative overflow-hidden border border-white/10 shadow-xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Banknote className="w-48 h-48"/>
                    </div>
                    
                    <div className="relative z-10">
                      <p className="text-gray-400 font-mono tracking-wider text-xs mb-2 uppercase">TOTAL EARNINGS</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl text-red-500 font-bold">GHS</span>
                        <span className="text-4xl sm:text-6xl font-bold font-mono">
                          <AnimatedCounter value={netCalculatedPayout} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Month-by-month card list */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider font-mono">Monthly Settlements</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {activeMonths.map((m) => {
                        const isAccruing = m.data.status === 'accruing';
                        const isAvailable = m.data.status === 'available';
                        const isPending = m.data.status === 'pending';
                        const isCompleted = m.data.status === 'completed';

                        return (
                          <div 
                            key={m.id}
                            className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all bg-white ${
                              isAvailable 
                                ? 'bg-red-50/20 border-red-500/30 hover:border-red-500 ' 
                                : isPending 
                                ? 'bg-gray-50/10 border-gray-500/20' 
                                : isCompleted 
                                ? 'bg-gray-50/40 border-gray-200 opacity-85' 
                                : 'bg-gray-50/20 border-gray-100'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-2xl shrink-0 ${
                                isAvailable 
                                  ? 'bg-red-500/10 text-red-600' 
                                  : isPending 
                                  ? 'bg-gray-500/10 text-gray-600' 
                                  : isCompleted 
                                  ? 'bg-gray-500/10 text-gray-600' 
                                  : 'bg-gray-100 text-gray-400'
                              }`}>
                                <Calendar className="w-6 h-6"/>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-900 text-base">{m.name}</h4>
                                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                    isAvailable 
                                      ? 'bg-red-100 text-red-800' 
                                      : isPending 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : isCompleted 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-gray-100 text-gray-650'
                                  }`}>
                                    {m.badge}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between md:justify-end">
                              <div className="text-left md:text-right">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Earnings</span>
                                <span className="text-xl font-bold text-gray-950 font-mono">
                                  GHS {m.data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>

                              <div>
                                {isAvailable ? (
                                  <button
                                    onClick={() => handleRequestMonthPayout(m.name, m.data.amount)}
                                    disabled={isRequesting}
                                    className="font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-2 justify-center cursor-pointer shadow-sm bg-red-500 hover:bg-red-400 text-white active:scale-95"
                                  >
                                    {isRequesting ? (
                                      <span className="animate-pulse">Requesting...</span>
                                    ) : (
                                      <>
                                        <Activity className="w-4 h-4"/>
                                        Request Payout
                                      </>
                                    )}
                                  </button>
                                ) : isPending ? (
                                  <div className="bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-2 justify-center">
                                    <Clock className="w-4 h-4 text-amber-600 animate-spin"/>
                                    Awaiting Processing
                                  </div>
                                ) : isCompleted ? (
                                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-2 justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                                    Transferred
                                  </div>
                                ) : (
                                  <div className="bg-gray-100 border border-gray-200 text-gray-500 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-2 justify-center">
                                    <Clock className="w-4 h-4"/>
                                    {m.helpText}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        )}

        {/* Payment Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Account Payment Ledger
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Complete real-time record of all incoming earnings and outgoing payments linked to your account.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {userTransactions.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs font-medium space-y-2">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <Activity className="w-6 h-6" />
                  </div>
                  <p>No account payments recorded yet.</p>
                  <p className="text-[11px] text-gray-400">All tips, unlocks, subscriptions, and ticket payments will automatically log here.</p>
                </div>
              ) : (
                userTransactions.map((tx) => {
                  const d = tx.timestamp ? new Date(tx.timestamp) : new Date();
                  const isCredit = tx.type === 'credit';
                  const cleanTitle = (tx.title || 'Payment')
                    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}]/gu, '')
                    .trim();
                  return (
                    <div key={tx.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-gray-50/50 p-3 rounded-2xl transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                          isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isCredit ? '+' : '-'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{cleanTitle || 'Payment'}</p>
                          <p className="text-gray-500 text-[11px] mt-0.5">
                            {isCredit ? `From: ${tx.payerName || 'Supporter'}` : `To: ${tx.recipientName || 'Creator'}`} • Ref: <span className="font-mono text-gray-700">{tx.reference || 'N/A'}</span>
                          </p>
                          <p className="text-gray-400 text-[10px] mt-0.5">
                            {d.toLocaleDateString()} at {d.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {isCredit ? `+ GHS ${Number(tx.amount).toFixed(2)}` : `- GHS ${Number(tx.amount).toFixed(2)}`}
                        </p>
                        {isCredit && tx.netAmount && (
                          <p className="text-[10px] text-gray-500 font-mono">
                            Net (70%): GHS {Number(tx.netAmount).toFixed(2)}
                          </p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-semibold uppercase">
                          {tx.category || tx.status || 'Success'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Payment Methods Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Payment Destination Route
              </h2>
            </div>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-mono">
                  Payment Route Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType('Mobile Money')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentType === 'Mobile Money' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('Bank Transfer')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentType === 'Bank Transfer' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    Bank Account
                  </button>
                </div>
              </div>

              {paymentType === 'Mobile Money' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      Network Provider
                    </label>
                    <select
                      value={providerNetwork}
                      onChange={(e) => setProviderNetwork(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-red-500"
                    >
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="VOD">Telecel / Vodafone Cash</option>
                      <option value="ATL">AT Money (AirtelTigo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      MoMo Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0241234567"
                      value={paymentNumber}
                      onChange={(e) => setPaymentNumber(e.target.value)}
                      className="w-full max-w-xs p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono font-medium focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      Account Registered Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kwesi Mensah"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-red-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      Bank Name
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-red-500"
                    >
                      <option value="GCB Bank">GCB Bank</option>
                      <option value="Ecobank Ghana">Ecobank Ghana</option>
                      <option value="Absa Bank Ghana">Absa Bank Ghana</option>
                      <option value="Stanbic Bank">Stanbic Bank</option>
                      <option value="Fidelity Bank Ghana">Fidelity Bank Ghana</option>
                      <option value="CalBank">CalBank</option>
                      <option value="Standard Chartered Bank">Standard Chartered Bank</option>
                      <option value="Zenith Bank Ghana">Zenith Bank Ghana</option>
                      <option value="Access Bank Ghana">Access Bank Ghana</option>
                      <option value="Guaranty Trust Bank (GTBank)">Guaranty Trust Bank (GTBank)</option>
                      <option value="Consolidated Bank Ghana (CBG)">Consolidated Bank Ghana (CBG)</option>
                      <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0401001234567890123"
                      value={paymentNumber}
                      onChange={(e) => setPaymentNumber(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono font-medium focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 font-mono">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kofi Appiah"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-red-500"
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleSavePaymentRoute}
                disabled={isSavingRoute}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingRoute ? 'Saving Route...' : saveSuccess ? 'Route Saved Successfully!' : 'Save Payment Destination'}
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'payouts' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Payout Transaction Log</h2>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {history.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs font-medium">
                  No payout history recorded yet.
                </div>
              ) : (
                history.map((tx) => (
                  <div key={tx.id} className="py-4 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900 font-mono">{tx.amount}</p>
                      <p className="text-gray-400 text-[10px]">{tx.date} at {tx.time} • {tx.route}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
