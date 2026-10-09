from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import AppUser, AuditLog, Department, Employee
from app.repositories.admin_employee_repository import AdminEmployeeRepository
from app.schemas.auth import LoginRequest
from app.schemas.employee import AccountUpdate, EmployeeCreate, EmployeeUpdate
from app.services.admin_employee_service import AdminEmployeeService
from app.services.auth_service import AuthService
from app.utils.errors import DomainError
from app.utils.security import verify_password
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send, state
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/admin/employees"


@pytest.fixture
def admin(auth_context):
    login = sign_in(auth_context, "ADM001").json()
    with Session(auth_context[1]) as db:
        ids = {e.employee_code: e.employee_id for e in db.scalars(select(Employee))}
        department_id = db.scalar(select(Department.department_id).where(Department.code == "ENG"))
    return SimpleNamespace(
        context=auth_context, token=login["access_token"], ids=ids, department_id=department_id
    )


def create_body(admin, **changes):
    return (
        dict(
            employee_code=" NEW011 ",
            name=" New Staff ",
            email=" NEW011@EXAMPLE.INVALID ",
            department_id=str(admin.department_id),
            manager_id=str(admin.ids["MGR001"]),
            joining_date="2026-10-01",
            role="EMPLOYEE",
            initial_password="  exact-password-123  ",
        )
        | changes
    )


def create(admin, **changes):
    return admin.context[0].post(
        BASE, headers=headers(admin.token), json=create_body(admin, **changes)
    )


def profile(admin, code="EMP001"):
    return (
        admin.context[0]
        .get(f"/api/v1/employees/{admin.ids[code]}", headers=headers(admin.token))
        .json()
    )


def replacement(row, **changes):
    return (
        {
            key: row[key]
            for key in ("name", "email", "phone", "designation", "joining_date", "status")
        }
        | {
            "department_id": row["department"]["department_id"],
            "manager_id": row["manager"]["employee_id"] if row["manager"] else None,
        }
        | changes
    )


def update(admin, code="EMP001", **changes):
    return admin.context[0].put(
        f"{BASE}/{admin.ids[code]}",
        headers=headers(admin.token),
        json=replacement(profile(admin, code), **changes),
    )


def account(admin, code="EMP001", **changes):
    row = profile(admin, code)["account"]
    return admin.context[0].put(
        f"{BASE}/{admin.ids[code]}/account",
        headers=headers(admin.token),
        json={"role": row["role"], "status": row["status"]} | changes,
    )


def counts(connection):
    with Session(connection) as db:
        return [
            db.scalar(select(func.count()).select_from(model))
            for model in (Employee, AppUser, AuditLog)
        ]


def test_atomic_create_contract_hash_password_preservation_and_audit(admin, caplog):
    before = counts(admin.context[1])
    response = create(admin)
    assert response.status_code == 201, response.text
    row = response.json()
    assert row["employee_code"] == "NEW011" and row["name"] == "New Staff"
    assert row["email"] == "new011@example.invalid" and row["status"] == "ACTIVE"
    assert row["account"]["role"] == "EMPLOYEE" and row["account"]["status"] == "ACTIVE"
    assert row["department"]["department_id"] == str(admin.department_id)
    assert row["manager"]["employee_id"] == str(admin.ids["MGR001"])
    assert row["phone"] is None and row["designation"] is None
    assert response.headers["Cache-Control"] == "no-store"
    assert [a - b for a, b in zip(counts(admin.context[1]), before, strict=True)] == [1, 1, 1]
    with Session(admin.context[1]) as db:
        user = db.get(AppUser, row["account"]["user_id"])
        assert user.username == row["email"] and user.password_hash.startswith("$argon2id$")
        assert verify_password("  exact-password-123  ", user.password_hash)
        assert not verify_password("exact-password-123", user.password_hash)
        audit = db.scalar(select(AuditLog).where(AuditLog.entity_id == row["employee_id"]))
        assert audit.action == "EMPLOYEE_CREATED" and audit.performed_by == admin.ids["ADM001"]
        assert audit.old_values is None and audit.new_values == row
        assert "password" not in str(audit.new_values)
    assert "exact-password" not in response.text + caplog.text
    assert sign_in(admin.context, "NEW011", "  exact-password-123  ").status_code == 200


