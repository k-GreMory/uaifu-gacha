# Animemes Collector Launch Script (Static Domain) - ASCII ONLY

Write-Host "--- Launching Animemes Collector ---" -ForegroundColor Cyan

# 1. Start Backend (FastAPI) on port 8001
Write-Host "Starting backend on port 8001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

# 2. Start Frontend (Vite) on port 5173
Write-Host "Starting frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --port 5173"

# 3. Start ngrok (Frontend) with STATIC DOMAIN
Write-Host "Opening STATIC ngrok tunnel for frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 5173 --domain thomasina-unannealed-granville.ngrok-free.dev"

# 4. Start localtunnel (Backend) with static subdomain
Write-Host "Opening localtunnel for backend (uaifu-api)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx localtunnel --port 8001 --subdomain uaifu-api-v2"

Write-Host "DONE: All systems running!" -ForegroundColor Green
Write-Host "Your static URL: https://thomasina-unannealed-granville.ngrok-free.dev" -ForegroundColor Cyan
