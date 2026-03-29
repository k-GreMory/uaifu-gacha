export default function ShopTab({ buyEnergy, loading, premiumSpin, userStats }) {
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
