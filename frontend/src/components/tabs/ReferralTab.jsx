export default function ReferralTab({ loadingReferral, referralData, showToast }) {
  const copyReferralLink = async () => {
    try {
      if (!referralData?.link) return
      await navigator.clipboard.writeText(referralData.link)
      showToast('Посилання скопійовано! ✨')
    } catch (error) {
      console.error('Copy referral link failed:', error)
      showToast('Не вдалося скопіювати')
    }
  }

  const count = referralData?.ref_count || 0

  return (
    <div className="w-full max-w-md animate-fade-in flex-1">
      <h2 className="text-xl font-bold tracking-tight mb-2 text-[#ededed]">Запрошення</h2>
      <p className="text-xs font-medium text-[#a3a3a3] mb-6">Запрошуй друзів</p>

      <div className="flat-card rounded-2xl p-5 mb-6">
        <div className="text-xs font-semibold text-[#737373] mb-2">Твоє посилання</div>
        <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#262626] font-mono text-xs text-[#a3a3a3] break-all mb-4">
          {loadingReferral ? 'Завантаження...' : (referralData?.link || 'Генерується...')}
        </div>
        <button
          onClick={copyReferralLink}
          disabled={loadingReferral || !referralData?.link}
          className="solid-btn w-full py-3 rounded-xl font-semibold text-sm"
        >
          {loadingReferral ? 'Завантаження...' : 'Скопіювати'}
        </button>
      </div>

      <div className="flat-card rounded-2xl p-5">
        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#737373] mb-1">Запрошено друзів</span>
            <span className="text-2xl font-bold text-[#ededed]">{count}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
