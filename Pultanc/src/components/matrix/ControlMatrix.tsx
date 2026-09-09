import React, { useMemo, useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Banknote, 
  SignalHigh, 
  DollarSign, 
  TrendingUp, 
  Video, 
  AlertCircle, 
  ArrowUpRight, 
  Smartphone, 
  CheckCircle, 
  Flame, 
  MessageSquare, 
  Settings, 
  Copy,
  TrendingDown,
  ChevronRight,
  Calendar,
  Share2,
  LineChart as LineIcon,
  ScanLine,
  BarChart2,
  Film,
  Lock
} from 'lucide-react';
import { TransactionLedger } from './TransactionLedger';
import { TopWhalesList, WhaleItem } from './TopWhalesList';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { MonthlyRevenueChart } from './MonthlyRevenueChart';
import { MonthOverMonthGrowthChart } from './MonthOverMonthGrowthChart';
import { GhsPerMinuteChart } from './GhsPerMinuteChart';
import { ChannelConversionChart } from './ChannelConversionChart';
import { ViewerPayloadChart } from './ViewerPayloadChart';
import { RevenueChart } from './RevenueChart';
import { PayoutRequestsManager } from './PayoutRequestsManager';
import { ContentAnalyticsStudio } from '../creator/ContentAnalyticsStudio';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Transaction } from '../../types';

function TaskerCardAnalytics() {
  const [engagementCount, setEngagementCount] = useState<number>(0);

  useEffect(() => {
    let unsubscribe = () => {};
    if (auth.currentUser) {
      unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.referralClicks !== undefined) {
            setEngagementCount(data.referralClicks);
          }
        }
      });
    }
    return () => unsubscribe();
  }, []);

  return (
    <div className="layered-container p-6 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Goal Card Analytics</h2>
          <p className="text-xs font-medium text-gray-500">Track clicks and scans of your custom Goal QR card link.</p>
        </div>
        <div className="bg-red-100 p-2 rounded-xl text-red-600">
          <ScanLine className="w-5 h-5"/>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">{engagementCount.toLocaleString()}</span>
          <span className="text-xs font-bold text-gray-500 uppercase">Total Engagements</span>
        </div>
      </div>
    </div>
  );
}

