import { useDeferredValue, useMemo, useRef, useState } from 'react'

import { BACKEND_URL } from '../../lib/api'

const RARITY_WEIGHT = { Mythic: 6, Legendary: 5, Epic: 4, Rare: 3, UnCommon: 2, Common: 1 }

export default function CollectionTab({ collection, fetchingCollection, getRarityColor, lastError, onRefresh, user, userStats, sellDuplicate, loading }) {
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
          )
        })}

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