@pytest.mark.parametrize("role", ["MANAGER", "ADMINISTRATOR"])
def test_top_level_role_can_omit_manager_and_inactive_creation(admin, role):
    row = create(admin, role=role, manager_id=None, status="INACTIVE").json()
    assert row["manager"] is None and row["account"]["status"] == "INACTIVE"
    assert (
        sign_in(admin.context, "NEW011", "  exact-password-123  ").json()["error"]["code"]
        == "USER_INACTIVE"
    )


@pytest.mark.parametrize(
    "changes,code",
    [
        ({"employee_code": " emp001 "}, "EMPLOYEE_CODE_EXISTS"),
        ({"email": " EMP001@EXAMPLE.INVALID "}, "EMPLOYEE_EMAIL_EXISTS"),
    ],
)
def test_duplicate_identifiers_rollback(admin, changes, code):
    before = counts(admin.context[1])
    response = create(admin, **changes)
    assert response.status_code == 409 and response.json()["error"]["code"] == code
    assert counts(admin.context[1]) == before


@pytest.mark.parametrize(
    "field,value",
    [
        ("employee_code", "bad@code"),
        ("employee_code", "A" * 51),
        ("name", " "),
        ("name", "x" * 201),
        ("email", "bad"),
        ("email", "a..b@example.invalid"),
        ("email", "x@-bad.invalid"),
        ("joining_date", "2026-02-30"),
        ("department_id", None),
        ("manager_id", "bad"),
        ("phone", "x" * 31),
        ("designation", "x" * 151),
        ("initial_password", "x" * 11),
        ("initial_password", "x" * 129),
        ("status", "RESIGNED"),
        ("role", "ADMIN"),
        ("unexpected", True),
    ],
)
def test_create_validation_no_secret_echo(admin, field, value):
    response = create(admin, **{field: value})
    assert response.status_code == 422
    assert "exact-password" not in response.text
    if field == "initial_password":
        assert str(value) not in response.text


@pytest.mark.parametrize("code", ["EMP001", "MGR001"])
def test_admin_writes_forbidden_for_other_roles(admin, code):
    token = sign_in(admin.context, code).json()["access_token"]
    for method, path, body in [
        ("post", BASE, create_body(admin)),
        ("put", f"{BASE}/{admin.ids['EMP001']}", replacement(profile(admin))),
        ("put", f"{BASE}/{admin.ids['EMP001']}/account", {"role": "EMPLOYEE", "status": "ACTIVE"}),
    ]:
        response = getattr(admin.context[0], method)(path, headers=headers(token), json=body)
        assert response.status_code == 403 and response.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.parametrize(
    "code,expected",
    [
        ("EMP001", {"EMP001"}),
        ("MGR001", {"MGR001", "EMP001"}),
        ("ADM001", {"EMP001", "MGR001", "ADM001"}),
    ],
)
def test_scoped_list_and_private_account_refs(admin, code, expected):
    token = admin.token if code == "ADM001" else sign_in(admin.context, code).json()["access_token"]
    data = admin.context[0].get("/api/v1/employees", headers=headers(token)).json()
    assert {row["employee_code"] for row in data["items"]} == expected
    assert data["total"] == len(expected)
    assert all(("account" in row) == (code == "ADM001") for row in data["items"])
    filtered = admin.context[0].get("/api/v1/employees?role=ADMINISTRATOR", headers=headers(token))
    assert filtered.status_code == (200 if code == "ADM001" else 403)


