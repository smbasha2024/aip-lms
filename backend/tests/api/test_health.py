from unittest.mock import MagicMock

from fastapi import Query
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import create_app


def test_startup_and_liveness(settings):
    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/api/v1/auth/me").status_code == 401
    assert set(app.openapi()["paths"]) == {
        "/health",
        "/health/ready",
        "/api/v1/auth/login",
        "/api/v1/auth/me",
        "/api/v1/auth/logout",
        "/api/v1/employees/{employee_id}",
        "/api/v1/employees/by-code/{employee_code}",
        "/api/v1/employees/{employee_id}/leave-balance",
        "/api/v1/employees/{employee_id}/leave-applications",
        "/api/v1/leave/applications/{application_id}/cancel",
        "/api/v1/leave-types",
        "/api/v1/dashboard",
        "/api/v1/holidays",
        "/api/v1/holidays/{holiday_id}",
        "/api/v1/leave/calculate-days",
        "/api/v1/leave/applications",
        "/api/v1/leave/applications/{application_id}",
    }


def test_ready_failure_safe(settings):
    app = create_app(settings)
    session = MagicMock()
    session.execute.side_effect = OperationalError("secret SQL", {}, Exception("password"))
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json() == {
            "error": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database is unavailable",
                "details": None,
            }
        }
        assert "password" not in response.text
    session.rollback.assert_called_once()


def test_errors_and_cors(settings, caplog):
    app = create_app(settings)

    @app.get("/test-validation")
    def validation(count: int = Query()):
        return count

    @app.get("/test-failure")
    def failure():
        raise ValueError("secret password and SQL")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-validation?count=secret")
        assert response.status_code == 422
        assert "secret" not in response.text
        response = client.get("/test-failure")
        assert response.status_code == 500
        assert "secret" not in response.text
        assert "secret" not in caplog.text
        assert client.get("/missing").json()["error"]["code"] == "NOT_FOUND"
        response = client.get("/health", headers={"Origin": "http://localhost:3000"})
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
        response = client.get("/health", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in response.headers


def test_production_hides_schema(settings):
    production = settings.model_copy(update={"app_env": "production"})
    with TestClient(create_app(production)) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404
