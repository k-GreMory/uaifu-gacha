const TABS = [
  ['home', '🎲'],
  ['collection', '🎴'],
  ['shop', '🛒'],
  ['leaderboard', '🏆'],
  ['events', '🎯'],
  ['referral', '🔗']
]

export function ToastBanner({ toast }) {
  if (!toast) return null

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 min-w-[280px] z-[100] animate-fade-up">
      <div className="bg-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.5)] border-2 border-red-400 text-sm font-black text-center flex items-center justify-center gap-2">
        ⚠️ {toast}
      </div>
    </div>
  )
}

export function AppHeader({ activeTab, onTabChange, triggerHaptic }) {
  return (
    <header className="w-full flex justify-between items-center py-1 sm:py-2 mb-2">
      <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 drop-shadow-sm pr-2">
        UAIFU
      </h1>
      <div className="flex gap-1.5">
        {TABS.map(([tab, icon]) => (
          <button
            key={tab}
            onClick={() => {
              onTabChange(tab)
              triggerHaptic('selection')
            }}
            className={`px-2.5 py-1.5 rounded-xl text-sm font-black border transition-all active:scale-95 shadow-lg ${
              activeTab === tab
                ? 'bg-blue-500/30 border-blue-500/60 text-blue-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
    </header>
  )
}

export function TopStatsBar({ collection, fetchingCollection, onOpenCollection, userStats }) {
  return (
    <div className="w-full max-w-md flex flex-col gap-2 mb-3">
      <div className="flex gap-2">
        <div className="flex-1 bg-slate-800/40 border border-slate-700/50 p-1.5 px-3 rounded-xl flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-400">ЕНЕРГІЯ</span>
          <span className={`text-xs font-black ${userStats.energy === 0 ? 'text-red-400' : 'text-cyan-400'}`}>
            {userStats.energy}/{userStats.max_energy}
          </span>
        </div>
        <div className="flex-1 bg-slate-800/40 border border-slate-700/50 p-1.5 px-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-black text-yellow-400">
            {userStats.coins}
            <img src="/coin.png" alt="Coins" className="w-4 h-4 object-cover object-center ml-0.5" style={{ imageRendering: 'auto' }} />
          </div>
        </div>
      </div>
      <div
        onClick={onOpenCollection}
        className="w-full bg-slate-800/20 border border-slate-700/30 p-1.5 px-3 rounded-lg flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
      >
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Твоя Колекція</span>
        <span className="text-[9px] font-black text-blue-400">
          {fetchingCollection ? 'Оновлення...' : `${collection.length} / ${userStats.total_cards}`}
        </span>
      </div>
    </div>
  )
}