@pytest.mark.parametrize(
    "query,expected",
    [
        ({"search": "EMP001"}, 1),
        ({"search": "%"}, 0),
        ({"search": "_"}, 0),
        ({"role": "MANAGER", "status": "ACTIVE"}, 1),
        ({"manager_id": "ADM001"}, 1),
        ({"page": 2, "page_size": 1}, 3),
        ({"page": 10**30}, 3),
    ],
)
def test_list_search_filters_and_pagination(admin, query, expected):
    if query.get("manager_id"):
        query = query | {"manager_id": str(admin.ids[query["manager_id"]])}
    response = admin.context[0].get("/api/v1/employees", params=query, headers=headers(admin.token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == expected
    if query.get("page", 1) > expected:
        assert data["items"] == []


@pytest.mark.parametrize(
    "query",
    [
        {"page": 0},
        {"page_size": 101},
        {"search": " "},
        {"role": "ADMIN"},
        {"other": 1},
        {"manager_id": "bad"},
    ],
)
def test_list_invalid_queries(admin, query):
    assert (
        admin.context[0]
        .get("/api/v1/employees", params=query, headers=headers(admin.token))
        .status_code
        == 422
    )


def test_departments_scopes_and_assignment_rules(admin):
    with Session(admin.context[1]) as db, db.begin():
        inactive = Department(code="OLD", name="Old Department", status="INACTIVE")
        db.add(inactive)
        db.flush()
        iid = str(inactive.department_id)
    client = admin.context[0]
    for status, size in [("ACTIVE", 2), ("INACTIVE", 1), ("ALL", 3)]:
        data = client.get(
            "/api/v1/departments", params={"status": status}, headers=headers(admin.token)
        ).json()
        assert len(data["items"]) == size
        assert [d["code"] for d in data["items"]] == sorted(d["code"] for d in data["items"])
    for code in ("EMP001", "MGR001"):
        token = sign_in(admin.context, code).json()["access_token"]
        assert client.get("/api/v1/departments", headers=headers(token)).status_code == 200
        assert (
            client.get("/api/v1/departments?status=ALL", headers=headers(token)).status_code == 403
        )
    assert create(admin, department_id=iid).json()["error"]["code"] == "DEPARTMENT_INACTIVE"
    assert update(admin, department_id=iid).json()["error"]["code"] == "DEPARTMENT_INACTIVE"
    assert (
        create(admin, department_id=str(uuid4())).json()["error"]["code"] == "DEPARTMENT_NOT_FOUND"
    )
    with Session(admin.context[1]) as db, db.begin():
        db.get(Employee, admin.ids["EMP001"]).department_id = UUID(iid)
    assert update(admin, name="Existing assignment remains").status_code == 200


@pytest.mark.parametrize(
    "case,code",
    [
        ("none", "INVALID_MANAGER"),
        ("missing", "MANAGER_NOT_FOUND"),
        ("self", "INVALID_MANAGER"),
        ("employee", "INVALID_MANAGER"),
        ("inactive", "INVALID_MANAGER"),
        ("locked", "INVALID_MANAGER"),
        ("cycle", "REPORTING_CYCLE"),
    ],
)
def test_manager_validation(admin, case, code):
    manager_id = (
        None
        if case == "none"
        else str(uuid4())
        if case == "missing"
        else str(
            admin.ids["EMP001"] if case in {"self", "employee", "cycle"} else admin.ids["MGR001"]
        )
    )
    if case == "cycle":
        with Session(admin.context[1]) as db, db.begin():
            db.get(Employee, admin.ids["EMP001"]).account.role = "MANAGER"
    if case in {"inactive", "locked"}:
        with Session(admin.context[1]) as db, db.begin():
            row = db.get(Employee, admin.ids["MGR001"])
            if case == "inactive":
                row.status = "INACTIVE"
            else:
                row.account.status = "LOCKED"
    response = (
        update(admin, "MGR001" if case == "cycle" else "EMP001", manager_id=manager_id)
        if case in {"self", "cycle"}
        else create(admin, manager_id=manager_id)
    )
    assert response.json()["error"]["code"] == code


def test_employee_edit_email_username_null_defaults_and_login(admin):
    body = replacement(
        profile(admin),
        name=" Renamed ",
        email=" RENAMED@EXAMPLE.INVALID ",
        phone="123",
        designation="Engineer",
    )
    result = admin.context[0].put(
        f"{BASE}/{admin.ids['EMP001']}", headers=headers(admin.token), json=body
    )
    assert result.status_code == 200 and result.json()["name"] == "Renamed"
    with Session(admin.context[1]) as db:
        assert db.get(Employee, admin.ids["EMP001"]).account.username == "renamed@example.invalid"
    assert sign_in(admin.context, "emp001@example.invalid").status_code == 401
    assert sign_in(admin.context, "RENAMED@EXAMPLE.INVALID").status_code == 200
    del body["phone"]
    del body["designation"]
    result = admin.context[0].put(
        f"{BASE}/{admin.ids['EMP001']}", headers=headers(admin.token), json=body
    )
    assert result.json()["phone"] is None and result.json()["designation"] is None


@pytest.mark.parametrize(
    "field", ["name", "email", "department_id", "manager_id", "joining_date", "status"]
)
def test_put_required_fields(admin, field):
    body = replacement(profile(admin))
    del body[field]
    assert (
        admin.context[0]
        .put(f"{BASE}/{admin.ids['EMP001']}", headers=headers(admin.token), json=body)
        .status_code
        == 422
    )


@pytest.mark.parametrize("field", ["employee_code", "role", "initial_password"])
def test_put_rejects_code_role_and_password(admin, field):
    assert update(admin, **{field: "NO"}).status_code == 422


@pytest.mark.parametrize("status", ["INACTIVE", "RESIGNED", "TERMINATED"])
def test_deactivation_revoke_all_sessions_and_preserve_history(leave_context, status):
    ctx, token, _ = leave_context
    application = send(leave_context).json()
    login = sign_in(ctx, "ADM001").json()
    a = SimpleNamespace(
        context=ctx,
        token=login["access_token"],
        ids={"EMP001": UUID(application["employee"]["employee_id"])},
    )
    second = sign_in(ctx).json()["access_token"]
    before = state(ctx[1])
    response = update(a, status=status)
    assert response.status_code == 200
    for old in (token, second):
        assert ctx[0].get("/api/v1/auth/me", headers=headers(old)).status_code == 401
    assert sign_in(ctx).json()["error"]["code"] == "EMPLOYEE_INACTIVE"
    after = state(ctx[1])
    assert after[0][0] == before[0][0] and after[1] == before[1]
    assert (
        ctx[0]
        .get(
            f"/api/v1/leave/applications/{application['application_id']}", headers=headers(a.token)
        )
        .json()["manager"]
        == application["manager"]
    )
    assert update(a, status="ACTIVE").status_code == 200 and sign_in(ctx).status_code == 200


@pytest.mark.parametrize(
    "change", [{"role": "MANAGER"}, {"status": "LOCKED"}, {"status": "INACTIVE"}]
)
def test_account_changes_revoke_sessions_leave_password_unchanged(admin, change):
    token = sign_in(admin.context).json()["access_token"]
    with Session(admin.context[1]) as db:
        encoded = db.get(Employee, admin.ids["EMP001"]).account.password_hash
    result = account(admin, **change)
    assert result.status_code == 200
    assert set(result.json()) == {"user_id", "role", "status"}
    assert admin.context[0].get("/api/v1/auth/me", headers=headers(token)).status_code == 401
    with Session(admin.context[1]) as db:
        assert db.get(Employee, admin.ids["EMP001"]).account.password_hash == encoded


def test_account_noop_retains_session_and_self_edits_forbidden(admin):
    token = sign_in(admin.context).json()["access_token"]
    assert account(admin).status_code == 200
    assert admin.context[0].get("/api/v1/auth/me", headers=headers(token)).status_code == 200
    assert account(admin, "ADM001").json()["error"]["code"] == "SELF_ACCOUNT_CHANGE_NOT_ALLOWED"
    assert (
        update(admin, "ADM001", status="INACTIVE").json()["error"]["code"]
        == "SELF_ACCOUNT_CHANGE_NOT_ALLOWED"
    )


@pytest.mark.parametrize("kind", ["employee", "role", "account"])
def test_manager_with_any_current_reports_cannot_be_removed(admin, kind):
    response = (
        update(admin, "MGR001", status="INACTIVE")
        if kind == "employee"
        else account(
            admin, "MGR001", **({"role": "EMPLOYEE"} if kind == "role" else {"status": "LOCKED"})
        )
    )
    assert (
        response.status_code == 409
        and response.json()["error"]["code"] == "MANAGER_HAS_DIRECT_REPORTS"
    )


def test_role_employee_requires_manager_and_demote_after_reassignment(admin):
    row = create(admin, role="MANAGER", manager_id=None).json()
    admin.ids["NEW011"] = UUID(row["employee_id"])
    assert account(admin, "NEW011", role="EMPLOYEE").json()["error"]["code"] == "INVALID_MANAGER"
    assert update(admin, manager_id=str(admin.ids["ADM001"])).status_code == 200
    assert account(admin, "MGR001", role="EMPLOYEE").status_code == 200


@pytest.mark.parametrize("stage", ["hash", "account", "audit"])
def test_create_failure_rolls_back_all_records(admin, monkeypatch, stage):
    before = counts(admin.context[1])

    def failure(*args, **kwargs):
        raise RuntimeError("private sensitive failure")

    if stage == "hash":
        monkeypatch.setattr("app.services.admin_employee_service.hash_password", failure)
    elif stage == "audit":
        monkeypatch.setattr(AdminEmployeeRepository, "audit", failure)
    else:
        original = AdminEmployeeRepository.insert

        def insert(self, row):
            if isinstance(row, AppUser):
                failure()
            return original(self, row)

        monkeypatch.setattr(AdminEmployeeRepository, "insert", insert)
    result = create(admin)
    assert result.status_code == 500 and "private" not in result.text
    assert counts(admin.context[1]) == before


def test_edit_audit_failure_restores_employee_username_sessions(admin, monkeypatch):
    token = sign_in(admin.context).json()["access_token"]
    before = profile(admin)

    def failure(*args, **kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr(AdminEmployeeRepository, "audit", failure)
    assert update(admin, email="changed@example.invalid", status="INACTIVE").status_code == 500
    assert profile(admin) == before
    assert admin.context[0].get("/api/v1/auth/me", headers=headers(token)).status_code == 200
    with Session(admin.context[1]) as db:
        assert db.get(Employee, admin.ids["EMP001"]).account.username == before["email"]


def run_mutation(admin, schema, body, employee_id=None, account_only=False, token=None):
    _, connection, app, _ = admin.context
    token = token or admin.token
    with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
        service = AdminEmployeeService(db, app.state.settings, app.state.auth_clock)
        try:
            actor = service.auth.current_account(token)
            service.mutate(actor, token, body, employee_id, account_only=account_only)
            return "OK"
        except DomainError as error:
            return error.code


def race(admin, monkeypatch, actions):
    connection = admin.context[1]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)
    from app.utils.locks import lock_hierarchy

    def lock(db):
        barrier.wait(timeout=15)
        lock_hierarchy(db)

    monkeypatch.setattr("app.services.admin_employee_service.lock_hierarchy", lock)
    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(lambda action: run_mutation(admin, schema, **action), actions))


def test_concurrent_duplicate_create_single_winner(admin, monkeypatch):
    before = counts(admin.context[1])
    bodies = [
        EmployeeCreate(**create_body(admin, email=email))
        for email in ["one@example.invalid", "two@example.invalid"]
    ]
    results = race(admin, monkeypatch, [{"body": body} for body in bodies])
    assert results.count("OK") == 1 and "EMPLOYEE_CODE_EXISTS" in results
    assert [a - b for a, b in zip(counts(admin.context[1]), before, strict=True)] == [1, 1, 1]


def test_concurrent_cycle_edits_single_winner(admin, monkeypatch):
    x = create(admin, employee_code="MGRX", email="x@example.invalid", role="MANAGER").json()
    y = create(admin, employee_code="MGRY", email="y@example.invalid", role="MANAGER").json()
    actions = [
        {
            "body": EmployeeUpdate(**replacement(row, manager_id=other["employee_id"])),
            "employee_id": UUID(row["employee_id"]),
        }
        for row, other in [(x, y), (y, x)]
    ]
    results = race(admin, monkeypatch, actions)
    assert results.count("OK") == 1 and "REPORTING_CYCLE" in results


def test_manager_removal_versus_new_assignment_preserves_eligibility(admin, monkeypatch):
    manager = create(admin, employee_code="MGRX", email="x@example.invalid", role="MANAGER").json()
    actions = [
        {
            "body": EmployeeUpdate(**replacement(manager, status="INACTIVE")),
            "employee_id": UUID(manager["employee_id"]),
        },
        {
            "body": EmployeeCreate(
                **create_body(
                    admin,
                    employee_code="ASSIGNED",
                    email="assigned@example.invalid",
                    manager_id=manager["employee_id"],
                )
            )
        },
    ]
    results = race(admin, monkeypatch, actions)
    assert results.count("OK") == 1
    assert "MANAGER_HAS_DIRECT_REPORTS" in results or "INVALID_MANAGER" in results


@pytest.mark.parametrize("change", ["logout", "lock", "demote"])
def test_mutation_auth_rechecked_after_wait_for_locks(admin, monkeypatch, change):
    other = create(
        admin,
        employee_code="ADM2",
        email="admin2@example.invalid",
        role="ADMINISTRATOR",
        manager_id=None,
    ).json()
    admin.ids["ADM2"] = UUID(other["employee_id"])
    other_token = sign_in(admin.context, "ADM2", "  exact-password-123  ").json()["access_token"]
    connection = admin.context[1]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    waiting, released = Event(), Event()
    from app.utils.locks import lock_hierarchy

    def lock(db):
        waiting.set()
        assert released.wait(15)
        lock_hierarchy(db)

    monkeypatch.setattr("app.services.admin_employee_service.lock_hierarchy", lock)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            run_mutation, admin, schema, EmployeeCreate(**create_body(admin)), token=other_token
        )
        assert waiting.wait(15)
        monkeypatch.setattr("app.services.admin_employee_service.lock_hierarchy", lock_hierarchy)
        if change == "logout":
            assert (
                admin.context[0]
                .post("/api/v1/auth/logout", headers=headers(other_token))
                .status_code
                == 204
            )
        else:
            assert (
                account(
                    admin,
                    "ADM2",
                    **({"status": "LOCKED"} if change == "lock" else {"role": "MANAGER"}),
                ).status_code
                == 200
            )
        released.set()
        assert future.result(timeout=20) == "UNAUTHENTICATED"
    assert (
        admin.context[0]
        .get("/api/v1/employees?search=NEW011", headers=headers(admin.token))
        .json()["total"]
        == 0
    )


