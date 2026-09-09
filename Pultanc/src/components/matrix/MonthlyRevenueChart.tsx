import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';

interface DailyEarning {
  dateKey: string;
  date: string;
  subscriptions: number;
  subscriptionsCount: number;
  episodes: number;
  episodesCount: number;
  live: number;
  liveCount: number;
  climer: number;
  climerCount: number;
  support: number;
  supportCount: number;
  totalGhs: number;
}

const generateBase30Days = (): DailyEarning[] => {
  const list: DailyEarning[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);

    const year = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const dateDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    list.push({
      dateKey,
      date: dateDisplay,
      subscriptions: 0,
      subscriptionsCount: 0,
      episodes: 0,
      episodesCount: 0,
      live: 0,
      liveCount: 0,
      climer: 0,
      climerCount: 0,
      support: 0,
      supportCount: 0,
      totalGhs: 0
    });
  }

  return list;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dayTotal = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[210px] z-50">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <span className="font-bold text-white text-sm">{label}</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">GHS {dayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="space-y-1.5 font-mono">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-zinc-300">{entry.name}:</span>
              </div>
              <span className="font-bold text-white">
                GHS {Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function MonthlyRevenueChart() {
  const [chartData, setChartData] = useState<DailyEarning[]>(generateBase30Days());

  useEffect(() => {
    const user = auth.currentUser;
    const q = user 
      ? query(collection(db, 'users', user.uid, 'transactions'), orderBy('timestamp', 'desc'), limit(200))
      : query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const baseList = generateBase30Days();
      const map = new Map<string, DailyEarning>();
      
      baseList.forEach(item => map.set(item.dateKey, { ...item }));

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.timestamp || !data.amount) return;

        const dateObj = new Date(data.timestamp);
        const year = dateObj.getFullYear();
        const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dayStr = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        if (map.has(dateKey)) {
          const dayData = map.get(dateKey)!;
          const amt = Number(data.amount) || 0;
          const cat = (data.type || data.category || 'support').toLowerCase();

          if (cat.includes('sub')) {
            dayData.subscriptions += amt;
            dayData.subscriptionsCount += 1;
          } else if (cat.includes('ep') || cat.includes('clip') || cat.includes('unlock')) {
            dayData.episodes += amt;
            dayData.episodesCount += 1;
          } else if (cat.includes('live')) {
            dayData.live += amt;
            dayData.liveCount += 1;
          } else if (cat.includes('climer') || cat.includes('funnel')) {
            dayData.climer += amt;
            dayData.climerCount += 1;
          } else {
            dayData.support += amt;
            dayData.supportCount += 1;
          }

          dayData.totalGhs += amt;
        }
      });

      setChartData(Array.from(map.values()));
    }, (error) => {
      console.warn("Firestore transactions snapshot listener warning:", error);
    });

    return () => unsubscribe();
  }, []);

  const totalSubsCount = chartData.reduce((acc, curr) => acc + curr.subscriptionsCount, 0);
  const totalSubsGhs = chartData.reduce((acc, curr) => acc + curr.subscriptions, 0);

  const totalEpisodesCount = chartData.reduce((acc, curr) => acc + curr.episodesCount, 0);
  const totalEpisodesGhs = chartData.reduce((acc, curr) => acc + curr.episodes, 0);

  const totalLiveCount = chartData.reduce((acc, curr) => acc + curr.liveCount, 0);
  const totalLiveGhs = chartData.reduce((acc, curr) => acc + curr.live, 0);

  const totalClimerCount = chartData.reduce((acc, curr) => acc + curr.climerCount, 0);
  const totalClimerGhs = chartData.reduce((acc, curr) => acc + curr.climer, 0);

  const totalSupportCount = chartData.reduce((acc, curr) => acc + curr.supportCount, 0);
  const totalSupportGhs = chartData.reduce((acc, curr) => acc + curr.support, 0);

  const grandTotalGhs = totalSubsGhs + totalEpisodesGhs + totalLiveGhs + totalClimerGhs + totalSupportGhs;

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col transition-colors duration-200 min-h-[420px] md:min-h-[480px] overflow-hidden">
      <div className="bg-[#000000] p-6 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${grandTotalGhs > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'} shrink-0`} />
          <h3 className="text-xl font-bold text-white tracking-tight">Monthly Platform Earnings</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="flex flex-col bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-white/60 text-[10px] uppercase font-semibold">Subs</span>
            <span className="font-bold text-[#3b82f6]">
              {totalSubsCount.toLocaleString()} 
              <span className="font-normal text-white/50 ml-1 text-[11px]">(GHS {totalSubsGhs.toLocaleString()})</span>
            </span>
          </div>
          <div className="flex flex-col bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-white/60 text-[10px] uppercase font-semibold">Clips</span>
            <span className="font-bold text-[#818cf8]">
              {totalEpisodesCount.toLocaleString()}
              <span className="font-normal text-white/50 ml-1 text-[11px]">(GHS {totalEpisodesGhs.toLocaleString()})</span>
            </span>
          </div>
          <div className="flex flex-col bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-white/60 text-[10px] uppercase font-semibold">Live</span>
            <span className="font-bold text-[#38bdf8]">
              {totalLiveCount.toLocaleString()}
              <span className="font-normal text-white/50 ml-1 text-[11px]">(GHS {totalLiveGhs.toLocaleString()})</span>
            </span>
          </div>
          <div className="flex flex-col bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-white/60 text-[10px] uppercase font-semibold">Climer</span>
            <span className="font-bold text-[#f472b6]">
              {totalClimerCount.toLocaleString()}
              <span className="font-normal text-white/50 ml-1 text-[11px]">(GHS {totalClimerGhs.toLocaleString()})</span>
            </span>
          </div>
          <div className="flex flex-col bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-white/60 text-[10px] uppercase font-semibold">Support</span>
            <span className="font-bold text-[#EAB308]">
              {totalSupportCount.toLocaleString()}
              <span className="font-normal text-white/50 ml-1 text-[11px]">(GHS {totalSupportGhs.toLocaleString()})</span>
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full min-h-0 p-6 pt-4 flex flex-col justify-center">
        {grandTotalGhs > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.15} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#FFFFFF' }} 
                dy={10} 
                interval={2}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#FFFFFF' }} 
                tickFormatter={(val) => `GHS ${val}`}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: '16px' }} />
              <Bar dataKey="subscriptions" name="Creator Subscriptions" stackId="a" fill="#3b82f6" />
              <Bar dataKey="episodes" name="Pay per Clip" stackId="a" fill="#818cf8" />
              <Bar dataKey="live" name="Live Streams" stackId="a" fill="#38bdf8" />
              <Bar dataKey="climer" name="Climer Studio" stackId="a" fill="#f472b6" />
              <Bar dataKey="support" name="Support & Tips" stackId="a" fill="#EAB308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
              <span className="font-mono font-bold text-lg text-emerald-400">GH₵</span>
            </div>
            <p className="text-sm font-semibold text-white">No Revenue Transactions Recorded</p>
            <p className="text-xs text-white/60 max-w-sm">30-day breakdown of creator subscriptions, scene unlocks, live passes, and tips will plot dynamically as fans transact.</p>
          </div>
        )}
      </div>
    </div>
  );
}

