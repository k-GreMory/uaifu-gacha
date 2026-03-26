const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Collection: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/>
    </svg>
  ),
  Shop: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  ),
  Leaderboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  ),
  Events: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Referral: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

const TABS = [
  { id: 'home', icon: <Icons.Home />, label: 'Головна' },
  { id: 'collection', icon: <Icons.Collection />, label: 'Колекція' },
  { id: 'shop', icon: <Icons.Shop />, label: 'Магазин' },
  { id: 'leaderboard', icon: <Icons.Leaderboard />, label: 'Лідерборд' },
  { id: 'events', icon: <Icons.Events />, label: 'Події' },
  { id: 'referral', icon: <Icons.Referral />, label: 'Реферали' }
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
              className={`group relative flex min-w-0 flex-col items-center justify-center rounded-[1rem] border px-1 py-2 text-sm font-black transition-all duration-300 active:scale-90 ${
                activeTab === id
                  ? 'border-cyan-400/40 bg-gradient-to-b from-cyan-500/20 to-blue-500/15 text-cyan-200 shadow-[0_10px_22px_rgba(34,211,238,0.2)]'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`transition-transform duration-300 ${activeTab === id ? 'scale-110' : 'group-hover:scale-105'}`}>
                {icon}
              </span>
              <span className={`mt-1 hidden text-[7px] uppercase tracking-[0.16em] sm:block ${activeTab === id ? 'text-cyan-100 font-black' : 'text-slate-600'}`}>
                {label}
              </span>
              {activeTab === id && (
                <div className="absolute -bottom-0.5 h-1 w-4 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
              )}
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
        <div className="glass-card rounded-[1.4rem] p-3 transition-all hover:border-cyan-400/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Енергія</span>
              <span className="mt-1 text-[10px] font-bold text-slate-400">
                {isEnergyFull ? 'Готово' : formatTime(userStats.next_energy_in_seconds)}
              </span>
            </div>
            <span className={`text-sm font-black ${userStats.energy === 0 ? 'text-red-400' : 'text-cyan-300'}`}>
              {userStats.energy}/{userStats.max_energy}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className={`h-full progress-glow rounded-full transition-all duration-500 ${userStats.energy === 0 ? 'bg-red-500' : 'bg-cyan-400'}`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <div className="glass-card rounded-[1.4rem] p-3 transition-all hover:border-yellow-400/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Баланс</span>
              <span className="mt-1 text-[10px] font-bold text-slate-400">Монети UAIFU</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-black text-yellow-400">
              {userStats.coins.toLocaleString()}
              <img src="/coin.png" alt="Coins" className="w-4 h-4 animate-bounce-slow" />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCollection}
        className="glass-card premium-border relative w-full overflow-hidden rounded-[1.4rem] p-3 text-left transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Твій Прогрес</span>
            <span className="mt-1 text-[11px] font-black text-slate-200">
              {fetchingCollection ? 'Завантаження...' : 'Колекція персонажів'}
            </span>
          </div>
          <div className="text-[11px] font-black text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            {collection.length} / {userStats.total_cards}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/80 relative z-10">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-700"
            style={{ width: `${collectionPercent}%` }}
          />
        </div>
      </button>
    </div>
  )
}
