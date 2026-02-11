"""Structured logging with rotating file handlers and multi-sink output.

Configures a three-sink logging pipeline: a combined application log,
a dedicated error log, and an access log for HTTP requests. All file
outputs use JSON format for machine parseability. Structlog processors
sit on top of stdlib logging to provide context propagation and request
ID correlation.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

import structlog

from app.config import settings


def _create_file_handler(filename: str, level: int = logging.DEBUG) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        filename=os.path.join(settings.log_dir, filename),
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
        encoding="utf-8",
    )
    handler.setLevel(level)
    return handler


def configure_logging() -> None:
    os.makedirs(settings.log_dir, exist_ok=True)

    log_level = logging.getLevelName(settings.log_level)
    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers.clear()

    json_formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )

    app_handler = _create_file_handler("app.log", logging.DEBUG)
    app_handler.setFormatter(json_formatter)
    root.addHandler(app_handler)

    error_handler = _create_file_handler("error.log", logging.ERROR)
    error_handler.setFormatter(json_formatter)
    root.addHandler(error_handler)

    access_logger = logging.getLogger("access")
    access_logger.propagate = False
    access_logger.setLevel(logging.INFO)
    access_handler = _create_file_handler("access.log", logging.INFO)
    access_handler.setFormatter(json_formatter)
    access_logger.addHandler(access_handler)

    if settings.environment != "production":
        console = logging.StreamHandler()
        console.setLevel(log_level)
        console_formatter = structlog.stdlib.ProcessorFormatter(
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.dev.ConsoleRenderer(),
            ],
        )
        console.setFormatter(console_formatter)
        root.addHandler(console)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
