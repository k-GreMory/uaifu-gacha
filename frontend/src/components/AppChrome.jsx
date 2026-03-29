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
    <header className="mb-2.5 flex w-full flex-col gap-2.5 sm:mb-6 sm:gap-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black uppercase tracking-tighter sm:text-2xl italic">
            UAIFU <span className="text-cyan-400">GACHA</span>
          </h1>
          <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_1px_6px_rgba(34,211,238,0.6)]" />
        </div>

        <div className="rounded-full border border-slate-700/60 bg-slate-900/45 px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-[0_8px_16px_rgba(2,8,23,0.2)] backdrop-blur-md">
          <div className="text-[8px] font-black uppercase tracking-[0.16em] text-cyan-300 sm:text-[9px]">
            {activeTabMeta.label}
          </div>
        </div>
      </div>

      <div className="rounded-[1.2rem] border border-slate-700/70 bg-slate-900/45 p-1 shadow-[0_12px_28px_rgba(2,8,23,0.25)] backdrop-blur-xl sm:p-1.5 sm:rounded-[1.5rem]">
        <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => {
                onTabChange(id)
                triggerHaptic('selection')
              }}
              title={label}
              aria-label={label}
              className={`group relative flex min-w-0 flex-col items-center justify-center rounded-[0.9rem] border px-1 py-1.5 text-sm font-black transition-all duration-300 active:scale-90 sm:py-2 sm:rounded-[1rem] ${
                activeTab === id
                  ? 'border-cyan-400/40 bg-gradient-to-b from-cyan-500/20 to-blue-500/15 text-cyan-200 shadow-[0_8px_18px_rgba(34,211,238,0.2)]'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`transition-transform duration-300 ${activeTab === id ? 'scale-110' : 'group-hover:scale-105'}`}>
                {icon}
              </span>
              <span className={`mt-0.5 hidden text-[6.5px] uppercase tracking-[0.14em] sm:block ${activeTab === id ? 'text-cyan-100 font-black' : 'text-slate-600'}`}>
                {label}
              </span>
              {activeTab === id && (
                <div className="absolute -bottom-0.5 h-0.5 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] sm:h-1 sm:w-4" />
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

  return (
    <div className="w-full max-w-md flex flex-col gap-2 mb-2 sm:gap-2.5 sm:mb-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <div className="glass-card rounded-[1.2rem] p-2.5 transition-all hover:border-cyan-400/30 sm:rounded-[1.4rem] sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-[9px]">Енергія</span>
              <span className="mt-0.5 truncate text-[9px] font-bold text-slate-400 sm:text-[10px]">
                {isEnergyFull ? 'Готово' : formatTime(userStats.next_energy_in_seconds)}
              </span>
            </div>
            <span className={`text-xs font-black whitespace-nowrap sm:text-sm ${userStats.energy === 0 ? 'text-red-400' : 'text-cyan-300'}`}>
              {userStats.energy}/{userStats.max_energy}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/80 sm:h-1.5 sm:mt-2.5">
            <div
              className={`h-full progress-glow rounded-full transition-all duration-500 ${userStats.energy === 0 ? 'bg-red-500' : 'bg-cyan-400'}`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <div className="glass-card rounded-[1.2rem] p-2.5 transition-all hover:border-yellow-400/30 sm:rounded-[1.4rem] sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-[9px]">Баланс</span>
              <span className="mt-0.5 truncate text-[9px] font-bold text-slate-400 sm:text-[10px]">Монети UAIFU</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className={`font-black whitespace-nowrap text-yellow-300 leading-none ${userStats.coins > 99999 ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                {userStats.coins.toLocaleString()}
              </span>
              <span className="text-[10px] shrink-0">🪙</span>
            </div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/80 sm:h-1.5 sm:mt-2.5">
            <div
              className="h-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (userStats.coins / 50000) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
