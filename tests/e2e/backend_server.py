"""Browser-test entry point: explicit test environment, no developer dotenv reads."""

import os

from app.config import Settings
from app.main import create_app


def create_test_app():
    if os.environ.get("APP_ENV") != "test":
        raise RuntimeError("Browser test server requires APP_ENV=test")
    # Settings still enforces a distinct database with 'test' in its name.
    return create_app(Settings(_env_file=None, app_env="test"))