def test_login_rechecks_email_after_waiting_for_locks(admin, monkeypatch):
    connection = admin.context[1]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    waiting, released = Event(), Event()
    from app.repositories.auth_repository import AuthRepository

    original = AuthRepository.lock_employee

    def lock(self, employee_id):
        waiting.set()
        assert released.wait(15)
        return original(self, employee_id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)

    def login():
        with independent(connection, schema) as other, Session(other) as db:
            service = AuthService(
                db, admin.context[2].state.settings, admin.context[2].state.auth_clock
            )
            try:
                service.login(
                    LoginRequest(username="emp001@example.invalid", password=admin.context[3])
                )
                return "OK"
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(login)
        assert waiting.wait(15)
        assert update(admin, email="renamed@example.invalid").status_code == 200
        released.set()
        assert future.result(timeout=20) == "INVALID_CREDENTIALS"


def test_account_username_collision_rolls_back_employee_creation(admin):
    with Session(admin.context[1]) as db, db.begin():
        db.get(Employee, admin.ids["MGR001"]).account.username = "new011@example.invalid"
    before = counts(admin.context[1])
    response = create(admin)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ACCOUNT_USERNAME_EXISTS"
    assert counts(admin.context[1]) == before


def test_duplicate_email_edit_changes_nothing(admin):
    before = profile(admin)
    assert (
        update(admin, email="MGR001@EXAMPLE.INVALID").json()["error"]["code"]
        == "EMPLOYEE_EMAIL_EXISTS"
    )
    assert profile(admin) == before


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"role": "EMPLOYEE"},
        {"status": "ACTIVE"},
        {"role": "UNKNOWN", "status": "ACTIVE"},
        {"role": "EMPLOYEE", "status": "UNKNOWN"},
        {"role": "EMPLOYEE", "status": "ACTIVE", "password": "secret"},
    ],
)
def test_account_contract_rejects_missing_invalid_and_password_fields(admin, body):
    result = admin.context[0].put(
        f"{BASE}/{admin.ids['EMP001']}/account", headers=headers(admin.token), json=body
    )
    assert result.status_code == 422
    assert "secret" not in result.text


