import React from 'react';
import { chartData } from '../../data';
import { DollarSign } from 'lucide-react';

export function RevenueChart() {
  const hasRevenue = chartData.some(d => d.revenue > 0);

  return (
    <div className="bg-white/50 dark:bg-gray-900/50 flex-1 border border-gray-200/80 dark:border-white/10 rounded-2xl transition-colors duration-200 min-h-[300px] overflow-hidden flex flex-col justify-between">
      <div className="bg-[#000000] p-4 px-3 border-b border-[#000000]">
        <h3 className="text-xs font-bold text-white mb-0 font-mono tracking-wider">MICRO-PAYMENTS EARNINGS (GHS)</h3>
      </div>
      <div className="p-6 pt-4 flex-1 flex flex-col justify-center">
        {hasRevenue ? (
          <div className="h-[200px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-4 pb-6 ml-8 sm:ml-10 pr-2 relative border-b border-gray-200/50 dark:border-white/10">
            <div className="absolute -left-8 sm:-left-10 top-4 bottom-6 flex flex-col justify-between text-[10px] text-gray-600 dark:text-gray-500 font-mono">
              <span>4000</span>
              <span>2000</span>
              <span>0</span>
            </div>
            {/* Horizontal Grid Lines */}
            <div className="absolute inset-0 top-4 bottom-6 flex flex-col justify-between pointer-events-none">
              <div className="w-full h-px border-t border-dashed border-gray-200/40"></div>
              <div className="w-full h-px border-t border-dashed border-gray-200/40"></div>
              <div className="w-full h-px"></div>
            </div>
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 gap-2 z-10 group cursor-crosshair">
                <div className="w-full relative h-[180px] flex items-end justify-center pb-1">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-200 text-red-600 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none font-mono">
                    GHS {d.revenue}
                  </div>
                  <div 
                    className="w-full max-w-[28px] bg-red-500 rounded-t border-t border-red-400 group-hover:bg-red-400 transition-colors relative"
                    style={{ height: `${(d.revenue / 4000) * 100}%` }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-900/50 to-transparent pointer-events-none"/>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-mono hidden sm:block">{d.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-gray-400">
            <DollarSign className="w-8 h-8 text-gray-300 dark:text-gray-700" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">No Micro-Payments Recorded</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 max-w-xs">Real-time micro-transactions from clip unbars and live passes will plot here dynamically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
