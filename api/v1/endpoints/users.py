# -*- coding: utf-8 -*-
"""User management endpoints (admin only)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from api.middlewares.auth import require_admin
from src.services.auth_service import (
    assign_user_roles,
    create_user,
    delete_user,
    get_user_roles,
    list_users,
    update_user,
    ROLE_ADMIN,
    ROLE_USER,
    ROLE_VIEWER,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Pydantic schemas ---

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    email: str = Field(default="")
    role: str = Field(default=ROLE_USER)


class UpdateUserRequest(BaseModel):
    email: str | None = Field(default=None)
    role: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    password: str | None = Field(default=None, min_length=6, max_length=128)


class ChangeOwnPasswordRequest(BaseModel):
    current_password: str = Field(..., alias="currentPassword")
    new_password: str = Field(..., min_length=6, alias="newPassword")


# --- Endpoints ---

@router.get("", summary="List all users (admin only)")
async def list_users_endpoint(request: Request, page: int = 1, page_size: int = 20):
    """List users with pagination. Admin only."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可访问"})
    return list_users(page=page, page_size=page_size)


@router.post("", summary="Create a new user (admin only)")
async def create_user_endpoint(request: Request, body: CreateUserRequest):
    """Create a new user. Admin only."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})

    user = create_user(
        username=body.username.strip(),
        password=body.password,
        email=(body.email or "").strip(),
        role=body.role if body.role in (ROLE_ADMIN, ROLE_USER, ROLE_VIEWER) else ROLE_USER,
    )
    if not user:
        return JSONResponse(status_code=400, content={"error": "create_failed", "message": "创建用户失败，用户名可能已存在"})

    return {"ok": True, "user": user.to_dict()}


@router.get("/{user_id}", summary="Get user by ID (admin only)")
async def get_user_endpoint(request: Request, user_id: int):
    """Get a single user. Admin only."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可访问"})

    from src.services.auth_service import get_user_by_id
    user = get_user_by_id(user_id)
    if not user:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})
    return user.to_dict()


@router.put("/{user_id}", summary="Update a user (admin only)")
async def update_user_endpoint(request: Request, user_id: int, body: UpdateUserRequest):
    """Update user fields. Admin only."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})

    current_user = getattr(request.state, "current_user", None)
    if current_user and current_user.id == user_id and body.role is not None and body.role != current_user.role:
        return JSONResponse(status_code=400, content={"error": "invalid", "message": "不能修改自己的角色"})

    kwargs = {}
    if body.email is not None:
        kwargs["email"] = body.email.strip()
    if body.role is not None and body.role in (ROLE_ADMIN, ROLE_USER, ROLE_VIEWER):
        kwargs["role"] = body.role
    if body.is_active is not None:
        kwargs["is_active"] = body.is_active
    if body.password:
        kwargs["password"] = body.password

    user = update_user(user_id, **kwargs)
    if not user:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在或更新失败"})

    return {"ok": True, "user": user.to_dict()}


@router.delete("/{user_id}", summary="Delete a user (admin only)")
async def delete_user_endpoint(request: Request, user_id: int):
    """Delete a user. Cannot delete self or last admin."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})

    current_user = getattr(request.state, "current_user", None)
    if current_user and current_user.id == user_id:
        return JSONResponse(status_code=400, content={"error": "invalid", "message": "不能删除自己"})

    ok = delete_user(user_id)
    if not ok:
        return JSONResponse(status_code=400, content={"error": "delete_failed", "message": "删除失败，可能是最后一个管理员"})

    return {"ok": True}


@router.put("/me/password", summary="Change own password")
async def change_own_password(request: Request, body: ChangeOwnPasswordRequest):
    """Change the current user's password."""
    user = getattr(request.state, "current_user", None)
    if not user:
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "请先登录"})

    from src.services.auth_service import verify_password, update_user
    if not verify_password(body.current_password, user.password_hash):
        return JSONResponse(status_code=400, content={"error": "invalid", "message": "当前密码错误"})

    update_user(user.id, password=body.new_password)
    return {"ok": True}


@router.get("/me/permissions", summary="Get current user permissions")
async def get_my_permissions(request: Request):
    """Return permissions for the current user based on their role."""
    user = getattr(request.state, "current_user", None)
    if not user:
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "请先登录"})
    from src.services.auth_service import get_user_permissions
    return {"permissions": get_user_permissions(user)}


@router.get("/me/profile", summary="Get current user profile")
async def get_my_profile(request: Request):
    """Return the current user's profile with roles."""
    user = getattr(request.state, "current_user", None)
    if not user:
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "请先登录"})
    profile = user.to_dict()
    profile["roles"] = get_user_roles(user.id)
    return profile


@router.put("/{user_id}/roles", summary="Assign roles to a user")
async def assign_roles_endpoint(request: Request, user_id: int, body: dict):
    """Replace a user's role assignments. Admin only."""
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})
    role_names = body.get("roles", [])
    if not isinstance(role_names, list):
        return JSONResponse(status_code=400, content={"error": "invalid", "message": "roles 必须是数组"})
    ok = assign_user_roles(user_id, role_names)
    if not ok:
        return JSONResponse(status_code=500, content={"error": "failed", "message": "角色分配失败"})
    return {"ok": True, "roles": get_user_roles(user_id)}
