export default function HomeView({ formatTime, getRarityColor, isFlipping, loading, result, spin, user, userStats }) {
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
