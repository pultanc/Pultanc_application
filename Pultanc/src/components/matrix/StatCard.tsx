import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface StatCardProps {
 title: string;
 value: string;
 trend: string;
 icon: React.ReactNode;
 color: string;
 bgClass?: string;
 textClass?: string;
 trendTextClass?: string;
}

export function StatCard({ title, value, trend, icon, color, bgClass, textClass, trendTextClass }: StatCardProps) {
 const borderColor = color.split(' ')[0];
 const bgAndTextColor = color.split(' ').slice(1).join(' ');

 return (
 <div className={`p-6 rounded-2xl border backdrop-blur-sm ${bgClass || 'bg-white/50 dark:bg-gray-900/50'} ${borderColor} transition-all hover:opacity-90`}>
 <div className="flex items-center justify-between mb-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgAndTextColor}`}>
 {icon}
 </div>
 <div className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${trendTextClass || (bgClass ? 'text-white bg-white/20' : 'text-red-600 dark:text-red-500 bg-red-500/10')}`}>
 <ArrowUpRight className="w-4 h-4"/>
 {trend}
 </div>
 </div>
 <div>
 <h3 className={`text-xs font-medium mb-1 font-mono tracking-wider ${textClass ? `${textClass} opacity-80` : (bgClass ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}`}>{title}</h3>
 <p className={`text-3xl font-bold ${textClass || (bgClass ? 'text-white' : 'text-gray-900 dark:text-white')}`}>{value}</p>
 </div>
 </div>
 );
}
