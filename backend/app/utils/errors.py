import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("aip_lms")


class DomainError(Exception):
    def __init__(self, status: int, code: str, message: str, *, headers=None):
        self.status, self.code, self.message = status, code, message
        self.headers = headers or ({"WWW-Authenticate": "Bearer"} if status == 401 else {})
        super().__init__(code)


def error_response(
    status: int, code: str, message: str, details=None, headers=None
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        headers=headers,
        content={"error": {"code": code, "message": message, "details": details}},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        return error_response(exc.status, exc.code, exc.message, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(part) for part in error["loc"]), "message": "Invalid value"}
            for error in exc.errors()
        ]
        return error_response(422, "VALIDATION_ERROR", "Request validation failed", details)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}
        return error_response(
            exc.status_code,
            codes.get(exc.status_code, "HTTP_ERROR"),
            "Request could not be completed",
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error("request_failed exception_type=%s", type(exc).__name__)
        return error_response(500, "INTERNAL_ERROR", "An unexpected error occurred")
