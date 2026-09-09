import React from 'react';
import { 
 LineChart, 
 Line, 
 XAxis, 
 YAxis, 
 CartesianGrid, 
 Tooltip, 
 ResponsiveContainer 
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const data = [
  { time: '00:00', value: 0 },
  { time: '00:05', value: 0 },
  { time: '00:10', value: 0 },
  { time: '00:15', value: 0 },
  { time: '00:20', value: 0 },
  { time: '00:25', value: 0 },
  { time: '00:30', value: 0 },
  { time: '00:35', value: 0 },
  { time: '00:40', value: 0 },
  { time: '00:45', value: 0 },
  { time: '00:50', value: 0 },
  { time: '00:55', value: 0 },
  { time: '01:00', value: 0 },
];

export function GhsPerMinuteChart() {
  const hasData = data.some(d => d.value > 0);

  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col h-96 transition-colors duration-200">
      <div className="p-4 border-b border-[#000000] flex justify-between items-center bg-[#000000] rounded-t-2xl shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-white"/>
          <h3 className="font-bold text-white">User Earnings Trends</h3>
        </div>
        <div className="text-[10px] font-mono text-white/70 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded">NARRATIVE HOOK CONVERSIONS</div>
      </div>
      
      <div className="flex-1 p-4 pb-6 w-full h-full relative flex flex-col justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
              <XAxis 
                dataKey="time"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#0F172A', fontFamily: 'monospace' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#0F172A', fontFamily: 'monospace' }}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }}
                itemStyle={{ color: '#3B82F6' }}
                labelStyle={{ color: '#FFFFFF', marginBottom: '0.25rem', fontSize: '0.75rem', fontFamily: 'monospace' }}
                formatter={(value: number) => [`GHS ${value}`, 'Earnings / Min']}
              />
              <Line 
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={3} 
                dot={{ r: 4, fill: '#111827', stroke: '#3B82F6', strokeWidth: 2 }} 
                activeDot={{ r: 6, fill: '#3B82F6', stroke: '#111827', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-gray-400">
            <TrendingUp className="w-8 h-8 text-gray-300 dark:text-gray-700" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">No Velocity Activity Recorded</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 max-w-xs">Earnings-per-minute rate during live premieres and cliffhanger reveals will chart in real-time here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
