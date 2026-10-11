from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.audit import AuditQuery
from app.services.audit_service import safe_values


@pytest.mark.parametrize("payload", [None, {}])
def test_absent_values_are_preserved(payload):
    assert safe_values(payload) == (payload, False)


def test_projection_includes_only_valid_scalars():
    identifier = str(UUID(int=1))
    payload = {
        "employee_id": identifier,
        "status": "APPROVED",
        "role": "ADMINISTRATOR",
        "allocated": 20,
        "adjustment": -2.5,
        "is_paid": False,
        "joining_date": "2026-01-01",
        "approved_at": "2026-10-10T10:00:00Z",
        "code": "SICK",
        "origin": "development_seed",
    }
    values, redacted = safe_values(payload)
    assert values == {**payload, "approved_at": "2026-10-10T10:00:00+00:00"}
    assert not redacted


@pytest.mark.parametrize(
    "key,value",
    [
        ("password", "private"),
        ("password_hash", "private"),
        ("token", "private"),
        ("email", "private"),
        ("phone", "private"),
        ("reason", "private"),
        ("approval_comment", "private"),
        ("account", {"role": "ADMINISTRATOR"}),
        ("allocated", True),
        ("allocated", float("inf")),
        ("used", float("nan")),
        ("pending", 10**1000),
        ("employee_id", "private"),
        ("status", ["ACTIVE"]),
        ("role", {"private": "secret"}),
        ("code", "<script>"),
        ("origin", "private"),
        ("joining_date", "2026-02-30"),
        ("approved_at", "2026-10-10T10:00:00"),
        ("allow_half_day", "false"),
        ("status", None),
        ("business_key", "private"),
    ],
)
def test_invalid_or_sensitive_fields_are_redacted(key, value):
    assert safe_values({key: value}) == ({}, True)


@pytest.mark.parametrize("payload", [[], "private", 42, True])
def test_malformed_payload_is_redacted(payload):
    assert safe_values(payload) == ({}, True)


@pytest.mark.parametrize(
    "query",
    [
        {"from_date": "2026-02-30"},
        {"from_date": "2026-1-01"},
        {"from_date": "2026-01-01T00:00:00Z"},
        {"to_date": "9999-12-31"},
        {"from_date": "1899-01-01"},
        {"from_date": "2026-02-01", "to_date": "2026-01-01"},
        {"page": 0},
        {"page_size": 101},
        {"entity_type": "unknown"},
        {"action": "unknown"},
        {"performed_by": "invalid"},
        {"sort": "asc"},
    ],
)
def test_query_rejects_invalid_contract(query):
    with pytest.raises(ValidationError):
        AuditQuery.model_validate(query)
