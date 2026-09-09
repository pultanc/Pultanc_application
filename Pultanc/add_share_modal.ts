import * as fs from 'fs';

const file = 'src/components/consumer/ConsumerFeed.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `        )}
      </AnimatePresence>
    </div>
  );
}`;

const shareModalStr = `        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowShareModal(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#1A1A1A] border border-white/10 w-full max-w-sm rounded-3xl p-6 relative shadow-2xl flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-red-500" />
                  Share with Users
                </h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-white bg-white/5 p-1 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative mb-4 shrink-0">
                <input
                  type="text"
                  placeholder="Search usernames..."
                  value={shareSearchQuery}
                  onChange={(e) => setShareSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors"
                />
                <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {['alex_dev', 'sarah_creator', 'mike_jones', 'emily_art', 'david_w', 'chris_p', 'jessica_m'].filter(u => u.includes(shareSearchQuery.toLowerCase())).map(username => (
                  <button 
                    key={username}
                    onClick={() => {
                      onToast(\`Shared to @\${username}!\`);
                      setShowShareModal(false);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                        {username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">@{username}</span>
                    </div>
                    <div className="bg-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full group-hover:bg-red-500 transition-colors">
                      Send
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}`;

content = content.replace(target, shareModalStr);
fs.writeFileSync(file, content);
