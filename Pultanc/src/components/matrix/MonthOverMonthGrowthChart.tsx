import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const growthData = [
  { month: 'Jan', growth: 0 },
  { month: 'Feb', growth: 0 },
  { month: 'Mar', growth: 0 },
  { month: 'Apr', growth: 0 },
  { month: 'May', growth: 0 },
  { month: 'Jun', growth: 0 },
  { month: 'Jul', growth: 0 },
];

export function MonthOverMonthGrowthChart() {
  const hasGrowth = growthData.some(d => d.growth !== 0);

  return (
    <div className="bg-white dark:bg-gray-900 flex-1 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 min-h-[300px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-gray-900 dark:text-white text-xs">Month-over-Month Growth (%)</h3>
        <div className="text-red-600 dark:text-red-400 text-xs font-bold bg-red-100 dark:bg-red-500/10 px-3 py-1 rounded-full border border-red-200 dark:border-red-500/20">
          0.0% MoM
        </div>
      </div>
      
      <div className="h-[250px] w-full flex-1 flex flex-col justify-center">
        {hasGrowth ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:opacity-20"/>
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#0F172A', fontSize: 12 }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#0F172A', fontSize: 12 }} 
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--tw-pred-body)', 
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                itemStyle={{ color: '#84cc16', fontWeight: 'bold' }}
                formatter={(value: number) => [`${value}%`, 'Growth']}
              />
              <Line 
                type="monotone"
                dataKey="growth"
                stroke="#84cc16"
                strokeWidth={3}
                dot={{ fill: '#fff', stroke: '#84cc16', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#84cc16', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-gray-400">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">No Multi-Month Records</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 max-w-xs">Growth rates comparing month-over-month performance will calculate once multiple cycles conclude.</p>
          </div>
        )}
      </div>
    </div>
  );
}
