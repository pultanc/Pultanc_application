with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    content = f.read()

# Replace pb-6 with pb-24 to move up above MobileBottomNav
content = content.replace("pb-6 px-4 z-20 pointer-events-none flex flex-col justify-end", "pb-24 px-4 z-20 pointer-events-none flex flex-col justify-end")

# Counts Container Adjustments
# Unlocks
content = content.replace(
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1.5 transition-colors">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Unlocks</span>
              <span className="text-xs font-bold text-white drop-shadow-md">12.4K</span>""",
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Unlocks</span>
              <span className="text-[10px] font-bold text-white drop-shadow-md">12.4K</span>"""
)

# Supports
content = content.replace(
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1.5 transition-colors">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Supports</span>
              <span className="text-xs font-bold text-white drop-shadow-md">{isLiked ? '24.6K' : '24.5K'}</span>""",
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Supports</span>
              <span className="text-[10px] font-bold text-white drop-shadow-md">{isLiked ? '24.6K' : '24.5K'}</span>"""
)

# Subscribes
content = content.replace(
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1.5 transition-colors">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Subscribes</span>
              <span className="text-xs font-bold text-white drop-shadow-md">{isSubscribed ? '1.3K' : '1.2K'}</span>""",
"""            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl py-1 transition-colors">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Subscribes</span>
              <span className="text-[10px] font-bold text-white drop-shadow-md">{isSubscribed ? '1.3K' : '1.2K'}</span>"""
)

with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
    f.write(content)

