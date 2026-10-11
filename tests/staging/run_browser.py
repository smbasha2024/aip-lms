"""Load private staging credentials into a child browser runner without printing them."""

import os
import subprocess
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    env = os.environ.copy()
    temporary = ROOT / ".cache/staging/browser-tmp"
    temporary.mkdir(parents=True, exist_ok=True)
    env["TMPDIR"] = str(temporary)
    for key, value in dotenv_values(ROOT / ".env.staging").items():
        if key.startswith("STAGING_SEED_") and value:
            env[key] = value
    subprocess.run(
        [
            "node",
            "frontend/node_modules/@playwright/test/cli.js",
            "test",
            "--config=tests/staging/playwright.config.ts",
        ],
        cwd=ROOT,
        env=env,
        check=True,
    )


if __name__ == "__main__":
    main()
