import { useEffect, useRef, useState } from 'react'

import { claimDroneReward, startDroneGameRequest } from '../lib/api'

const DRONE_TYPES = ['RED', 'STEALTH']
const OBSTACLE_TYPES = ['LIGHT', 'CONE']
const INITIAL_BIRD = { x: 50, y: 250, velocity: 0, width: 44, height: 44 }

const getRandomIntInclusive = (min, max) => (
  Math.floor(Math.random() * (max - min + 1)) + min
)

const pickRandomItem = (items) => items[getRandomIntInclusive(0, items.length - 1)]

function DroneGame({ user, onClose, triggerHaptic }) {
  const canvasRef = useRef(null)
  const droneImgRef = useRef(null)
  const dayBgRef = useRef(null)
  const cloudsRef = useRef(null)
  const lightsRef = useRef(null)
  const conesRef = useRef(null)

  const [gameState, setGameState] = useState('START')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('drone_highscore') || '0', 10))
  const [rewardClaimed, setRewardClaimed] = useState(false)
  const [startingGame, setStartingGame] = useState(false)

  const GRAVITY = 0.2
  const JUMP = -4.5
  const PIPE_SPEED = 3.0
  const PIPE_SPAWN_RATE = 110
  const PIPE_WIDTH = 50
  const GAP_SIZE = 170

  const requestRef = useRef(null)
  const birdRef = useRef({ ...INITIAL_BIRD })
  const pipesRef = useRef([])
  const frameCountRef = useRef(0)
  const scoreRef = useRef(0)
  const highScoreRef = useRef(parseInt(localStorage.getItem('drone_highscore') || '0', 10))
  const rewardClaimedRef = useRef(false)
  const pendingRewardRef = useRef(false)
  const sessionTokenRef = useRef(null)
  const gameStateRef = useRef('START')
  const droneTypeRef = useRef('RED')
  const gameOverHandledRef = useRef(false)

  useEffect(() => {
    const V = '1.4'
    const loadImg = (src, ref) => {
      const img = new Image()
      img.src = `${src}?v=${V}`
      img.onload = () => { ref.current = img }
    }

    loadImg('/drone.png', droneImgRef)
    loadImg('/day_theme/day_bg.png', dayBgRef)
    loadImg('/day_theme/clouds.png', cloudsRef)
    loadImg('/day_theme/traffic_lights.png', lightsRef)
    loadImg('/day_theme/traffic_cones.png', conesRef)
  }, [])

  const startGame = async () => {
    if (startingGame) return

    setStartingGame(true)
    gameStateRef.current = 'STARTING'
    setGameState('STARTING')

    try {
      const response = await startDroneGameRequest()
      sessionTokenRef.current = response.data.session_token
    } catch (error) {
      console.error('Start game session error', error)
      sessionTokenRef.current = null
    }

    birdRef.current = { ...INITIAL_BIRD }
    pipesRef.current = []
    frameCountRef.current = 0
    scoreRef.current = 0
    rewardClaimedRef.current = false
    pendingRewardRef.current = false
    gameOverHandledRef.current = false
    droneTypeRef.current = pickRandomItem(DRONE_TYPES)
    gameStateRef.current = 'PLAYING'

    setScore(0)
    setRewardClaimed(false)
    setGameState('PLAYING')
    setStartingGame(false)
  }

  const jump = () => {
    if (gameStateRef.current === 'PLAYING') {
      birdRef.current.velocity = JUMP
      triggerHaptic('selection')
      return
    }

    if (gameStateRef.current === 'START' || gameStateRef.current === 'GAMEOVER') {
      void startGame()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const claimRewardIfNeeded = async (finalScore) => {
      if (!user || !sessionTokenRef.current || rewardClaimedRef.current || pendingRewardRef.current) return
      if (finalScore <= 0) return

      pendingRewardRef.current = true
      try {
        await claimDroneReward({ session_token: sessionTokenRef.current, score: finalScore })
        rewardClaimedRef.current = true
        setRewardClaimed(true)
      } catch (error) {
        console.error('Reward error', error)
      } finally {
        sessionTokenRef.current = null
        pendingRewardRef.current = false
      }
    }

    const endGame = () => {
      if (gameOverHandledRef.current) return

      gameOverHandledRef.current = true
      gameStateRef.current = 'GAMEOVER'
      setGameState('GAMEOVER')
      triggerHaptic('error')

      const finalScore = scoreRef.current
      if (finalScore > highScoreRef.current) {
        highScoreRef.current = finalScore
        setHighScore(finalScore)
        localStorage.setItem('drone_highscore', finalScore.toString())
      }

      if (finalScore >= 5) {
        void claimRewardIfNeeded(finalScore)
      }
    }

    const drawPixelCloud = (x, y) => {
      ctx.fillStyle = '#ffffff'
      const unit = 6
      ctx.fillRect(x, y, unit * 6, unit * 3)
      ctx.fillRect(x - unit, y + unit, unit * 8, unit * 2)
      ctx.fillRect(x + unit, y - unit, unit * 4, unit)
    }

    const loop = () => {
      if (gameStateRef.current === 'PLAYING') {
        birdRef.current.velocity += GRAVITY
        birdRef.current.y += birdRef.current.velocity

        if (birdRef.current.y < 0 || birdRef.current.y > 600) {
          endGame()
        }

        if (gameStateRef.current === 'PLAYING') {
          frameCountRef.current += 1

          if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
            const height = getRandomIntInclusive(50, 300)
            const type = pickRandomItem(OBSTACLE_TYPES)
            pipesRef.current.push({ x: 400, top: height, bottom: height + GAP_SIZE, passed: false, type })
          }

          let didCollide = false

          for (const pipe of pipesRef.current) {
            pipe.x -= PIPE_SPEED

            const hitObstacle =
              birdRef.current.x + birdRef.current.width > pipe.x &&
              birdRef.current.x < pipe.x + PIPE_WIDTH &&
              (birdRef.current.y < pipe.top || birdRef.current.y + birdRef.current.height > pipe.bottom)

            if (hitObstacle) {
              didCollide = true
              break
            }

            if (!pipe.passed && birdRef.current.x > pipe.x + PIPE_WIDTH) {
              pipe.passed = true
              scoreRef.current += 1
              setScore(scoreRef.current)
            }
          }

          if (didCollide) {
            endGame()
          }

          pipesRef.current = pipesRef.current.filter(pipe => pipe.x > -PIPE_WIDTH)
        }
      }

      const cw = ctx.canvas.width
      const ch = ctx.canvas.height
      ctx.clearRect(0, 0, cw, ch)

      ctx.fillStyle = '#29abe2'
      ctx.fillRect(0, 0, cw, ch)

      ctx.fillStyle = '#fef08a'
      const sunX = 330
      const sunY = 70
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          if (Math.abs(r) + Math.abs(c) <= 2) {
            ctx.fillRect(sunX + c * 12 - 6, sunY + r * 12 - 6, 12, 12)
          }
        }
      }

      for (let i = 0; i < 3; i += 1) {
        const x = (i * 350 - (frameCountRef.current * 0.4) % 1050)
        const y = 80 + (i % 2) * 60
        drawPixelCloud(x, y)
        drawPixelCloud(x + 180, y - 40)
      }

      if (dayBgRef.current && dayBgRef.current.complete) {
        const bgX = -(frameCountRef.current * 0.8) % 800
        ctx.drawImage(dayBgRef.current, 0, 150, 800, 230, bgX, 320, 800, 230)
        ctx.drawImage(dayBgRef.current, 0, 150, 800, 230, bgX + 800, 320, 800, 230)
      }

      ctx.fillStyle = '#334155'
      ctx.fillRect(0, 550, 400, 50)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      for (let i = 0; i < 10; i += 1) {
        const x = (i * 80 - (frameCountRef.current * PIPE_SPEED) % 80)
        ctx.fillRect(x, 573, 40, 4)
      }

      pipesRef.current.forEach(pipe => {
        ctx.fillStyle = '#475569'

        const drawObstacle = (yPosition, isTop) => {
          if (pipe.type === 'LIGHT' && lightsRef.current) {
            const sx = isTop ? 160 : 64
            ctx.drawImage(lightsRef.current, sx, 0, 32, 64, pipe.x + 9, isTop ? yPosition - 64 : yPosition, 32, 64)
          } else if (pipe.type === 'CONE' && conesRef.current) {
            ctx.drawImage(conesRef.current, 0, 0, 32, 32, pipe.x + 9, isTop ? yPosition - 32 : yPosition, 32, 32)
          }
        }

        ctx.fillRect(pipe.x + 22, 0, 6, pipe.top)
        drawObstacle(pipe.top, true)
        ctx.fillRect(pipe.x + 22, pipe.bottom, 6, 600 - pipe.bottom)
        drawObstacle(pipe.bottom, false)
      })

      ctx.save()
      ctx.translate(birdRef.current.x + birdRef.current.width / 2, birdRef.current.y + birdRef.current.height / 2)
      ctx.rotate(Math.min(0.5, Math.max(-0.5, birdRef.current.velocity * 0.1)))

      if (droneImgRef.current) {
        const frameWidth = droneImgRef.current.width / 2
        const frameHeight = droneImgRef.current.height / 2
        const animationFrame = Math.floor(frameCountRef.current / 8) % 2
        const spriteRow = droneTypeRef.current === 'STEALTH' ? 1 : 0

        ctx.drawImage(
          droneImgRef.current,
          animationFrame * frameWidth,
          spriteRow * frameHeight,
          frameWidth,
          frameHeight,
          -birdRef.current.width / 2,
          -birdRef.current.height / 2,
          birdRef.current.width,
          birdRef.current.height
        )
      } else {
        ctx.fillStyle = '#f97316'
        ctx.fillRect(-birdRef.current.width / 2, -birdRef.current.height / 2, birdRef.current.width, birdRef.current.height)
      }

      ctx.restore()
      requestRef.current = requestAnimationFrame(loop)
    }

    requestRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(requestRef.current)
  }, [triggerHaptic, user])

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center touch-none select-none" onClick={jump}>
      <div className="relative w-full max-w-[400px] aspect-[2/3] overflow-hidden rounded-[2.5rem] border-4 border-slate-900 bg-black">
        <canvas ref={canvasRef} width="400" height="600" className="w-full h-full" />
        <div className="absolute top-8 left-8 right-8 flex justify-between pointer-events-none">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest drop-shadow-sm">Score</span>
            <span className="text-3xl font-black text-slate-950 drop-shadow-[0_2px_2px_rgba(255,255,255,0.8)]">{score}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">High</span>
            <span className="text-sm font-black text-slate-800 block">{highScore}</span>
            {rewardClaimed && <span className="text-[9px] font-black text-emerald-600 uppercase">Coin+ 🪙</span>}
          </div>
        </div>

        {(gameState === 'START' || gameState === 'STARTING') && (
          <div className="absolute inset-0 bg-sky-100/40 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
            <div className="text-5xl mb-6 animate-bounce">🐶</div>
            <h1 className="text-3xl font-black text-slate-950 italic tracking-tighter mb-2">DRONE DASH</h1>
            <p className="text-xs text-slate-700 mb-8 font-bold">
              {gameState === 'STARTING'
                ? 'Готуємо безпечну сесію польоту...'
                : <>Клікай, щоб летіти.<br />Заробляй 1 монету за 5 очок.</>}
            </p>
            <div className="px-8 py-3 bg-slate-900 rounded-2xl text-white font-black text-xs uppercase animate-pulse shadow-xl">
              {gameState === 'STARTING' ? 'ПІДКЛЮЧЕННЯ...' : 'Клікніть для старту'}
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center p-8 text-center animate-fade-in backdrop-blur-lg">
            <h2 className="text-4xl font-black text-slate-950 italic tracking-tighter mb-2">GAME OVER</h2>
            <div className="text-2xl font-black text-blue-900 mb-3 drop-shadow-sm">{score} <span className="text-[10px] text-slate-500 uppercase">очок</span></div>
            <div className="mb-8 text-[11px] font-bold text-slate-700">
              {score >= 5 ? `Зароблено монет: ${Math.floor(score / 5)} 🪙` : 'Наберіть 5 очок для нагороди!'}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button onClick={(event) => { event.stopPropagation(); void startGame() }} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase transition-all active:scale-95 shadow-lg">Ще раз</button>
              <button onClick={(event) => { event.stopPropagation(); onClose(score) }} className="w-full py-4 bg-white text-slate-600 font-bold border-2 border-slate-200 rounded-2xl text-xs uppercase transition-all active:scale-95">У хаб</button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-8 text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-50">Натисніть будь-де, щоб летіти</p>
    </div>
  )
}

export default DroneGame
