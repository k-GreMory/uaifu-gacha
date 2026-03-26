import { useDeferredValue, useMemo, useRef, useState } from 'react'

import { BACKEND_URL } from '../lib/api'

export function HomeView({ formatTime, getRarityColor, isFlipping, loading, result, spin, user, userStats }) {
  const energyReady = userStats.energy > 0

  return (
    <div className="w-full flex flex-col items-center flex-1 justify-center py-4">
      {user && !result && (
        <div className="mb-3 text-slate-400 text-[10px] animate-fade-in text-center font-black uppercase tracking-[0.2em]">
          Ласкаво просимо, <span className="text-cyan-400">{user.first_name || 'Player'}</span>
        </div>
      )}

      <div className="perspective-1000 relative w-full aspect-[3/4.2] max-w-[290px] group">
        <div className="home-stage-halo" />
        <div
          className={`w-full h-full rounded-[2.7rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-2 transition-transform duration-[800ms] transform-style-3d ${isFlipping ? 'rotate-y-180' : ''} ${result && isFlipping ? getRarityColor(result.rarity) : 'border-slate-700/50 border-dashed bg-slate-950/90'}`}
          style={{ willChange: 'transform' }}
        >
          <div
            className="absolute inset-0 backface-hidden flex flex-col items-center justify-center gap-6 rounded-[2.7rem] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.1),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.95))] border-2 border-slate-700/50 border-dashed overflow-hidden"
            style={{ transform: 'translateZ(1px)' }}
          >
            <div className="dice-container">
              <div className={`dice ${loading ? 'rolling' : ''}`}>
                <div className="face front"><span></span></div>
                <div className="face back"><span></span><span></span><span></span><span></span><span></span><span></span></div>
                <div className="face right"><span></span><span></span><span></span></div>
                <div className="face left"><span></span><span></span><span></span><span></span></div>
                <div className="face top"><span></span><span></span></div>
                <div className="face bottom"><span></span><span></span><span></span><span></span><span></span></div>
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-600 text-center leading-loose">
              {loading ? <>Тягнемо<br /><span className="text-cyan-400">картку...</span></> : <>ГОТОВИЙ<br />ДО КРУТКИ</>}
            </div>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05),transparent_70%)]" />
          </div>

          <div
            className={`absolute inset-0 backface-hidden flex flex-col p-3 rounded-[2.7rem] bg-slate-900 border-2 overflow-hidden ${result ? `${getRarityColor(result.rarity)} ${['Legendary', 'Mythic'].includes(result.rarity) ? 'holo-card' : ''}` : ''}`}
            style={{ transform: 'rotateY(180deg) translateZ(1px)' }}
          >
            {result && (
              <>
                <div className={`rarity-glow ${getRarityColor(result.rarity).split(' ')[0].replace('text-', 'bg-')}`}></div>
                {result.rarity === 'Legendary' || result.rarity === 'Mythic' ? <div className="legendary-aura" /> : null}
                <div className="flex-1 rounded-[1.8rem] bg-[#0b1120] flex items-center justify-center overflow-hidden relative shadow-inner">
                  <img src={result.image} alt={result.name} className="w-full h-full object-cover animate-pop-in" />
                  <div className="absolute bottom-4 left-4 right-4 py-2.5 rounded-xl bg-black/70 border border-white/10 text-center backdrop-blur-md">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-100">{result.name}</div>
                  </div>
                </div>
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase border-2 bg-slate-950 shadow-xl ${getRarityColor(result.rarity).split(' ')[0]} ${getRarityColor(result.rarity).split(' ')[1]}`}>
                  {result.rarity}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 w-full px-2 flex flex-col items-center">
        <button
          onClick={spin}
          disabled={loading || userStats.energy < 1}
          className={`w-full py-4.5 rounded-[1.4rem] font-black text-xs tracking-[0.25em] uppercase transition-all duration-300 active:scale-95 shadow-xl ${(loading || userStats.energy < 1)
            ? 'bg-slate-800 text-slate-600 grayscale border border-slate-700/50'
            : 'shimmer-btn text-white shadow-[0_20px_40px_rgba(37,99,235,0.35)] border border-white/20'
          }`}
        >
          {loading ? 'ЗАРУЖАЄМО...' : (userStats.energy < 1 ? `⏳ ${formatTime(userStats.next_energy_in_seconds)}` : 'КРУТИТИ')}
        </button>
        <div className="mt-4 min-h-8 text-center px-6">
          {result ? (
            <p className="text-[10px] font-black text-cyan-400 animate-fade-in uppercase tracking-widest italic">✨ {result.message}</p>
          ) : (
            <p className={`text-[10px] font-bold uppercase tracking-wider ${energyReady ? 'text-slate-500' : 'text-amber-500/90'}`}>
              {energyReady ? '1 спін = 1 випадкова картка' : 'Енергія відновлюється автоматично'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ShopTab({ buyEnergy, loading, premiumSpin, userStats }) {
  const energyFull = userStats.energy >= userStats.max_energy
  const canBuyEnergy = !loading && userStats.coins >= 1000 && !energyFull

  return (
    <div className="w-full max-w-md animate-fade-in flex-1 flex flex-col items-center py-4">
      <h2 className="text-2xl font-black tracking-tighter mb-1 text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] uppercase italic">Black Market</h2>
      <p className="text-[10px] font-black tracking-[0.15em] text-slate-500 mb-6 text-center uppercase">Рідкісні ресурси за монети UAIFU</p>

      <div className="w-full glass-card p-4 rounded-2xl flex items-center justify-between mb-8 shadow-inner border-y border-white/5">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Твій Баланс</span>
          <div className="flex items-center gap-2 text-xl font-black text-yellow-400">
            {userStats.coins.toLocaleString()}
            <img src="/coin.png" alt="Coins" className="w-6 h-6 animate-bounce-slow" />
          </div>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xl">🛒</div>
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="glass-card rounded-[1.8rem] p-5 flex items-center justify-between shadow-xl transition-all hover:border-cyan-400/30">
          <div className="flex items-center gap-4">
            <div className="text-3xl bg-cyan-400/10 p-3 rounded-2xl border border-cyan-400/20">⚡</div>
            <div className="flex flex-col">
              <span className="font-black text-[13px] text-cyan-100 uppercase tracking-tight">Енергія (+1)</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Миттєве відновлення</span>
            </div>
          </div>
          <button
            onClick={buyEnergy}
            disabled={!canBuyEnergy}
            className={`px-5 py-3 rounded-xl font-black text-[11px] transition-all active:scale-95 whitespace-nowrap uppercase tracking-widest border ${canBuyEnergy ? 'shimmer-btn text-white border-white/20' : 'bg-slate-800/50 text-slate-600 border-slate-700 grayscale'}`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {energyFull ? (
                'MAX'
              ) : (
                <>
                  1,000 <img src="/coin.png" className="w-4 h-4" alt="Coins" />
                </>
              )}
            </div>
          </button>
        </div>

        <div className="glass-card bg-gradient-to-br from-yellow-900/30 to-slate-900/60 premium-border rounded-[1.8rem] p-5 flex items-center justify-between relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="text-3xl bg-yellow-400/10 p-3 rounded-2xl border border-yellow-400/20 shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-pulse">✨</div>
            <div className="flex flex-col flex-1 pr-2">
              <span className="font-black text-[13px] text-yellow-400 uppercase tracking-tight">Преміум Крутка</span>
              <span className="text-[9px] font-bold text-slate-400 leading-tight uppercase tracking-tighter">100% Rare або краще!</span>
            </div>
          </div>
          <button
            onClick={premiumSpin}
            disabled={loading || userStats.coins < 10000}
            className={`px-5 py-3 rounded-xl font-black text-[11px] relative z-10 transition-all active:scale-95 whitespace-nowrap uppercase tracking-widest border ${loading || userStats.coins < 10000 ? 'bg-slate-800/60 text-slate-600 border-slate-700/50 grayscale' : 'shimmer-btn from-yellow-500 to-amber-600 text-white border-white/30 shadow-[0_0_25px_rgba(234,179,8,0.4)]'}`}
          >
            <div className="flex items-center justify-center gap-1.5">
              10k <img src="/coin.png" className="w-4 h-4" alt="Coins" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

const RARITY_WEIGHT = { Mythic: 6, Legendary: 5, Epic: 4, Rare: 3, UnCommon: 2, Common: 1 }

export function CollectionTab({ collection, fetchingCollection, getRarityColor, lastError, onRefresh, user, userStats }) {
  const [debugMode, setDebugMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState('ALL')
  const debugClickCountRef = useRef(0)
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const availableRarities = useMemo(() => (
    ['ALL', ...Object.keys(RARITY_WEIGHT)
      .filter(rarity => collection.some(card => card.rarity === rarity))]
  ), [collection])

  const filteredCollection = useMemo(() => {
    const list = collection.filter(card => {
      const matchesRarity = rarityFilter === 'ALL' || card.rarity === rarityFilter
      const matchesSearch = !deferredSearchQuery || card.name.toLowerCase().includes(deferredSearchQuery)
      return matchesRarity && matchesSearch
    })

    return list.sort((a, b) => {
      if (RARITY_WEIGHT[b.rarity] !== RARITY_WEIGHT[a.rarity]) return RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity]
      return a.name.localeCompare(b.name)
    })
  }, [collection, deferredSearchQuery, rarityFilter])

  const isFiltered = rarityFilter !== 'ALL' || deferredSearchQuery.length > 0

  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <div className="flex flex-row justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2
            className="text-xl font-black tracking-tight cursor-pointer active:scale-95"
            onClick={() => {
              debugClickCountRef.current += 1
              if (debugClickCountRef.current >= 5) {
                debugClickCountRef.current = 0
                setDebugMode(prev => !prev)
              }
            }}
          >
            ТВОЇ ЗДОБУТКИ
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={() => { void onRefresh() }}
              disabled={fetchingCollection}
              className="text-[8px] font-bold text-blue-500/60 uppercase tracking-tighter text-left active:text-blue-400"
            >
              {fetchingCollection ? '⚡ СИНХРОНІЗАЦІЯ...' : '⟳ ОНОВИТИ ДАНІ'}
            </button>
            {lastError && <span className="text-[7px] text-red-500/80 font-bold animate-pulse">! API ERROR</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-500/20">
            {isFiltered ? `${filteredCollection.length} з ${collection.length}` : `${collection.length} / ${userStats.total_cards}`} КАРТ
          </span>
          <span className="text-[10px] font-bold text-slate-500 mr-2">
            ПРОГРЕС: {((collection.length / Math.max(1, userStats.total_cards)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-[1.6rem] border border-slate-700/50 bg-slate-900/40 p-3 shadow-inner">
        <div className="flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Пошук картки..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-black uppercase text-slate-300 active:scale-95"
            >
              Стерти
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {availableRarities.map(rarity => (
            <button
              key={rarity}
              onClick={() => setRarityFilter(rarity)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                rarityFilter === rarity
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-slate-700 bg-slate-800/70 text-slate-400'
              }`}
            >
              {rarity === 'ALL' ? 'Усі' : rarity}
            </button>
          ))}
        </div>
      </div>

      {debugMode && (
        <div className="mb-6 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-[10px] font-mono text-red-200 animate-fade-in relative">
          <button onClick={() => setDebugMode(false)} className="absolute top-2 right-2 text-red-400">✕</button>
          <div className="mb-1 font-bold">--- DIAGNOSTICS ---</div>
          <div>URL: <span className="text-cyan-400 break-all">{BACKEND_URL}</span></div>
          <div>UID: {user?.id}</div>
          <div>LOCAL_COUNT: {collection.length}</div>
          <div>LAST_ERR: {lastError || 'none'}</div>
          <div className="mt-2 text-slate-400 italic">Click "Achievements" title 5 times to show/hide.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pb-20">
        {filteredCollection.map(card => {
          const [rarityTextClass, rarityBorderClass, rarityShadowClass] = getRarityColor(card.rarity).split(' ')

          return (
          <div
            key={card.card_id}
            className={`bg-slate-800/70 backdrop-blur-sm p-2 rounded-[1.45rem] border overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 ${rarityBorderClass} ${rarityShadowClass}`}
          >
            <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
              <span className={`rounded-full border border-black/10 bg-slate-950/85 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${rarityTextClass}`}>
                {card.rarity}
              </span>
              {card.duplicates > 0 ? (
                <span className="rounded-full border border-blue-400/20 bg-blue-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-blue-200">
                  Lvl.{card.duplicates + 1}
                </span>
              ) : null}
            </div>

            <div className="aspect-[3/4] rounded-[1.05rem] overflow-hidden mb-2 bg-slate-900">
              <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-cover grayscale-[0.18] group-hover:grayscale-0 group-hover:scale-[1.03] transition-all duration-500" />
              <div className="pointer-events-none absolute inset-x-2 bottom-[3.4rem] h-16 rounded-full bg-gradient-to-t from-black/30 to-transparent blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <div className="px-1">
              <div className="text-[11px] font-black truncate leading-tight uppercase">
                <span className="truncate block">{card.name}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className={`text-[9px] font-bold ${rarityTextClass}`}>
                  {card.rarity}
                </div>
                <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {card.duplicates > 0 ? `${card.duplicates + 1} copies` : '1 copy'}
                </div>
              </div>
            </div>
            {card.rarity === 'Legendary' && (
              <div className="absolute top-1 right-1 text-xs">⭐</div>
            )}
          </div>
        )})}
        {collection.length === 0 && (
          <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4 opacity-40">
            <div className="text-5xl">🌑</div>
            <div className="text-sm italic font-medium">Твоя колекція поки порожня...</div>
          </div>
        )}
        {collection.length > 0 && filteredCollection.length === 0 && (
          <div className="col-span-2 py-16 text-center flex flex-col items-center gap-3 opacity-70">
            <div className="text-4xl">🔎</div>
            <div className="text-sm font-bold uppercase tracking-tight">Нічого не знайдено</div>
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Зміни фільтр або пошуковий запит</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function LeaderboardTab({ leaderboard, lbMode, loadingLeaderboard, onModeChange, onRefresh, user }) {
  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">Champions Rank</h2>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
            {loadingLeaderboard ? 'Синхронізація...' : 'Топ Гравців UAIFU'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900/60 rounded-xl p-0.5 border border-slate-700/50 backdrop-blur-md">
            {[['spins', '🎯'], ['cards', '💎']].map(([mode, icon]) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lbMode === mode ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-24">
        {loadingLeaderboard && leaderboard.length === 0 ? Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="glass-card flex items-center gap-4 p-5 rounded-[1.8rem] animate-pulse">
            <div className="w-9 h-9 rounded-2xl bg-slate-800/80" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded-lg bg-slate-800" />
              <div className="h-2 w-20 rounded-lg bg-slate-800/60 mt-2" />
            </div>
          </div>
        )) : null}

        {!loadingLeaderboard && leaderboard.length > 0 ? leaderboard.map((player, idx) => (
          <div
            key={player.user_id}
            className={`flex items-center gap-4 p-4.5 rounded-[2rem] border transition-all duration-300 ${
              player.user_id === user?.id
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.15)] scale-[1.02] z-10'
                : 'glass-card border-slate-700/40 hover:border-slate-600/60'
            }`}
          >
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-[13px] border-b-2 ${
              idx === 0 ? 'bg-yellow-400 text-black border-yellow-600 shadow-lg shadow-yellow-500/20' :
              idx === 1 ? 'bg-slate-300 text-slate-800 border-slate-500' :
              idx === 2 ? 'bg-orange-500 text-slate-900 border-orange-700 font-bold' :
              'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className={`font-black text-sm truncate uppercase tracking-tight ${
                idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : 'text-slate-200'
              }`}>
                {player.user_id === user?.id ? 'Це Ти' : (player.name || 'Anonymous')}
              </div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                {player.score.toLocaleString()} <span className="opacity-60">{player.label}</span>
              </div>
            </div>
            {idx < 3 && (
              <div className="text-xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                {idx === 0 ? '👑' : idx === 1 ? '🏆' : '🔥'}
              </div>
            )}
          </div>
        )) : null}

        {!loadingLeaderboard && leaderboard.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-700/60 bg-slate-900/10 py-16 text-center text-slate-500">
            Рейтинг ще порожній. Спробуй оновити пізніше.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function EventsTab({
  claimSeasonTask,
  claimingTask,
  eventsView,
  onEventsViewChange,
  onStartGame,
  season,
  triggerHaptic
}) {
  return (
    <div className="w-full max-w-md animate-fade-in flex-1 flex flex-col">
      {eventsView === 'hub' ? (
        <div className="flex-1 flex flex-col">
          <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-cyan-400">Центр Подій</h2>
          <p className="text-[10px] text-slate-500 mb-5 font-bold tracking-wider">Грай, перемагай та забирай нагороди</p>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                onStartGame()
                triggerHaptic('medium')
              }}
              className="group relative bg-gradient-to-br from-cyan-600/30 to-blue-600/10 border border-cyan-500/40 rounded-[2rem] p-5 overflow-hidden active:scale-95 transition-all cursor-pointer shadow-xl text-left"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">🛸</div>
              <div className="flex flex-col relative z-10">
                <span className="text-[9px] font-black text-cyan-300 uppercase tracking-widest mb-1">Міні-Гра (Активна)</span>
                <span className="text-lg font-black text-white uppercase tracking-tighter text-[16px]">Drone Dash</span>
                <p className="text-[10px] text-cyan-400/70 mt-1 font-bold">1 монета / 5 очок</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onEventsViewChange('season_tasks')
                triggerHaptic('selection')
              }}
              className="group relative bg-gradient-to-br from-blue-600/30 to-purple-600/10 border border-blue-500/40 rounded-[2rem] p-5 overflow-hidden active:scale-95 transition-all cursor-pointer shadow-xl text-left"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">🎯</div>
              <div className="flex flex-col relative z-10">
                <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Активний Сезон</span>
                <span className="text-lg font-black text-white text-[16px]">{season?.season_name || 'Завантаження...'}</span>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 bg-slate-900/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                      style={{ width: season?.active ? `${Math.min(100, (season.tasks.filter(task => task.completed).length / Math.max(1, season.tasks.length)) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-blue-400">{season?.active ? `${season.tasks.filter(task => task.completed).length}/${season.tasks.length}` : '0/0'}</span>
                </div>
              </div>
            </button>

            <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-[2rem] p-6 flex items-center justify-center opacity-40">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Більше івентів у розробці...</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => onEventsViewChange('hub')}
              className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-xs active:scale-90 transition-all"
            >
              ←
            </button>
            <h2 className="text-lg font-black tracking-tight uppercase">{season?.season_name}</h2>
          </div>

          <div className="flex flex-col gap-3 pb-20">
            {season?.tasks.map(task => (
              <div key={task.id} className={`p-4 rounded-[1.5rem] border transition-all ${
                task.claimed ? 'bg-emerald-900/10 border-emerald-500/20 opacity-60' :
                task.completed ? 'bg-blue-900/20 border-blue-500/30' :
                'bg-slate-800/40 border-slate-700/50'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-sm truncate pr-2">{task.title}</div>
                  <div className="text-[10px] font-black text-yellow-500 whitespace-nowrap">+{task.reward_coins}🪙</div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 bg-slate-900/60 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${task.completed ? 'bg-blue-500' : 'bg-slate-700'}`} style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 shrink-0">{task.progress}/{task.target}</span>
                  {task.completed && !task.claimed && (
                    <button
                      onClick={() => claimSeasonTask(task.id)}
                      disabled={claimingTask === task.id}
                      className={`px-3 py-1 text-[9px] font-black rounded-lg active:scale-90 transition-all ${
                        claimingTask === task.id
                          ? 'bg-emerald-900/40 text-emerald-300 cursor-wait'
                          : 'bg-emerald-500 text-black'
                      }`}
                    >
                      {claimingTask === task.id ? '...' : 'OK'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReferralTab({ loadingReferral, referralData, showToast }) {
  const copyReferralLink = async () => {
    try {
      if (!referralData?.link) return
      await navigator.clipboard.writeText(referralData.link)
      showToast('Посилання скопійовано! ✨')
    } catch (error) {
      console.error('Copy referral link failed:', error)
      showToast('Не вдалося скопіювати')
    }
  }

  const milestones = [
    { limit: 5, reward: '10k 🪙' },
    { limit: 10, reward: '25k 🪙' },
    { limit: 25, reward: 'Elite Badge 🛡️' }
  ]

  const count = referralData?.ref_count || 0
  const progressPercent = Math.min(100, (count / 25) * 100)

  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <h2 className="text-xl font-black tracking-tighter mb-1 uppercase italic text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.3)]">Squad Expansion</h2>
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Запрошуй друзів та отримуй бонуси</p>

      <div className="glass-card premium-border rounded-[2rem] p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl">🔗</div>
        <div className="relative z-10">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Твій реферальний код</div>
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-700/50 font-mono text-[11px] text-cyan-300 break-all mb-5 shadow-inner leading-relaxed">
            {loadingReferral ? 'Синхронізація...' : (referralData?.link || 'Генеруємо посилання...')}
          </div>
          <button
            onClick={copyReferralLink}
            disabled={loadingReferral || !referralData?.link}
            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              !loadingReferral && referralData?.link
                ? 'shimmer-btn text-white border border-white/20 active:scale-[0.97]'
                : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {loadingReferral ? 'Завантаження...' : 'Скопіювати Код'}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[2.2rem] p-6 shadow-2xl">
        <div className="flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Твій Прогрес</span>
            <span className="text-2xl font-black text-white mt-1">{count} <span className="text-sm text-slate-500 font-bold uppercase tracking-tight">Друзів</span></span>
          </div>
          <div className="bg-fuchsia-500/10 text-fuchsia-400 text-[10px] font-black px-3 py-1 rounded-full border border-fuchsia-500/20 uppercase tracking-widest">
            Level Up
          </div>
        </div>

        <div className="h-2 rounded-full bg-slate-800/80 mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-600 via-purple-500 to-cyan-400 transition-all duration-1000 shadow-[0_0_12px_rgba(232,121,249,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {milestones.map((m) => (
            <div key={m.limit} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${count >= m.limit ? 'bg-fuchsia-500/10 border-fuchsia-500/30' : 'bg-slate-900/30 border-slate-800/80 opacity-40'}`}>
              <span className="text-[11px] font-black text-white">{m.limit}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-1">{m.reward}</span>
              {count >= m.limit && <div className="mt-1.5 text-[8px] text-fuchsia-400 font-black tracking-widest uppercase">OK</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
