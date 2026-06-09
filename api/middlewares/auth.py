# -*- coding: utf-8 -*-
"""
Auth middleware: protect /api/v1/* with JWT (primary) or legacy cookie (fallback).

Priority:
1. JWT Bearer token → user-level auth (new multi-user system)
2. Cookie session → admin-level auth (legacy file-based)
3. If no users exist yet → setup mode, everything passes
4. Otherwise → 401
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.auth import COOKIE_NAME, verify_session
from src.services.auth_service import get_current_user_from_token
from src.services.user_context import set_current_user_id

logger = logging.getLogger(__name__)

# Auth-related endpoints always public
EXEMPT_PATHS = frozenset({
    "/api/v1/auth/login",
    "/api/v1/auth/status",
    "/api/v1/auth/refresh",
    "/api/v1/auth/settings",
    "/api/v1/auth/logout",
    "/api/v1/auth/change-password",
    "/api/v1/auth/token",
    "/api/v1/auth/register",
    "/api/health",
    "/api/v1/health",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})

# Endpoints the frontend calls on every page — should not trigger redirect loops
FRONTEND_SAFE_PATHS = frozenset({
    "/api/v1/alphasift/status",
})


def _path_exempt(path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    return normalized in EXEMPT_PATHS


def _path_frontend_safe(path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    return normalized in FRONTEND_SAFE_PATHS


# Cache for setup mode check
_setup_mode: bool | None = None
_setup_mode_ts: float = 0.0


def _is_setup_mode() -> bool:
    """Return True if no users exist yet (setup mode — allow everything)."""
    global _setup_mode, _setup_mode_ts
    import time
    now = time.time()
    if _setup_mode is None or now - _setup_mode_ts > 10:
        try:
            from src.storage import DatabaseManager, User
            db = DatabaseManager.get_instance()
            session = db.get_session()
            try:
                _setup_mode = session.query(User).first() is None
            finally:
                session.close()
            _setup_mode_ts = now
        except Exception:
            _setup_mode = False
    return bool(_setup_mode)


class AuthMiddleware(BaseHTTPMiddleware):
    """Authenticate requests via JWT (preferred) or legacy cookie session."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ):
        path = request.url.path

        # Always allow exempt paths
        if _path_exempt(path):
            return await call_next(request)

        # Only protect API routes
        if not path.startswith("/api/v1/"):
            return await call_next(request)

        # Setup mode: no users exist, allow everything (no user context to set)
        if _is_setup_mode():
            return await call_next(request)

        authenticated = False

        # 1. Try JWT Bearer token (new multi-user auth)
        auth_header = request.headers.get("Authorization")
        if auth_header:
            user = get_current_user_from_token(auth_header)
            if user:
                request.state.current_user = user
                request.state.auth_method = "jwt"
                authenticated = True

        # 2. Fall back to legacy cookie session
        if not authenticated:
            cookie_val = request.cookies.get(COOKIE_NAME)
            if cookie_val and verify_session(cookie_val):
                request.state.auth_method = "cookie"
                from src.services.auth_service import get_user_by_username
                admin_user = get_user_by_username("admin")
                if admin_user:
                    request.state.current_user = admin_user
                authenticated = True

        if not authenticated:
            # Frontend-safe paths: return empty data instead of 401 to avoid redirect loops
            if _path_frontend_safe(path):
                return JSONResponse(status_code=200, content={"available": False})

            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": "请先登录",
                },
            )

        # Set user context for data isolation
        user = getattr(request.state, "current_user", None)
        if user:
            set_current_user_id(user.id)

        return await call_next(request)


def require_admin(request: Request) -> bool:
    """Check if the current request is from an admin user."""
    user = getattr(request.state, "current_user", None)
    if not user:
        return False
    return user.role == "admin"


def require_permission(request: Request, permission: str) -> bool:
    """Check if the current user has a specific permission (from their role)."""
    user = getattr(request.state, "current_user", None)
    if not user:
        return False
    # Admin always has everything
    if user.role == "admin":
        return True
    try:
        from src.services.auth_service import get_user_permissions
        perms = get_user_permissions(user)
        return permission in perms
    except Exception:
        return False


def add_auth_middleware(app):
    """Add auth middleware to protect API routes.

    The middleware is always registered; auth is enforced based on token validity,
    cookie session, or setup mode.
    """
    app.add_middleware(AuthMiddleware)
