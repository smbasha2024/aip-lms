"""Opt-in HTTPS integration checks against the synthetic local staging stack only."""

import concurrent.futures
import json
import os
import ssl
import subprocess
import time
import unittest
import uuid
from datetime import date, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "https://localhost:8443"
COMPOSE = [
    "docker",
    "compose",
    "--env-file",
    ".env.staging",
    "-f",
    "docker-compose.staging.yml",
]


def compose(*args, binary=False, data=None):
    result = subprocess.run(
        [*COMPOSE, *args],
        cwd=ROOT,
        input=data,
        capture_output=True,
        text=not binary,
        check=False,
    )
    if result.returncode:
        raise AssertionError(f"Staging Compose operation failed: {args[0]}")
    return result.stdout


def request(path, *, method="GET", body=None, token=None, headers=None):
    context = ssl.create_default_context(
        cafile=ROOT / ".cache/staging/tls/localhost.crt"
    )
    fields = dict(headers or {})
    if token:
        fields["Authorization"] = f"Bearer {token}"
    if body is not None:
        fields["Content-Type"] = "application/json"
    req = Request(
        ORIGIN + path,
        method=method,
        headers=fields,
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        response = urlopen(req, context=context, timeout=20)
    except HTTPError as exc:
        response = exc
    with response:
        raw = response.read()
        parsed = (
            json.loads(raw)
            if "application/json" in response.headers.get("Content-Type", "")
            else raw
        )
        return response.status, response.headers, parsed


def wait_ready():
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            if request("/health/ready")[0] == 200 and request("/login")[0] == 200:
                return
        except (URLError, OSError):
            pass
        time.sleep(1)
    raise AssertionError("Staging did not become ready")


def counts(database="aip_lms_staging"):
    if database != "aip_lms_staging" and not database.startswith("staging_restore_"):
        raise AssertionError("Only staging databases are allowed")
    sql = (
        "SELECT (SELECT version_num FROM alembic_version), "
        "(SELECT count(*) FROM employee), (SELECT count(*) FROM app_user), "
        "(SELECT count(*) FROM leave_appln), (SELECT count(*) FROM audit_log), "
        "(SELECT count(*) FROM notification), "
        "(SELECT count(*) FROM app_user WHERE password_hash LIKE '$argon2id$%'), "
        "(SELECT count(*) FROM department), (SELECT count(*) FROM holiday), "
        "(SELECT count(*) FROM leave_type), (SELECT count(*) FROM leave_balance), "
        "(SELECT COALESCE(sum(used), 0) FROM leave_balance), "
        "(SELECT COALESCE(sum(pending), 0) FROM leave_balance)"
    )
    return compose(
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "aip_lms_staging",
        "-d",
        database,
        "-Atc",
        sql,
    ).strip()


class StagingStack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if __name__ != "__main__" and os.environ.get("RUN_STAGING_TESTS") != "1":
            raise unittest.SkipTest("Run this staging script explicitly to enable live checks")
        cls.secrets = dotenv_values(ROOT / ".env.staging")
        expected = "@postgres:5432/aip_lms_staging"
        if not cls.secrets.get("STAGING_DATABASE_URL", "").endswith(expected):
            raise AssertionError("Refusing non-local staging configuration")
        wait_ready()
        cls.users = {}
        cls.tokens = {}
        for code, role in [
            ("EMP001", "EMPLOYEE"),
            ("MGR001", "MANAGER"),
            ("ADM001", "ADMINISTRATOR"),
        ]:
            status, _, body = request(
                "/api/v1/auth/login",
                method="POST",
                body={
                    "username": code,
                    "password": cls.secrets[f"STAGING_SEED_{role}_PASSWORD"],
                },
            )
            if status != 200:
                raise AssertionError(f"Staging {role} login failed ({status})")
            cls.users[role] = body["user"]
            cls.tokens[role] = body["access_token"]

    def api(
        self,
        path,
        role="EMPLOYEE",
        *,
        method="GET",
        body=None,
        expected=200,
        headers=None,
    ):
        status, fields, parsed = request(
            path, method=method, body=body, token=self.tokens[role], headers=headers
        )
        self.assertEqual(status, expected, f"{method} {path} status mismatch")
        self.assertEqual(fields.get("Cache-Control"), "no-store")
        return parsed

    def test_01_health_migration_and_runtime_isolation(self):
        self.assertEqual(request("/health")[2], {"status": "ok"})
        self.assertEqual(request("/health/ready")[2], {"status": "ready"})
        self.assertTrue(counts().startswith("0001|3|3|"))
        compose(
            "exec", "-T", "backend", "alembic", "-c", "database/alembic.ini", "check"
        )
        runtime = compose("ps", "--format", "json")
        services = [json.loads(line) for line in runtime.splitlines()]
        for service in services:
            if service["Service"] != "proxy":
                self.assertFalse(
                    any(p.get("PublishedPort") for p in service.get("Publishers") or [])
                )
        for service in ("backend", "frontend"):
            command = (
                ["python", "-c", "import os; assert os.getuid() != 0"]
                if service == "backend"
                else ["node", "-e", "if(process.getuid()===0)process.exit(1)"]
            )
            compose("exec", "-T", service, *command)

    def test_02_https_csp_and_cors(self):
        first = request("/login")
        second = request("/login")
        self.assertEqual(first[0], 200)
        policy = first[1]["Content-Security-Policy"]
        self.assertIn("'strict-dynamic'", policy)
        self.assertIn("frame-ancestors 'none'", policy)
        self.assertNotIn("'unsafe-inline'", policy)
        self.assertNotEqual(policy, second[1]["Content-Security-Policy"])
        allowed = request("/api/v1/auth/me", headers={"Origin": ORIGIN})
        denied = request(
            "/api/v1/auth/me", headers={"Origin": "https://untrusted.invalid"}
        )
        self.assertEqual(allowed[1]["Access-Control-Allow-Origin"], ORIGIN)
        self.assertIsNone(denied[1].get("Access-Control-Allow-Origin"))
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual(request(path)[0], 404)

    def test_03_three_role_reads_and_authorization(self):
        for role in self.users:
            me = self.api("/api/v1/auth/me", role)
            self.assertEqual(me["role"], role)
            self.api("/api/v1/dashboard", role)
            self.api("/api/v1/reports/leave-summary", role)
        self.api("/api/v1/managers/me/direct-reports", "MANAGER")
        self.api("/api/v1/leave/approvals/pending", "MANAGER")
        self.api("/api/v1/admin/leave-balances", "ADMINISTRATOR")
        self.api("/api/v1/employees", "ADMINISTRATOR")
        self.api("/api/v1/admin/audit-logs", expected=403)
        self.api(
            f"/api/v1/employees/{self.users['ADMINISTRATOR']['employee_id']}",
            expected=403,
        )
        self.assertEqual(request("/api/v1/dashboard")[0], 401)

    def test_04_leave_workflows_transactions_and_notifications(self):
        employee = self.users["EMPLOYEE"]["employee_id"]
        types = self.api("/api/v1/leave-types")["items"]
        sick = next(item for item in types if item["code"] == "SICK")["leave_type_id"]
        today = date.fromisoformat(self.users["EMPLOYEE"]["business_today"])
        history = self.api("/api/v1/leave/applications?page_size=100")["items"]
        occupied = {
            item["from_date"]
            for item in history
            if item["status"] in ("PENDING", "APPROVED")
        }
        candidates = []
        for offset in range(1, 75):
            day = today + timedelta(days=offset)
            if (
                day.weekday() < 5
                and day.year == today.year
                and day.isoformat() not in occupied
            ):
                candidates.append(day.isoformat())
            if len(candidates) == 3:
                break
        self.assertEqual(
            len(candidates), 3, "Need three unused future working dates this year"
        )
        balance_path = f"/api/v1/employees/{employee}/leave-balance?year={today.year}"

        def counters():
            return next(
                row
                for row in self.api(balance_path)["balances"]
                if row["leave_type_id"] == sick
            )

        before = counters()
        applications = []
        for day in candidates:
            body = {
                "employee_id": employee,
                "leave_type_id": sick,
                "from_date": day,
                "to_date": day,
            }
            self.assertEqual(
                self.api("/api/v1/leave/calculate-days", method="POST", body=body)[
                    "leave_days"
                ],
                1,
            )
            body["reason"] = "Synthetic Docker staging verification"
            applications.append(
                self.api(
                    "/api/v1/leave/applications", method="POST", body=body, expected=201
                )
            )
        self.assertEqual(counters()["pending"], before["pending"] + 3)
        approved, rejected, cancelled = [row["application_id"] for row in applications]

        def approve_once(_):
            return request(
                f"/api/v1/leave/applications/{approved}/approve",
                method="POST",
                token=self.tokens["MANAGER"],
            )[0]

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(approve_once, range(2))), [200, 409])
        self.api(
            f"/api/v1/leave/applications/{rejected}/reject",
            "MANAGER",
            method="POST",
            body={"reason": "Synthetic rejection"},
        )
        self.api(
            f"/api/v1/leave/applications/{cancelled}/cancel",
            method="POST",
            body={"reason": "Synthetic cancellation"},
        )
        after = counters()
        self.assertEqual(after["pending"], before["pending"])
        self.assertEqual(after["used"], before["used"] + 1)
        self.assertEqual(after["available"], before["available"] - 1)
        notifications = self.api("/api/v1/notifications")["items"]
        self.assertTrue(notifications)
        notification = notifications[0]["notification_id"]
        self.assertTrue(
            self.api(f"/api/v1/notifications/{notification}/read", method="POST")[
                "is_read"
            ]
        )
        audit = self.api(
            "/api/v1/admin/audit-logs?entity_type=leave_appln", "ADMINISTRATOR"
        )
        self.assertGreaterEqual(audit["total"], 6)

    def test_05_admin_mutation_and_audit(self):
        body = {
            "code": "STAGING_" + uuid.uuid4().hex[:10].upper(),
            "name": "Synthetic staging type",
        }
        created = self.api(
            "/api/v1/admin/leave-types",
            "ADMINISTRATOR",
            method="POST",
            body=body,
            expected=201,
        )
        fields = {
            key: created[key]
            for key in (
                "name",
                "description",
                "is_paid",
                "allow_employee_application",
                "allow_half_day",
                "requires_approval",
            )
        }
        fields["status"] = "INACTIVE"
        updated = self.api(
            f"/api/v1/admin/leave-types/{created['leave_type_id']}",
            "ADMINISTRATOR",
            method="PUT",
            body=fields,
        )
        self.assertEqual(updated["status"], "INACTIVE")
        self.api("/api/v1/admin/leave-types", method="POST", body=body, expected=403)
        self.assertGreaterEqual(
            self.api(
                "/api/v1/admin/audit-logs?action=LEAVE_TYPE_CREATED", "ADMINISTRATOR"
            )["total"],
            1,
        )

    def test_06_logout_revokes_session(self):
        status, _, login = request(
            "/api/v1/auth/login",
            method="POST",
            body={
                "username": "EMP001",
                "password": self.secrets["STAGING_SEED_EMPLOYEE_PASSWORD"],
            },
        )
        self.assertEqual(status, 200)
        token = login["access_token"]
        self.assertEqual(
            request("/api/v1/auth/logout", method="POST", token=token)[0], 204
        )
        self.assertEqual(request("/api/v1/auth/me", token=token)[0], 401)

    def test_07_backup_restore(self):
        target = "staging_restore_" + uuid.uuid4().hex
        snapshot = counts()
        dump = compose(
            "exec",
            "-T",
            "postgres",
            "pg_dump",
            "-U",
            "aip_lms_staging",
            "-d",
            "aip_lms_staging",
            "-Fc",
            binary=True,
        )
        compose("exec", "-T", "postgres", "createdb", "-U", "aip_lms_staging", target)
        try:
            compose(
                "exec",
                "-T",
                "postgres",
                "pg_restore",
                "-U",
                "aip_lms_staging",
                "-d",
                target,
                "--exit-on-error",
                "--single-transaction",
                "--no-owner",
                binary=True,
                data=dump,
            )
            self.assertEqual(counts(target), snapshot)
        finally:
            compose("exec", "-T", "postgres", "dropdb", "-U", "aip_lms_staging", target)

    def test_08_recreation_preserves_data_and_secrets_stay_private(self):
        snapshot = counts()
        compose("up", "-d", "--no-deps", "--force-recreate", "backend", "frontend")
        wait_ready()
        self.assertEqual(counts(), snapshot)
        self.api("/api/v1/auth/me")
        for service in ("backend", "frontend"):
            files = compose(
                "exec", "-T", service, "find", "/app", "-name", ".env*", "-type", "f"
            )
            self.assertEqual(files.strip(), "")
        logs = compose("logs", "--no-color")
        for key, value in self.secrets.items():
            if value:
                self.assertFalse(
                    value in logs, f"Private {key} appeared in staging logs"
                )

    def test_09_shared_rolling_login_limit(self):
        compose("restart", "backend", "proxy")
        wait_ready()

        def bad_login(index):
            return request(
                "/api/v1/auth/login",
                method="POST",
                body={"username": "EMP001", "password": "incorrect"},
                headers={
                    "X-Forwarded-For": f"198.51.100.{index + 1}",
                    "Forwarded": f"for=198.51.100.{index + 1}",
                },
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(bad_login, range(20)))
        self.assertEqual(sum(row[0] == 401 for row in results), 10)
        self.assertEqual(sum(row[0] == 429 for row in results), 10)
        rejected = next(row for row in results if row[0] == 429)
        self.assertEqual(rejected[2]["error"]["code"], "LOGIN_RATE_LIMITED")
        retry = int(rejected[1]["Retry-After"])
        self.assertGreaterEqual(retry, 1)
        self.assertLessEqual(retry, 60)
        self.assertEqual(
            request(
                "/api/v1/auth/%6cogin",
                method="POST",
                body={"username": "EMP001", "password": "incorrect"},
            )[0],
            429,
        )
        compose("restart", "backend")
        wait_ready()
        self.assertEqual(
            bad_login(21)[0], 429, "API worker restart must not reset proxy state"
        )
        remaining = int(bad_login(22)[1]["Retry-After"])
        time.sleep(remaining + 0.5)
        self.assertEqual(
            bad_login(23)[0], 401, "Expired rolling window should admit a new attempt"
        )

    def test_10_limit_is_per_client_ip(self):
        body = {"username": "EMP001", "password": "incorrect"}
        for _ in range(10):
            request("/api/v1/auth/login", method="POST", body=body)
        self.assertEqual(
            request("/api/v1/auth/login", method="POST", body=body)[0], 429
        )
        # The trusted frontend container has a different source IP. TLS bypass
        # is scoped to this test request, never the application environment.
        script = """
const https = require('node:https');
async function attempt() {
  return new Promise((resolve, reject) => {
    const req = https.request({hostname:'proxy',port:8443,
      path:'/api/v1/auth/login',method:'POST',rejectUnauthorized:false,
      headers:{'Content-Type':'application/json','X-Forwarded-For':'198.51.100.1'}
    }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(JSON.stringify({username:'EMP001',password:'incorrect'}));
  });
}
Promise.all([attempt(),attempt()]).then(v=>console.log(JSON.stringify(v)))
  .catch(()=>process.exit(1));
"""
        try:
            result = compose("exec", "-T", "frontend", "node", "-e", script)
            self.assertEqual(json.loads(result), [401, 401])
        finally:
            compose("restart", "backend", "proxy")
            wait_ready()

    def test_11_readiness_detects_database_outage(self):
        snapshot = counts()
        compose("stop", "postgres")
        try:
            status, _, failure = request("/health/ready")
            self.assertEqual(status, 503)
            self.assertEqual(failure["error"]["code"], "DATABASE_UNAVAILABLE")
            self.assertEqual(request("/health")[0], 200)
        finally:
            compose("start", "postgres")
            wait_ready()
        self.assertEqual(counts(), snapshot)


if __name__ == "__main__":
    unittest.main(verbosity=2)
