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
      <div className="rounded-2xl border border-[#262626] bg-[#171717] px-4 py-3 text-[#ededed] shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#262626] text-[#60a5fa]">
            ⚠️
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-[#a3a3a3]">System Notice</div>
            <div className="text-sm font-medium leading-tight">{toast}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppHeader({ activeTab, onTabChange, triggerHaptic }) {
  const activeTabMeta = TABS.find(tab => tab.id === activeTab) || TABS[0]

  return (
    <header className="mb-4 flex w-full flex-col gap-3 sm:mb-6 sm:gap-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            UAIFU <span className="text-[#60a5fa] font-semibold">GACHA</span>
          </h1>
        </div>

        <div className="rounded-full border border-[#262626] bg-[#171717] px-3 py-1.5 shadow-sm">
          <div className="text-xs font-semibold text-[#60a5fa]">
            {activeTabMeta.label}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#262626] bg-[#171717] p-1.5 shadow-sm">
        <div className="grid grid-cols-6 gap-1">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => {
                onTabChange(id)
                triggerHaptic('selection')
              }}
              title={label}
              aria-label={label}
              className={`group relative flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-sm transition-all duration-200 active:scale-95 ${
                activeTab === id
                  ? 'bg-[#262626] text-[#ededed]'
                  : 'bg-transparent text-[#737373] hover:text-[#a3a3a3] hover:bg-[#262626]/50'
              }`}
            >
              <span className={`transition-transform duration-200 ${activeTab === id ? 'scale-110' : ''}`}>
                {icon}
              </span>
              <span className={`mt-1 hidden text-[10px] font-medium sm:block ${activeTab === id ? 'text-[#ededed]' : 'text-[#737373]'}`}>
                {label}
              </span>
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
    <div className="w-full max-w-md flex flex-col gap-2.5 mb-3 sm:mb-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flat-card rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold text-[#737373]">Енергія</span>
              <span className="mt-0.5 truncate text-xs font-medium text-[#d4d4d4]">
                {isEnergyFull ? 'Готово' : formatTime(userStats.next_energy_in_seconds)}
              </span>
            </div>
            <span className={`text-sm font-semibold whitespace-nowrap ${userStats.energy === 0 ? 'text-[#f43f5e]' : 'text-[#60a5fa]'}`}>
              {userStats.energy}/{userStats.max_energy}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#262626]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${userStats.energy === 0 ? 'bg-[#f43f5e]' : 'bg-[#60a5fa]'}`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <div className="flat-card rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold text-[#737373]">Баланс</span>
              <span className="mt-0.5 truncate text-xs font-medium text-[#d4d4d4]">Монети UAIFU</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className={`font-semibold whitespace-nowrap text-[#fbbf24] leading-none ${userStats.coins > 99999 ? 'text-xs' : 'text-sm'}`}>
                {userStats.coins.toLocaleString()}
              </span>
              <span className="text-xs shrink-0">🪙</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#262626]">
            <div
              className="h-full bg-[#fbbf24] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (userStats.coins / 50000) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
