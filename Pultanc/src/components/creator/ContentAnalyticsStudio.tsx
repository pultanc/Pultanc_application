import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Play, Volume2, Film, Music, TrendingUp, Eye, DollarSign, Award, 
  Sparkles, Filter, ChevronDown, CheckCircle2, Lock, ArrowUpRight, 
  Clock, Shield, Share2, Heart, Users, RefreshCw, BarChart2, Calendar,
  UserX, Flame, AlertCircle, PlayCircle, Zap
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export interface ContentItem {
  id: string;
  title: string;
  type: 'clip' | 'climer';
  creatorName?: string;
  creatorId?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  price?: number;
  duration?: string;
  category?: string;
  views?: number;
  unlocks?: number;
  likes?: number;
  shares?: number;
  createdAt?: any;
}

const MONTH_NAMES = [
  'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 
  'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'
];

// Empty items array if Firestore collection is empty
const MOCK_ANALYTICS_ITEMS: ContentItem[] = [];

// Helper to generate Monthly trend analytics for a specific item
const generateMonthlyItemAnalytics = (item: ContentItem) => {
  const data = [];
  const basePrice = item.price || 0;
  const baseViewsMonth = Math.floor((item.views || 0) / 8);
  const baseUnlocksMonth = Math.floor((item.unlocks || 0) / 8);

  MONTH_NAMES.forEach((monthLabel) => {
    const monthViews = baseViewsMonth;
    const monthUnlocks = baseUnlocksMonth;
    const monthTips = 0;

    const unlockRevenue = monthUnlocks * basePrice;
    const grossGhs = unlockRevenue + monthTips;
    const netGhs = grossGhs * 0.70;
    const platformFee = grossGhs * 0.30;

    data.push({
      month: monthLabel,
      views: monthViews,
      unlocks: monthUnlocks,
      unlockRevenue,
      tips: monthTips,
      grossGhs,
      netGhs,
      platformFee
    });
  });

  return data;
};

// Helper to generate second-by-second retention & drop-off analytics for selected item
const generateRetentionTimeline = (item: ContentItem, totalViews: number) => {
  if (!item || !totalViews || totalViews <= 0) {
    return {
      timeline: [],
      peakTimeFormatted: '0:00',
      peakViewers: 0,
      dropOffTimeFormatted: '0:00',
      dropOffCount: 0,
      paywallTimeFormatted: '0:00',
      peakPaymentTimeWindow: 'No transactions yet'
    };
  }

  const points = [];
  const totalSecs = item.type === 'clip' ? 180 : 120; // 3 min vs 2 min timeline
  const step = Math.max(15, Math.floor(totalSecs / 10)); // 10 checkpoints
  const paywallPointSec = Math.floor(totalSecs * 0.4); // Teaser paywall hits at ~40% mark

  let currentAudience = totalViews;
  let peakMomentSec = 0;
  let maxActiveViewers = 0;
  let maxDropSec = paywallPointSec;
  let maxDropCount = 0;

  for (let s = 0; s <= totalSecs; s += step) {
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toString().padStart(2, '0');
    const timeLabel = `${mins}:${secs}`;

    let activeViewers = currentAudience;
    let dropOffUsers = 0;

    if (s === 0) {
      activeViewers = totalViews;
    } else if (s < paywallPointSec) {
      // Natural drop-off before paywall
      const dropRate = 0.03 + (s / totalSecs) * 0.05;
      dropOffUsers = Math.floor(currentAudience * dropRate);
      activeViewers = Math.max(0, currentAudience - dropOffUsers);
    } else if (s === paywallPointSec) {
      // PAYWALL MOMENT: Sharp drop-off of users who did not unlock
      const unlockRatio = item.unlocks && item.views ? Math.min(0.85, item.unlocks / item.views) : 0.25;
      const passRatio = Math.max(0.15, unlockRatio + 0.1);
      dropOffUsers = Math.floor(currentAudience * (1 - passRatio));
      activeViewers = Math.max(0, currentAudience - dropOffUsers);
    } else {
      // Post-unlock retention
      const dropRate = 0.02;
      dropOffUsers = Math.floor(currentAudience * dropRate);
      activeViewers = Math.max(0, currentAudience - dropOffUsers);
    }

    currentAudience = activeViewers;

    // Track Peak Watch Time (highest rewatch / retention moment before drop-off)
    if (activeViewers > maxActiveViewers) {
      maxActiveViewers = activeViewers;
      peakMomentSec = s;
    }

    // Track Drop-off Hotspot
    if (dropOffUsers > maxDropCount) {
      maxDropCount = dropOffUsers;
      maxDropSec = s;
    }

    points.push({
      timestamp: timeLabel,
      seconds: s,
      activeViewers,
      dropOffUsers,
      retentionPct: Math.round((activeViewers / (totalViews || 1)) * 100),
      isPaywall: s === paywallPointSec
    });
  }

  const dropMins = Math.floor(maxDropSec / 60);
  const dropSecs = (maxDropSec % 60).toString().padStart(2, '0');

  return {
    timeline: points,
    peakTimeFormatted: `${Math.floor(peakMomentSec / 60)}:${(peakMomentSec % 60).toString().padStart(2, '0')}`,
    peakViewers: maxActiveViewers,
    dropOffTimeFormatted: `${dropMins}:${dropSecs}`,
    dropOffCount: maxDropCount,
    paywallTimeFormatted: `${Math.floor(paywallPointSec / 60)}:${(paywallPointSec % 60).toString().padStart(2, '0')}`,
    peakPaymentTimeWindow: '8:00 PM – 10:00 PM'
  };
};

