export default function LeaderboardTab({ leaderboard, lbMode, loadingLeaderboard, onModeChange, user }) {
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
              idx === 0 ? 'bg-[#fbbf24] text-[#0a0a0a]'
                : idx === 1 ? 'bg-[#a3a3a3] text-[#0a0a0a]'
                  : idx === 2 ? 'bg-[#d97706] text-[#0a0a0a]'
                    : 'bg-[#171717] text-[#737373] border border-[#262626]'
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
