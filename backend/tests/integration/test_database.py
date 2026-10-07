import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from app.main import create_app
from app.models import Base

pytestmark = pytest.mark.integration


def test_postgres_connection_readiness_and_no_ddl(postgres_settings):
    app = create_app(postgres_settings)
    engine = app.state.session_factory.kw["bind"]
    assert not Base.metadata.tables
    before = inspect(engine).get_table_names()
    with TestClient(app) as client:
        assert client.get("/health/ready").json() == {"status": "ready"}
        with app.state.session_factory() as session:
            assert session.execute(text("SELECT 1")).scalar_one() == 1
            assert session.execute(text("SHOW server_version")).scalar_one().startswith("17.")
        assert inspect(engine).get_table_names() == before
