"""Create independent private local staging credentials and a localhost certificate."""

import os
import secrets
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    env = ROOT / ".env.staging"
    tls = ROOT / ".cache/staging/tls"
    if env.exists() or tls.exists():
        raise SystemExit(
            "Staging configuration already exists; existing values were preserved."
        )
    openssl = shutil.which("openssl")
    if not openssl:
        raise SystemExit("Install OpenSSL before preparing local staging.")
    os.umask(0o077)
    password = secrets.token_hex(24)
    tls.parent.mkdir(parents=True, exist_ok=True)
    # Generate in a temporary directory before creating the final private files.
    with tempfile.TemporaryDirectory(dir=tls.parent) as temporary:
        scratch = Path(temporary)
        result = subprocess.run(
            [
                openssl,
                "req",
                "-x509",
                "-newkey",
                "rsa:3072",
                "-sha256",
                "-nodes",
                "-days",
                "30",
                "-subj",
                "/CN=localhost",
                "-addext",
                "subjectAltName=DNS:localhost,IP:127.0.0.1",
                "-keyout",
                str(scratch / "localhost.key"),
                "-out",
                str(scratch / "localhost.crt"),
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode:
            raise SystemExit(
                "Local certificate generation failed; configuration was not written."
            )
        values = {
            "STAGING_POSTGRES_PASSWORD": password,
            "STAGING_DATABASE_URL": (
                f"postgresql+psycopg://aip_lms_staging:{password}"
                "@postgres:5432/aip_lms_staging"
            ),
            "STAGING_SEED_EMPLOYEE_PASSWORD": secrets.token_hex(24),
            "STAGING_SEED_MANAGER_PASSWORD": secrets.token_hex(24),
            "STAGING_SEED_ADMINISTRATOR_PASSWORD": secrets.token_hex(24),
        }
        with env.open("x") as handle:
            handle.write(
                "# Private local Docker staging only. Do not commit or share.\n"
            )
            for key, value in values.items():
                handle.write(f"{key}={value}\n")
        tls.mkdir()
        shutil.copyfile(scratch / "localhost.crt", tls / "localhost.crt")
        with (tls / "localhost.pem").open("xb") as handle:
            handle.write((scratch / "localhost.crt").read_bytes())
            handle.write((scratch / "localhost.key").read_bytes())
    print("Prepared .env.staging and .cache/staging/tls; credentials were not printed.")


if __name__ == "__main__":
    main()
