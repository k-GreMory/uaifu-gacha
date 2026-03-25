import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import config


class ConfigTests(unittest.TestCase):
    def test_bot_token_alias_uses_telegram_bot_token(self):
        with patch.dict(os.environ, {"BOT_TOKEN": "", "TELEGRAM_BOT_TOKEN": "alias-token"}, clear=False):
            self.assertEqual(config.get_bot_token(), "alias-token")

    def test_telegram_auth_max_age_can_be_overridden(self):
        with patch.dict(os.environ, {"TELEGRAM_AUTH_MAX_AGE_SECONDS": "42"}, clear=False):
            self.assertEqual(config.get_telegram_auth_max_age_seconds(), 42)

    def test_admin_is_disabled_by_default_without_secret(self):
        with patch.dict(os.environ, {"ENABLE_ADMIN": "", "ADMIN_SECRET": ""}, clear=False):
            self.assertFalse(config.is_admin_enabled(None))


if __name__ == "__main__":
    unittest.main()
