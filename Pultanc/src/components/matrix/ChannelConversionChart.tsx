import React from 'react';
import { motion } from 'motion/react';
import { Target } from 'lucide-react';

export function ChannelConversionChart() {
 const channels = [
  { name: 'TikTok', value: 0, color: 'bg-black text-white' },
  { name: 'Instagram', value: 0, color: 'bg-gradient-to-tr from-gray-400 via-pink-500 to-gray-500 text-white' },
  { name: 'YouTube', value: 0, color: 'bg-red-600 text-white' },
  { name: 'Facebook', value: 0, color: 'bg-gray-600 text-white' },
  { name: 'Twitter (X)', value: 0, color: 'bg-gray-900 text-white' },
  { name: 'LinkedIn', value: 0, color: 'bg-gray-700 text-white' },
  { name: 'Snapchat', value: 0, color: 'bg-gray-400 text-white' },
  { name: 'Pinterest', value: 0, color: 'bg-red-500 text-white' }
];

 const total = channels.reduce((sum, channel) => sum + channel.value, 0);

 return (
 <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl transition-colors duration-200 h-full overflow-hidden flex flex-col">
 <div className="flex items-center gap-2 bg-[#000000] text-white p-6 border-b border-[#000000]">
 <Target className="w-5 h-5 text-white"/>
 <h3 className="font-bold">Conversion by Channel</h3>
 </div>
 
 <div className="p-6 pt-4 flex-1 flex flex-col justify-center">
 <div className="mb-6">
 <div className="text-xs text-gray-500 font-mono mb-1">TOTAL CONVERSIONS</div>
 <div className="text-3xl font-bold text-gray-900 dark:text-white">{total.toLocaleString()}</div>
 </div>

 {total > 0 ? (
 <div className="space-y-4">
 {channels.map((channel, idx) => {
 const percent = total > 0 ? Math.round((channel.value / total) * 100) : 0;
 return (
 <div key={channel.name}>
 <div className="flex justify-between text-xs mb-1">
 <span className="font-medium text-gray-700 dark:text-gray-300">{channel.name}</span>
 <span className="font-mono text-gray-900 dark:text-white">{channel.value.toLocaleString()} ({percent}%)</span>
 </div>
 <div className="h-2 w-full bg-white dark:bg-gray-800 rounded-full overflow-hidden">
 <motion.div 
 initial={{ width: 0 }}
 animate={{ width: `${percent}%` }}
 transition={{ duration: 1, delay: idx * 0.1 }}
 className={`h-full rounded-full ${channel.color}`} 
 />
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="py-8 flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
 <Target className="w-8 h-8 text-gray-300 dark:text-gray-700" />
 <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">No External Conversions Recorded</p>
 <p className="text-[11px] text-gray-400 dark:text-gray-600 max-w-xs">Referral clicks and conversions across social channels will rank dynamically as fans visit and purchase.</p>
 </div>
 )}
 </div>
 </div>
 );
}
