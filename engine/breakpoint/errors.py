"""Application errors mapped to explicit HTTP responses by the API layer."""

from __future__ import annotations


class AppError(Exception):
    """Base error carrying an HTTP status and a machine-readable code."""

    status = 500
    code = "internal_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)


class ValidationError(AppError):
    """Bad request from a client. status 400, code invalid_request."""

    status = 400
    code = "invalid_request"


class NotFoundError(AppError):
    """Referenced record does not exist. status 404, code not_found."""

    status = 404
    code = "not_found"


class ConflictError(AppError):
    """Concurrent mutation or a stale baseline. status 409, code conflict."""

    status = 409
    code = "conflict"


class ForbiddenError(AppError):
    """Action refused (untrusted project). status 403, code forbidden."""

    status = 403
    code = "forbidden"


class ProviderUnavailableError(AppError):
    """Upstream dependency refused. status 503, code provider_unavailable."""

    status = 503
    code = "provider_unavailable"


class AiUnavailableError(Exception):
    """AI adapter failures; the API maps this class to 503."""
