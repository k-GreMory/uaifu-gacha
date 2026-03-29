import { useCallback, useEffect, useRef, useState } from 'react'

import {
  buyEnergyRequest,
  claimDailyReward,
  claimReferral,
  claimSeasonTaskRequest,
  fetchCollectionData,
  fetchLeaderboardData,
  fetchReferralData,
  fetchSeasonData,
  fetchUserStateData,
  premiumSpinRequest,
  sellDuplicateCard,
  spinRequest
} from '../lib/api'

const CACHE_TTL_MS = {
  collection: 30000,
  leaderboard: 15000,
  season: 20000,
  referral: 30000
}

const DEFAULT_USER_STATS = {
  energy: 0,
  max_energy: 20,
  coins: 0,
  next_energy_in_seconds: 0,
  total_cards: 200
}

export function useGameData({ onGoHome, showToast, telegramStartParam, triggerHaptic, user }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [userStats, setUserStats] = useState(DEFAULT_USER_STATS)
  const [collection, setCollection] = useState([])
  const [isFlipping, setIsFlipping] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [season, setSeason] = useState(null)
  const [referralData, setReferralData] = useState(null)
  const [loadingReferral, setLoadingReferral] = useState(false)
  const [claimingTask, setClaimingTask] = useState(null)
  const [fetchingCollection, setFetchingCollection] = useState(false)
  const [lastError, setLastError] = useState(null)

  const collectionFetchInFlightRef = useRef(false)
  const leaderboardFetchInFlightRef = useRef(false)
  const seasonFetchInFlightRef = useRef(false)
  const referralFetchInFlightRef = useRef(false)
  const processedReferralRef = useRef(new Set())
  const dailyClaimInFlightRef = useRef(false)
  const collectionCacheRef = useRef({ userId: null, fetchedAt: 0, loaded: false })
  const leaderboardCacheRef = useRef({ mode: null, fetchedAt: 0, loaded: false })
  const seasonCacheRef = useRef({ userId: null, fetchedAt: 0, loaded: false })
  const referralCacheRef = useRef({ userId: null, fetchedAt: 0, loaded: false })

  const getApiErrorMessage = useCallback((error, fallback = 'Помилка мережі') => (
    error.response?.data?.detail || error.message || fallback
  ), [])

  const updateStats = useCallback((data) => {
    if (!data) return

    setUserStats(prev => ({
      ...prev,
      ...data
    }))
  }, [])

  const invalidateLeaderboardCache = useCallback(() => {
    leaderboardCacheRef.current = { mode: null, fetchedAt: 0, loaded: false }
  }, [])

  const invalidateSeasonCache = useCallback(() => {
    seasonCacheRef.current = { userId: null, fetchedAt: 0, loaded: false }
  }, [])

  const syncPulledCard = useCallback((spinData) => {
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
  }, [])

  const applySpinResult = useCallback((spinData) => {
    setResult(spinData)
    updateStats(spinData.user_stats)
    syncPulledCard(spinData)
    invalidateLeaderboardCache()
    invalidateSeasonCache()
  }, [invalidateLeaderboardCache, invalidateSeasonCache, syncPulledCard, updateStats])

  const isCacheFresh = useCallback((fetchedAt, ttlMs) => (
    fetchedAt > 0 && (Date.now() - fetchedAt) < ttlMs
  ), [])

  useEffect(() => {
    collectionCacheRef.current = { userId: null, fetchedAt: 0, loaded: false }
    leaderboardCacheRef.current = { mode: null, fetchedAt: 0, loaded: false }
    seasonCacheRef.current = { userId: null, fetchedAt: 0, loaded: false }
    referralCacheRef.current = { userId: null, fetchedAt: 0, loaded: false }
    collectionFetchInFlightRef.current = false
    leaderboardFetchInFlightRef.current = false
    seasonFetchInFlightRef.current = false
    referralFetchInFlightRef.current = false
    processedReferralRef.current = new Set()
    dailyClaimInFlightRef.current = false
    setCollection([])
    setLeaderboard([])
    setSeason(null)
    setReferralData(null)
    setLastError(null)
    setResult(null)
    setIsFlipping(false)
    setLoading(false)
    setClaimingTask(null)
    setLoadingLeaderboard(false)
    setLoadingReferral(false)
    setFetchingCollection(false)
    setUserStats(DEFAULT_USER_STATS)
  }, [user?.id])

  const fetchCollection = useCallback(async (userId = user?.id, { force = false } = {}) => {
    if (!userId || collectionFetchInFlightRef.current) return

    const cached = collectionCacheRef.current
    if (!force && cached.loaded && cached.userId === userId && isCacheFresh(cached.fetchedAt, CACHE_TTL_MS.collection)) {
      return
    }

    collectionFetchInFlightRef.current = true
    setFetchingCollection(true)
    try {
      setLastError(null)
      setCollection(await fetchCollectionData())
      collectionCacheRef.current = { userId, fetchedAt: Date.now(), loaded: true }
    } catch (error) {
      console.error('Error fetching collection:', error)
      const message = getApiErrorMessage(error, 'Не вдалося завантажити колекцію')
      setLastError(message)
      showToast(`Помилка: ${message}`)
    } finally {
      collectionFetchInFlightRef.current = false
      setFetchingCollection(false)
    }
  }, [getApiErrorMessage, isCacheFresh, showToast, user?.id])

  const fetchLeaderboard = useCallback(async (mode, { force = false } = {}) => {
    const cached = leaderboardCacheRef.current
    if (leaderboardFetchInFlightRef.current) return
    if (!force && cached.loaded && cached.mode === mode && isCacheFresh(cached.fetchedAt, CACHE_TTL_MS.leaderboard)) {
      return
    }

    leaderboardFetchInFlightRef.current = true
    setLoadingLeaderboard(true)
    try {
      setLeaderboard(await fetchLeaderboardData(mode))
      leaderboardCacheRef.current = { mode, fetchedAt: Date.now(), loaded: true }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      showToast(getApiErrorMessage(error, 'Не вдалося оновити лідерборд'))
    } finally {
      leaderboardFetchInFlightRef.current = false
      setLoadingLeaderboard(false)
    }
  }, [getApiErrorMessage, isCacheFresh, showToast])

  const fetchSeason = useCallback(async (userId = user?.id, { force = false } = {}) => {
    if (!userId) return

    const cached = seasonCacheRef.current
    if (seasonFetchInFlightRef.current) return
    if (!force && cached.loaded && cached.userId === userId && isCacheFresh(cached.fetchedAt, CACHE_TTL_MS.season)) {
      return
    }

    seasonFetchInFlightRef.current = true
    try {
      setSeason(await fetchSeasonData())
      seasonCacheRef.current = { userId, fetchedAt: Date.now(), loaded: true }
    } catch (error) {
      console.error('Error fetching season:', error)
      const message = getApiErrorMessage(error, 'Не вдалося завантажити сезон')
      if (error.response?.status === 401) {
        showToast(message)
      }
    } finally {
      seasonFetchInFlightRef.current = false
    }
  }, [getApiErrorMessage, isCacheFresh, showToast, user?.id])

  const fetchReferral = useCallback(async (userId = user?.id, { force = false } = {}) => {
    if (!userId) return

    const cached = referralCacheRef.current
    if (referralFetchInFlightRef.current) return
    if (!force && cached.loaded && cached.userId === userId && isCacheFresh(cached.fetchedAt, CACHE_TTL_MS.referral)) {
      return
    }

    referralFetchInFlightRef.current = true
    setLoadingReferral(true)
    try {
      setReferralData(await fetchReferralData())
      referralCacheRef.current = { userId, fetchedAt: Date.now(), loaded: true }
    } catch (error) {
      console.error('Error fetching referral data:', error)
      if (error.response?.status === 401) {
        showToast(getApiErrorMessage(error, 'Не вдалося завантажити реферали'))
      }
    } finally {
      referralFetchInFlightRef.current = false
      setLoadingReferral(false)
    }
  }, [getApiErrorMessage, isCacheFresh, showToast, user?.id])

  const fetchUserStats = useCallback(async (currentUser = user) => {
    if (!currentUser) return

    try {
      setUserStats(await fetchUserStateData())
    } catch (error) {
      console.error('Error fetching user stats:', error)
      showToast(getApiErrorMessage(error, 'Не вдалося оновити профіль'))
    }
  }, [getApiErrorMessage, showToast, user])

  const refreshCollection = useCallback(() => (
    fetchCollection(user?.id, { force: true })
  ), [fetchCollection, user?.id])

  const claimSeasonTask = useCallback(async (taskId) => {
    if (!user) return

    setClaimingTask(taskId)
    triggerHaptic('selection')
    try {
      const response = await claimSeasonTaskRequest(taskId)
      showToast(response.data.message)
      updateStats(response.data.user_stats)
      invalidateSeasonCache()
      await fetchSeason(user.id, { force: true })
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Помилка'))
    } finally {
      setClaimingTask(null)
    }
  }, [fetchSeason, getApiErrorMessage, invalidateSeasonCache, showToast, triggerHaptic, updateStats, user])

  useEffect(() => {
    if (!user) return

    const initializeUser = async () => {
      await fetchUserStats(user)

      if (!telegramStartParam.startsWith('ref_')) {
        return
      }

      const refId = parseInt(telegramStartParam.replace('ref_', ''), 10)
      if (!refId || refId === user.id || processedReferralRef.current.has(telegramStartParam)) {
        return
      }

      try {
        const response = await claimReferral(refId)
        processedReferralRef.current.add(telegramStartParam)
        showToast(response.data.message)
        updateStats(response.data.user_stats)
      } catch (error) {
        if (error?.response?.status === 400) {
          processedReferralRef.current.add(telegramStartParam)
          return
        }

        showToast(getApiErrorMessage(error, 'Не вдалося зарахувати реферал'))
      }
    }

    void initializeUser()
  }, [fetchUserStats, getApiErrorMessage, showToast, telegramStartParam, updateStats, user])

  useEffect(() => {
    if (!user) return

    let refreshTimeoutId = null
    const timer = setInterval(() => {
      setUserStats(prev => {
        if (prev.next_energy_in_seconds <= 0) return prev

        const nextEnergyInSeconds = prev.next_energy_in_seconds - 1
        if (nextEnergyInSeconds === 0) {
          refreshTimeoutId = setTimeout(async () => {
            try {
              setUserStats(await fetchUserStateData())
            } catch (error) {
              console.error('Error refreshing user stats:', error)
            }
          }, 1000)
        }

        return { ...prev, next_energy_in_seconds: nextEnergyInSeconds }
      })
    }, 1000)

    return () => {
      clearInterval(timer)
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId)
      }
    }
  }, [user])

  useEffect(() => {
    if (!userStats?.can_claim_daily || dailyClaimInFlightRef.current) return

    dailyClaimInFlightRef.current = true

    const claim = async () => {
      try {
        const response = await claimDailyReward()
        showToast(response.data.message)
        updateStats(response.data.user_stats)
        setTimeout(() => triggerHaptic('success'), 300)
      } catch (error) {
        console.error('Failed to claim daily reward', error)
        if (error?.response?.status !== 400) {
          showToast(getApiErrorMessage(error, 'Не вдалося отримати щоденний бонус'))
        }
      } finally {
        dailyClaimInFlightRef.current = false
      }
    }

    void claim()
  }, [getApiErrorMessage, showToast, triggerHaptic, updateStats, userStats?.can_claim_daily])

  const spin = useCallback(async () => {
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
      const [response] = await Promise.all([spinRequest(), minDelay])

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
      showToast(getApiErrorMessage(error, 'Помилка крутки'))
    } finally {
      setLoading(false)
    }
  }, [applySpinResult, getApiErrorMessage, showToast, triggerHaptic, user, userStats.energy])

  const buyEnergy = useCallback(async () => {
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
      showToast(getApiErrorMessage(error, 'Помилка покупки'))
    } finally {
      setLoading(false)
    }
  }, [getApiErrorMessage, showToast, triggerHaptic, updateStats, user, userStats.coins, userStats.energy, userStats.max_energy])

  const sellDuplicate = useCallback(async (cardId) => {
    if (!user) return

    setLoading(true)
    triggerHaptic('selection')

    try {
      const response = await sellDuplicateCard(cardId)
      showToast(response.data.message)
      updateStats(response.data.user_stats)
      setCollection(prev => prev.map(card => (
        card.card_id === cardId && card.duplicates > 0
          ? { ...card, duplicates: card.duplicates - 1 }
          : card
      )))
      collectionCacheRef.current = { userId: user.id, fetchedAt: Date.now(), loaded: true }
      triggerHaptic('success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Помилка продажу'))
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }, [getApiErrorMessage, showToast, triggerHaptic, updateStats, user])

  const premiumSpin = useCallback(async () => {
    if (!user) return
    if (userStats.coins < 10000) {
      showToast('Недостатньо монет! Потрібно 10,000 🪙')
      return
    }

    setResult(null)
    setIsFlipping(false)
    setLoading(true)
    triggerHaptic('heavy')
    onGoHome?.()

    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 1400))
      const [response] = await Promise.all([premiumSpinRequest(), minDelay])

      applySpinResult(response.data)
      setTimeout(() => setIsFlipping(true), 100)

      if (response.data.message) {
        showToast(response.data.message)
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Помилка покупки'))
    } finally {
      setLoading(false)
    }
  }, [applySpinResult, getApiErrorMessage, onGoHome, showToast, triggerHaptic, user, userStats.coins])

  return {
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
  }
}