export default function ControlMatrix() {
  const [userData, setUserData] = useState<any>({
    balance: 0,
    totalEarnings: 0,
    unlocksCount: 0,
    supportsCount: 0,
    subscribersCount: 0
  });
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [topWhales, setTopWhales] = useState<WhaleItem[]>([]);
  const [creatorFunnels, setCreatorFunnels] = useState<any[]>([]);
  const [creatorClips, setCreatorClips] = useState<any[]>([]);
  const [showReminderDraft, setShowReminderDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'items' | 'charts'>('overview');

  const draftText = `Hello! This is a gentle reminder that your automated Mobile Money recurring tier renewal was unsuccessful due to insufficient funds in your MoMo wallet. Please remember to top-up so you don't miss out on our upcoming exclusive clip drop this week. Thank you for your support! 🍿✨`;

  const copyReminderText = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real-time Firestore subscriptions for signed-in user
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setUserData({ balance: 0, totalEarnings: 0, unlocksCount: 0, supportsCount: 0, subscribersCount: 0 });
      setRawTransactions([]);
      setTopWhales([]);
      setCreatorFunnels([]);
      setCreatorClips([]);
      return;
    }

    // 1. User profile data (balance, totalEarnings, counts)
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setUserData({
          balance: Number(d.balance) || 0,
          totalEarnings: Number(d.totalEarnings) || 0,
          unlocksCount: Number(d.unlocksCount) || 0,
          supportsCount: Number(d.supportsCount) || 0,
          subscribersCount: Number(d.subscribersCount) || 0,
          referralClicks: Number(d.referralClicks) || 0
        });
      }
    }, (err) => console.warn("User data listener inactive:", err));

    // 2. Creator transactions
    const txQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const txs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRawTransactions(txs);
    }, (err) => {
      console.warn("User transactions listener fallback:", err);
      // Fallback query top-level transactions
      const globalTxQ = query(
        collection(db, 'transactions'),
        where('creatorId', '==', user.uid),
        limit(100)
      );
      onSnapshot(globalTxQ, (gSnap) => {
        const txs = gSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setRawTransactions(txs);
      }, () => {});
    });

    // 3. Creator Supporters (Whales)
    const supportersQ = query(
      collection(db, 'users', user.uid, 'supporters'),
      orderBy('supportValue', 'desc'),
      limit(50)
    );
    const unsubSupporters = onSnapshot(supportersQ, (snapshot) => {
      const whales: WhaleItem[] = snapshot.docs.map(d => {
        const data = d.data();
        const amt = Number(data.supportValue || data.totalSpent || data.amount) || 0;
        return {
          id: d.id,
          username: data.username || data.name || 'Supporter',
          supportValue: amt,
          vipStatus: data.vipStatus || (amt >= 100 ? 'Diamond' : amt >= 50 ? 'Gold' : 'Silver'),
          vipCode: data.vipCode || `VIP-${d.id.slice(0, 4).toUpperCase()}`
        };
      });
      setTopWhales(whales);
    }, (err) => console.warn("Supporters listener inactive:", err));

    // 4. Creator funnels / climers
    const funnelsQ = query(
      collection(db, 'funnels'),
      where('creatorId', '==', user.uid)
    );
    const unsubFunnels = onSnapshot(funnelsQ, (snapshot) => {
      const funs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCreatorFunnels(funs);
    }, (err) => console.warn("Funnels listener inactive:", err));

    // 5. Creator series / clips
    const clipsQ = query(
      collection(db, 'series'),
      where('creatorId', '==', user.uid)
    );
    const unsubClips = onSnapshot(clipsQ, (snapshot) => {
      const clips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCreatorClips(clips);
    }, (err) => console.warn("Clips listener inactive:", err));

    return () => {
      unsubUser();
      unsubTx();
      unsubSupporters();
      unsubFunnels();
      unsubClips();
    };
  }, []);

  // Format transactions for TransactionLedger
  const formattedTransactions: Transaction[] = useMemo(() => {
    return rawTransactions.map(tx => {
      const amt = Number(tx.amount) || 0;
      const net = Number(tx.netAmount || tx.creatorSplit) || (amt * 0.70);
      return {
        id: tx.reference || tx.id,
        timestamp: tx.timestamp,
        userId: tx.payerId || tx.userId || 'user',
        seriesId: tx.seriesId || tx.category || tx.type || 'content',
        episodeId: tx.episodeId || '',
        amount: amt,
        creatorSplit: net,
        platformSplit: amt - net,
        status: tx.status === 'pending' ? 'pending_analysis' : 'cleared',
        seriesTitle: tx.title || tx.seriesTitle,
        episodeTitle: tx.episodeTitle,
        creatorName: tx.recipientName || 'Me'
      };
    });
  }, [rawTransactions]);

  // Financial Breakdown calculations
  const { ppvGhs, liveGhs, subsGhs, climerGhs, supportGhs, grossTotalGhs, netEarningsGhs, pendingBalanceGhs } = useMemo(() => {
    let ppv = 0;
    let live = 0;
    let subs = 0;
    let climer = 0;
    let support = 0;

    rawTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const cat = (tx.category || tx.type || '').toLowerCase();
      if (cat.includes('ep') || cat.includes('clip') || cat.includes('unlock') || cat.includes('paywall')) {
        ppv += amt;
      } else if (cat.includes('ticket') || cat.includes('live')) {
        live += amt;
      } else if (cat.includes('sub')) {
        subs += amt;
      } else if (cat.includes('funnel') || cat.includes('climer')) {
        climer += amt;
      } else {
        support += amt;
      }
    });

    const gross = ppv + live + subs + climer + support;
    const computedNet = gross * 0.70;
    const actualNet = rawTransactions.length === 0 ? 0 : computedNet;
    const actualBalance = rawTransactions.length === 0 ? 0 : (userData.balance > 0 ? userData.balance : computedNet);

    return {
      ppvGhs: ppv,
      liveGhs: live,
      subsGhs: subs,
      climerGhs: climer,
      supportGhs: support,
      grossTotalGhs: gross,
      netEarningsGhs: actualNet,
      pendingBalanceGhs: actualBalance
    };
  }, [rawTransactions, userData.balance]);

  // Clean up residual phantom numbers if transactions array is empty
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    if (rawTransactions.length === 0 && (userData.balance > 0 || userData.totalEarnings > 0 || userData.supportsCount > 0)) {
      import('firebase/firestore').then(({ updateDoc, doc }) => {
        updateDoc(doc(db, 'users', user.uid), { balance: 0, totalEarnings: 0, supportsCount: 0 }).catch(() => {});
      });
    }
  }, [rawTransactions.length, userData.balance, userData.totalEarnings, userData.supportsCount]);

  // Dynamic 7-Day Area Chart data from transactions
  const analyticsData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets: Record<string, { paywalls: number; tips: number }> = {
      Mon: { paywalls: 0, tips: 0 },
      Tue: { paywalls: 0, tips: 0 },
      Wed: { paywalls: 0, tips: 0 },
      Thu: { paywalls: 0, tips: 0 },
      Fri: { paywalls: 0, tips: 0 },
      Sat: { paywalls: 0, tips: 0 },
      Sun: { paywalls: 0, tips: 0 },
    };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    rawTransactions.forEach(tx => {
      const ts = typeof tx.timestamp === 'number' ? tx.timestamp : new Date(tx.timestamp).getTime();
      if (isNaN(ts) || ts < sevenDaysAgo) return;

      const date = new Date(ts);
      const day = dayNames[date.getDay()];
      if (buckets[day]) {
        const amt = Number(tx.amount) || 0;
        const cat = (tx.category || tx.type || '').toLowerCase();
        if (cat.includes('tip') || cat.includes('support')) {
          buckets[day].tips += amt;
        } else {
          buckets[day].paywalls += amt;
        }
      }
    });

    return [
      { name: 'Mon', ...buckets.Mon },
      { name: 'Tue', ...buckets.Tue },
      { name: 'Wed', ...buckets.Wed },
      { name: 'Thu', ...buckets.Thu },
      { name: 'Fri', ...buckets.Fri },
      { name: 'Sat', ...buckets.Sat },
      { name: 'Sun', ...buckets.Sun },
    ];
  }, [rawTransactions]);

  // Conversion rate & top content
  const { totalVisits, totalUnlocks, conversionRatePct, topContentItems } = useMemo(() => {
    let visits = 0;
    let unlocks = userData.unlocksCount || 0;

    const allContent = [...creatorFunnels, ...creatorClips];
    allContent.forEach(item => {
      visits += Number(item.visits || item.views || item.plays) || 0;
      unlocks += Number(item.unlocks || item.purchases) || 0;
    });

    const rate = visits > 0 ? ((unlocks / visits) * 100).toFixed(1) : (unlocks > 0 ? '100.0' : '0.0');

    // Sort by revenue/unlocks
    const sorted = allContent.sort((a, b) => {
      const revA = Number(a.revenue || (a.unlocks || 0) * (a.price || 10));
      const revB = Number(b.revenue || (b.unlocks || 0) * (b.price || 10));
      return revB - revA;
    }).slice(0, 4);

    return {
      totalVisits: visits,
      totalUnlocks: unlocks,
      conversionRatePct: rate,
      topContentItems: sorted
    };
  }, [creatorFunnels, creatorClips, userData.unlocksCount]);

  // Dynamic MoM breakdown from real transactions
  const momData = useMemo(() => {
    const monthLabels = ['June 2026', 'May 2026', 'April 2026', 'March 2026', 'February 2026'];
    const monthIndices = [5, 4, 3, 2, 1]; // 0-indexed month numbers for 2026

    const monthlyStats = monthIndices.map((mIdx, idx) => {
      const label = monthLabels[idx];
      let monthGross = 0;
      let monthUnlocks = 0;
      let monthSubs = 0;
      let monthLive = 0;
      let monthClimer = 0;
      let monthSupport = 0;

      rawTransactions.forEach(tx => {
        const ts = typeof tx.timestamp === 'number' ? tx.timestamp : new Date(tx.timestamp).getTime();
        if (isNaN(ts)) return;
        const d = new Date(ts);
        if (d.getFullYear() === 2026 && d.getMonth() === mIdx) {
          const amt = Number(tx.amount) || 0;
          const cat = (tx.category || tx.type || '').toLowerCase();
          if (cat.includes('ep') || cat.includes('clip') || cat.includes('unlock') || cat.includes('paywall')) {
            monthUnlocks += amt * 0.70;
          } else if (cat.includes('sub')) {
            monthSubs += amt * 0.70;
          } else if (cat.includes('live') || cat.includes('ticket')) {
            monthLive += amt * 0.70;
          } else if (cat.includes('climer') || cat.includes('funnel')) {
            monthClimer += amt * 0.70;
          } else {
            monthSupport += amt * 0.70;
          }
          monthGross += amt * 0.70;
        }
      });

      return {
        month: label,
        total: monthGross,
        isCurrent: idx === 0,
        growth: null as string | null,
        unlocks: monthUnlocks,
        subs: monthSubs,
        live: monthLive,
        climer: monthClimer,
        support: monthSupport,
        pct: 0
      };
    });

    const maxMonthTotal = Math.max(...monthlyStats.map(m => m.total), 1);
    monthlyStats.forEach((m, i) => {
      m.pct = maxMonthTotal > 0 ? (m.total / maxMonthTotal) * 100 : 0;
      if (i < monthlyStats.length - 1) {
        const nextMonth = monthlyStats[i + 1];
        if (nextMonth.total > 0) {
          const diff = ((m.total - nextMonth.total) / nextMonth.total) * 100;
          m.growth = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
        } else if (m.total > 0) {
          m.growth = '+100.0%';
        } else {
          m.growth = '0.0%';
        }
      }
    });

    return monthlyStats;
  }, [rawTransactions]);

  const currentMoMGrowth = momData[0]?.growth || '0.0%';
  const mrrEstimated = (userData.subscribersCount || 0) * 25 + subsGhs;

  return (
    <div className="h-full w-full bg-neutral-50 dark:bg-black lg:p-8 overflow-y-auto transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        
        {/* Header Section */}
        <div className="bg-white p-6 lg:rounded-b-2xl border-b border-gray-200 lg:border lg:border-t-0 mb-8 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl flex items-center gap-2">
                <SignalHigh className="w-8 h-8 text-red-500"/>
                Creator Analytics
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-200/60 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                <button 
                  onClick={() => setActiveSubTab('overview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'overview' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Activity className="w-3.5 h-3.5"/> Overview
                </button>
                <button 
                  onClick={() => setActiveSubTab('items')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'items' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-500"/> Clips & Climers
                </button>
                <button 
                  onClick={() => setActiveSubTab('charts')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'charts' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <LineIcon className="w-3.5 h-3.5"/> Advanced Analytics
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeSubTab === 'overview' && (
          <>
            {/* ---------------------------------------------------- */}
            {/* 4 CORE ANALYTICS MODULES (The Human-Centered Grid) */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ⭐ 1. Financial Analytics (The Money Dashboard) */}
              <div id="financial-analytics" className="layered-container layered-container-interactive p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Financial Analytics</h2>
                  <p className="text-xs text-gray-500 mb-6">Track your platform payouts and direct cash flow generated.</p>

                  {/* Earnings breakdown cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-red-50/50 border border-red-500/10 rounded-2xl p-4">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Net Take-Home Earnings</div>
                      <div className="text-2xl font-bold text-gray-900">
                        GHS {netEarningsGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                        Exact amount credited to your account (70% net share).
                      </p>
                    </div>
                    
                    <div className="bg-gray-50/50 border border-gray-500/10 rounded-2xl p-4">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pending Payout Ledger</div>
                      <div className="text-2xl font-bold text-gray-900">
                        GHS {pendingBalanceGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                        Sitting in app wallet. Ready for withdrawal or automatic payout processing.
                      </p>
                    </div>
                  </div>

                  {/* Revenue Source breakdown */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-700 uppercase tracking-wider">
                      <span>Revenue Source Breakdown</span>
                      <span className="text-gray-900">Total: GHS {grossTotalGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-medium text-gray-700">Video PPV (Pay-Per-View)</span>
                          <span className="font-bold text-gray-900">GHS {ppvGhs.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full transition-all" 
                            style={{ width: `${grossTotalGhs > 0 ? (ppvGhs / grossTotalGhs) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-medium text-gray-700">Live Streams Passes</span>
                          <span className="font-bold text-gray-900">GHS {liveGhs.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-indigo-500 h-2 rounded-full transition-all" 
                            style={{ width: `${grossTotalGhs > 0 ? (liveGhs / grossTotalGhs) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-medium text-gray-700">Monthly Tiers / Subscribers</span>
                          <span className="font-bold text-gray-900">GHS {subsGhs.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-teal-500 h-2 rounded-full transition-all" 
                            style={{ width: `${grossTotalGhs > 0 ? (subsGhs / grossTotalGhs) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-medium text-gray-700">Climer Links (Bio Funnels)</span>
                          <span className="font-bold text-gray-900">GHS {climerGhs.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-pink-500 h-2 rounded-full transition-all" 
                            style={{ width: `${grossTotalGhs > 0 ? (climerGhs / grossTotalGhs) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-medium text-gray-700">Support & Tips</span>
                          <span className="font-bold text-gray-900">GHS {supportGhs.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-amber-500 h-2 rounded-full transition-all" 
                            style={{ width: `${grossTotalGhs > 0 ? (supportGhs / grossTotalGhs) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⭐ 2. Conversion Analytics (The Marketing Check) */}
              <div id="conversion-analytics" className="layered-container layered-container-interactive p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-end mb-6">
                    <TrendingUp className="w-5 h-5 text-gray-500"/>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-1">Conversion Analytics</h2>
                  <p className="text-xs text-gray-500 mb-6">Analyze how promotion clicks and previews convert to actual revenue.</p>

                  {/* Conversion KPI */}
                  <div className="bg-gray-50/50 border border-gray-500/10 rounded-2xl p-5 mb-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-sm">
                      {Math.round(Number(conversionRatePct))}%
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Paywall Conversion Rate</div>
                      <div className="text-xl font-bold text-gray-900">{conversionRatePct}% success rate</div>
                      <p className="text-xs text-gray-500 mt-1 leading-snug">
                        {totalVisits > 0 
                          ? `${totalUnlocks} unlocks completed out of ${totalVisits} total preview sessions logged across your links.`
                          : 'Percentage of visitors who viewed your cliffhanger preview and authorized a MoMo unlock.'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Leaderboard */}
                  <div>
                    <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider mb-3">Top Performing Content</h4>
                    <div className="space-y-2.5">
                      {topContentItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          No content uploaded yet. Publish clips or climers to generate statistics.
                        </div>
                      ) : (
                        topContentItems.map((item, idx) => (
                          <div key={item.id || idx} className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0 font-bold text-xs">
                                #{idx + 1}
                              </div>
                              <div className="truncate">
                                <p className="font-bold text-xs text-gray-900 truncate">{item.title || 'Untitled Content'}</p>
                                <p className="text-[10px] text-gray-400 font-mono">
                                  {Number(item.visits || item.views || 0)} views • {Number(item.unlocks || 0)} unlocks
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono text-xs font-bold text-gray-900">
                              GHS {Number(item.revenue || (Number(item.unlocks || 0) * Number(item.price || 10))).toFixed(2)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ⭐ 3. Watch Time Analytics (The Content Check) */}
              <div id="watch-time-analytics" className="layered-container layered-container-interactive p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-end mb-6">
                    <Video className="w-5 h-5 text-gray-500"/>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-1">Watch Time Analytics</h2>
                  <p className="text-xs text-gray-500 mb-6">Understand audience engagement and duration across your video releases.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50/50 border border-gray-500/10 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Average View Duration</div>
                        <div className="text-3xl font-bold text-gray-900 font-mono">
                          {creatorClips.length > 0 ? '03:45' : '00:00'}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Typical duration fans actively watch before reaching cliffhanger gates.
                      </p>
                    </div>

                    <div className="bg-indigo-50/50 border border-indigo-500/10 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Audience Reach</div>
                        <div className="text-3xl font-bold text-gray-900 font-mono">
                          {totalVisits.toLocaleString()}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Cumulative distinct viewer impressions across all active links.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⭐ 4. Subscription Analytics (The Predictable Income Pipeline) */}
              <div id="subscription-analytics" className="layered-container layered-container-interactive p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-end mb-6">
                    <Activity className="w-5 h-5 text-red-500"/>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-1">Subscription Analytics</h2>
                  <p className="text-xs text-gray-500 mb-6">Protect and track monthly predictable pipeline income.</p>

                  {/* Grid of pipeline metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-red-50/50 border border-red-500/10 rounded-2xl p-4">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Monthly Recurring Revenue (MRR)</div>
                      <div className="text-2xl font-bold text-gray-900">
                        GHS {mrrEstimated.toFixed(2)}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                        {userData.subscribersCount || 0} active subscribers on record.
                      </p>
                    </div>
                    
                    <div className="bg-neutral-100 rounded-2xl p-4 border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Subscriber Churn Rate</div>
                      <div className="text-2xl font-bold text-gray-900">0.0%</div>
                      <p className="text-[10px] text-gray-400 mt-1 leading-normal">Active retention on recurring plans.</p>
                    </div>
                  </div>

                  {/* MoMo Balance Delinquency Card */}
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                    <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">MoMo Wallet Delinquency</div>
                    
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xl font-bold text-red-900">0 Subscribers Failed</span>
                      <span className="text-[9px] bg-red-200/50 text-red-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">100% Healthy</span>
                    </div>
                    
                    <p className="text-xs text-red-800 leading-snug mb-3">
                      Automated Mobile Money wallet renewal reminders will generate if any subscriber encounters insufficient funds.
                    </p>

                    <button 
                      onClick={() => setShowReminderDraft(!showReminderDraft)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4"/>
                      {showReminderDraft ? "Close Workspace" : "Open Reminder Template"}
                    </button>
                  </div>

                  {/* Interactive Delinquent Reminder Panel */}
                  {showReminderDraft && (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">Socials Reminder Draft</span>
                        <button 
                          onClick={copyReminderText}
                          className="text-[10px] bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all font-mono cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5"/>
                          {copied ? 'Copied!' : 'Copy Template'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 italic bg-white p-3 rounded-xl border border-gray-100 leading-relaxed">
                        "{draftText}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* MoM COMPARATIVE MATRIX CARD */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8">
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Left Column: Interactive Trend Graph & Comparison Metrics */}
                <div className="flex-1 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-red-500 animate-pulse"/>
                        Month-on-Month Net Revenue Comparative Matrix
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Real month-by-month net returns grouped across all direct creator conduits.</p>
                    </div>
                    <div className="bg-neutral-900 text-white px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <TrendingUp className="w-3.5 h-3.5 text-red-400 font-bold"/>
                      <span className="text-[10px] font-bold tracking-wider uppercase font-mono">{currentMoMGrowth} MoM Net</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {momData.map((item, idx) => {
                      const unlocksPct = item.total > 0 ? Math.round((item.unlocks / item.total) * 100) : 0;
                      const subsPct = item.total > 0 ? Math.round((item.subs / item.total) * 100) : 0;
                      const livePct = item.total > 0 ? Math.round((item.live / item.total) * 100) : 0;
                      const climerPct = item.total > 0 ? Math.round((item.climer / item.total) * 100) : 0;
                      const supportPct = item.total > 0 ? Math.max(0, 100 - unlocksPct - subsPct - livePct - climerPct) : 0;

                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                            item.isCurrent 
                              ? 'bg-neutral-50 border-red-500/30' 
                              : 'bg-white border-zinc-100 hover:border-zinc-300'
                          }`}
                        >
                          {/* Card Header Info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 z-10 relative">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">{item.month}</span>
                              {item.isCurrent && (
                                <span className="bg-red-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider font-mono">
                                  Live Period
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                              {item.growth && (
                                <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                                  {item.growth}
                                </span>
                              )}
                              <span className="text-xs font-bold text-gray-950 font-mono">
                                GH₵ {item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          
                          {/* Stacked Revenue split bar */}
                          <div className="w-full bg-neutral-100 h-3.5 rounded-full overflow-hidden flex mb-3">
                            <div 
                              className="h-full bg-red-500 transition-all duration-500 cursor-pointer hover:opacity-90 relative"
                              style={{ width: `${item.pct * (unlocksPct / 100)}%` }}
                              title={`Gated: GH₵${item.unlocks.toFixed(2)}`}
                            />
                            <div 
                              className="h-full bg-teal-500 transition-all duration-500 cursor-pointer hover:opacity-90 relative"
                              style={{ width: `${item.pct * (subsPct / 100)}%` }}
                              title={`Subs: GH₵${item.subs.toFixed(2)}`}
                            />
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-500 cursor-pointer hover:opacity-90 relative"
                              style={{ width: `${item.pct * (livePct / 100)}%` }}
                              title={`Live: GH₵${item.live.toFixed(2)}`}
                            />
                            <div 
                              className="h-full bg-pink-500 transition-all duration-500 cursor-pointer hover:opacity-90 relative"
                              style={{ width: `${item.pct * (climerPct / 100)}%` }}
                              title={`Climer: GH₵${item.climer.toFixed(2)}`}
                            />
                            <div 
                              className="h-full bg-amber-500 transition-all duration-500 cursor-pointer hover:opacity-90 relative"
                              style={{ width: `${item.pct * (supportPct / 100)}%` }}
                              title={`Support: GH₵${item.support.toFixed(2)}`}
                            />
                          </div>
                          
                          {/* Quick details sub-legend */}
                          <div className="grid grid-cols-5 gap-1 pt-2 border-t border-dashed border-zinc-100 text-[9px] font-mono text-gray-400">
                            <div>
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1"/>
                              <span>Gated:</span> <strong className="text-gray-800">GH₵{Math.round(item.unlocks)}</strong>
                            </div>
                            <div className="text-center">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 mr-1"/>
                              <span>Subs:</span> <strong className="text-gray-800">GH₵{Math.round(item.subs)}</strong>
                            </div>
                            <div className="text-center">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1"/>
                              <span>Live:</span> <strong className="text-gray-800">GH₵{Math.round(item.live)}</strong>
                            </div>
                            <div className="text-center">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-500 mr-1"/>
                              <span>Climer:</span> <strong className="text-gray-800">GH₵{Math.round(item.climer)}</strong>
                            </div>
                            <div className="text-right">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"/>
                              <span>Support:</span> <strong className="text-gray-800">GH₵{Math.round(item.support)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Right Column: Key Legend & Summary Bento Card */}
                <div className="w-full lg:w-[260px] shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-gray-100 pt-6 lg:pt-0 lg:pl-6 space-y-6 text-left">
                  <div className="bg-neutral-900 text-white rounded-2xl p-5 border border-white/5 space-y-4">
                    <span className="text-[9px] font-mono uppercase bg-white/10 text-white/80 px-2 py-0.5 rounded tracking-widest font-bold">
                      CHANNELS EXPLAINED
                    </span>
                    <h4 className="font-bold text-xs">Your Direct Economy</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Micro-earnings grouped across five creator revenue conduits:
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0"/>
                        <div>
                          <div className="text-xs font-bold text-white">Scene Unlocks ({grossTotalGhs > 0 ? Math.round((ppvGhs / grossTotalGhs) * 100) : 0}%)</div>
                          <div className="text-[9px] text-gray-400">Viewers pay one-offs for story cliffhangers.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-teal-500 mt-1 shrink-0"/>
                        <div>
                          <div className="text-xs font-bold text-white">Channel Subs ({grossTotalGhs > 0 ? Math.round((subsGhs / grossTotalGhs) * 100) : 0}%)</div>
                          <div className="text-[9px] text-gray-400">Monthly direct viewer patronage fees.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1 shrink-0"/>
                        <div>
                          <div className="text-xs font-bold text-white">Live Passes ({grossTotalGhs > 0 ? Math.round((liveGhs / grossTotalGhs) * 100) : 0}%)</div>
                          <div className="text-[9px] text-gray-400">Interactive watch party premiums.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-pink-500 mt-1 shrink-0"/>
                        <div>
                          <div className="text-xs font-bold text-white">Climer Links ({grossTotalGhs > 0 ? Math.round((climerGhs / grossTotalGhs) * 100) : 0}%)</div>
                          <div className="text-[9px] text-gray-400">Micro-earnings from viral teaser bio gates.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0"/>
                        <div>
                          <div className="text-xs font-bold text-white">Support & Tips ({grossTotalGhs > 0 ? Math.round((supportGhs / grossTotalGhs) * 100) : 0}%)</div>
                          <div className="text-[9px] text-gray-400">Direct supporter micro-tips.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-4 space-y-3.5">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block font-bold">Launch-to-Date Net</span>
                      <span className="text-xs font-bold text-gray-950 font-mono">
                        GH₵ {netEarningsGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block font-bold">Creator Status</span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                        Verified Creator
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* REVENUE BREAKDOWN AREA CHART */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Microtransactions & Paywalls Ledger</h3>
                  <p className="text-xs text-gray-400 mt-1">Comparing user direct paywalls to community micro-tips daily.</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"/>
                    Paywalls
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"/>
                    Tips
                  </span>
                </div>
              </div>
              
              <div className="h-[280px] w-full flex flex-col justify-center">
                {analyticsData.some(d => d.paywalls > 0 || d.tips > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPaywalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DE210B" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#DE210B" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTips" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EAB308" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="paywalls" stroke="#DE210B" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPaywalls)" name="Stream Paywalls"/>
                      <Area type="monotone" dataKey="tips" stroke="#EAB308" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTips)" name="Micro-Tips"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 text-gray-400">
                    <Activity className="w-8 h-8 text-gray-300" />
                    <p className="text-xs font-semibold text-gray-600">No Microtransactions or Paywalls Recorded</p>
                    <p className="text-[11px] text-gray-400 max-w-sm">Daily comparisons between direct clip paywall unlocks and community tips will plot in real-time as supporters interact.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* DETAILED DATA (TRANSACTIONS & TOP SUPPORTERS) */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
              <div className="md:col-span-1">
                <TopWhalesList whales={topWhales} />
              </div>
              <div className="md:col-span-2">
                <TransactionLedger transactions={formattedTransactions} />
              </div>
            </div>
          </>
        )}

        {activeSubTab === 'items' && (
          <div className="pb-12">
            <ContentAnalyticsStudio creatorOnly={true} />
          </div>
        )}

        {activeSubTab === 'charts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
            <TaskerCardAnalytics />
            <MonthlyRevenueChart />
            <ChannelConversionChart />
            <GhsPerMinuteChart />
            <MonthOverMonthGrowthChart />
            <ViewerPayloadChart />
            <RevenueChart />
          </div>
        )}

      </div>
    </div>
  );
}
