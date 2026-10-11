"""Phase 19 integrated security, workflow and representative-size regression gates."""

import json
import logging
from datetime import date, timedelta
from math import ceil
from time import perf_counter
from uuid import uuid4

import pytest
from sqlalchemy import event, insert, select, text
from sqlalchemy.orm import Session

from app.models import Employee, LeaveApplication, LeaveBalance, LeaveType
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("code", [None, "EMP001", "MGR001", "ADM001"])
def test_all_protected_gets_and_admin_read_authorization(auth_context, code):
    client, connection, app, _ = auth_context
    with Session(connection) as db:
        employee = db.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        employee_id = str(employee.employee_id)
    auth = headers(sign_in(auth_context, code).json()["access_token"]) if code else {}
    checked = 0
    for template, methods in app.openapi()["paths"].items():
        if not template.startswith("/api/v1/") or "get" not in methods:
            continue
        if code and not (template.startswith("/api/v1/admin/")):
            continue
        path = template
        for field in [
            "employee_id",
            "application_id",
            "balance_id",
            "holiday_id",
            "leave_type_id",
            "notification_id",
            "audit_id",
        ]:
            path = path.replace(
                "{" + field + "}", employee_id if field == "employee_id" else str(uuid4())
            )
        path = path.replace("{employee_code}", "EMP001")
        response = client.get(path, headers=auth)
        if code == "ADM001":
            assert response.status_code in {200, 404, 422}, path
        else:
            assert response.status_code == (403 if code else 401), path
            assert response.headers["Cache-Control"] == "no-store"
        checked += 1
    assert checked >= (1 if code else 15)


