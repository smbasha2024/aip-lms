from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.database import get_db


def test_request_session_rolls_back_and_closes():
    session = MagicMock()
    session.__enter__.return_value = session
    factory = MagicMock(return_value=session)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(session_factory=factory)))
    dependency = get_db(request)
    assert next(dependency) is session
    with pytest.raises(RuntimeError):
        dependency.throw(RuntimeError("request failed"))
    session.rollback.assert_called_once()
    session.__exit__.assert_called_once()
    session.commit.assert_not_called()
