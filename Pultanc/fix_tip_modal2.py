import re

with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    content = f.read()

tip_modal = """
      {showTipModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowTipModal(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative"
          >
            <div className="p-6">
              <button 
                onClick={() => setShowTipModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Support Creator</h3>
                <p className="text-gray-600 text-xs mb-6">Send a custom micro-tip to support the creator directly.</p>
                
                <div className="mb-6 relative">
                  <input 
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Enter amount..."
                  />
                </div>
                
                <button 
                  onClick={handleTipSubmit}
                  disabled={isProcessingTip || tipSuccess || !tipAmount || Number(tipAmount) <= 0}
                  className={`w-full font-bold text-xs py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2 ${tipSuccess ? 'bg-red-500 text-black scale-105 shadow-[0_0_20px_rgba(132,204,22,0.4)]' : 'bg-[#ff0514] hover:bg-red-600 text-white'}`}
                >
                  {isProcessingTip ? 'Redirecting to Checkout...' : tipSuccess ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Success!
                    </>
                  ) : (
                    'Support Creator'
                  )}
                </button>

                {isProcessingTip && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-center animate-pulse">
                    <p className="text-[10px] text-gray-600 mb-2">
                      After completing payment, verify here to finish.
                    </p>
                    <button 
                      onClick={handleManualTipVerify}
                      disabled={isCheckingTip}
                      className="w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-600 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isCheckingTip ? <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : null}
                      Verify Payment
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
"""

content = content.replace("    </div>\n  );\n}\n\nexport default function ConsumerFeed", tip_modal + "\n    </div>\n  );\n}\n\nexport default function ConsumerFeed")

with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
    f.write(content)