def test_integrated_apply_approve_reject_cancel_balances_and_secret_logs(auth_context, caplog):
    caplog.set_level(logging.DEBUG)
    client, connection, _, password = auth_context
    logins = {code: sign_in(auth_context, code).json() for code in ["EMP001", "MGR001", "ADM001"]}
    auth = {code: headers(login["access_token"]) for code, login in logins.items()}
    employee_id = logins["EMP001"]["user"]["employee_id"]
    with Session(connection) as db:
        type_id = str(db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED")))
    body = dict(
        employee_id=employee_id,
        leave_type_id=type_id,
        from_date="2026-10-12",
        to_date="2026-10-12",
        reason="Integrated regression",
    )
    path = f"/api/v1/employees/{employee_id}/leave-balance?year=2026"

    def balance():
        response = client.get(path, headers=auth["EMP001"])
        assert response.status_code == 200
        return next(row for row in response.json()["balances"] if row["leave_type_id"] == type_id)

    before = balance()
    for action, terminal in [
        ("approve", "APPROVED"),
        ("reject", "REJECTED"),
        ("cancel", "CANCELLED"),
    ]:
        created = client.post("/api/v1/leave/applications", headers=auth["EMP001"], json=body)
        assert created.status_code == 201
        entry = created.json()
        assert entry["status"] == "PENDING"
        reserved = balance()
        assert reserved["pending"] == before["pending"] + 1
        assert reserved["available"] == before["available"] - 1
        uri = f"/api/v1/leave/applications/{entry['application_id']}"
        assert client.post(uri + "/approve", headers=auth["EMP001"], json={}).status_code == 403
        actor = "EMP001" if action == "cancel" else "MGR001"
        result = client.post(
            uri + "/" + action,
            headers=auth[actor],
            json={"reason": "Coverage unavailable"} if action == "reject" else {},
        )
        assert result.status_code == 200 and result.json()["status"] == terminal
        assert client.get(uri, headers=auth["EMP001"]).json()["status"] == terminal
        after = balance()
        assert after["pending"] == before["pending"]
        assert after["used"] == before["used"] + (1 if action == "approve" else 0)
        assert after["available"] == before["available"] - (1 if action == "approve" else 0)
        before = after
        # Approved leave remains overlapping; later actions use the next work day.
        day = date.fromisoformat(body["from_date"]) + timedelta(days=1)
        body.update(from_date=day.isoformat(), to_date=day.isoformat())
    assert password not in caplog.text
    assert all(login["access_token"] not in caplog.text for login in logins.values())


def test_representative_lists_are_bounded_parameterized_and_measured(auth_context):
    client, connection, _, _ = auth_context
    manager = sign_in(auth_context, "MGR001").json()
    administrator = sign_in(auth_context, "ADM001").json()
    with Session(connection) as db:
        owner = db.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        department_id = owner.department_id
        employee_id = owner.employee_id
        type_id = db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED"))
    employee_ids = [uuid4() for _ in range(1000)]
    with Session(connection) as db, db.begin():
        db.execute(
            insert(Employee),
            [
                dict(
                    employee_id=identifier,
                    employee_code=f"PERF{i:04}",
                    name=f"Representative {i:04}",
                    email=f"perf{i}@example.invalid",
                    department_id=department_id,
                    manager_id=manager["user"]["employee_id"],
                    joining_date=date(2024, 1, 1),
                )
                for i, identifier in enumerate(employee_ids)
            ],
        )
        db.execute(
            insert(LeaveBalance),
            [
                dict(
                    employee_id=identifier,
                    leave_type_id=type_id,
                    leave_year=2026,
                    allocated=20,
                    pending=1,
                )
                for identifier in employee_ids
            ],
        )
        db.execute(
            insert(LeaveApplication),
            [
                dict(
                    employee_id=identifier,
                    manager_id=manager["user"]["employee_id"],
                    leave_type_id=type_id,
                    leave_year=year,
                    from_date=date(year, 11, 2),
                    to_date=date(year, 11, 2),
                    number_of_days=1,
                    reason="Representative data",
                )
                for year in [2024, 2025, 2026]
                for identifier in employee_ids
            ],
        )
        db.execute(text("ANALYZE employee"))
        db.execute(text("ANALYZE leave_appln"))
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append((statement, parameters))

    scenarios = [
        ("/api/v1/managers/me/direct-reports?page_size=20", manager, "items"),
        ("/api/v1/leave/approvals/pending?page_size=20", manager, "items"),
        ("/api/v1/employees?page_size=20", administrator, "items"),
        ("/api/v1/leave/applications?page_size=20", administrator, "items"),
        ("/api/v1/reports/leave-summary?year=2026&page_size=20", administrator, "items"),
        (f"/api/v1/employees/{employee_id}/leave-balance", manager, "balances"),
    ]
    measurements = []
    event.listen(connection.engine, "before_cursor_execute", record)
    try:
        for path, actor, collection in scenarios:
            elapsed, counts = [], []
            for _ in range(10):
                statements.clear()
                start = perf_counter()
                response = client.get(path, headers=headers(actor["access_token"]))
                elapsed.append((perf_counter() - start) * 1000)
                assert response.status_code == 200, response.text
                assert len(response.json()[collection]) <= 20
                counts.append(len(statements))
            assert max(counts) <= 15, (path, counts)
            ordered = sorted(elapsed)
            measurements.append(
                dict(
                    endpoint=path,
                    samples=len(ordered),
                    p50_ms=round(ordered[len(ordered) // 2], 2),
                    p95_ms=round(ordered[ceil(len(ordered) * 0.95) - 1], 2),
                    error_rate=0,
                    max_selects=max(counts),
                )
            )
        attack = "' OR 1=1 --"
        statements.clear()
        response = client.get(
            "/api/v1/employees",
            params={"search": attack},
            headers=headers(administrator["access_token"]),
        )
        assert response.status_code == 200 and response.json()["total"] == 0
        assert statements and all(attack not in statement for statement, _ in statements)
        assert any(attack in str(parameters) for _, parameters in statements)
    finally:
        event.remove(connection.engine, "before_cursor_execute", record)
    plans = {}
    for label, sql in {
        "history": (
            "SELECT id FROM leave_appln WHERE employee_id=:employee "
            "ORDER BY created_at DESC LIMIT 20"
        ),
        "overlap": (
            "SELECT id FROM leave_appln WHERE employee_id=:employee "
            "AND from_date <= DATE '2026-11-03' AND to_date >= DATE '2026-11-01'"
        ),
        "balance": "SELECT id FROM leave_balance WHERE employee_id=:employee AND leave_year=2026",
    }.items():
        plans[label] = connection.scalar(
            text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + sql), {"employee": employee_ids[0]}
        )
    print("PHASE19_QUERY_PLANS=" + json.dumps(plans))
    # Informational local measurements: staging load/HTTPS overhead is a release check.
    print("PHASE19_PERFORMANCE=" + json.dumps(measurements))


def test_normal_api_performance_scenarios(auth_context):
    """Record timings without treating a noisy laptop as a staging load gate."""
    client, connection, _, _ = auth_context
    actor = sign_in(auth_context).json()
    manager = sign_in(auth_context, "MGR001").json()
    auth = headers(actor["access_token"])
    manager_auth = headers(manager["access_token"])
    with Session(connection) as db:
        type_id = str(db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED")))
    employee_id = actor["user"]["employee_id"]
    readings = {}

    def measure(label, method, path, expected, **kwargs):
        start = perf_counter()
        response = client.request(method, "/api/v1" + path, **kwargs)
        readings.setdefault(label, []).append((perf_counter() - start) * 1000)
        assert response.status_code == expected, (label, response.text)
        return response

    for index in range(5):
        measure(
            "POST /auth/login",
            "POST",
            "/auth/login",
            200,
            json={"username": "EMP001", "password": auth_context[3]},
        )
        for path in [
            "/auth/me",
            f"/employees/{employee_id}/leave-balance",
            "/leave-types",
            "/holidays",
            "/leave/applications",
            "/reports/leave-summary",
        ]:
            measure("GET " + path, "GET", path, 200, headers=auth)
        measure(
            "GET /leave/approvals/pending",
            "GET",
            "/leave/approvals/pending",
            200,
            headers=manager_auth,
        )
        day = date(2026, 11, 2) + timedelta(days=index)
        body = dict(
            employee_id=employee_id,
            leave_type_id=type_id,
            from_date=day.isoformat(),
            to_date=day.isoformat(),
        )
        measure(
            "POST /leave/calculate-days",
            "POST",
            "/leave/calculate-days",
            200,
            headers=auth,
            json=body,
        )
        entry = measure(
            "POST /leave/applications",
            "POST",
            "/leave/applications",
            201,
            headers=auth,
            json=body | {"reason": "Performance sample"},
        ).json()
        measure(
            "POST /leave/applications/{id}/approve",
            "POST",
            f"/leave/applications/{entry['application_id']}/approve",
            200,
            headers=manager_auth,
            json={},
        )
    summaries = []
    for endpoint, samples in readings.items():
        ordered = sorted(samples)
        summaries.append(
            dict(
                endpoint=endpoint,
                samples=len(samples),
                p50_ms=round(ordered[2], 2),
                p95_ms=round(ordered[-1], 2),
                error_rate=0,
            )
        )
    assert len(summaries) == 11
    print("PHASE19_NORMAL_API=" + json.dumps(summaries))
