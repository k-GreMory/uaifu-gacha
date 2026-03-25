import axios from 'axios'

const PRODUCTION_URL = 'https://uaifu-gacha-production.up.railway.app'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : PRODUCTION_URL)

const DEV_USER = {
  id: 12345678,
  first_name: 'Гість (Dev Mode)',
  username: ''
}

const isLocalBackend = BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1')

const getTelegramWebApp = () => window.Telegram?.WebApp

const buildAuthHeaders = () => {
  const tg = getTelegramWebApp()
  const initData = tg?.initData || ''
  if (initData) {
    return { 'X-Telegram-Init-Data': initData }
  }

  if (!isLocalBackend) {
    return {}
  }

  const devUser = tg?.initDataUnsafe?.user || DEV_USER
  return {
    'X-Dev-User-Id': String(devUser.id),
    'X-Dev-Username': devUser.username || '',
    'X-Dev-First-Name': devUser.first_name || ''
  }
}

const apiClient = axios.create({
  baseURL: BACKEND_URL
})

apiClient.interceptors.request.use((config) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    ...buildAuthHeaders()
  }
}))

export const fetchCollectionData = async () => {
  const response = await apiClient.get('/collection')
  return response.data
}

export const fetchLeaderboardData = async (mode) => {
  const response = await apiClient.get(`/leaderboard?mode=${mode}`)
  return response.data
}

export const fetchSeasonData = async () => {
  const response = await apiClient.get('/season')
  return response.data
}

export const fetchReferralData = async () => {
  const response = await apiClient.get('/referral/link')
  return response.data
}

export const fetchUserStateData = async () => {
  const response = await apiClient.get('/user')
  return response.data
}

export const claimReferral = (refId) => (
  apiClient.post(`/referral/claim?ref_id=${refId}`)
)

export const claimSeasonTaskRequest = (taskId) => (
  apiClient.post(`/season/claim?task_id=${taskId}`)
)

export const spinRequest = () => (
  apiClient.get('/spin')
)

export const premiumSpinRequest = () => (
  apiClient.get('/premium_spin')
)

export const buyEnergyRequest = () => (
  apiClient.post('/buy_energy', null)
)

export const startDroneGameRequest = () => (
  apiClient.post('/games/drone/start')
)

export const claimDroneReward = (payload) => (
  apiClient.post('/games/drone/reward', payload)
)
