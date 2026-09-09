import React, { useState, useEffect } from 'react';
import { Search, Compass, Users, User, Pin } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';

export default function DiscoverView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'creators'>('all');
  const [creators, setCreators] = useState<any[]>([]);
  const [pinnedCreator, setPinnedCreator] = useState<any>(null);

  // 5-Hour Deterministic Rotation & Shuffle Logic for Featured Creators
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);
        let fetched = snapshot.docs
          .map(doc => {
            const data = doc.data();
            const photoURL = data.photoURL || data.avatar || data.picture || data.profilePic || data.photo;
            return {
              id: doc.id,
              ...data,
              photoURL: photoURL && typeof photoURL === 'string' && photoURL.trim() !== '' ? photoURL : null
            };
          })
          .filter(c => Boolean(c.photoURL));

        // Default vibrant fallback creators if database has few
        const defaultCreators = [
          { id: 'kwame_1', displayName: 'Kwame Creator', username: 'kwame_creator', bio: 'Unlocking new peaks in climbing and community.', photoURL: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=300&q=80' },
          { id: 'ama_2', displayName: 'Ama Motion', username: 'ama_cinema', bio: 'High-octane drama & short series storytelling.', photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80' },
          { id: 'pultanc_3', displayName: 'Pultanc Studios', username: 'pultanc_official', bio: 'Official micro-dramas and viral series.', photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80' },
          { id: 'kofi_4', displayName: 'Kofi Tech & Beats', username: 'kofi_beats', bio: 'Acoustic scores and tech breakdown clips.', photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' },
          { id: 'efua_5', displayName: 'Efua Visuals', username: 'efuavisuals', bio: 'Cinematic color grading and storytelling.', photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80' },
          { id: 'yaw_6', displayName: 'Yaw Comedy', username: 'yaw_skits', bio: 'Relatable micro-skits and behind-the-scenes.', photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80' }
        ];

        // Merge fetched with fallback ensuring uniqueness
        const existingIds = new Set(fetched.map((c: any) => c.id));
        defaultCreators.forEach(d => {
          if (!existingIds.has(d.id)) {
            fetched.push(d);
          }
        });

        // Calculate 5-hour epoch seed block
        const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
        const current5HourBlock = Math.floor(Date.now() / FIVE_HOURS_MS);

        // Seeded LCG deterministic shuffle algorithm
        const getDeterministicShuffled = (arr: any[], seed: number) => {
          if (!arr || arr.length <= 1) return arr;
          const shuffled = [...arr];
          let s = seed;
          const prng = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
          };
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
          }
          return shuffled;
        };

        const rotatedCreators = getDeterministicShuffled(fetched, current5HourBlock);
        setCreators(rotatedCreators);

        // Featured Creator on top card rotates every 5 hours (0th item in shuffled array)
        if (rotatedCreators.length > 0) {
          setPinnedCreator(rotatedCreators[0]);
        }
      } catch (err) {
        console.warn('Could not fetch creators:', err);
      }
    };
    fetchCreators();
  }, []);

  const displayPinnedHandle = pinnedCreator 
    ? `@${pinnedCreator.username || pinnedCreator.displayName?.toLowerCase().replace(/\s+/g, '') || 'kwame_creator'}`
    : (auth.currentUser ? `@${auth.currentUser.displayName?.toLowerCase().replace(/\s+/g, '') || 'kwame_creator'}` : '@kwame_creator');

  const displayPinnedName = pinnedCreator?.displayName || auth.currentUser?.displayName || 'Kwame Creator';
  const displayPhoto = pinnedCreator?.photoURL || auth.currentUser?.photoURL;

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-950 overflow-y-auto pt-6 pb-28 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Row */}
        <div className="pb-2 border-b border-gray-100 dark:border-zinc-800/60">
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white flex items-center gap-2">
            <Compass className="w-7 h-7 text-red-500"/>
            Discover
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">Explore top creators, spotlight cards, and categories</p>
        </div>

        {/* Top Pinned Social Card Showcase */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl p-4 sm:p-5 bg-gradient-to-r from-[#40000a] via-[#650316] to-[#7a3900] border border-white/10 text-white flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Ambient Lighting Sheen */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-16 -left-16 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Left Section: Round Avatar & Info */}
          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto flex-1 min-w-0">
            {/* Round Profile Picture */}
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-red-500 to-amber-200 shadow-lg shrink-0 overflow-hidden">
              <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center">
                {displayPhoto ? (
                  <img src={displayPhoto} alt={displayPinnedName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-full h-full p-3 text-white/50" />
                )}
              </div>
            </div>

            {/* Creator Text Info */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block bg-white/15 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 border border-white/10">
                  FEATURED CREATOR
                </span>
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  {displayPinnedHandle}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-white/90 font-medium truncate max-w-lg sm:max-w-xl">
                {pinnedCreator?.bio || "Unlocking new peaks in climbing and community. Let’s reach higher, together."}
              </p>
            </div>
          </div>

          {/* Right Section: Badges & TOP PINNED Tag */}
          <div className="flex items-center justify-between md:justify-end gap-3 relative z-10 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
              Spotlight
            </div>

            {/* Top Pinned Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/25 via-amber-400/20 to-yellow-500/25 backdrop-blur-md border border-amber-300/40 px-3.5 py-1.5 rounded-2xl shadow-lg shadow-amber-950/30">
              <Pin className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
              <span 
                style={{ fontFamily: '"Syne", "Cinzel", "Playfair Display", Georgia, serif' }}
                className="text-xs sm:text-sm font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 uppercase whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              >
                TOP PINNED
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar below Pinned Creator Card */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search creators & categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs sm:text-sm bg-gray-100 dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 text-gray-900 dark:text-white rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-xs"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"/>
        </div>

        {/* Filter Navigation Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setActiveFilter('all')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === 'all' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-900 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}>All</button>
          <button onClick={() => setActiveFilter('creators')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeFilter === 'creators' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 dark:bg-zinc-900 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}><Users className="w-3.5 h-3.5"/> Creators</button>
        </div>

        {/* Categories Section in Landscape Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Trending Topics & Categories
            </h2>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-red-500 font-semibold hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {['Business', 'Finance', 'Entertainment', 'Education', 'Gaming', 'Lifestyle', 'Music', 'Sports', 'Movies', 'Drama', 'Documentary', 'Tech'].map(cat => (
              <div 
                key={cat} 
                onClick={() => setSearchQuery(cat.toLowerCase())}
                className={`py-2 px-2.5 rounded-xl cursor-pointer transition-colors text-center shadow-xs border ${
                  searchQuery.toLowerCase() === cat.toLowerCase()
                    ? 'bg-red-500 text-white border-red-500 font-bold'
                    : 'bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-900 border-gray-100 dark:border-white/5 text-gray-900 dark:text-white'
                }`}
              >
                <div className="font-bold text-xs truncate">{cat}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Creators Section in Landscape Grid */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-red-500"/> Creators
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {creators.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-500">
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded"></div>
                      <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              (() => {
                const filtered = creators
                  .filter(c => Boolean(c.photoURL && typeof c.photoURL === 'string' && c.photoURL.trim() !== ''))
                  .filter(c => 
                    searchQuery.trim() === '' || 
                    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                if (filtered.length === 0) {
                  return (
                    <div className="col-span-full py-6 text-center text-gray-500 text-xs">
                      No creators found matching "{searchQuery}"
                    </div>
                  );
                }

                return filtered.map(creator => (
                  <div key={creator.id} className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-900/80 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700">
                      {creator.photoURL ? <img src={creator.photoURL} alt={creator.displayName} className="w-full h-full object-cover"/> : <User className="w-full h-full p-2.5 text-gray-400"/>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">{creator.displayName || 'Creator'}</div>
                      <div className="text-[11px] text-gray-400 truncate">@{creator.username || creator.displayName?.toLowerCase().replace(/\s+/g, '')}</div>
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
