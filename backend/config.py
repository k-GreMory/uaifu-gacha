import os
from typing import Optional

LOCAL_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
NON_LOCAL_MARKERS = (
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_ENVIRONMENT_NAME",
    "VERCEL",
    "VERCEL_ENV",
    "RENDER",
    "FLY_APP_NAME",
)


def parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_csv(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def dedupe_preserve_order(items: list[str]) -> list[str]:
    result = []
    seen = set()
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def is_non_local_environment() -> bool:
    app_env = (os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    if app_env in {"development", "dev", "local", "test"}:
        return False
    if app_env in {"production", "prod", "staging"}:
        return True
    return any(os.getenv(marker) for marker in NON_LOCAL_MARKERS)


def is_local_environment() -> bool:
    return not is_non_local_environment()


def get_bot_token(required: bool = False) -> Optional[str]:
    token = (os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if required and not token:
        raise RuntimeError("BOT_TOKEN or TELEGRAM_BOT_TOKEN must be configured")
    return token or None


def get_admin_secret() -> Optional[str]:
    secret = os.getenv("ADMIN_SECRET", "").strip()
    return secret or None


def is_admin_enabled(admin_secret: Optional[str] = None) -> bool:
    explicit = os.getenv("ENABLE_ADMIN")
    if explicit is not None:
        return parse_bool(explicit, default=False)
    return bool(admin_secret)


def is_dev_auth_enabled() -> bool:
    return parse_bool(os.getenv("ALLOW_DEV_AUTH"), default=is_local_environment())


def get_cors_allowed_origins() -> list[str]:
    origins = []
    origins.extend(parse_csv(os.getenv("CORS_ALLOW_ORIGINS")))
    origins.extend(parse_csv(os.getenv("FRONTEND_URLS")))

    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url:
        origins.append(frontend_url)

    if not origins and is_local_environment():
        origins.extend(LOCAL_FRONTEND_ORIGINS)

    return dedupe_preserve_order(origins)


def get_cors_allowed_origin_regex() -> Optional[str]:
    regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip()
    return regex or None


def validate_runtime_configuration() -> dict[str, object]:
    non_local = is_non_local_environment()
    admin_secret = get_admin_secret()
    admin_enabled = is_admin_enabled(admin_secret)
    dev_auth_enabled = is_dev_auth_enabled()
    cors_origins = get_cors_allowed_origins()
    cors_origin_regex = get_cors_allowed_origin_regex()

    warnings = []
    errors = []

    if non_local and dev_auth_enabled:
        errors.append("ALLOW_DEV_AUTH must be disabled outside local development.")

    if non_local and not get_bot_token(required=False):
        errors.append("BOT_TOKEN or TELEGRAM_BOT_TOKEN must be configured outside local development.")

    if admin_enabled and not admin_secret:
        errors.append("ADMIN_SECRET is required when admin is enabled.")

    if non_local and not cors_origins and not cors_origin_regex:
        warnings.append(
            "No CORS whitelist configured. Set FRONTEND_URL, FRONTEND_URLS, CORS_ALLOW_ORIGINS, or CORS_ALLOW_ORIGIN_REGEX."
        )

    for warning in warnings:
        print(f"[config] WARNING: {warning}")

    if errors:
        raise RuntimeError("Runtime configuration error(s): " + " ".join(errors))

    return {
        "non_local": non_local,
        "admin_enabled": admin_enabled,
        "admin_secret": admin_secret,
        "dev_auth_enabled": dev_auth_enabled,
        "cors_origins": cors_origins,
        "cors_origin_regex": cors_origin_regex,
    }
