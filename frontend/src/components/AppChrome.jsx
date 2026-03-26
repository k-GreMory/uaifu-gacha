const TABS = [
  { id: 'home', icon: '🎲', label: 'Головна' },
  { id: 'collection', icon: '🎴', label: 'Колекція' },
  { id: 'shop', icon: '🛒', label: 'Магазин' },
  { id: 'leaderboard', icon: '🏆', label: 'Лідерборд' },
  { id: 'events', icon: '🎯', label: 'Події' },
  { id: 'referral', icon: '🔗', label: 'Реферали' }
]

export function ToastBanner({ toast }) {
  if (!toast) return null

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 min-w-[280px] z-[100] animate-fade-up px-4">
      <div className="rounded-[1.4rem] border border-cyan-400/20 bg-slate-950/88 px-4 py-3 text-white shadow-[0_18px_50px_rgba(2,8,23,0.65)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
            ⚠️
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-300/70">System Notice</div>
            <div className="text-sm font-black leading-tight text-slate-100">{toast}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppHeader({ activeTab, onTabChange, triggerHaptic }) {
  const activeTabMeta = TABS.find(tab => tab.id === activeTab) || TABS[0]

  return (
    <header className="w-full mb-3">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-500">Anime Gacha</div>
          <h1 className="mt-1 text-[1.9rem] leading-none font-black italic tracking-[-0.06em] text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-blue-400 to-blue-500 drop-shadow-sm pr-2">
            UAIFU
          </h1>
        </div>

        <div className="rounded-full border border-slate-700/70 bg-slate-900/55 px-3 py-1.5 text-right shadow-[0_10px_20px_rgba(2,8,23,0.28)] backdrop-blur-md">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
            {activeTabMeta.label}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-700/70 bg-slate-900/45 p-1.5 shadow-[0_14px_30px_rgba(2,8,23,0.28)] backdrop-blur-xl">
        <div className="grid grid-cols-6 gap-1.5">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => {
                onTabChange(id)
                triggerHaptic('selection')
              }}
              title={label}
              aria-label={label}
              className={`group relative flex min-w-0 flex-col items-center justify-center rounded-[1rem] border px-1 py-2 text-sm font-black transition-all duration-300 active:scale-95 ${
                activeTab === id
                  ? 'border-cyan-400/35 bg-gradient-to-b from-cyan-500/16 to-blue-500/12 text-cyan-200 shadow-[0_10px_22px_rgba(34,211,238,0.12)]'
                  : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800/70'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className={`mt-1 hidden text-[7px] uppercase tracking-[0.16em] sm:block ${activeTab === id ? 'text-cyan-100/80' : 'text-slate-500'}`}>
                {label}
              </span>
              <span className={`mt-1 h-1 w-1 rounded-full transition-all ${activeTab === id ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

export function TopStatsBar({ collection, fetchingCollection, formatTime, onOpenCollection, userStats }) {
  const isEnergyFull = userStats.energy >= userStats.max_energy
  const energyPercent = Math.round((userStats.energy / Math.max(1, userStats.max_energy)) * 100)
  const collectionPercent = Math.round((collection.length / Math.max(1, userStats.total_cards)) * 100)

  return (
    <div className="w-full max-w-md flex flex-col gap-2.5 mb-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[1.2rem] border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-800/60 p-3 shadow-[0_16px_28px_rgba(2,8,23,0.3)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Енергія</span>
              <span className="mt-1 text-[10px] font-bold text-slate-400">
                {isEnergyFull ? 'Повний заряд' : `+1 через ${formatTime(userStats.next_energy_in_seconds)}`}
              </span>
            </div>
            <span className={`text-sm font-black ${userStats.energy === 0 ? 'text-red-400' : 'text-cyan-300'}`}>
              {userStats.energy}/{userStats.max_energy}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-800/90">
            <div
              className={`h-full rounded-full transition-all ${userStats.energy === 0 ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-yellow-500/15 bg-gradient-to-br from-slate-900/90 to-slate-800/60 p-3 shadow-[0_16px_28px_rgba(2,8,23,0.3)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Монети</span>
              <span className="mt-1 text-[10px] font-bold text-slate-400">Для шопу і преміумів</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-black text-yellow-400">
              {userStats.coins}
              <img src="/coin.png" alt="Coins" className="w-4 h-4 object-cover object-center ml-0.5" style={{ imageRendering: 'auto' }} />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCollection}
        className="w-full rounded-[1.2rem] border border-slate-700/60 bg-slate-900/35 p-3 text-left transition-all active:scale-[0.985] shadow-[0_14px_28px_rgba(2,8,23,0.25)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Колекція</span>
            <span className="mt-1 text-[11px] font-bold text-slate-300">
              {fetchingCollection ? 'Синхронізуємо картки...' : 'Переглянути та оновити'}
            </span>
          </div>
          <span className="text-[10px] font-black text-blue-300 flex items-center gap-2">
            {fetchingCollection ? 'Оновлення...' : `${collection.length} / ${userStats.total_cards}`}
            {!fetchingCollection && <span className="text-slate-500">→</span>}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-800/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all"
            style={{ width: `${collectionPercent}%` }}
          />
        </div>
      </button>
    </div>
  )
}
