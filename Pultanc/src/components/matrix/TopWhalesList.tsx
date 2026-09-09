import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Crown, Gift } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export interface WhaleItem {
  id: string;
  username: string;
  supportValue: number;
  vipStatus: string;
  vipCode: string;
}

interface TopWhalesListProps {
  whales?: WhaleItem[];
}

export function TopWhalesList({ whales: propWhales }: TopWhalesListProps) {
  const [dbWhales, setDbWhales] = useState<WhaleItem[]>([]);

  useEffect(() => {
    if (propWhales && propWhales.length > 0) {
      setDbWhales(propWhales);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setDbWhales([]);
      return;
    }

    const supportersRef = collection(db, 'users', user.uid, 'supporters');
    const q = query(supportersRef, orderBy('supportValue', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: WhaleItem[] = snapshot.docs.map(doc => {
        const d = doc.data();
        const amt = Number(d.supportValue || d.totalSpent || d.amount) || 0;
        return {
          id: doc.id,
          username: d.username || d.name || 'Supporter',
          supportValue: amt,
          vipStatus: d.vipStatus || (amt >= 100 ? 'Diamond' : amt >= 50 ? 'Gold' : 'Silver'),
          vipCode: d.vipCode || `VIP-${doc.id.slice(0, 4).toUpperCase()}`
        };
      });
      setDbWhales(list);
    }, (err) => {
      console.warn("Supporters snapshot warning:", err);
      setDbWhales([]);
    });

    return () => unsubscribe();
  }, [propWhales]);

  const displayWhales = (propWhales && propWhales.length > 0) ? propWhales : dbWhales;

  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col h-[400px] transition-colors duration-200">
      <div className="p-4 border-b border-[#000000] flex justify-between items-center bg-[#000000] rounded-t-2xl shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-white"/>
          <h3 className="font-bold text-white">Top 50 Global Whales</h3>
        </div>
        <div className="text-xs font-mono text-white/70 bg-white/10 px-2 py-1 rounded">AUTO-VIP ENABLED</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {displayWhales.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
            <Crown className="w-8 h-8 text-gray-300 dark:text-gray-700" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">No supporter records yet.</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 max-w-[200px]">Top supporters and contributors will appear here once viewers tip or unlock your content.</p>
          </div>
        ) : (
          displayWhales.map((whale, idx) => (
            <motion.div 
              key={whale.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center justify-between p-3 rounded-lg border ${idx < 3 ? 'border-gray-200 dark:border-gray-500/20 bg-gray-50/30 dark:bg-gray-500/10' : 'border-gray-100 dark:border-white/5 bg-white dark:bg-black'} hover:border-gray-300 dark:hover:border-white/20 transition-colors group`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-gray-400 text-gray-900' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-gray-300 text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  #{idx + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-xs flex items-center gap-2">
                    {whale.username}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">GHS {whale.supportValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={`text-[10px] uppercase font-bold tracking-wider ${whale.vipStatus === 'Diamond' ? 'text-gray-500' : whale.vipStatus === 'Gold' ? 'text-gray-600' : 'text-gray-500'}`}>
                    {whale.vipStatus}
                  </div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-300 flex items-center gap-1">
                    {whale.vipCode}
                    <button className="text-red-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Grant Code Access">
                      <Gift className="w-3 h-3"/>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
