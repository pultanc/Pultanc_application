with open("src/components/profile/UserProfile.tsx", "r") as f:
    content = f.read()

# Change Stats block
old_stats = """                <div className="flex items-center justify-center gap-6 py-5 w-full border-b border-gray-100 dark:border-white/5 mb-6 mt-2 max-w-md mx-auto">
                  <div className="text-center flex flex-col items-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">12.4K</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Unlocks</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                  <div className="text-center flex flex-col items-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">24.5K</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Supports</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                  <div className="text-center flex flex-col items-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">1.2K</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Subscribes</span>
                  </div>
                </div>"""

new_stats = """                <div className="flex items-center justify-center gap-4 py-3 w-full border-b border-gray-100 dark:border-white/5 mb-4 mt-0 max-w-md mx-auto">
                  <div className="text-center flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">12.4K</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Unlocks</span>
                  </div>
                  <div className="w-px h-6 bg-gray-200 dark:bg-white/10"></div>
                  <div className="text-center flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">24.5K</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Supports</span>
                  </div>
                  <div className="w-px h-6 bg-gray-200 dark:bg-white/10"></div>
                  <div className="text-center flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">1.2K</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Subscribes</span>
                  </div>
                </div>"""

content = content.replace(old_stats, new_stats)

# Action Buttons: let's add Message button back
old_buttons = """                <div className="flex justify-center gap-3 w-full max-w-sm mx-auto">
                  <button 
                    onClick={handleSubscribeClick}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-black dark:text-black text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-[0_4px_14px_0_rgba(132,204,22,0.39)] hover:shadow-[0_6px_20px_rgba(132,204,22,0.23)] hover:-translate-y-0.5"
                  >
                    Subscribe • GHS {subscribePrice.toFixed(2)}
                  </button>
                  <button 
                    onClick={() => setShowTipModal(true)}
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    Support
                  </button>
                </div>"""

new_buttons = """                <div className="flex justify-center gap-2 w-full max-w-sm mx-auto">
                  <button 
                    onClick={handleSubscribeClick}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-2 py-2 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
                  >
                    Subscribe
                  </button>
                  <button 
                    onClick={() => setShowTipModal(true)}
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 text-xs font-bold px-2 py-2 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1"
                  >
                    Support
                  </button>
                  <button 
                    onClick={() => { /* open messages or comment */ }}
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 text-xs font-bold px-2 py-2 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1"
                  >
                    Message
                  </button>
                </div>"""

content = content.replace(old_buttons, new_buttons)

with open("src/components/profile/UserProfile.tsx", "w") as f:
    f.write(content)