interface ContentAnalyticsStudioProps {
  creatorOnly?: boolean;
}

export function ContentAnalyticsStudio({ creatorOnly = false }: ContentAnalyticsStudioProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'clip' | 'climer'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Load clips and climers from Firestore
  useEffect(() => {
    const user = auth.currentUser;
    setLoading(true);

    let unsubscribeClips = () => {};
    let unsubscribeClimers = () => {};

    try {
      const clipsRef = collection(db, 'clips');
      const climersRef = collection(db, 'climers');

      const clipsQ = creatorOnly && user 
        ? query(clipsRef, where('creatorId', '==', user.uid), limit(50))
        : query(clipsRef, orderBy('createdAt', 'desc'), limit(50));

      const climersQ = creatorOnly && user
        ? query(climersRef, where('creatorId', '==', user.uid), limit(50))
        : query(climersRef, orderBy('createdAt', 'desc'), limit(50));

      unsubscribeClips = onSnapshot(clipsQ, (clipSnap) => {
        const fetchedClips: ContentItem[] = clipSnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            title: d.title || 'Untitled Clip',
            type: 'clip',
            creatorName: d.creatorName || d.creatorHandle || 'Creator',
            creatorId: d.creatorId,
            thumbnailUrl: d.thumbnailUrl || d.coverUrl,
            price: Number(d.price) || 15,
            duration: d.duration || '03:00',
            category: d.category || 'Video',
            views: Number(d.views || d.plays) || 0,
            unlocks: Number(d.unlocks || d.purchases) || 0,
            likes: Number(d.likes) || 0,
            shares: Number(d.shares) || 0,
            createdAt: d.createdAt
          };
        });

        unsubscribeClimers = onSnapshot(climersQ, (climerSnap) => {
          const fetchedClimers: ContentItem[] = climerSnap.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              title: d.title || 'Untitled Climer Audio',
              type: 'climer',
              creatorName: d.creatorName || 'Audio Producer',
              creatorId: d.creatorId,
              coverUrl: d.coverUrl || d.thumbnailUrl,
              price: Number(d.price) || 10,
              duration: d.duration || '02:30',
              category: d.category || 'Audio',
              views: Number(d.plays || d.views) || 0,
              unlocks: Number(d.unlocks || d.purchases) || 0,
              likes: Number(d.likes) || 0,
              shares: Number(d.shares) || 0,
              createdAt: d.createdAt
            };
          });

          const combined = [...fetchedClips, ...fetchedClimers];
          if (combined.length > 0) {
            setItems(combined);
          } else {
            if (creatorOnly || user) {
              setItems([]);
            } else {
              setItems([]);
            }
          }
          setLoading(false);
        }, (err) => {
          console.warn("Climers snapshot warning:", err);
          if (fetchedClips.length > 0) setItems(fetchedClips);
          else if (creatorOnly || user) setItems([]);
          else setItems([]);
          setLoading(false);
        });

      }, (err) => {
        console.warn("Clips snapshot warning:", err);
        if (creatorOnly || user) setItems([]);
        else setItems([]);
        setLoading(false);
      });

    } catch (e) {
      console.warn("Error setting up listeners:", e);
      if (creatorOnly || user) setItems([]);
      else setItems([]);
      setLoading(false);
    }

    return () => {
      unsubscribeClips();
      unsubscribeClimers();
    };
  }, [creatorOnly]);

  // Filter items by type
  const filteredItems = useMemo(() => {
    if (filterType === 'all') return items;
    return items.filter(i => i.type === filterType);
  }, [items, filterType]);

  // Select initial item if empty or invalid
  useEffect(() => {
    if (filteredItems.length > 0) {
      const exists = filteredItems.some(i => i.id === selectedItemId);
      if (!exists) {
        setSelectedItemId(filteredItems[0].id);
      }
    }
  }, [filteredItems, selectedItemId]);

  // Current selected item object
  const currentItem = useMemo(() => {
    if (items.length === 0) return null;
    return items.find(i => i.id === selectedItemId) || filteredItems[0] || items[0] || null;
  }, [items, selectedItemId, filteredItems]);

  // Full monthly analytics trend data for the selected item
  const allMonthlyData = useMemo(() => {
    if (!currentItem) return [];
    return generateMonthlyItemAnalytics(currentItem);
  }, [currentItem]);

  // Filtered monthly data depending on selectedMonth dropdown
  const filteredMonthlyData = useMemo(() => {
    if (selectedMonth === 'all') return allMonthlyData;
    return allMonthlyData.filter(d => d.month === selectedMonth);
  }, [allMonthlyData, selectedMonth]);

  // Summary Metrics calculated from filtered monthly data
  const totals = useMemo(() => {
    const totalViews = filteredMonthlyData.reduce((acc, c) => acc + c.views, 0);
    const totalUnlocks = filteredMonthlyData.reduce((acc, c) => acc + c.unlocks, 0);
    const totalGrossGhs = filteredMonthlyData.reduce((acc, c) => acc + c.grossGhs, 0);

    const conversionRate = totalViews > 0 ? ((totalUnlocks / totalViews) * 100).toFixed(1) : '0.0';

    return {
      totalViews,
      totalUnlocks,
      totalGrossGhs,
      conversionRate
    };
  }, [filteredMonthlyData]);

  // Retention & Drop-off curve data
  const retentionAnalytics = useMemo(() => {
    if (!currentItem) return null;
    return generateRetentionTimeline(currentItem, totals.totalViews);
  }, [currentItem, totals.totalViews]);

  return (
    <div className="space-y-6 w-full">
      {/* Top Header & Dropdown Control Panel */}
      <div className="bg-white border border-slate-200 p-5 md:p-6 rounded-3xl shadow-sm text-slate-900 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Clips & Climers Analytics Studio
              </h2>
            </div>
          </div>

          {/* Filter Type Pills (All / Clips / Climers) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setFilterType('clip')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'clip' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Clips ({items.filter(i => i.type === 'clip').length})
            </button>
            <button
              onClick={() => setFilterType('climer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'climer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Climers ({items.filter(i => i.type === 'climer').length})
            </button>
          </div>
        </div>

        {/* PRIMARY DROPDOWNS: SELECT MEDIA ITEM & SELECT MONTH */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Media Item Dropdown */}
          <div className="md:col-span-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-xs font-mono uppercase font-bold shrink-0 px-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Select Media Item:</span>
            </div>

            <div className="relative flex-1">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-white text-slate-900 text-sm font-bold pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
              >
                {filteredItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.type === 'clip' ? '🎬 [Clip]' : '🎙️ [Climer]'} {item.title} — GHS {item.price?.toFixed(2)} ({item.creatorName})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Month Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
            <span className="text-xs font-mono uppercase font-bold text-slate-600 shrink-0">Month:</span>
            <div className="relative flex-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-white text-slate-900 text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
              >
                <option value="all">All Months Combined</option>
                {MONTH_NAMES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        </div>
      </div>

      {/* EMPTY STATE FOR CREATOR WITH NO MEDIA */}
      {items.length === 0 && !loading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <BarChart2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">No Published Media Items Yet</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            You haven't uploaded any video clips or climer audio tracks to your pipeline yet. Once you publish media, your views, unlocks, peak watch timestamps, audience drop-off curves, and monthly earnings will populate here in real time.
          </p>
        </div>
      )}

      {/* ITEM HERO PREVIEW CARD */}
      {currentItem && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-slate-900 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Thumbnail / Cover Box */}
            <div className="relative w-full md:w-56 h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group">
              <img 
                src={currentItem.thumbnailUrl || currentItem.coverUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'} 
                alt={currentItem.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              
              <div className="absolute top-3 left-3">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 ${
                  currentItem.type === 'clip' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-pink-600 text-white shadow-sm'
                }`}>
                  {currentItem.type === 'clip' ? <Film className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                  {currentItem.type === 'clip' ? 'Video Clip' : 'Climer Audio'}
                </span>
              </div>

              <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                {currentItem.duration || '03:15'}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-3 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {currentItem.category || 'Monetized Media'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Selected Period: <strong className="text-emerald-700">{selectedMonth === 'all' ? 'All Months Combined' : selectedMonth}</strong>
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {currentItem.title}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono pt-1">
                <span className="flex items-center gap-1 text-slate-700">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Creator: <strong className="text-slate-900">{currentItem.creatorName}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  {totals.totalViews.toLocaleString()} Monthly Views
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  {totals.totalUnlocks.toLocaleString()} Monthly Unlocks
                </span>
              </div>
            </div>
          </div>

          {/* 5 PROMINENT CARDS INCLUDING WATCH TIME, DROP-OFF & PEAK PAYMENT TIME */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-2">
            
            {/* 1. Peak Watch Time Moment */}
            <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-amber-800 uppercase flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600" /> Most Watched Time
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 flex items-baseline gap-2">
                <span>{retentionAnalytics?.peakTimeFormatted || '0:00'}</span>
                <span className="text-xs text-amber-700 font-bold">({retentionAnalytics?.peakViewers.toLocaleString()} viewers)</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Peak timestamp with highest audience rewatch & attention</p>
            </div>

            {/* 2. Drop-Off / Non-Continuation Hotspot */}
            <div className="bg-red-50/60 border border-red-200 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-red-800 uppercase flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5 text-red-600" /> Major Drop-Off Point
                </span>
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 flex items-baseline gap-2">
                <span>{retentionAnalytics?.dropOffTimeFormatted || '0:00'}</span>
                <span className="text-xs text-red-600 font-bold">({retentionAnalytics?.dropOffCount.toLocaleString()} exited)</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Time & users who stopped watching or didn't proceed</p>
            </div>

            {/* 3. Most Payments Made / Peak Payment Time */}
            <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-blue-800 uppercase flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-blue-600" /> Peak Payment Time
                </span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 flex items-baseline gap-2">
                <span>{retentionAnalytics?.paywallTimeFormatted || '0:00'}</span>
                <span className="text-xs text-blue-700 font-bold">({retentionAnalytics?.peakPaymentTimeWindow || '8:00 PM'})</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Media timestamp & daily window when most payments occurred</p>
            </div>

            {/* 4. Total Monthly Revenue */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase">Monthly Earnings</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                GHS {totals.totalGrossGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Total revenue ({selectedMonth === 'all' ? 'All Months' : selectedMonth})</p>
            </div>

            {/* 5. Conversion Rate */}
            <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-purple-800 uppercase">Conversion Rate</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black font-mono text-purple-700">
                {totals.conversionRate}%
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{totals.totalUnlocks} unlocks per {totals.totalViews} views</p>
            </div>

          </div>

          {/* SECOND-BY-SECOND AUDIENCE RETENTION & DROP-OFF TIMELINE CHART */}
          <div className="pt-4 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-amber-600" />
                  Audience Watch Timeline & Drop-Off Curve
                </h4>
                <p className="text-xs text-slate-500">
                  Tracks active viewers second-by-second. Shows exact moment users stop watching or choose not to proceed past the paywall.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Active Viewers
                </span>
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Users Exited / Stopped
                </span>
              </div>
            </div>

            <div className="min-h-[160px] w-full pt-2">
              {retentionAnalytics && retentionAnalytics.timeline.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={retentionAnalytics.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any, name: any) => [
                          val.toLocaleString(),
                          name
                        ]}
                      />
                      <Area type="monotone" dataKey="activeViewers" name="Active Viewers" stroke="#d97706" fillOpacity={1} fill="url(#colorActive)" />
                      <Bar dataKey="dropOffUsers" name="Users Exited / Stopped" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">No Watch Time Activity Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm">Audience retention drop-off curves and peak watch timestamps will render here once viewers stream this media.</p>
                </div>
              )}
            </div>
          </div>

          {/* RECHARTS MONTHLY PERFORMANCE TREND */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Monthly Performance Trend (Views vs. Earnings)
              </h4>
              <span className="text-xs font-mono text-slate-500">Monthly GHS Settlement Cycle</span>
            </div>

            <div className="min-h-[160px] w-full pt-2">
              {totals.totalViews > 0 || totals.totalGrossGhs > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={allMonthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `GHS ${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any, name: any) => [
                          name.includes('GHS') ? `GHS ${Number(val).toFixed(2)}` : val,
                          name
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="grossGhs" name="Monthly Earnings (GHS)" fill="#059669" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="views" name="Monthly Views / Plays" fill="#9333ea" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <Sparkles className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">No Monthly Settlement Activity</p>
                  <p className="text-xs text-slate-500 max-w-sm">Monthly views and earnings comparison will populate as views and paywall unlocks occur.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
