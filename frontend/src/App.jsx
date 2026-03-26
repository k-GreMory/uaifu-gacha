import { startTransition, useCallback, useEffect, useRef, useState } from 'react'

import './App.css'
import { AppHeader, ToastBanner, TopStatsBar } from './components/AppChrome'
import DroneGame from './components/DroneGame'
import {
  CollectionTab,
  EventsTab,
  HomeView,
  LeaderboardTab,
  ReferralTab,
  ShopTab
} from './components/GameTabs'
import {
  buyEnergyRequest,
  claimReferral,
  claimSeasonTaskRequest,
  fetchCollectionData,
  fetchLeaderboardData,
  fetchReferralData,
  fetchSeasonData,
  fetchUserStateData,
  premiumSpinRequest,
  spinRequest
} from './lib/api'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const TAB_STORAGE_KEY = 'uaifu_active_tab'
const VALID_TABS = new Set(['home', 'collection', 'shop', 'leaderboard', 'events', 'referral'])

const parseTelegramInitData = (initData = '') => {
  if (!initData) {
    return { user: null, startParam: '' }
  }

  const params = new URLSearchParams(initData)
  let user = null

  const userParam = params.get('user')
  if (userParam) {
    try {
      user = JSON.parse(userParam)
    } catch (error) {
      console.error('Failed to parse Telegram initData user:', error)
    }
  }

  return {
    user,
    startParam: params.get('start_param') || ''
  }
}

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [isSessionBootstrapping, setIsSessionBootstrapping] = useState(true)
  const [telegramStartParam, setTelegramStartParam] = useState('')
  const [userStats, setUserStats] = useState({ energy: 0, max_energy: 20, coins: 0, next_energy_in_seconds: 0, total_cards: 200 })
  const [collection, setCollection] = useState([])
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY)
    return VALID_TABS.has(savedTab) ? savedTab : 'home'
  })
  const [eventsView, setEventsView] = useState('hub')
  const [isFlipping, setIsFlipping] = useState(false)
  const [toast, setToast] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbMode, setLbMode] = useState('spins')
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [season, setSeason] = useState(null)
  const [referralData, setReferralData] = useState(null)
  const [loadingReferral, setLoadingReferral] = useState(false)
  const [claimingTask, setClaimingTask] = useState(null)
  const [fetchingCollection, setFetchingCollection] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [gameActive, setGameActive] = useState(false)
  const toastTimeoutRef = useRef(null)
  const collectionFetchInFlightRef = useRef(false)

  const triggerHaptic = (type = 'light') => {
    const haptic = window.Telegram?.WebApp?.HapticFeedback
    if (!haptic) return

    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(type)) {
      haptic.impactOccurred(type)
    } else if (['error', 'success', 'warning'].includes(type)) {
      haptic.notificationOccurred(type)
    } else if (type === 'selection') {
      haptic.selectionChanged()
    }
  }

  const updateStats = (data) => {
    if (!data) return

    setUserStats(prev => ({
      ...prev,
      ...data
    }))
  }

  const getApiErrorMessage = useCallback((error, fallback = 'Помилка мережі') => (
    error.response?.data?.detail || error.message || fallback
  ), [])

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    setToast(message)
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 3000)
  }, [])

  const syncPulledCard = (spinData) => {
    setCollection(prev => {
      const existing = prev.find(card => card.card_id === spinData.card_id)
      if (existing) {
        return prev.map(card => (
          card.card_id === spinData.card_id
            ? { ...card, duplicates: spinData.new_level - 1 }
            : card
        ))
      }

      return [
        ...prev,
        {
          card_id: spinData.card_id,
          name: spinData.name,
          rarity: spinData.rarity,
          image: spinData.image,
          duplicates: 0,
          acquired_at: new Date().toISOString()
        }
      ]
    })
  }

  const applySpinResult = (spinData) => {
    setResult(spinData)
    updateStats(spinData.user_stats)
    syncPulledCard(spinData)
  }

  const changeTab = useCallback((tab) => {
    startTransition(() => {
      setActiveTab(tab)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    const parsed = parseTelegramInitData(tg?.initData || '')

    if (tg) {
      tg.ready()
      tg.expand()
    }

    const telegramUser = tg?.initDataUnsafe?.user || parsed.user
    const startParam = tg?.initDataUnsafe?.start_param || parsed.startParam || ''

    if (telegramUser?.id) {
      setUser(telegramUser)
      setTelegramStartParam(startParam)
    } else if (LOCAL_HOSTS.has(window.location.hostname)) {
      setUser({ first_name: 'Гість (Dev Mode)', id: 12345678 })
      setTelegramStartParam('')
    } else {
      setUser(null)
      setTelegramStartParam('')
      showToast('Не вдалося підтвердити Telegram-сесію. Перевідкрий мініапку.')
    }

    setIsSessionBootstrapping(false)
  }, [showToast])

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  const fetchCollection = useCallback(async (userId = user?.id) => {
    if (!userId || collectionFetchInFlightRef.current) return

    collectionFetchInFlightRef.current = true
    setFetchingCollection(true)
    try {
      setLastError(null)
      setCollection(await fetchCollectionData())
    } catch (error) {
      console.error('Error fetching collection:', error)
      const msg = error.response?.data?.detail || error.message || 'Network Error'
      setLastError(msg)
      showToast(`Помилка: ${msg}`)
    } finally {
      collectionFetchInFlightRef.current = false
      setFetchingCollection(false)
    }
  }, [showToast, user])

  const fetchLeaderboard = useCallback(async (mode = lbMode) => {
    setLoadingLeaderboard(true)
    try {
      setLeaderboard(await fetchLeaderboardData(mode))
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      showToast(getApiErrorMessage(error, 'Не вдалося оновити лідерборд'))
    } finally {
      setLoadingLeaderboard(false)
    }
  }, [getApiErrorMessage, lbMode, showToast])

  const fetchSeason = useCallback(async (userId = user?.id) => {
    if (!userId) return

    try {
      setSeason(await fetchSeasonData())
    } catch (error) {
      console.error('Error fetching season:', error)
      const msg = getApiErrorMessage(error, 'Не вдалося завантажити сезон')
      if (error.response?.status === 401) {
        showToast(msg)
      }
    }
  }, [getApiErrorMessage, showToast, user])

  const fetchReferral = useCallback(async (userId = user?.id) => {
    if (!userId) return

    setLoadingReferral(true)
    try {
      setReferralData(await fetchReferralData())
    } catch (error) {
      console.error('Error fetching referral data:', error)
      if (error.response?.status === 401) {
        showToast(getApiErrorMessage(error, 'Не вдалося завантажити реферали'))
      }
    } finally {
      setLoadingReferral(false)
    }
  }, [getApiErrorMessage, showToast, user])

  const fetchUserStats = useCallback(async (currentUser = user) => {
    if (!currentUser) return

    try {
      setUserStats(await fetchUserStateData())
    } catch (error) {
      console.error('Error fetching user stats:', error)
      showToast(getApiErrorMessage(error, 'Не вдалося оновити профіль'))
    }
  }, [getApiErrorMessage, showToast, user])

  const claimSeasonTask = async (taskId) => {
    if (!user) return

    setClaimingTask(taskId)
    triggerHaptic('selection')
    try {
      const response = await claimSeasonTaskRequest(taskId)
      showToast(response.data.message)
      updateStats(response.data.user_stats)
      await fetchSeason(user.id)
    } catch (error) {
      showToast(error.response?.data?.detail || 'Помилка')
    } finally {
      setClaimingTask(null)
    }
  }

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
  }, [activeTab, fetchCollection, fetchLeaderboard, fetchReferral, fetchSeason, lbMode, user])

  useEffect(() => {
    if (activeTab !== 'events' && eventsView !== 'hub') {
      setEventsView('hub')
    }
  }, [activeTab, eventsView])

  useEffect(() => {
    if (!user) return

    const initializeUser = async () => {
      await fetchUserStats(user)
      await fetchCollection(user.id)

      const startParam = telegramStartParam
      if (startParam.startsWith('ref_')) {
        const refId = parseInt(startParam.replace('ref_', ''), 10)
        if (refId && refId !== user.id) {
          claimReferral(refId)
            .then(response => showToast(response.data.message))
            .catch(() => {})
        }
      }
    }

    void initializeUser()
  }, [fetchCollection, fetchUserStats, showToast, telegramStartParam, user])

  useEffect(() => {
    if (!user) return

    let refreshTimeoutId = null
    const timer = setInterval(() => {
      setUserStats(prev => {
        if (prev.next_energy_in_seconds <= 0) return prev

        const newTime = prev.next_energy_in_seconds - 1
        if (newTime === 0) {
          refreshTimeoutId = setTimeout(async () => {
            try {
              setUserStats(await fetchUserStateData())
            } catch (error) {
              console.error('Error refreshing user stats:', error)
            }
          }, 1000)
        }

        return { ...prev, next_energy_in_seconds: newTime }
      })
    }, 1000)

    return () => {
      clearInterval(timer)
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId)
      }
    }
  }, [user])

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const spin = async () => {
    if (!user) return
    if (userStats.energy < 1) {
      showToast('Недостатньо енергії! Зачекай поки відновиться ⚡')
      return
    }

    setResult(null)
    setIsFlipping(false)
    setLoading(true)
    triggerHaptic('light')

    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 1400))
      const [response] = await Promise.all([
        spinRequest(),
        minDelay
      ])

      applySpinResult(response.data)

      setTimeout(() => {
        setIsFlipping(true)
        if (['Legendary', 'Mythic'].includes(response.data.rarity)) {
          triggerHaptic('success')
        } else {
          triggerHaptic('medium')
        }
      }, 100)
    } catch (error) {
      console.error('Error spinning:', error)
      showToast(error.response?.data?.detail || error.message)
    } finally {
      setLoading(false)
    }
  }

  const buyEnergy = async () => {
    if (!user) return
    if (userStats.energy >= userStats.max_energy) {
      showToast('Енергія вже повна! Спочатку витрать хоча б 1 ⚡')
      return
    }
    if (userStats.coins < 1000) {
      showToast('Недостатньо монет! Потрібно 1,000 🪙')
      return
    }

    setLoading(true)
    triggerHaptic('medium')
    try {
      const response = await buyEnergyRequest()
      showToast(response.data.message)
      updateStats(response.data.user_stats)
    } catch (error) {
      showToast(error.response?.data?.detail || 'Помилка покупки')
    } finally {
      setLoading(false)
    }
  }

  const premiumSpin = async () => {
    if (!user) return
    if (userStats.coins < 10000) {
      showToast('Недостатньо монет! Потрібно 10,000 🪙')
      return
    }

    setResult(null)
    setIsFlipping(false)
    setLoading(true)
    triggerHaptic('heavy')
    changeTab('home')

    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 1400))
      const [response] = await Promise.all([
        premiumSpinRequest(),
        minDelay
      ])

      applySpinResult(response.data)
      setTimeout(() => setIsFlipping(true), 100)

      if (response.data.message) {
        showToast(response.data.message)
      }
    } catch (error) {
      showToast(error.response?.data?.detail || 'Помилка покупки')
    } finally {
      setLoading(false)
    }
  }

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Mythic': return 'text-rose-500 border-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]'
      case 'Legendary': return 'text-yellow-400 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]'
      case 'Epic': return 'text-fuchsia-400 border-fuchsia-500 shadow-fuchsia-500/30'
      case 'Rare': return 'text-blue-400 border-blue-500 shadow-blue-500/20'
      case 'UnCommon': return 'text-emerald-400 border-emerald-500 shadow-emerald-500/10'
      default: return 'text-slate-300 border-slate-600 shadow-slate-500/10'
    }
  }

  if (!user) {
    if (isSessionBootstrapping) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0f172a] px-6 text-white">
          <div className="max-w-sm rounded-[2rem] border border-slate-700/60 bg-slate-900/70 p-6 text-center shadow-2xl">
            <div className="mb-4 mx-auto h-12 w-12 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin" />
            <h1 className="mb-2 text-lg font-black uppercase tracking-tight">Підключаємо профіль</h1>
            <p className="text-sm text-slate-300">
              Завантажуємо Telegram-сесію та синхронізуємо твої дані.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0f172a] px-6 text-white">
        <div className="max-w-sm rounded-[2rem] border border-slate-700/60 bg-slate-900/70 p-6 text-center shadow-2xl">
          <div className="mb-3 text-4xl">🔒</div>
          <h1 className="mb-2 text-lg font-black uppercase tracking-tight">Telegram Session Needed</h1>
          <p className="text-sm text-slate-300">
            Перевідкрий цю мініапку прямо в Telegram, щоб підтягнути твій профіль і колекцію.
          </p>
        </div>
      </div>
    )
  }

  if (gameActive) {
    return (
      <DroneGame
        user={user}
        triggerHaptic={triggerHaptic}
        onClose={() => {
          setGameActive(false)
          void fetchUserStats()
        }}
      />
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
        onRefresh={fetchCollection}
        user={user}
        userStats={userStats}
      />
    )
  } else if (activeTab === 'leaderboard') {
    content = (
      <LeaderboardTab
        leaderboard={leaderboard}
        lbMode={lbMode}
        loadingLeaderboard={loadingLeaderboard}
        onModeChange={setLbMode}
        onRefresh={fetchLeaderboard}
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
    <div className="flex flex-col items-center min-h-screen w-full bg-[#0f172a] text-white p-3 sm:p-5 font-sans select-none overflow-x-hidden relative">
      <ToastBanner toast={toast} />

      <div className="w-full flex flex-col items-center flex-1 max-w-lg mx-auto">
        <AppHeader
          activeTab={activeTab}
          onTabChange={changeTab}
          triggerHaptic={triggerHaptic}
        />

        {activeTab === 'home' && (
          <TopStatsBar
            collection={collection}
            fetchingCollection={fetchingCollection}
            formatTime={formatTime}
            onOpenCollection={() => changeTab('collection')}
            userStats={userStats}
          />
        )}

        {content}
      </div>
    </div>
  )
}

export default App
