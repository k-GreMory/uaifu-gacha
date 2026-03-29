import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from 'react'

import { AppHeader, ToastBanner, TopStatsBar } from './components/AppChrome'
import {
  CollectionTab,
  EventsTab,
  HomeView,
  LeaderboardTab,
  ReferralTab,
  ShopTab
} from './components/GameTabs'
import { useGameData } from './hooks/useGameData'
import { useTelegramSession } from './hooks/useTelegramSession'
import { useToast } from './hooks/useToast'

const DroneGame = lazy(() => import('./components/DroneGame'))

const TAB_STORAGE_KEY = 'uaifu_active_tab'
const VALID_TABS = new Set(['home', 'collection', 'shop', 'leaderboard', 'events', 'referral'])

function FullscreenMessage({ description, icon, loading, title }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0a0a0a] px-6 text-[#ededed]">
      <div className="max-w-sm rounded-2xl border border-[#262626] bg-[#171717] p-6 text-center">
        {loading ? (
          <div className="mb-4 mx-auto h-8 w-8 rounded-full border-2 border-[#333] border-t-[#ededed] animate-spin" />
        ) : (
          <div className="mb-3 text-4xl">{icon}</div>
        )}
        <h1 className="mb-2 text-lg font-semibold">{title}</h1>
        <p className="text-sm text-[#a3a3a3]">{description}</p>
      </div>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY)
    return VALID_TABS.has(savedTab) ? savedTab : 'home'
  })
  const [eventsView, setEventsView] = useState('hub')
  const [gameActive, setGameActive] = useState(false)
  const [lbMode, setLbMode] = useState('spins')

  const { toast, showToast } = useToast()
  const { user, isSessionBootstrapping, telegramStartParam, triggerHaptic } = useTelegramSession(showToast)

  const changeTab = useCallback((tab) => {
    startTransition(() => {
      setActiveTab(tab)
      if (tab !== 'events') {
        setEventsView('hub')
      }
    })
  }, [])

  const {
    result,
    loading,
    userStats,
    collection,
    isFlipping,
    leaderboard,
    loadingLeaderboard,
    season,
    referralData,
    loadingReferral,
    claimingTask,
    fetchingCollection,
    lastError,
    buyEnergy,
    claimSeasonTask,
    fetchCollection,
    fetchLeaderboard,
    fetchReferral,
    fetchSeason,
    fetchUserStats,
    premiumSpin,
    refreshCollection,
    sellDuplicate,
    spin
  } = useGameData({
    onGoHome: () => changeTab('home'),
    showToast,
    telegramStartParam,
    triggerHaptic,
    user
  })

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  useEffect(() => {
    const syncActiveTab = async () => {
      if (activeTab === 'collection' && user?.id) {
        await fetchCollection(user.id)
      }

      if (activeTab === 'leaderboard') {
        await fetchLeaderboard(lbMode)
      }

      if (activeTab === 'events' && user?.id) {
        await fetchSeason(user.id)
      }

      if (activeTab === 'referral' && user?.id) {
        await fetchReferral(user.id)
      }
    }

    void syncActiveTab()
  }, [activeTab, fetchCollection, fetchLeaderboard, fetchReferral, fetchSeason, lbMode, user?.id])

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Mythic': return 'text-[#f43f5e] border-[#f43f5e]'
      case 'Legendary': return 'text-[#fbbf24] border-[#fbbf24]'
      case 'Epic': return 'text-[#c084fc] border-[#c084fc]'
      case 'Rare': return 'text-[#60a5fa] border-[#60a5fa]'
      case 'UnCommon': return 'text-[#34d399] border-[#34d399]'
      default: return 'text-[#a3a3a3] border-[#a3a3a3]'
    }
  }

  if (!user) {
    if (isSessionBootstrapping) {
      return (
        <FullscreenMessage
          loading
          title="Підключаємо профіль"
          description="Завантажуємо Telegram-сесію та синхронізуємо твої дані."
        />
      )
    }

    return (
      <FullscreenMessage
        icon="🔒"
        title="Потрібна Telegram сесія"
        description="Перевідкрий цю апку в Telegram, щоб підтягнути профіль."
      />
    )
  }

  if (gameActive) {
    return (
      <Suspense
        fallback={(
          <FullscreenMessage
            loading
            title="Запускаємо Drone Dash"
            description="Підвантажуємо міні-гру й синхронізуємо нагороди."
          />
        )}
      >
        <DroneGame
          user={user}
          triggerHaptic={triggerHaptic}
          onClose={() => {
            setGameActive(false)
            void fetchUserStats()
          }}
        />
      </Suspense>
    )
  }

  let content
  if (activeTab === 'shop') {
    content = (
      <ShopTab
        buyEnergy={buyEnergy}
        loading={loading}
        premiumSpin={premiumSpin}
        userStats={userStats}
      />
    )
  } else if (activeTab === 'collection') {
    content = (
      <CollectionTab
        collection={collection}
        fetchingCollection={fetchingCollection}
        getRarityColor={getRarityColor}
        lastError={lastError}
        onRefresh={refreshCollection}
        user={user}
        userStats={userStats}
        sellDuplicate={sellDuplicate}
        loading={loading}
      />
    )
  } else if (activeTab === 'leaderboard') {
    content = (
      <LeaderboardTab
        leaderboard={leaderboard}
        lbMode={lbMode}
        loadingLeaderboard={loadingLeaderboard}
        onModeChange={setLbMode}
        user={user}
      />
    )
  } else if (activeTab === 'events') {
    content = (
      <EventsTab
        claimSeasonTask={claimSeasonTask}
        claimingTask={claimingTask}
        eventsView={eventsView}
        onEventsViewChange={setEventsView}
        onStartGame={() => setGameActive(true)}
        season={season}
        triggerHaptic={triggerHaptic}
      />
    )
  } else if (activeTab === 'referral') {
    content = (
      <ReferralTab
        loadingReferral={loadingReferral}
        referralData={referralData}
        showToast={showToast}
      />
    )
  } else {
    content = (
      <HomeView
        formatTime={formatTime}
        getRarityColor={getRarityColor}
        isFlipping={isFlipping}
        loading={loading}
        result={result}
        spin={spin}
        user={user}
        userStats={userStats}
      />
    )
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-x-hidden p-2.5 text-[#ededed] bg-[#0a0a0a] sm:p-5 font-sans select-none">
      <ToastBanner toast={toast} />

      <div className="app-frame mx-auto flex w-full max-w-lg flex-1 flex-col items-center rounded-2xl px-2.5 pb-5 pt-4 sm:px-4 sm:pt-5 bg-[#0a0a0a]">
        <AppHeader
          activeTab={activeTab}
          onTabChange={changeTab}
          triggerHaptic={triggerHaptic}
        />

        {activeTab === 'home' && (
          <TopStatsBar
            formatTime={formatTime}
            userStats={userStats}
          />
        )}

        {content}
      </div>
    </div>
  )
}

export default App
