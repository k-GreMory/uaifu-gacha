import { useState, useEffect, useMemo } from 'react'
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
  const [activeTab, setActiveTab] = useState('home') // home | collection | shop | leaderboard | season | referral
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
    if (!user) return;
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
    if (activeTab === 'season' && user) fetchSeason(user.id)
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
            {[['home','🎲'],['collection','🎴'],['shop','🛒'],['leaderboard','🏆'],['season','🎯'],['referral','🔗']].map(([tab, icon]) => (
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
              <h2 className="text-xl font-black tracking-tight">🏆 ЛІДЕРБОРД</h2>
              <div className="flex gap-2">
                {[['spins','Спіни'],['cards','Картки']].map(([m, label]) => (
                  <button key={m} onClick={() => { setLbMode(m); fetchLeaderboard(m); }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${
                      lbMode === m ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 pb-20">
              {leaderboard.map((row) => (
                <div key={row.rank} className={`flex items-center gap-3 p-3 rounded-2xl border ${
                  row.rank === 1 ? 'bg-yellow-500/10 border-yellow-500/30' :
                  row.rank === 2 ? 'bg-slate-400/10 border-slate-400/30' :
                  row.rank === 3 ? 'bg-amber-700/10 border-amber-700/30' :
                  'bg-slate-800/40 border-slate-700/50'
                }`}>
                  <span className={`text-lg font-black w-8 text-center ${
                    row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-slate-300' : row.rank === 3 ? 'text-amber-600' : 'text-slate-500'
                  }`}>{row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm truncate">{row.name}</div>
                    <div className="text-[10px] text-slate-400">{row.score} {row.label}</div>
                  </div>
                  {row.user_id === user?.id && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">ТИ</span>
                  )}
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="text-center opacity-40 py-20">Ще немає даних. Крути карти! 🎲</div>
              )}
            </div>
          </div>

        ) : activeTab === 'season' ? (
          <div className="w-full max-w-md animate-fade-in flex-1">
            {season?.active ? (
              <>
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-xl font-black tracking-tight">🎯 {season.season_name}</h2>
                </div>
                <div className="text-[10px] text-slate-400 mb-4">Залишилось днів: <span className="text-cyan-400 font-bold">{season.days_left}</span></div>
                <div className="flex flex-col gap-3 pb-20">
                  {season.tasks.map(task => (
                    <div key={task.id} className={`p-3 rounded-2xl border ${
                      task.claimed ? 'bg-emerald-900/20 border-emerald-500/30 opacity-60' :
                      task.completed ? 'bg-blue-900/20 border-blue-500/30' :
                      'bg-slate-800/40 border-slate-700/50'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-sm">{task.title}</div>
                        <div className="text-[10px] text-slate-400 text-right whitespace-nowrap ml-2">
                          {task.reward_coins > 0 && <span>+{task.reward_coins}🪙 </span>}
                          {task.reward_energy > 0 && <span>+{task.reward_energy}⚡</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900/60 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{task.progress}/{task.target}</span>
                        {task.claimed ? (
                          <span className="text-[10px] text-emerald-400 font-black">✓</span>
                        ) : task.completed ? (
                          <button
                            onClick={() => claimSeasonTask(task.id)}
                            disabled={claimingTask === task.id}
                            className="px-3 py-1 rounded-lg bg-emerald-500 text-black text-[10px] font-black active:scale-95 transition-all"
                          >Забрати</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center opacity-40 py-20">
                <div className="text-4xl mb-4">⏳</div>
                <div>Зараз немає активного сезону</div>
              </div>
            )}
          </div>

        ) : activeTab === 'referral' ? (
          <div className="w-full max-w-md animate-fade-in flex-1">
            <h2 className="text-xl font-black tracking-tight mb-4">🔗 РЕФЕРАЛЬНА ПРОГРАМА</h2>
            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl mb-4">
              <div className="text-sm text-slate-300 mb-2">Запроси друга → обидва отримаєте бонуси!</div>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <div>👤 Ти: <span className="text-emerald-400 font-bold">+5⚡ +500🪙</span></div>
                <div>🆕 Друг: <span className="text-cyan-400 font-bold">+3⚡ +200🪙</span></div>
              </div>
            </div>
            {referralData && (
              <>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 mb-3 font-mono text-[11px] text-cyan-300 break-all">
                  {referralData.link}
                </div>
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => { navigator.clipboard.writeText(referralData.link); showToast('Посилання скопійовано!'); }}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs active:scale-95 transition-all"
                  >📋 Копіювати</button>
                  <button
                    onClick={() => { const tg = window.Telegram?.WebApp; if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralData.link)}&text=${encodeURIComponent('Грай зі мною в UAIFU Gacha! 🎲')}`); }}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-black text-xs active:scale-95 transition-all"
                  >📤 Поділитись</button>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-yellow-400">{referralData.ref_count}</div>
                  <div className="text-[10px] text-slate-400">запрошених друзів</div>
                </div>
              </>
            )}
          </div>

        ) : (
          <div className="w-full max-w-md flex flex-col items-center flex-1 justify-center py-4">
            {/* Main Card Slot - 3D Container */}
            <div className="perspective-1000 relative w-full aspect-[3/4.2] max-w-[280px] group">
              <div 
                className={`w-full h-full rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 transition-transform duration-[800ms] transform-style-3d ${isFlipping ? 'rotate-y-180' : ''} ${result && isFlipping ? getRarityColor(result.rarity) : 'border-slate-700/50 border-dashed bg-slate-800'}`}
                style={{ willChange: 'transform' }}
              >

                {/* DEFAULT STATE (Card Back with Dice) - Faces Front initially */}
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

                {/* REVEALED STATE (The Result) - Faces Back initially, rotates to Front */}
                  <div 
                    className={`absolute inset-0 backface-hidden flex flex-col p-3 rounded-[2.5rem] bg-slate-900 border-2 ${result ? getRarityColor(result.rarity) : ''}`}
                    style={{ transform: 'rotateY(180deg) translateZ(1px)' }}
                  >
                    {/* Visual Polish Elements */}
                    {result && (
                      <>
                        <div className={`rarity-glow ${getRarityColor(result.rarity).split(' ')[0].replace('text-', 'bg-')}`}></div>
                        {['Legendary', 'Mythic'].includes(result.rarity) && (
                          <>
                            <div className="legendary-aura"></div>
                            <div className="shine-effect animate-shine"></div>
                          </>
                        )}
                      </>
                    )}

                    <div className="flex-1 rounded-[1.8rem] bg-[#0b1120] flex items-center justify-center overflow-hidden relative shadow-inner">
                    {result && (
                      <>
                        <img src={result.image} alt={result.name} className="w-full h-full object-cover animate-pop-in" style={{ WebkitTransform: 'translateZ(0)' }} />
                        {result.is_gold && (
                          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/40 via-transparent to-yellow-500/10 animate-pulse"></div>
                        )}
                        
                        {/* Overlay for duplicate level up */}
                        {result.new_level > 0 && (
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 animate-bounce">
                            <span className="bg-blue-600/90 text-white text-[12px] font-black px-3 py-1 rounded-xl shadow-lg border-2 border-blue-400 whitespace-nowrap hidden sm:inline-block">
                              Lvl.{result.new_level} 🆙
                            </span>
                            <span className="bg-blue-600/90 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-lg border-2 border-blue-400 whitespace-nowrap sm:hidden">
                              Lvl.{result.new_level} 🆙
                            </span>
                          </div>
                        )}

                        {/* Overlay for name */}
                        <div className="absolute bottom-4 left-4 right-4 py-2 rounded-xl bg-black/60 border border-white/10 text-center animate-fade-up">
                          <div className="text-xs font-black uppercase tracking-widest">{result.name}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Rare Badge */}
                  {result && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border-2 bg-slate-900 ${getRarityColor(result.rarity).split(' ')[0]} ${getRarityColor(result.rarity).split(' ')[1]}`}>
                      {result.rarity}
                    </div>
                  )}

                  {/* NEW! Badge */}
                  {result?.is_new && (
                    <div className="absolute -top-4 -right-4 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[12px] font-black px-4 py-1 rounded-full shadow-[0_0_20px_rgba(225,29,72,0.8)] border-2 border-red-400/50 rotate-12 z-50 animate-bounce">
                      NEW!
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Action Area */}
            <div className="mt-4 w-full px-2 flex-1 flex flex-col justify-end pb-2">
              <button
                onClick={spin}
                disabled={loading || userStats.energy < 1}
                className={`w-full py-3.5 rounded-2xl font-black text-base tracking-widest uppercase transition-all duration-300 transform active:scale-95 shadow-xl relative overflow-hidden group ${(loading || userStats.energy < 1)
                    ? 'bg-slate-800 text-slate-600 grayscale'
                    : 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-500/40'
                  }`}
              >
                <span className="relative z-10 font-mono tracking-[0.2em]">
                  {loading ? 'ПРОЦЕС...' : (userStats.energy < 1 ? `⏳ ${formatTime(userStats.next_energy_in_seconds)}` : 'КРУТИТИ')}
                </span>
                {!loading && userStats.energy >= 1 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                )}
              </button>

              {result && (
                <div className="mt-3 text-center animate-bounce-slow">
                  <span className="bg-slate-800/80 px-4 py-1.5 rounded-full text-[10px] font-bold text-slate-300 border border-slate-700/50">
                    ✨ {result.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
