# -*- coding: utf-8 -*-
"""
Per-request user context for multi-tenant data isolation.

Usage:
    from src.services.user_context import set_current_user_id, get_current_user_id

    # In middleware / API handler:
    set_current_user_id(user.id)

    # In data access layer:
    user_id = get_current_user_id()
    query = query.filter(Model.user_id == user_id)
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Optional

_current_user_id: ContextVar[Optional[int]] = ContextVar("current_user_id", default=None)


def set_current_user_id(user_id: int) -> None:
    """Set the current user ID for this request context."""
    _current_user_id.set(user_id)


def get_current_user_id() -> Optional[int]:
    """Get the current user ID from request context, or None."""
    return _current_user_id.get()


def require_current_user_id() -> int:
    """Get the current user ID, raising if not set."""
    uid = _current_user_id.get()
    if uid is None:
        raise RuntimeError("No current user in context — authentication required")
    return uid
