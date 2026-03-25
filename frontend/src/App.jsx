import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import './App.css'

const PRODUCTION_URL = 'https://uaifu-gacha-production.up.railway.app'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                     ? 'http://localhost:8000' 
                     : PRODUCTION_URL)

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [userStats, setUserStats] = useState({ energy: 0, max_energy: 20, coins: 0, next_energy_in_seconds: 0, total_cards: 200 })
  const [collection, setCollection] = useState([])
  const [activeTab, setActiveTab] = useState('home') // home | collection | shop | leaderboard | events | referral
  const [eventsView, setEventsView] = useState('hub') // hub | season_tasks
  const [isFlipping, setIsFlipping] = useState(false)
  const [toast, setToast] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbMode, setLbMode] = useState('spins')
  const [season, setSeason] = useState(null)
  const [referralData, setReferralData] = useState(null)
  const [claimingTask, setClaimingTask] = useState(null)
  const [fetchingCollection, setFetchingCollection] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugClickCount, setDebugClickCount] = useState(0)
  const [gameActive, setGameActive] = useState(false)

  const triggerHaptic = (type = 'light') => {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (!haptic) return;
    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(type)) {
      haptic.impactOccurred(type);
    } else if (['error', 'success', 'warning'].includes(type)) {
      haptic.notificationOccurred(type);
    } else if (type === 'selection') {
      haptic.selectionChanged();
    }
  }

  const updateStats = (data) => {
    if (!data) return;
    setUserStats(prev => ({
      ...prev,
      ...data
    }));
  }

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      setUser(tg.initDataUnsafe.user);
    } else {
      // Fallback for development outside Telegram
      setUser({ first_name: 'Гість (Dev Mode)', id: 12345678 });
    }
  }, [])

  const fetchCollection = async () => {
    if (!user || fetchingCollection) return;
    setFetchingCollection(true);
    try {
      setLastError(null);
      const response = await axios.get(`${BACKEND_URL}/collection?user_id=${user.id}`);
      setCollection(response.data);
    } catch (error) {
      console.error("Error fetching collection:", error);
      const msg = error.response?.data?.detail || error.message || 'Network Error';
      setLastError(msg);
      showToast(`Помилка: ${msg}`);
    } finally {
      setFetchingCollection(false);
    }
  }

  const fetchLeaderboard = async (mode = lbMode) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/leaderboard?mode=${mode}`)
      setLeaderboard(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchSeason = async (uid) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/season?user_id=${uid}`)
      setSeason(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchReferral = async (uid) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/referral/link?user_id=${uid}`)
      setReferralData(res.data)
    } catch (e) { console.error(e) }
  }

  const claimSeasonTask = async (taskId) => {
    if (!user) return;
    setClaimingTask(taskId);
    triggerHaptic('selection');
    try {
      const res = await axios.post(`${BACKEND_URL}/season/claim?user_id=${user.id}&task_id=${taskId}`)
      showToast(res.data.message)
      updateStats(res.data.user_stats)
      fetchSeason(user.id)
    } catch (e) {
      showToast(e.response?.data?.detail || 'Помилка')
    } finally {
      setClaimingTask(null)
    }
  }

  const fetchUserStats = async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        username: user.username || '',
        first_name: user.first_name || ''
      });
      const response = await axios.get(`${BACKEND_URL}/user?${params.toString()}`)
      setUserStats(response.data)
    } catch (error) {
      console.error("Error fetching user stats:", error)
    }
  }

  useEffect(() => {
    if (activeTab === 'collection') fetchCollection()
    if (activeTab === 'leaderboard') fetchLeaderboard(lbMode)
    if (activeTab === 'events' && user) fetchSeason(user.id)
    if (activeTab === 'referral' && user) fetchReferral(user.id)
  }, [activeTab, user])

  useEffect(() => {
    if (user) {
      fetchUserStats()
      fetchCollection() // Load immediately on start to prevent 0-count anxiety
      
      // Check for referral in start param
      const tg = window.Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param || '';
      if (startParam.startsWith('ref_')) {
        const refId = parseInt(startParam.replace('ref_', ''), 10);
        if (refId && refId !== user.id) {
          axios.post(`${BACKEND_URL}/referral/claim?user_id=${user.id}&ref_id=${refId}`)
            .then(r => showToast(r.data.message))
            .catch(() => {}); // silently fail if already referred
        }
      }
    }
  }, [user])

  // Live Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setUserStats(prev => {
        if (prev.next_energy_in_seconds <= 0) return prev;
        
        const newTime = prev.next_energy_in_seconds - 1;
        // Auto-refresh stats when the timer hits zero to restore energy!
        if (newTime === 0 && user) {
          setTimeout(fetchUserStats, 1000);
        }
        return { ...prev, next_energy_in_seconds: newTime };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [user]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const spin = async () => {
    if (!user) return;
    if (userStats.energy < 1) {
      showToast("Недостатньо енергії! Зачекай поки відновиться ⚡");
      return;
    }

    setResult(null)
    setIsFlipping(false)
    setLoading(true)
    triggerHaptic('light')
    try {
      // Run request and minimum delay in parallel — result shows only after BOTH finish
      const minDelay = new Promise(resolve => setTimeout(resolve, 1400))
      const [response] = await Promise.all([
        axios.get(`${BACKEND_URL}/spin?user_id=${user.id}`),
        minDelay
      ])
      setResult(response.data)
      updateStats(response.data.user_stats)

      // Optimistic Collection Sync
      setCollection(prev => {
        const existing = prev.find(c => c.card_id === response.data.card_id);
        if (existing) {
          return prev.map(c => c.card_id === response.data.card_id ? { ...c, duplicates: response.data.new_level - 1 } : c);
        } else {
          return [...prev, {
            card_id: response.data.card_id,
            name: response.data.name,
            rarity: response.data.rarity,
            image: response.data.image,
            duplicates: 0,
            acquired_at: new Date().toISOString()
          }];
        }
      });

      setTimeout(() => {
        setIsFlipping(true);
        if (['Legendary', 'Mythic'].includes(response.data.rarity)) {
          triggerHaptic('success');
        } else {
          triggerHaptic('medium');
        }
      }, 100)
    } catch (error) {
      console.error("Error spinning:", error)
      const errorMsg = error.response?.data?.detail || error.message;
      showToast(errorMsg);
    } finally {
      setLoading(false)
    }
  }

  const buyEnergy = async () => {
    if (!user) return;
    if (userStats.coins < 1000) {
      showToast("Недостатньо монет! Потрібно 1,000 🪙");
      return;
    }
    setLoading(true);
    triggerHaptic('medium');
    try {
      const response = await axios.post(`${BACKEND_URL}/buy_energy?user_id=${user.id}`, null);
      showToast(response.data.message);
      updateStats(response.data.user_stats);
    } catch (error) {
      showToast(error.response?.data?.detail || "Помилка покупки");
    } finally {
      setLoading(false);
    }
  };

  const premiumSpin = async () => {
    if (!user) return;
    if (userStats.coins < 10000) {
      showToast("Недостатньо монет! Потрібно 10,000 🪙");
      return;
    }
    setResult(null);
    setIsFlipping(false);
    setLoading(true);
    triggerHaptic('heavy');
    setActiveTab('home');
    try {
      // Run request and minimum delay in parallel — result shows only after BOTH finish
      const minDelay = new Promise(resolve => setTimeout(resolve, 1400))
      const [response] = await Promise.all([
        axios.get(`${BACKEND_URL}/premium_spin?user_id=${user.id}`),
        minDelay
      ])
      setResult(response.data);
      updateStats(response.data.user_stats);

      // Optimistic Collection Sync
      setCollection(prev => {
        const existing = prev.find(c => c.card_id === response.data.card_id);
        if (existing) {
          return prev.map(c => c.card_id === response.data.card_id ? { ...c, duplicates: response.data.new_level - 1 } : c);
        } else {
          return [...prev, {
            card_id: response.data.card_id,
            name: response.data.name,
            rarity: response.data.rarity,
            image: response.data.image,
            duplicates: 0,
            acquired_at: new Date().toISOString()
          }];
        }
      });

      setTimeout(() => setIsFlipping(true), 100);
      if (response.data.message) {
        showToast(response.data.message);
      }
    } catch (error) {
      showToast(error.response?.data?.detail || "Помилка покупки");
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Mythic': return 'text-rose-500 border-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]';
      case 'Legendary': return 'text-yellow-400 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]';
      case 'Epic': return 'text-fuchsia-400 border-fuchsia-500 shadow-fuchsia-500/30';
      case 'Rare': return 'text-blue-400 border-blue-500 shadow-blue-500/20';
      case 'UnCommon': return 'text-emerald-400 border-emerald-500 shadow-emerald-500/10';
      default: return 'text-slate-300 border-slate-600 shadow-slate-500/10';
    }
  }

  // Optimize React rerendering by caching the heavy algorithmic sort
  const sortedCollection = useMemo(() => {
    return [...collection].sort((a, b) => {
      const weight = { 'Mythic': 6, 'Legendary': 5, 'Epic': 4, 'Rare': 3, 'UnCommon': 2, 'Common': 1 };
      if (weight[b.rarity] !== weight[a.rarity]) return weight[b.rarity] - weight[a.rarity];
      return a.name.localeCompare(b.name);
    });
  }, [collection]);

  if (gameActive) {
    return <DroneGame user={user} triggerHaptic={triggerHaptic} onClose={(score) => { setGameActive(false); fetchUserStats(); }} />
  }

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-[#0f172a] text-white p-3 sm:p-5 font-sans select-none overflow-x-hidden relative">
      
      {/* Toast Notification Layer */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 min-w-[280px] z-[100] animate-fade-up">
          <div className="bg-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.5)] border-2 border-red-400 text-sm font-black text-center flex items-center justify-center gap-2">
            ⚠️ {toast}
          </div>
        </div>
      )}

      <div className="w-full flex flex-col items-center flex-1 max-w-lg mx-auto">
        {/* Header */}
        <header className="w-full flex justify-between items-center py-1 sm:py-2 mb-2">
          <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 drop-shadow-sm pr-2">
            UAIFU
          </h1>
          <div className="flex gap-1.5">
            {[['home','🎲'],['collection','🎴'],['shop','🛒'],['leaderboard','🏆'],['events','🎯'],['referral','🔗']].map(([tab, icon]) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); triggerHaptic('selection'); }}
                className={`px-2.5 py-1.5 rounded-xl text-sm font-black border transition-all active:scale-95 shadow-lg ${
                  activeTab === tab
                    ? 'bg-blue-500/30 border-blue-500/60 text-blue-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >{icon}</button>
            ))}
          </div>
        </header>

        {/* Top Stats Bar */}
        {activeTab === 'home' && (
          <div className="w-full max-w-md flex flex-col gap-2 mb-3">
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-800/40 border border-slate-700/50 p-1.5 px-3 rounded-xl flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400">ЕНЕРГІЯ</span>
                <span className={`text-xs font-black ${userStats.energy === 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {userStats.energy}/{userStats.max_energy}
                </span>
              </div>
              <div className="flex-1 bg-slate-800/40 border border-slate-700/50 p-1.5 px-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-black text-yellow-400">
                  {userStats.coins}
                  <img src="/coin.png" alt="Coins" className="w-4 h-4 object-cover object-center ml-0.5" style={{ imageRendering: 'auto' }} />
                </div>
              </div>
            </div>
            {/* Quick Progress Bar */}
            <div 
              onClick={() => setActiveTab('collection')}
              className="w-full bg-slate-800/20 border border-slate-700/30 p-1.5 px-3 rounded-lg flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Твоя Колекція</span>
              <span className="text-[9px] font-black text-blue-400">
                {fetchingCollection ? 'Оновлення...' : `${collection.length} / ${userStats.total_cards}`}
              </span>
            </div>
          </div>
        )}

        {user && activeTab === 'home' && !result && (
          <div className="mb-2 text-slate-400 text-[10px] animate-fade-in text-center font-medium">
            Вітаємо, <span className="text-blue-400 font-bold">{user.first_name || 'Player'}</span>!
          </div>
        )}

        {activeTab === 'shop' ? (
          <div className="w-full max-w-md animate-fade-in flex-1 flex flex-col items-center py-4">
            <h2 className="text-2xl font-black tracking-tight mb-1 text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">ЧОРНИЙ РИНОК</h2>
            <p className="text-xs text-slate-400 mb-6 text-center">Витрать свої монети на найцінніші ресурси.</p>
            
            <div className="w-full bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between mb-8 shadow-inner">
              <div className="flex items-center gap-1.5 text-lg font-black text-yellow-400">
                {userStats.coins}
                <img src="/coin.png" alt="Coins" className="w-6 h-6 object-cover object-center" style={{ imageRendering: 'auto' }} />
              </div>
            </div>
            
            <div className="w-full flex flex-col gap-4">
              {/* Energy item */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🔋</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-cyan-400">Енергія (+1)</span>
                    <span className="text-[10px] text-slate-400">Миттєвий заряд для ще 1 крутки</span>
                  </div>
                </div>
                <button 
                  onClick={buyEnergy}
                  disabled={loading || userStats.coins < 1000}
                  className={`px-4 py-2.5 rounded-[0.8rem] font-black text-xs transition-all active:scale-95 whitespace-nowrap ${loading || userStats.coins < 1000 ? 'bg-slate-700/50 text-slate-500 border border-slate-600 grayscale' : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]'}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    1,000 <img src="/coin.png" className="w-4 h-4 object-cover object-center" alt="Coins" style={{ imageRendering: 'auto' }} />
                  </div>
                </button>
              </div>

              {/* Premium Spin item */}
              <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/10 border border-yellow-600/40 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-pulse">🌟</div>
                  <div className="flex flex-col flex-1 pr-2">
                    <span className="font-bold text-sm text-yellow-400">Преміум Крутка</span>
                    <span className="text-[10px] text-yellow-500/70 leading-tight">100% Rare або краще! Ніякого ширпотребу.</span>
                  </div>
                </div>
                <button 
                  onClick={premiumSpin}
                  disabled={loading || userStats.coins < 10000}
                  className={`px-4 py-2.5 rounded-[0.8rem] font-black text-xs relative z-10 transition-all active:scale-95 whitespace-nowrap ${loading || userStats.coins < 10000 ? 'bg-slate-800/60 text-slate-500 border border-slate-700 grayscale' : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border border-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.5)]'}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    10k <img src="/coin.png" className="w-4 h-4 object-cover object-center" alt="Coins" style={{ imageRendering: 'auto' }} />
                  </div>
                </button>
              </div>
            </div>
            
          </div>
        ) : activeTab === 'collection' ? (
          <div className="w-full max-w-md animate-fade-in flex-1">
            <div className="flex flex-row justify-between items-center mb-6">
              <div className="flex flex-col">
                <h2 
                  className="text-xl font-black tracking-tight cursor-pointer active:scale-95"
                  onClick={() => {
                    setDebugClickCount(prev => {
                      if (prev + 1 >= 5) { setDebugMode(true); return 0; }
                      return prev + 1;
                    })
                  }}
                >ТВОЇ ЗДОБУТКИ</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <button 
                    onClick={fetchCollection} 
                    disabled={fetchingCollection}
                    className="text-[8px] font-bold text-blue-500/60 uppercase tracking-tighter text-left active:text-blue-400"
                  >
                    {fetchingCollection ? '⚡ СИНХРОНІЗАЦІЯ...' : '⟳ ОНОВИТИ ДАНІ'}
                  </button>
                  {lastError && <span className="text-[7px] text-red-500/80 font-bold animate-pulse">! API ERROR</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-500/20">
                  {collection.length} / {userStats.total_cards} КАРТ
                </span>
                <span className="text-[10px] font-bold text-slate-500 mr-2">
                  ПРОГРЕС: {((collection.length / Math.max(1, userStats.total_cards)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Hidden Diagnostic Panel */}
            {debugMode && (
              <div className="mb-6 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-[10px] font-mono text-red-200 animate-fade-in relative">
                <button onClick={() => setDebugMode(false)} className="absolute top-2 right-2 text-red-400">✕</button>
                <div className="mb-1 font-bold">--- DIAGNOSTICS ---</div>
                <div>URL: <span className="text-cyan-400 break-all">{BACKEND_URL}</span></div>
                <div>UID: {user?.id}</div>
                <div>LOCAL_COUNT: {collection.length}</div>
                <div>LAST_ERR: {lastError || 'none'}</div>
                <div className="mt-2 text-slate-400 italic">Click "Achievements" title 5 times to show/hide.</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pb-20">
              {sortedCollection.map((card, idx) => (
                <div key={idx} className="bg-slate-800/60 backdrop-blur-sm p-2 rounded-2xl border border-slate-700/50 overflow-hidden relative group">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden mb-2 bg-slate-900">
                    <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                  </div>
                  <div className="px-1">
                    <div className="text-[11px] font-black truncate leading-tight uppercase flex justify-between gap-1 items-center">
                      <span className="truncate">{card.name}</span>
                      {card.duplicates > 0 && <span className="bg-blue-500/20 text-blue-300 text-[8px] px-1 rounded-sm border border-blue-500/30 whitespace-nowrap">Lvl.{card.duplicates + 1}</span>}
                    </div>
                    <div className={`text-[9px] font-bold ${getRarityColor(card.rarity).split(' ')[0]}`}>
                      {card.rarity}
                    </div>
                  </div>
                  {card.rarity === 'Legendary' && (
                    <div className="absolute top-1 right-1 text-xs">⭐</div>
                  )}
                </div>
              ))}
              {collection.length === 0 && (
                <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4 opacity-40">
                  <div className="text-5xl">🌑</div>
                  <div className="text-sm italic font-medium">Твоя колекція поки порожня...</div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'leaderboard' ? (
          <div className="w-full max-w-md animate-fade-in flex-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black tracking-tight uppercase">🏆 Лідерборд</h2>
              <div className="flex bg-slate-800/40 rounded-xl p-0.5 border border-slate-700/50">
                {[['spins','🎲'],['cards','🎴']].map(([mode, icon]) => (
                  <button
                    key={mode}
                    onClick={() => { setLbMode(mode); fetchLeaderboard(mode); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lbMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 pb-20">
              {leaderboard.length > 0 ? leaderboard.map((player, idx) => (
                <div 
                  key={player.id} 
                  className={`flex items-center gap-4 p-4 rounded-[1.8rem] border transition-all ${
                    player.id === user?.id 
                    ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                    : 'bg-slate-900/40 border-slate-800/80'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    idx === 0 ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' :
                    idx === 1 ? 'bg-slate-300 text-black' :
                    idx === 2 ? 'bg-orange-400 text-black' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm truncate">{player.id === user?.id ? 'Ти' : (player.first_name || 'Гравець')}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {lbMode === 'cards' ? `${player.total_cards} Карт` : `${player.total_spins} Спінів`}
                    </div>
                  </div>
                  <div className="text-xl">{idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''}</div>
                </div>
              )) : (
                <div className="text-center py-20 opacity-30 italic">Завантаження...</div>
              )}
            </div>
          </div>

        ) : activeTab === 'events' ? (
          <div className="w-full max-w-md animate-fade-in flex-1 flex flex-col">
            {eventsView === 'hub' ? (
              <div className="flex-1 flex flex-col">
                <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-cyan-400">Центр Подій</h2>
                <p className="text-[10px] text-slate-500 mb-5 font-bold tracking-wider">Грай, перемагай та забирай нагороди</p>

                <div className="flex flex-col gap-4">
                  {/* Drone Dash Card */}
                  <div 
                    onClick={() => { setGameActive(true); triggerHaptic('impact'); }}
                    className="group relative bg-gradient-to-br from-cyan-600/30 to-blue-600/10 border border-cyan-500/40 rounded-[2rem] p-5 overflow-hidden active:scale-95 transition-all cursor-pointer shadow-xl"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">🛸</div>
                    <div className="flex flex-col relative z-10">
                      <span className="text-[9px] font-black text-cyan-300 uppercase tracking-widest mb-1">Міні-Гра (Активна)</span>
                      <span className="text-lg font-black text-white uppercase tracking-tighter text-[16px]">Drone Dash</span>
                      <p className="text-[10px] text-cyan-400/70 mt-1 font-bold">1 монета / 5 очок</p>
                    </div>
                  </div>

                  {/* Season Card */}
                  <div 
                    onClick={() => { setEventsView('season_tasks'); triggerHaptic('selection'); }}
                    className="group relative bg-gradient-to-br from-blue-600/30 to-purple-600/10 border border-blue-500/40 rounded-[2rem] p-5 overflow-hidden active:scale-95 transition-all cursor-pointer shadow-xl"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">🎯</div>
                    <div className="flex flex-col relative z-10">
                      <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Активний Сезон</span>
                      <span className="text-lg font-black text-white text-[16px]">{season?.season_name || "Завантаження..."}</span>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 bg-slate-900/60 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                            style={{ width: season?.active ? `${Math.min(100, (season.tasks.filter(t => t.completed).length / Math.max(1, season.tasks.length)) * 100)}%` : '0%' }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-blue-400">{season?.active ? `${season.tasks.filter(t => t.completed).length}/${season.tasks.length}` : '0/0'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Future Events Placeholder */}
                  <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-[2rem] p-6 flex items-center justify-center opacity-40">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Більше івентів у розробці...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setEventsView('hub')}
                    className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-xs active:scale-90 transition-all"
                  >←</button>
                  <h2 className="text-lg font-black tracking-tight uppercase">{season?.season_name}</h2>
                </div>
                
                <div className="flex flex-col gap-3 pb-20">
                  {season?.tasks.map(task => (
                    <div key={task.id} className={`p-4 rounded-[1.5rem] border transition-all ${
                      task.claimed ? 'bg-emerald-900/10 border-emerald-500/20 opacity-60' :
                      task.completed ? 'bg-blue-900/20 border-blue-500/30' :
                      'bg-slate-800/40 border-slate-700/50'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-sm truncate pr-2">{task.title}</div>
                        <div className="text-[10px] font-black text-yellow-500 whitespace-nowrap">+{task.reward_coins}🪙</div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex-1 bg-slate-900/60 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${task.completed ? 'bg-blue-500' : 'bg-slate-700'}`} style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 shrink-0">{task.progress}/{task.target}</span>
                        {task.completed && !task.claimed && (
                          <button onClick={() => claimSeasonTask(task.id)} className="px-3 py-1 bg-emerald-500 text-black text-[9px] font-black rounded-lg active:scale-90 transition-all">OK</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        ) : activeTab === 'referral' ? (
          <div className="w-full max-w-md animate-fade-in flex-1">
            <h2 className="text-xl font-black tracking-tight mb-4 uppercase">🔗 Реферали</h2>
            <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-[2rem] mb-6 text-center">
               <div className="text-xs text-slate-400 mb-4">Твоє унікальне посилання:</div>
               <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-700 font-mono text-[10px] text-cyan-400 break-all mb-4">
                  {referralData ? referralData.link : 'Завантаження...'}
               </div>
               <button 
                  onClick={() => { navigator.clipboard.writeText(referralData?.link || ''); showToast('Скопійовано!'); }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
               >Копіювати посилання</button>
            </div>
            
            <div className="text-center py-4">
               <div className="text-4xl font-black text-white">{referralData?.ref_count || 0}</div>
               <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Запрошених друзів</div>
            </div>
          </div>

        ) : (
          <div className="w-full max-w-md flex flex-col items-center flex-1 justify-center py-4">
            {/* Main Card Slot - 3D Container */}
            <div className="perspective-1000 relative w-full aspect-[3/4.2] max-w-[280px] group">
              <div 
                className={`w-full h-full rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 transition-transform duration-[800ms] transform-style-3d ${isFlipping ? 'rotate-y-180' : ''} ${result && isFlipping ? getRarityColor(result.rarity) : 'border-slate-700/50 border-dashed bg-slate-800'}`}
                style={{ willChange: 'transform' }}
              >

                {/* DEFAULT STATE (Card Back with Dice) */}
                <div 
                  className="absolute inset-0 backface-hidden flex flex-col items-center justify-center gap-6 rounded-[2.5rem] bg-slate-800 border-2 border-slate-700/50 border-dashed"
                  style={{ transform: 'translateZ(1px)' }}
                >
                  <div className="dice-container">
                    <div className={`dice ${loading ? 'rolling' : ''}`}>
                      <div className="face front"><span></span></div>
                      <div className="face back"><span></span><span></span><span></span><span></span><span></span><span></span></div>
                      <div className="face right"><span></span><span></span><span></span></div>
                      <div className="face left"><span></span><span></span><span></span><span></span></div>
                      <div className="face top"><span></span><span></span></div>
                      <div className="face bottom"><span></span><span></span><span></span><span></span><span></span></div>
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center leading-loose">
                    {loading ? <>Тягнемо<br />картку...</> : <>Очікування<br />результату</>}
                  </div>
                </div>

                {/* REVEALED STATE (The Result) */}
                <div 
                  className={`absolute inset-0 backface-hidden flex flex-col p-3 rounded-[2.5rem] bg-slate-900 border-2 ${result ? getRarityColor(result.rarity) : ''}`}
                  style={{ transform: 'rotateY(180deg) translateZ(1px)' }}
                >
                  {result && (
                    <>
                      <div className={`rarity-glow ${getRarityColor(result.rarity).split(' ')[0].replace('text-', 'bg-')}`}></div>
                      <div className="flex-1 rounded-[1.8rem] bg-[#0b1120] flex items-center justify-center overflow-hidden relative shadow-inner">
                        <img src={result.image} alt={result.name} className="w-full h-full object-cover animate-pop-in" />
                        <div className="absolute bottom-4 left-4 right-4 py-2 rounded-xl bg-black/60 border border-white/10 text-center">
                          <div className="text-xs font-black uppercase tracking-widest">{result.name}</div>
                        </div>
                      </div>
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border-2 bg-slate-900 ${getRarityColor(result.rarity).split(' ')[0]} ${getRarityColor(result.rarity).split(' ')[1]}`}>
                        {result.rarity}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Area */}
            <div className="mt-4 w-full px-2 flex flex-col items-center">
              <button
                onClick={spin}
                disabled={loading || userStats.energy < 1}
                className={`w-full py-4 rounded-2xl font-black text-xs tracking-widest uppercase transition-all duration-300 active:scale-95 shadow-xl ${(loading || userStats.energy < 1)
                    ? 'bg-slate-800 text-slate-600 grayscale'
                    : 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-blue-500/30'
                  }`}
              >
                {loading ? 'ПРОЦЕС...' : (userStats.energy < 1 ? `⏳ ${formatTime(userStats.next_energy_in_seconds)}` : 'КРУТИТИ')}
              </button>
              {result && <p className="mt-3 text-[10px] font-bold text-slate-400 animate-fade-in italic">✨ {result.message}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- MINIGAME: DRONE DASH ---
const DroneGame = ({ user, onClose, triggerHaptic }) => {
  const canvasRef = useRef(null)
  const droneImgRef = useRef(null)
  // Day Assets Refs
  const dayBgRef = useRef(null)
  const cloudsRef = useRef(null)
  const lightsRef = useRef(null)
  
  const [gameState, setGameState] = useState('START') // START, PLAYING, GAMEOVER
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('drone_highscore') || '0'))
  const [rewardClaimed, setRewardClaimed] = useState(false)

  // Game Constants
  const GRAVITY = 0.2
  const JUMP = -4.5
  const PIPE_SPEED = 3.0
  const PIPE_SPAWN_RATE = 110 // frames
  const PIPE_WIDTH = 50
  const GAP_SIZE = 170

  const requestRef = useRef()
  const birdRef = useRef({ x: 50, y: 250, velocity: 0, width: 44, height: 44 })
  const pipesRef = useRef([])
  const frameCountRef = useRef(0)

  useEffect(() => {
    // Load Drone
    const img = new Image(); img.src = '/drone.png'; img.onload = () => { droneImgRef.current = img }
    
    // Load Day Theme
    const bg = new Image(); bg.src = '/day_theme/day_bg.png'; bg.onload = () => { dayBgRef.current = bg }
    const cl = new Image(); cl.src = '/day_theme/clouds.png'; cl.onload = () => { cloudsRef.current = cl }
    const lt = new Image(); lt.src = '/day_theme/traffic_lights.png'; lt.onload = () => { lightsRef.current = lt }
  }, [])

  const startGame = () => {
    birdRef.current = { x: 50, y: 250, velocity: 0, width: 44, height: 44 }
    pipesRef.current = []
    frameCountRef.current = 0
    setScore(0)
    setRewardClaimed(false)
    setGameState('PLAYING')
  }

  const jump = () => {
    if (gameState === 'PLAYING') {
      birdRef.current.velocity = JUMP
      triggerHaptic('selection')
    } else if (gameState === 'START' || gameState === 'GAMEOVER') {
      startGame()
    }
  }

  const update = () => {
    if (gameState !== 'PLAYING') return

    birdRef.current.velocity += GRAVITY
    birdRef.current.y += birdRef.current.velocity

    if (birdRef.current.y < 0 || birdRef.current.y > 600) {
      endGame()
    }

    frameCountRef.current++
    if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
      const minPipeHeight = 50
      const maxPipeHeight = 300
      const height = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight
      pipesRef.current.push({ x: 400, top: height, bottom: height + GAP_SIZE, passed: false })
    }

    pipesRef.current.forEach(pipe => {
      pipe.x -= PIPE_SPEED
      if (
        birdRef.current.x + birdRef.current.width > pipe.x &&
        birdRef.current.x < pipe.x + PIPE_WIDTH &&
        (birdRef.current.y < pipe.top || birdRef.current.y + birdRef.current.height > pipe.bottom)
      ) {
        endGame()
      }
      if (!pipe.passed && birdRef.current.x > pipe.x + PIPE_WIDTH) {
        pipe.passed = true
        setScore(s => s + 1)
      }
    })
    pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_WIDTH)
  }

  const endGame = () => {
    setGameState('GAMEOVER')
    triggerHaptic('error')
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('drone_highscore', score.toString())
    }
    if (score >= 5) claimReward(score)
  }

  const claimReward = async (finalScore) => {
    if (!user || rewardClaimed) return
    const coins = Math.floor(finalScore / 5)
    if (coins <= 0) return
    try {
      await axios.post(`${BACKEND_URL}/games/drone/reward`, { user_id: user.id, score: finalScore, coins })
      setRewardClaimed(true)
    } catch (e) {
      console.error("Reward error", e)
    }
  }

  const draw = (ctx) => {
    ctx.clearRect(0, 0, 400, 600)
    
    // Day Sky
    ctx.fillStyle = '#38bdf8' // Brighter Blue
    ctx.fillRect(0, 0, 400, 600)

    // Sun
    ctx.shadowBlur = 40; ctx.shadowColor = '#fde047'
    ctx.fillStyle = '#fff7ed'
    ctx.beginPath(); ctx.arc(330, 70, 30, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // Clouds (Procedural for perfect transparency)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    for(let i=0; i<5; i++) {
        const x = (i * 250 - (frameCountRef.current * 0.3) % 1250)
        const y = 50 + (i % 3) * 40
        // Simple 3-circle cloud
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(x+15, y-10, 22, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(x+30, y, 20, 0, Math.PI*2); ctx.fill()
    }

    // Daytime City (Parallax)
    if (dayBgRef.current) {
        const bgX = -(frameCountRef.current * 0.8) % 800
        ctx.drawImage(dayBgRef.current, bgX, 220, 800, 380)
        ctx.drawImage(dayBgRef.current, bgX + 800, 220, 800, 380)
    }

    // Street Floor
    ctx.fillStyle = '#334155'
    ctx.fillRect(0, 550, 400, 50)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    for(let i=0; i<10; i++) {
        const x = (i * 80 - (frameCountRef.current * PIPE_SPEED) % 80)
        ctx.fillRect(x, 573, 40, 4)
    }

    // Obstacles (Traffic Lights)
    pipesRef.current.forEach(pipe => {
      ctx.fillStyle = '#475569' // Pole color
      
      // Top Obstacle
      ctx.fillRect(pipe.x + 22, 0, 6, pipe.top)
      if (lightsRef.current) {
          ctx.drawImage(lightsRef.current, 160, 0, 32, 64, pipe.x + 9, pipe.top - 64, 32, 64)
      }
      
      // Bottom Obstacle
      ctx.fillRect(pipe.x + 22, pipe.bottom, 6, 600 - pipe.bottom)
      if (lightsRef.current) {
          ctx.drawImage(lightsRef.current, 160, 0, 32, 64, pipe.x + 9, pipe.bottom, 32, 64)
      }
    })

    // Bird (Drone)
    ctx.save()
    ctx.translate(birdRef.current.x + birdRef.current.width/2, birdRef.current.y + birdRef.current.height/2)
    ctx.rotate(Math.min(0.5, Math.max(-0.5, birdRef.current.velocity * 0.1)))
    
    if (droneImgRef.current) {
        const frameWidth = droneImgRef.current.width / 2
        const frameHeight = droneImgRef.current.height / 2
        const frameIndex = Math.floor(frameCountRef.current / 5) % 3 
        const sx = (frameIndex % 2) * frameWidth
        const sy = Math.floor(frameIndex / 2) * frameHeight
        
        ctx.drawImage(
            droneImgRef.current,
            sx, sy, frameWidth, frameHeight,
            -birdRef.current.width/2, -birdRef.current.height/2, birdRef.current.width, birdRef.current.height
        )
    } else {
        ctx.fillStyle = '#f97316'
        ctx.fillRect(-birdRef.current.width/2, -birdRef.current.height/2, birdRef.current.width, birdRef.current.height)
    }
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const loop = () => {
      update()
      draw(ctx)
      requestRef.current = requestAnimationFrame(loop)
    }
    requestRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(requestRef.current)
  }, [gameState])

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center touch-none select-none" onClick={jump}>
      <div className="relative w-full max-w-[400px] aspect-[2/3] overflow-hidden rounded-[2.5rem] border-4 border-slate-900 bg-black">
        <canvas ref={canvasRef} width="400" height="600" className="w-full h-full" />
        <div className="absolute top-8 left-8 right-8 flex justify-between pointer-events-none">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Score</span>
            <span className="text-3xl font-black text-white">{score}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High</span>
            <span className="text-sm font-black text-slate-300 block">{highScore}</span>
            {rewardClaimed && <span className="text-[9px] font-black text-emerald-400 uppercase">Coin+ 🪙</span>}
          </div>
        </div>

        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
            <div className="text-5xl mb-6 animate-bounce">🛸</div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter mb-2">DRONE DASH</h1>
            <p className="text-xs text-slate-400 mb-8 font-medium">Клікай, щоб летіти.<br/>Заробляй 1 монету за 5 очок.</p>
            <div className="px-8 py-3 bg-cyan-500 rounded-2xl text-black font-black text-xs uppercase animate-pulse">Клікніть для старту</div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <h2 className="text-4xl font-black text-white italic tracking-tighter mb-2">GAME OVER</h2>
            <div className="text-2xl font-black text-cyan-400 mb-3">{score} <span className="text-[10px] text-slate-500 uppercase">очок</span></div>
            <div className="mb-8 text-[11px] font-bold text-slate-400">
               {score >= 5 ? `Зароблено монет: ${Math.floor(score/5)} 🪙` : 'Наберіть 5 очок для нагороди!'}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="w-full py-4 bg-white text-black font-black rounded-2xl text-xs uppercase transition-all active:scale-95">Ще раз</button>
              <button onClick={(e) => { e.stopPropagation(); onClose(score); }} className="w-full py-4 bg-slate-800 text-slate-300 font-black rounded-2xl text-xs uppercase transition-all active:scale-95">У хаб</button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-8 text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-50">Натисніть будь-де, щоб летіти</p>
    </div>
  )
}

export default App