def test_unknown_resource_and_query_contract(admin):
    for suffix, body in [
        ("", replacement(profile(admin))),
        ("/account", {"role": "EMPLOYEE", "status": "ACTIVE"}),
    ]:
        response = admin.context[0].put(
            f"{BASE}/{uuid4()}{suffix}", headers=headers(admin.token), json=body
        )
        assert (
            response.status_code == 404 and response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"
        )
    assert (
        admin.context[0]
        .post(BASE + "?unexpected=1", headers=headers(admin.token), json=create_body(admin))
        .status_code
        == 422
    )
    assert admin.context[0].post(BASE, json=create_body(admin)).status_code == 401
    assert admin.context[0].get("/api/v1/employees").status_code == 401
    assert (
        admin.context[0]
        .get("/api/v1/departments?unexpected=1", headers=headers(admin.token))
        .status_code
        == 422
    )


@pytest.mark.parametrize("state,expected", [("40P01", 409), ("40001", 409), ("XX000", 500)])
def test_database_failures_rollback_with_safe_concurrency_error(
    admin, monkeypatch, state, expected
):
    from sqlalchemy.exc import DBAPIError

    before = profile(admin)

    def failed(*args, **kwargs):
        raise DBAPIError("private SQL", {}, SimpleNamespace(sqlstate=state))

    monkeypatch.setattr(AdminEmployeeRepository, "audit", failed)
    response = update(admin, email="edited@example.invalid")
    assert response.status_code == expected
    assert response.json()["error"]["code"] == (
        "CONCURRENT_UPDATE" if expected == 409 else "TRANSACTION_FAILED"
    )
    assert "private" not in response.text and profile(admin) == before


