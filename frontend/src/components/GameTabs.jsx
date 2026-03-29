import { useDeferredValue, useMemo, useRef, useState } from 'react'

import { BACKEND_URL } from '../lib/api'

export function HomeView({ formatTime, getRarityColor, isFlipping, loading, result, spin, user, userStats }) {
  const energyReady = userStats.energy > 0

  return (
    <div className="w-full flex flex-col items-center flex-1 justify-center py-1 sm:py-4">
      {user && !result && (
        <div className="mb-4 text-[#a3a3a3] text-xs font-medium text-center">
          Ласкаво просимо, <span className="text-[#ededed] font-semibold">{user.first_name || 'Player'}</span>
        </div>
      )}

      <div className="perspective-1000 relative w-full flex-1 max-h-[42vh] min-h-[320px] aspect-[3/4] max-w-[260px] group sm:aspect-[3/4.2] sm:max-w-[280px] sm:max-h-none">
        <div
          className={`w-full h-full rounded-3xl shadow-lg border transition-transform duration-[800ms] transform-style-3d ${isFlipping ? 'rotate-y-180' : ''} ${result && isFlipping ? getRarityColor(result.rarity) : 'border-[#262626] bg-[#171717]'}`}
          style={{ willChange: 'transform' }}
        >
          <div
            className="absolute inset-0 backface-hidden flex flex-col items-center justify-center gap-6 rounded-3xl bg-[#171717] border border-[#262626]"
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
            <div className="text-xs font-semibold tracking-wider text-[#a3a3a3] text-center uppercase">
              {loading ? <>Тягнемо<br /><span className="text-[#ededed]">картку...</span></> : <>Готовий<br />до крутки</>}
            </div>
          </div>

          <div
            className={`absolute inset-0 backface-hidden flex flex-col p-1.5 rounded-3xl bg-[#171717] border ${result ? getRarityColor(result.rarity) : ''}`}
            style={{ transform: 'rotateY(180deg) translateZ(1px)' }}
          >
            {result && (
              <>
                <div className="flex-1 rounded-[1.25rem] bg-[#0f0f0f] flex items-center justify-center overflow-hidden relative border border-[#262626]">
                  <img src={result.image} alt={result.name} className="w-full h-full object-cover animate-pop-in" />
                  <div className="absolute bottom-4 left-4 right-4 py-2 rounded-xl bg-black/80 text-center backdrop-blur-md">
                    <div className="text-[11px] font-bold text-[#ededed]">{result.name}</div>
                  </div>
                </div>
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#171717] shadow-sm ${getRarityColor(result.rarity)}`}>
                  {result.rarity}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 w-full px-2 flex flex-col items-center">
        <button
          onClick={spin}
          disabled={loading || userStats.energy < 1}
          className={`solid-btn w-full py-3.5 rounded-2xl font-semibold text-sm transition-all sm:py-4 ${(loading || userStats.energy < 1)
            ? 'bg-[#262626] text-[#737373] border border-[#333]'
            : 'bg-[#ededed] text-[#0a0a0a] shadow-sm'
          }`}
        >
          {loading ? 'ЗАВАНТАЖЕННЯ...' : (userStats.energy < 1 ? `⏳ ${formatTime(userStats.next_energy_in_seconds)}` : 'КРУТИТИ')}
        </button>
        <div className="mt-4 flex flex-col items-center gap-1 min-h-8 text-center px-6">
          {result ? (
            <p className="text-xs font-medium text-[#ededed] animate-fade-in">{result.message}</p>
          ) : (
            <p className={`text-xs font-medium ${energyReady ? 'text-[#737373]' : 'text-[#f43f5e]'}`}>
              {energyReady ? '1 спін = 1 випадкова картка' : 'Енергія відновлюється автоматично'}
            </p>
          )}
          {(userStats.pity_counter || 0) > 0 && (
            <div className="text-[10px] font-bold text-[#fbbf24] mt-1 bg-[#fbbf24]/10 px-2 py-0.5 rounded-full border border-[#fbbf24]/20">
              Гарант: {userStats.pity_counter} / 50
            </div>
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
      <h2 className="text-2xl font-bold tracking-tight mb-2 text-[#ededed]">Магазин</h2>
      <p className="text-xs font-medium text-[#a3a3a3] mb-6 text-center">Обмінюй монети на ресурси</p>

      <div className="w-full flat-card p-4 rounded-2xl flex items-center justify-between mb-8">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-[#737373] mb-1">Твій Баланс</span>
          <div className="flex items-center gap-2 text-xl font-bold text-[#fbbf24]">
            {userStats.coins.toLocaleString()}
            <span className="text-xl">🪙</span>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="flat-card rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-[#ededed] mb-1">Енергія (+1)</span>
            <span className="text-xs text-[#a3a3a3]">Миттєве відновлення</span>
          </div>
          <button
            onClick={buyEnergy}
            disabled={!canBuyEnergy}
            className={`solid-btn px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${canBuyEnergy ? 'bg-[#ededed] text-[#0a0a0a]' : 'bg-[#262626] text-[#737373]'}`}
          >
            {energyFull ? (
              'MAX'
            ) : (
              <>
                1,000 <span>🪙</span>
              </>
            )}
          </button>
        </div>

        <div className="flat-card rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-[#fbbf24] mb-1">Преміум Крутка</span>
            <span className="text-xs text-[#a3a3a3]">100% Rare або краще</span>
          </div>
          <button
            onClick={premiumSpin}
            disabled={loading || userStats.coins < 10000}
            className={`solid-btn px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${loading || userStats.coins < 10000 ? 'bg-[#262626] text-[#737373]' : 'bg-[#fbbf24] text-[#0a0a0a]'}`}
          >
            10,000 <span>🪙</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const RARITY_WEIGHT = { Mythic: 6, Legendary: 5, Epic: 4, Rare: 3, UnCommon: 2, Common: 1 }

export function CollectionTab({ collection, fetchingCollection, getRarityColor, lastError, onRefresh, user, userStats, sellDuplicate, loading }) {
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
            className="text-xl font-bold tracking-tight cursor-pointer"
            onClick={() => {
              debugClickCountRef.current += 1
              if (debugClickCountRef.current >= 5) {
                debugClickCountRef.current = 0
                setDebugMode(prev => !prev)
              }
            }}
          >
            Твої картки
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => { void onRefresh() }}
              disabled={fetchingCollection}
              className="text-[10px] font-semibold text-[#60a5fa] hover:text-[#3b82f6]"
            >
              {fetchingCollection ? 'Оновлення...' : 'Оновити дані'}
            </button>
            {lastError && <span className="text-[10px] text-[#f43f5e] font-semibold">Помилка API</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="bg-[#262626] text-[#ededed] text-xs font-medium px-3 py-1 rounded-full">
            {isFiltered ? `${filteredCollection.length} з ${collection.length}` : `${collection.length} / ${userStats.total_cards}`} карток
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Пошук..."
            className="flex-1 rounded-xl border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-[#ededed] outline-none placeholder:text-[#737373] focus:border-[#60a5fa]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="rounded-xl bg-[#262626] px-3 py-2 text-xs font-medium text-[#ededed] active:scale-95"
            >
              Стерти
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mask-right [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {availableRarities.map(rarity => (
            <button
              key={rarity}
              onClick={() => setRarityFilter(rarity)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                rarityFilter === rarity
                  ? 'border-[#ededed] bg-[#ededed] text-[#0a0a0a]'
                  : 'border-[#262626] bg-[#171717] text-[#a3a3a3]'
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
          <div className="mt-2 text-[#a3a3a3] italic">Click title 5 times to toggle.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pb-20">
        {filteredCollection.map(card => {
          const [rarityTextClass, rarityBorderClass] = getRarityColor(card.rarity).split(' ')

          return (
          <div
            key={card.card_id}
            className={`flat-card p-2 rounded-2xl border ${rarityBorderClass}`}
          >
            <div className="flex justify-between items-start mb-2 px-1">
              <span className={`text-[10px] font-bold ${rarityTextClass}`}>
                {card.rarity}
              </span>
              {card.duplicates > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-[#737373]">
                    Lvl: {card.duplicates + 1}
                  </span>
                  <button
                    onClick={() => sellDuplicate(card.card_id)}
                    disabled={loading}
                    className="ml-1 px-1.5 py-0.5 rounded bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-[8px] font-bold uppercase active:scale-95 transition-all disabled:opacity-50"
                  >
                    Продати
                  </button>
                </div>
              )}
            </div>

            <div className="aspect-[3/4] rounded-xl overflow-hidden mb-2 bg-[#0a0a0a] border border-[#262626]">
              <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-cover" />
            </div>
            
            <div className="px-1 py-1">
              <div className="text-xs font-semibold truncate text-[#ededed]">
                {card.name}
              </div>
            </div>
          </div>
        )})}
        
        {collection.length === 0 && (
          <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4 text-[#737373]">
            <div className="text-sm font-medium">Твоя колекція поки порожня...</div>
          </div>
        )}
        
        {collection.length > 0 && filteredCollection.length === 0 && (
          <div className="col-span-2 py-16 text-center flex flex-col items-center gap-2 text-[#737373]">
            <div className="text-sm font-medium">Нічого не знайдено</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function LeaderboardTab({ leaderboard, lbMode, loadingLeaderboard, onModeChange, user }) {
  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#ededed]">Таблиця лідерів</h2>
          <p className="text-xs font-medium text-[#a3a3a3] mt-1">
            {loadingLeaderboard ? 'Завантаження...' : 'Топ Гравців UAIFU'}
          </p>
        </div>
        <div className="flex bg-[#171717] rounded-xl p-1 border border-[#262626]">
          {[['spins', 'Спіни'], ['cards', 'Картки']].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${lbMode === mode ? 'bg-[#262626] text-[#ededed]' : 'text-[#737373]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-24">
        {loadingLeaderboard && leaderboard.length === 0 ? Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flat-card flex items-center gap-4 p-4 rounded-2xl animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-[#262626]" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-[#262626]" />
            </div>
          </div>
        )) : null}

        {!loadingLeaderboard && leaderboard.length > 0 ? leaderboard.map((player, idx) => (
          <div
            key={player.user_id}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              player.user_id === user?.id
                ? 'bg-[#262626] border-[#333]'
                : 'flat-card'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
              idx === 0 ? 'bg-[#fbbf24] text-[#0a0a0a]' :
              idx === 1 ? 'bg-[#a3a3a3] text-[#0a0a0a]' :
              idx === 2 ? 'bg-[#d97706] text-[#0a0a0a]' :
              'bg-[#171717] text-[#737373] border border-[#262626]'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm truncate ${
                idx === 0 ? 'text-[#fbbf24]' : idx === 1 ? 'text-[#e5e5e5]' : idx === 2 ? 'text-[#d97706]' : 'text-[#ededed]'
              }`}>
                {player.user_id === user?.id ? 'Це Ти' : (player.name || 'Anonymous')}
              </div>
              <div className="text-xs text-[#a3a3a3] mt-0.5">
                {player.score.toLocaleString()} {player.label}
              </div>
            </div>
          </div>
        )) : null}

        {!loadingLeaderboard && leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#262626] bg-[#171717] py-12 text-center text-[#737373] text-sm font-medium">
            Рейтинг ще порожній.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function EventsTab({ claimSeasonTask, claimingTask, eventsView, onEventsViewChange, onStartGame, season, triggerHaptic }) {
  return (
    <div className="w-full max-w-md animate-fade-in flex-1 flex flex-col">
      {eventsView === 'hub' ? (
        <div className="flex-1 flex flex-col">
          <h2 className="text-xl font-bold tracking-tight mb-2 text-[#ededed]">Події</h2>
          <p className="text-xs font-medium text-[#a3a3a3] mb-5">Додаткові нагороди</p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                onStartGame()
                triggerHaptic('medium')
              }}
              className="flat-card rounded-2xl p-5 text-left active:scale-95 transition-all"
            >
              <span className="text-xs font-semibold text-[#60a5fa] mb-1 block">Міні-гра</span>
              <span className="text-lg font-bold text-[#ededed]">Drone Dash</span>
              <p className="text-xs text-[#a3a3a3] mt-2">1 монета за 5 очок</p>
            </button>

            <button
              type="button"
              onClick={() => {
                onEventsViewChange('season_tasks')
                triggerHaptic('selection')
              }}
              className="flat-card rounded-2xl p-5 text-left active:scale-95 transition-all"
            >
              <span className="text-xs font-semibold text-[#c084fc] mb-1 block">Активний сезон</span>
              <span className="text-lg font-bold text-[#ededed]">{season?.season_name || 'Завантаження...'}</span>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 bg-[#262626] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#c084fc] rounded-full"
                    style={{ width: season?.active ? `${Math.min(100, (season.tasks.filter(task => task.completed).length / Math.max(1, season.tasks.length)) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#a3a3a3]">{season?.active ? `${season.tasks.filter(task => task.completed).length}/${season.tasks.length}` : '0/0'}</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => onEventsViewChange('hub')}
              className="p-2 bg-[#262626] rounded-xl text-[#ededed] active:scale-90 transition-all font-semibold"
            >
              ←
            </button>
            <h2 className="text-lg font-bold tracking-tight text-[#ededed]">{season?.season_name}</h2>
          </div>

          <div className="flex flex-col gap-3 pb-20">
            {season?.tasks.map(task => (
              <div key={task.id} className="flat-card p-4 rounded-2xl">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-semibold text-sm text-[#ededed] pr-2">{task.title}</div>
                  <div className="text-xs font-bold text-[#fbbf24] whitespace-nowrap">+{task.reward_coins}🪙</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#262626] rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-[#60a5fa] transition-all" style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#a3a3a3] shrink-0">{task.progress}/{task.target}</span>
                  {task.completed && !task.claimed && (
                    <button
                      onClick={() => claimSeasonTask(task.id)}
                      disabled={claimingTask === task.id}
                      className={`solid-btn px-4 py-1.5 text-xs font-semibold rounded-xl ${
                        claimingTask === task.id ? 'opacity-50' : ''
                      }`}
                    >
                      {claimingTask === task.id ? 'ЗАЧЕКАЙ...' : 'ЗАБРАТИ'}
                    </button>
                  )}
                  {task.claimed && (
                    <span className="text-xs font-medium text-[#34d399]">Зібрано</span>
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

  const count = referralData?.ref_count || 0

  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <h2 className="text-xl font-bold tracking-tight mb-2 text-[#ededed]">Запрошення</h2>
      <p className="text-xs font-medium text-[#a3a3a3] mb-6">Запрошуй друзів</p>

      <div className="flat-card rounded-2xl p-5 mb-6">
        <div className="text-xs font-semibold text-[#737373] mb-2">Твоє посилання</div>
        <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#262626] font-mono text-xs text-[#a3a3a3] break-all mb-4">
          {loadingReferral ? 'Завантаження...' : (referralData?.link || 'Генерується...')}
        </div>
        <button
          onClick={copyReferralLink}
          disabled={loadingReferral || !referralData?.link}
          className="solid-btn w-full py-3 rounded-xl font-semibold text-sm"
        >
          {loadingReferral ? 'Завантаження...' : 'Скопіювати'}
        </button>
      </div>

      <div className="flat-card rounded-2xl p-5">
        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#737373] mb-1">Запрошено друзів</span>
            <span className="text-2xl font-bold text-[#ededed]">{count}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
