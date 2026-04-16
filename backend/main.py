import os
from contextlib import asynccontextmanager
from threading import Lock

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from admin_panel import setup_admin
from bootstrap import bootstrap_system
from config import get_app_version, get_app_version_short, validate_runtime_configuration
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
_BOOTSTRAP_LOCK = Lock()
_BOOTSTRAP_COMPLETED = False


def ensure_bootstrap():
    global _BOOTSTRAP_COMPLETED
    if _BOOTSTRAP_COMPLETED:
        return False

    with _BOOTSTRAP_LOCK:
        if _BOOTSTRAP_COMPLETED:
            return False
        bootstrap_system()
        _BOOTSTRAP_COMPLETED = True
        return True


def is_bootstrap_completed() -> bool:
    return _BOOTSTRAP_COMPLETED


def create_app() -> FastAPI:
    load_dotenv()
    runtime_config = validate_runtime_configuration()
    admin_secret = runtime_config["admin_secret"]
    admin_enabled = runtime_config["admin_enabled"]
    cors_allow_origins = runtime_config["cors_origins"]
    cors_allow_origin_regex = runtime_config["cors_origin_regex"]
    # When no explicit whitelist is configured we intentionally leave the
    # list empty instead of falling back to "*". Allowing every origin is
    # risky (and in production `validate_runtime_configuration` has already
    # warned about it). Local development still works because
    # get_cors_allowed_origins() returns LOCAL_FRONTEND_ORIGINS as a default.

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        ensure_bootstrap()
        app_instance.state.bootstrapped = True
        yield

    app_instance = FastAPI(title="UAIFU Admin API", version="1.0.0", lifespan=lifespan)
    app_instance.state.bootstrapped = False
    app_instance.state.runtime_config = runtime_config
    app_instance.state.app_version = get_app_version()
    app_instance.state.app_version_short = get_app_version_short()

    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins,
        allow_origin_regex=cors_allow_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app_instance.middleware("http")
    async def https_middleware(request: Request, call_next):
        if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
            request.scope["scheme"] = "https"
        response = await call_next(request)
        return response

    @app_instance.get("/health")
    async def health():
        return {
            "status": "ok",
            "bootstrapped": is_bootstrap_completed(),
        }

    @app_instance.get("/health/version")
    async def health_version():
        return {
            "status": "ok",
            "bootstrapped": is_bootstrap_completed(),
            "version": app_instance.state.app_version,
            "version_short": app_instance.state.app_version_short,
            "environment": "non_local" if runtime_config["non_local"] else "local",
        }

    setup_admin(
        app=app_instance,
        engine=engine,
        templates_dir=TEMPLATES_DIR,
        admin_secret=admin_secret,
        admin_enabled=admin_enabled,
    )

    app_instance.include_router(user_router)
    app_instance.include_router(gameplay_router)
    app_instance.include_router(referral_router)
    app_instance.include_router(season_router)
    app_instance.include_router(drone_router)
    return app_instance


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
