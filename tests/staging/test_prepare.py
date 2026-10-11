"""Private staging initialization, entirely inside temporary test directories."""

import contextlib
import importlib.util
import io
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "deploy/prepare_staging.py"
SPEC = importlib.util.spec_from_file_location("prepare_staging", SOURCE)
prepare = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare)


class PrepareStaging(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patcher = patch.object(prepare, "ROOT", self.root)
        self.patcher.start()
        self.old_umask = os.umask(0o077)

    def tearDown(self):
        os.umask(self.old_umask)
        self.patcher.stop()
        self.temp.cleanup()

    @staticmethod
    def certificate(command, **kwargs):
        Path(command[command.index("-keyout") + 1]).write_text("TEST_PRIVATE_KEY")
        Path(command[command.index("-out") + 1]).write_text("TEST_CERTIFICATE")
        return SimpleNamespace(returncode=0)

    def test_creates_private_configuration_without_printing_secrets(self):
        with (
            patch.object(prepare.shutil, "which", return_value="openssl"),
            patch.object(
                prepare.subprocess,
                "run",
                side_effect=self.certificate,
            ),
            contextlib.redirect_stdout(io.StringIO()) as output,
        ):
            prepare.main()
        env = self.root / ".env.staging"
        values = dict(
            line.split("=", 1)
            for line in env.read_text().splitlines()
            if not line.startswith("#")
        )
        self.assertEqual(env.stat().st_mode & 0o777, 0o600)
        self.assertEqual(
            (self.root / ".cache/staging/tls/localhost.pem").stat().st_mode & 0o777,
            0o600,
        )
        for key in (
            "STAGING_POSTGRES_PASSWORD",
            "STAGING_SEED_EMPLOYEE_PASSWORD",
            "STAGING_SEED_MANAGER_PASSWORD",
            "STAGING_SEED_ADMINISTRATOR_PASSWORD",
        ):
            self.assertEqual(len(values[key]), 48)
            self.assertNotIn(values[key], output.getvalue())
        self.assertEqual(len({values[key] for key in values if "PASSWORD" in key}), 4)
        self.assertFalse((self.root / ".env").exists())

    def test_preserves_existing_configuration(self):
        env = self.root / ".env.staging"
        env.write_text("PRESERVE_EXISTING")
        with self.assertRaises(SystemExit):
            prepare.main()
        self.assertEqual(env.read_text(), "PRESERVE_EXISTING")

    def test_preserves_existing_certificate_directory(self):
        tls = self.root / ".cache/staging/tls"
        tls.mkdir(parents=True)
        with self.assertRaises(SystemExit):
            prepare.main()
        self.assertFalse((self.root / ".env.staging").exists())

    def test_missing_openssl_does_not_write_configuration(self):
        with (
            patch.object(prepare.shutil, "which", return_value=None),
            self.assertRaises(SystemExit),
        ):
            prepare.main()
        self.assertFalse((self.root / ".env.staging").exists())

    def test_certificate_failure_does_not_write_configuration(self):
        with (
            patch.object(prepare.shutil, "which", return_value="openssl"),
            patch.object(
                prepare.subprocess,
                "run",
                return_value=SimpleNamespace(returncode=1),
            ),
            self.assertRaises(SystemExit),
        ):
            prepare.main()
        self.assertFalse((self.root / ".env.staging").exists())
        self.assertFalse((self.root / ".cache/staging/tls").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
