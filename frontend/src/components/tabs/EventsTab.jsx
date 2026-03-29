export default function EventsTab({ claimSeasonTask, claimingTask, eventsView, onEventsViewChange, onStartGame, season, triggerHaptic }) {
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
