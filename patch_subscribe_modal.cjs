const fs = require('fs');

let feedContent = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf8');

const oldModalBtn = `<button 
 onClick={() => handleUnlock('subscribe')}
 disabled={isProcessing || unlockSuccess}
 className={\`w-full border rounded-xl p-4 flex items-center justify-between transition-all active:scale-[0.98] disabled:opacity-70 group cursor-pointer \${unlockSuccess && unlockType === 'subscribe' ? 'bg-red-500 border-red-400 text-black' : 'bg-gray-600 border-gray-500 hover:bg-gray-500'}\`}
 >
 <div className="text-left">
 <div className={\`font-medium text-xs mb-0.5 flex items-center gap-2 \${unlockSuccess && unlockType === 'subscribe' ? 'text-black' : 'text-white'}\`}>
 {unlockSuccess && unlockType === 'subscribe' ? 'Subscribed Successfully' : 'Subscribe Monthly'}
 </div>
 <div className={\`text-[11px] \${unlockSuccess && unlockType === 'subscribe' ? 'text-black/70' : 'text-gray-100'}\`}>Unlocks creator's clips posted monthly.</div>
 </div>
 <div className={\`text-xs font-bold \${unlockSuccess && unlockType === 'subscribe' ? 'text-black' : 'text-white'}\`}>
 {isProcessing && unlockType === 'subscribe' ? (
 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease:"linear"}} className={\`w-4 h-4 border-2 rounded-full \${unlockSuccess ? 'border-black/20 border-t-black' : 'border-white/40 border-t-white'}\`} />
 ) : unlockSuccess && unlockType === 'subscribe' ? (
 <CheckCircle2 className="w-5 h-5"/>
 ) : (
 \`GHS \${subscribePrice.toFixed(2)}\`
 )}
 </div>
 </button>`;

const newModalBtn = `<button 
 onClick={() => handleUnlock('subscribe')}
 disabled={isProcessing || unlockSuccess}
 className={\`w-full border rounded-xl p-4 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-70 group cursor-pointer \${unlockSuccess && unlockType === 'subscribe' ? 'bg-red-500 border-red-400 text-black' : 'bg-gray-600 border-gray-500 hover:bg-gray-500'}\`}
 >
 <div className={\`text-sm font-bold flex items-center gap-2 \${unlockSuccess && unlockType === 'subscribe' ? 'text-black' : 'text-white'}\`}>
 {isProcessing && unlockType === 'subscribe' ? (
 <>
 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease:"linear"}} className={\`w-4 h-4 border-2 rounded-full \${unlockSuccess ? 'border-black/20 border-t-black' : 'border-white/40 border-t-white'}\`} />
 Processing...
 </>
 ) : unlockSuccess && unlockType === 'subscribe' ? (
 <>
 <CheckCircle2 className="w-5 h-5"/>
 Subscribed Successfully
 </>
 ) : (
 \`GHS \${subscribePrice.toFixed(2)}\`
 )}
 </div>
 </button>`;

feedContent = feedContent.replace(oldModalBtn, newModalBtn);
fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', feedContent);

