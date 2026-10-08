from unittest.mock import Mock

import pytest
from sqlalchemy.exc import OperationalError

from app.services.auth_service import AuthService
from app.utils.errors import DomainError
from app.utils.security import hash_password, new_token, token_digest, verify_password


def test_password_and_token_security():
    password = " exact whitespace password "
    encoded = hash_password(password)
    assert encoded.startswith("$argon2id$") and password not in encoded
    assert verify_password(password, encoded)
    assert not verify_password(password.strip(), encoded)
    assert not verify_password(password, "invalid hash")
    assert not verify_password(password, None)
    token = new_token()
    assert len(token) >= 43 and len(token_digest(token)) == 64
    assert token != new_token()


@pytest.mark.parametrize("state", ["40P01", "40001"])
def test_concurrency_errors_are_safe(state):
    exc = OperationalError("secret SQL", {}, Mock(sqlstate=state))
    with pytest.raises(DomainError) as error:
        AuthService.concurrent_error(exc)
    assert error.value.code == "CONCURRENT_UPDATE"
    assert "secret" not in str(error.value)
