import axios from 'axios'

const PRODUCTION_URL = 'https://uaifu-gacha-production.up.railway.app'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : PRODUCTION_URL)

export const fetchCollectionData = async (userId) => {
  const response = await axios.get(`${BACKEND_URL}/collection?user_id=${userId}`)
  return response.data
}

export const fetchLeaderboardData = async (mode) => {
  const response = await axios.get(`${BACKEND_URL}/leaderboard?mode=${mode}`)
  return response.data
}

export const fetchSeasonData = async (userId) => {
  const response = await axios.get(`${BACKEND_URL}/season?user_id=${userId}`)
  return response.data
}

export const fetchReferralData = async (userId) => {
  const response = await axios.get(`${BACKEND_URL}/referral/link?user_id=${userId}`)
  return response.data
}

export const fetchUserStateData = async (telegramUser) => {
  const params = new URLSearchParams({
    user_id: telegramUser.id,
    username: telegramUser.username || '',
    first_name: telegramUser.first_name || ''
  })
  const response = await axios.get(`${BACKEND_URL}/user?${params.toString()}`)
  return response.data
}

export const claimReferral = (userId, refId) => (
  axios.post(`${BACKEND_URL}/referral/claim?user_id=${userId}&ref_id=${refId}`)
)

export const claimSeasonTaskRequest = (userId, taskId) => (
  axios.post(`${BACKEND_URL}/season/claim?user_id=${userId}&task_id=${taskId}`)
)

export const spinRequest = (userId) => (
  axios.get(`${BACKEND_URL}/spin?user_id=${userId}`)
)

export const premiumSpinRequest = (userId) => (
  axios.get(`${BACKEND_URL}/premium_spin?user_id=${userId}`)
)

export const buyEnergyRequest = (userId) => (
  axios.post(`${BACKEND_URL}/buy_energy?user_id=${userId}`, null)
)

export const claimDroneReward = (payload) => (
  axios.post(`${BACKEND_URL}/games/drone/reward`, payload)
)