def test_account_audit_failure_rolls_back_role_status_and_revocation(admin, monkeypatch):
    token = sign_in(admin.context).json()["access_token"]
    before = profile(admin)

    def failed(*args, **kwargs):
        raise RuntimeError("audit failure")

    monkeypatch.setattr(AdminEmployeeRepository, "audit", failed)
    assert account(admin, role="MANAGER", status="LOCKED").status_code == 500
    assert profile(admin) == before
    assert admin.context[0].get("/api/v1/auth/me", headers=headers(token)).status_code == 200


def test_last_administrator_service_invariant(admin):
    # Exercise the defensive invariant directly: HTTP self edits are rejected earlier.
    with Session(admin.context[1]) as db:
        employee = db.get(Employee, admin.ids["ADM001"])
        service = AdminEmployeeService(db, admin.context[2].state.settings)
        actor = SimpleNamespace(employee_id=admin.ids["MGR001"])
        with pytest.raises(DomainError) as error:
            service.safeguard(actor, employee, employee.account, "MANAGER", "ACTIVE", "ACTIVE")
        assert error.value.code == "LAST_ADMINISTRATOR"


def test_concurrent_administrators_cannot_remove_each_other(admin, monkeypatch):
    other = create(
        admin,
        employee_code="ADM2",
        email="admin2@example.invalid",
        role="ADMINISTRATOR",
        manager_id=None,
    ).json()
    token = sign_in(admin.context, "ADM2", "  exact-password-123  ").json()["access_token"]
    body = AccountUpdate(role="MANAGER", status="ACTIVE")
    results = race(
        admin,
        monkeypatch,
        [
            {"body": body, "employee_id": UUID(other["employee_id"]), "account_only": True},
            {
                "body": body,
                "employee_id": admin.ids["ADM001"],
                "account_only": True,
                "token": token,
            },
        ],
    )
    assert results.count("OK") == 1 and "UNAUTHENTICATED" in results
    with Session(admin.context[1]) as db:
        assert AdminEmployeeRepository(db).active_administrators() == 1


