import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from admin_panel import setup_admin
from bootstrap import bootstrap_system
from config import validate_runtime_configuration
from database import engine
from routers.drone import (
    router as drone_router,
    create_drone_game_session,
    drone_reward,
    get_max_allowed_drone_score,
    start_drone_game,
)
from routers.gameplay import (
    router as gameplay_router,
    buy_energy,
    claim_daily,
    get_collection,
    get_leaderboard,
    premium_spin,
    sell_duplicate,
    spin,
)
from routers.referral import (
    router as referral_router,
    claim_referral,
    get_referral_link,
    is_referral_eligible_user,
)
from routers.season import (
    router as season_router,
    claim_season_reward,
    ensure_season_exists,
    get_active_season,
    get_season,
)
from routers.user import router as user_router, get_user
from schemas import DroneRewardRequest
from user_service import get_or_create_user

load_dotenv()
RUNTIME_CONFIG = validate_runtime_configuration()
ADMIN_SECRET = RUNTIME_CONFIG["admin_secret"]
ADMIN_ENABLED = RUNTIME_CONFIG["admin_enabled"]
CORS_ALLOW_ORIGINS = RUNTIME_CONFIG["cors_origins"]
CORS_ALLOW_ORIGIN_REGEX = RUNTIME_CONFIG["cors_origin_regex"]
if not CORS_ALLOW_ORIGINS and not CORS_ALLOW_ORIGIN_REGEX:
    CORS_ALLOW_ORIGINS = ["*"]

bootstrap_system()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

app = FastAPI(title="UAIFU Admin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def https_middleware(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
        request.scope["scheme"] = "https"
    response = await call_next(request)
    return response


setup_admin(
    app=app,
    engine=engine,
    templates_dir=TEMPLATES_DIR,
    admin_secret=ADMIN_SECRET,
    admin_enabled=ADMIN_ENABLED,
)

app.include_router(user_router)
app.include_router(gameplay_router)
app.include_router(referral_router)
app.include_router(season_router)
app.include_router(drone_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
