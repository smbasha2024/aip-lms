"""Repository-level secret/configuration guard; never reads private dotenv values."""

import re
import subprocess

from app.config import REPOSITORY_ROOT


def test_private_configuration_is_ignored_and_untracked():
    files = (
        subprocess.check_output(["git", "ls-files", "-z"], cwd=REPOSITORY_ROOT).decode().split("\0")
    )
    private = {".env", "frontend/.env.local", "backend/.env"}
    assert not private.intersection(files)
    for name in private:
        result = subprocess.run(
            ["git", "check-ignore", "--no-index", name], cwd=REPOSITORY_ROOT, capture_output=True
        )
        assert result.returncode == 0, name
    assert not any(name.endswith((".pem", ".key", ".p12", ".pfx")) for name in files)


def test_frontend_environment_example_only_declares_approved_public_values():
    content = (REPOSITORY_ROOT / "frontend/.env.example").read_text()
    keys = re.findall(r"^([A-Z_]+)=", content, flags=re.MULTILINE)
    assert set(keys) == {"NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_NAME"}


def test_application_sources_have_no_embedded_private_keys_or_raw_sql_interpolation():
    key = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
    sql = re.compile(r"\b(?:text|execute)\(f[\"']")
    sources = list((REPOSITORY_ROOT / "backend/app").rglob("*.py"))
    sources += list((REPOSITORY_ROOT / "frontend").glob("features/**/*.tsx"))
    sources += list((REPOSITORY_ROOT / "frontend").glob("services/**/*.ts"))
    assert sources
    for path in sources:
        content = path.read_text()
        assert not key.search(content), str(path.relative_to(REPOSITORY_ROOT))
        if path.suffix == ".py":
            assert not sql.search(content), str(path.relative_to(REPOSITORY_ROOT))