def test_reassignment_then_manager_demotion_preserves_pending_snapshot(leave_context):
    context, _, _ = leave_context
    application = send(leave_context).json()
    login = sign_in(context, "ADM001").json()
    with Session(context[1]) as db:
        ids = {e.employee_code: e.employee_id for e in db.scalars(select(Employee))}
    admin = SimpleNamespace(context=context, token=login["access_token"], ids=ids)
    manager_token = sign_in(context, "MGR001").json()["access_token"]
    assert update(admin, manager_id=str(ids["ADM001"])).status_code == 200
    assert account(admin, "MGR001", role="EMPLOYEE").status_code == 200
    assert context[0].get("/api/v1/auth/me", headers=headers(manager_token)).status_code == 401
    saved = (
        context[0]
        .get(
            f"/api/v1/leave/applications/{application['application_id']}",
            headers=headers(admin.token),
        )
        .json()
    )
    assert saved["status"] == "PENDING" and saved["manager"] == application["manager"]


def test_apply_versus_employee_deactivation_serializes_and_preserves_reservation(
    leave_context, monkeypatch
):
    from app.repositories.leave_repository import LeaveRepository
    from app.schemas.leave import ApplyLeaveRequest
    from app.services.leave_service import LeaveService

    context, token, body = leave_context
    login = sign_in(context, "ADM001").json()
    admin = SimpleNamespace(
        context=context, token=login["access_token"], ids={"EMP001": UUID(body["employee_id"])}
    )
    update_body = EmployeeUpdate(**replacement(profile(admin), status="INACTIVE"))
    connection = context[1]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        barrier.wait(timeout=15)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def apply():
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, context[2].state.settings, context[2].state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                return service.apply(actor, token, ApplyLeaveRequest(**body), None).status
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        removal = pool.submit(run_mutation, admin, schema, update_body, admin.ids["EMP001"])
        application = pool.submit(apply)
        assert removal.result(timeout=20) == "OK"
        outcome = application.result(timeout=20)
        assert outcome in {"PENDING", "UNAUTHENTICATED"}
    after = state(connection)
    assert after[0][0] == (1 if outcome == "PENDING" else 0)
    assert sum(row[1] for row in after[1]) == (2 if outcome == "PENDING" else 0)
