import React from 'react';
import { Lock, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { Transaction } from '../../types';

interface TransactionLedgerProps {
  transactions: Transaction[];
}

export function TransactionLedger({ transactions }: TransactionLedgerProps) {
  return (
    <div className="bg-white/50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col h-full max-h-[400px] transition-colors duration-200">
      <div className="flex items-center justify-between shrink-0 bg-[#000000] p-4 px-3 border-b border-[#000000]">
        <h3 className="text-xs font-bold text-white font-mono tracking-wider flex items-center gap-2 mb-0">
          AUTOMATED MICRO-PAYMENT SPLITS 
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-2"/>
        </h3>
        <span className="text-xs text-white/50 font-mono hidden sm:block">Real-Time Creator Ledger</span>
      </div>
      
      <div className="overflow-auto flex-1 no-scrollbar p-6 pt-2">
        {transactions.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
            <FileText className="w-8 h-8 text-gray-300 dark:text-gray-700" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">No transactions recorded yet.</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 max-w-[260px]">
              Micro-payment splits, clip unlocks, subscription fees, and community tips will log automatically here in real time.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-gray-500 dark:text-gray-500 border-b border-gray-200/60 dark:border-white/10 font-mono text-xs tracking-wider transition-colors duration-200">
              <tr>
                <th className="pb-4 font-normal">TIME</th>
                <th className="pb-4 font-normal">TX ID</th>
                <th className="pb-4 font-normal">CONTENT / TYPE</th>
                <th className="pb-4 font-normal">AMOUNT</th>
                <th className="pb-4 font-normal text-right">STATUS</th>
                <th className="pb-4 font-normal text-right">CREATOR NET</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {transactions.map((tx, idx) => {
                const isPending = tx.status === 'pending_analysis';
                const formattedTime = typeof tx.timestamp === 'number'
                  ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                  : (tx.timestamp || 'Recent');

                const titleDisplay = tx.title || tx.seriesTitle || tx.episodeTitle || tx.seriesId || 'Unlock Event';
                const displaySplit = tx.creatorSplit !== undefined ? tx.creatorSplit : (tx.amount * 0.70);

                return (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={tx.id || `tx-${idx}`} 
                    className={`border-b border-gray-200/30 dark:border-white/5 group hover:bg-gray-200/20 dark:hover:bg-gray-800/50 transition-colors ${
                      isPending ? 'bg-gray-500/[0.02]' : ''
                    }`}
                  >
                    <td className="py-2 text-gray-600 dark:text-gray-400">{formattedTime}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">
                      {(tx.id || tx.reference || 'TX').slice(0, 10)}
                    </td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">
                      <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <Lock className={`w-3 h-3 ${isPending ? 'text-gray-500' : 'text-[#84cc16]'}`} />
                        {titleDisplay}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-gray-900 dark:text-white">GHS {Number(tx.amount || 0).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-500/10 text-gray-600 border border-gray-500/10 animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-gray-500"/>
                          Analyzing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-600 border border-red-500/10">
                          <span className="w-1 h-1 rounded-full bg-red-500"/>
                          Cleared & Settled
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-red-600 dark:text-red-400 font-bold">
                      {isPending ? (
                        <span className="text-gray-400 dark:text-gray-500 line-through">
                          +GHS {displaySplit.toFixed(2)}
                        </span>
                      ) : (
                        <span>+GHS {displaySplit.toFixed(2)}</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
