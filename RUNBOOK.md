# UAIFU Runbook

## Services
- Frontend: Vercel
- Backend API: Railway
- Database: SQLite via `DATABASE_URL`

## Balance And Season Seeds
- Game economy loads from [backend/content/game_balance.json](/D:/gachaAPP/backend/content/game_balance.json) via [backend/game_balance.py](/D:/gachaAPP/backend/game_balance.py)
- Default season seed loads from [backend/content/default_season.json](/D:/gachaAPP/backend/content/default_season.json) via [backend/season_catalog.py](/D:/gachaAPP/backend/season_catalog.py)
- Optional override envs: `GAME_BALANCE_FILE`, `DEFAULT_SEASON_FILE`

## Critical Env
### Backend
- `DATABASE_URL`: path or hosted database connection string
- `BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`: Telegram bot token for WebApp auth validation
- `BOT_NAME`: bot username used for referral links
- `ALLOW_DEV_AUTH`: `true` only for local development
- `FRONTEND_URL`, `FRONTEND_URLS`, `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_ORIGIN_REGEX`: frontend allowlist
- `ENABLE_ADMIN`, `ADMIN_SECRET`: admin panel access
- `APP_VERSION` or `RAILWAY_GIT_COMMIT_SHA`: version metadata for `/health/version`
- `DRONE_SESSION_TTL_MINUTES`, `MAX_DRONE_COINS_PER_RUN`, `MAX_DRONE_SCORE_PER_SECOND`, `DRONE_SCORE_GRACE`: drone anti-abuse limits

### Frontend
- `VITE_BACKEND_URL`: optional API override for non-prod environments

See [backend/.env.example](/D:/gachaAPP/backend/.env.example) for the baseline template.

## Local Start
### Backend
```powershell
cd D:\gachaAPP\backend
.\venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd D:\gachaAPP\frontend
npm run dev
```

## Deploy
### Backend
```powershell
cd D:\gachaAPP
git push origin main
```

### Frontend
- Vercel should redeploy automatically from the same repo push.

## Smoke Check
### Backend health
- [health](/D:/gachaAPP/backend/main.py)
- [health version](/D:/gachaAPP/backend/main.py)

```powershell
Invoke-WebRequest https://uaifu-gacha-production.up.railway.app/health | Select-Object -Expand Content
Invoke-WebRequest https://uaifu-gacha-production.up.railway.app/health/version | Select-Object -Expand Content
```

Expected:
- `"status":"ok"`
- `"bootstrapped":true`
- `version` or `version_short` matches the intended deploy metadata

## Recovery
Always run `diff` before `merge`.

### Export a user snapshot
```powershell
python backend/user_data_tools.py export --db-url "sqlite:///D:/gachaAPP/backend/uaifu.db" --user-id 123456 --output user-123456.json
```

### Compare source and target
```powershell
python backend/user_data_tools.py diff --source-db-url "sqlite:///D:/source.db" --target-db-url "sqlite:///D:/target.db" --user-id 123456
```

### Dry-run merge
```powershell
python backend/user_data_tools.py merge --snapshot user-123456.json --target-db-url "sqlite:///D:/target.db" --user-id 123456 --dry-run
```

### Real merge
```powershell
python backend/user_data_tools.py merge --snapshot user-123456.json --target-db-url "sqlite:///D:/target.db" --user-id 123456
```

## Quick Production Checklist
- Backend push reached GitHub `main`
- Railway env has correct token and CORS values
- `/health/version` returns the expected version metadata
- Frontend points to the intended backend
- Telegram mini app opens and `/user` loads without auth errors
