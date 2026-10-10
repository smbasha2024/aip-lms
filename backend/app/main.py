from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin_balances import router as admin_balance_router
from app.api.admin_employees import router as admin_employee_router
from app.api.admin_holidays import router as admin_holiday_router
from app.api.admin_leave_types import router as admin_leave_type_router
from app.api.approvals import router as approval_router
from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.employees import router as employee_router
from app.api.health import router
from app.api.leave import router as leave_router
from app.api.notifications import router as notification_router
from app.config import Settings, load_settings
from app.database import create_session_factory
from app.services.auth_service import utc_now
from app.utils.errors import install_error_handlers
from app.utils.rate_limit import LoginLimiter


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    factory = create_session_factory(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            factory.kw["bind"].dispose()

    app = FastAPI(
        title="Employee Leave Management API",
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None if settings.app_env == "production" else "/redoc",
        openapi_url=None if settings.app_env == "production" else "/openapi.json",
    )
    app.state.login_limiter = LoginLimiter()
    app.state.auth_clock = utc_now
    app.state.settings = settings
    app.state.session_factory = factory
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def private_api_responses(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(employee_router)
    app.include_router(admin_employee_router)
    app.include_router(admin_balance_router)
    app.include_router(admin_holiday_router)
    app.include_router(admin_leave_type_router)
    app.include_router(calendar_router)
    app.include_router(leave_router)
    app.include_router(approval_router)
    app.include_router(notification_router)
    return app
