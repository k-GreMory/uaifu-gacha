import { useCallback, useEffect, useState } from 'react'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

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

export function useTelegramSession(showToast) {
  const [session] = useState(() => {
    const tg = window.Telegram?.WebApp
    const parsed = parseTelegramInitData(tg?.initData || '')
    const telegramUser = tg?.initDataUnsafe?.user || parsed.user
    const startParam = tg?.initDataUnsafe?.start_param || parsed.startParam || ''

    if (telegramUser?.id) {
      return {
        isSessionBootstrapping: false,
        needsAuthToast: false,
        telegramStartParam: startParam,
        user: telegramUser
      }
    }

    if (LOCAL_HOSTS.has(window.location.hostname)) {
      return {
        isSessionBootstrapping: false,
        needsAuthToast: false,
        telegramStartParam: '',
        user: { first_name: 'Гість (Dev Mode)', id: 12345678 }
      }
    }

    return {
      isSessionBootstrapping: false,
      needsAuthToast: true,
      telegramStartParam: '',
      user: null
    }
  })

  const triggerHaptic = useCallback((type = 'light') => {
    const haptic = window.Telegram?.WebApp?.HapticFeedback
    if (!haptic) return

    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(type)) {
      haptic.impactOccurred(type)
    } else if (['error', 'success', 'warning'].includes(type)) {
      haptic.notificationOccurred(type)
    } else if (type === 'selection') {
      haptic.selectionChanged()
    }
  }, [])

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
    }

    if (session.needsAuthToast) {
      showToast('Не вдалося підтвердити Telegram-сесію. Перевідкрий мініапку.')
    }
  }, [session.needsAuthToast, showToast])

  return {
    user: session.user,
    isSessionBootstrapping: session.isSessionBootstrapping,
    telegramStartParam: session.telegramStartParam,
    triggerHaptic
  }
}
