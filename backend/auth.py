import hashlib
import hmac
import json
import os
import time
from typing import Optional
from urllib.parse import parse_qsl

from fastapi import HTTPException, Request
from pydantic import BaseModel

from config import get_bot_token, is_dev_auth_enabled

class TelegramAuthUser(BaseModel):
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    source: str = "telegram"
    auth_date: Optional[int] = None

def build_telegram_data_check_string(init_data: str) -> tuple[dict[str, str], str]:
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    provided_hash = parsed.pop("hash", None)
    if not provided_hash:
        raise ValueError("Missing hash in initData")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed.items())
    )
    return parsed, data_check_string


def validate_telegram_init_data(init_data: str, bot_token: str, max_age_seconds: int) -> TelegramAuthUser:
    parsed, data_check_string = build_telegram_data_check_string(init_data)
    provided_hash = dict(parse_qsl(init_data, keep_blank_values=True)).get("hash", "")

    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, provided_hash):
        raise ValueError("Invalid Telegram signature")

    auth_date_raw = parsed.get("auth_date")
    if not auth_date_raw:
        raise ValueError("Missing auth_date")

    auth_date = int(auth_date_raw)
    if max_age_seconds > 0 and (time.time() - auth_date) > max_age_seconds:
        raise ValueError("Telegram auth data expired")

    user_raw = parsed.get("user")
    if not user_raw:
        raise ValueError("Missing Telegram user")

    user_payload = json.loads(user_raw)
    user_id = int(user_payload["id"])
    return TelegramAuthUser(
        id=user_id,
        username=user_payload.get("username"),
        first_name=user_payload.get("first_name"),
        auth_date=auth_date,
        source="telegram",
    )


def get_authenticated_telegram_user(request: Request) -> TelegramAuthUser:
    init_data = request.headers.get("X-Telegram-Init-Data", "").strip()
    if init_data:
        try:
            max_age_seconds = int(os.getenv("TELEGRAM_AUTH_MAX_AGE_SECONDS", "86400"))
            bot_token = get_bot_token(required=True)
            return validate_telegram_init_data(init_data, bot_token, max_age_seconds)
        except HTTPException:
            raise
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=401, detail=f"Telegram auth failed: {exc}") from exc

    allow_dev_auth = is_dev_auth_enabled()
    if not allow_dev_auth:
        raise HTTPException(status_code=401, detail="Missing Telegram auth data")

    dev_user_id = (
        request.headers.get("X-Dev-User-Id")
        or request.query_params.get("user_id")
    )
    if not dev_user_id:
        raise HTTPException(status_code=401, detail="Missing development user_id")

    try:
        return TelegramAuthUser(
            id=int(dev_user_id),
            username=request.headers.get("X-Dev-Username") or request.query_params.get("username"),
            first_name=request.headers.get("X-Dev-First-Name") or request.query_params.get("first_name"),
            source="dev",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid development user_id") from exc
