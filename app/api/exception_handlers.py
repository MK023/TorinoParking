"""Centralized exception handlers mapping domain errors to HTTP responses.

Registered on the FastAPI application to ensure consistent error formatting
across all endpoints without try/except boilerplate in route functions.
"""

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import FiveTApiError, ParkingNotFoundError

logger = structlog.get_logger()


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ParkingNotFoundError)
    async def parking_not_found_handler(request: Request, exc: ParkingNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(FiveTApiError)
    async def five_t_error_handler(request: Request, exc: FiveTApiError):
        logger.error("five_t_api_error", error=str(exc))
        return JSONResponse(
            status_code=502,
            content={"detail": "Unable to fetch parking data from upstream API"},
        )
