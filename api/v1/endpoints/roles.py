# -*- coding: utf-8 -*-
"""Role management endpoints (admin only)."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from api.middlewares.auth import require_admin
from src.services.auth_service import (
    list_roles, get_role, create_role, update_role, delete_role,
    get_available_permissions,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateRoleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=32)
    display_name: str = Field(..., alias="displayName")
    description: str = Field(default="")
    permissions: List[str] = Field(default_factory=list)


class UpdateRoleRequest(BaseModel):
    display_name: str | None = Field(default=None, alias="displayName")
    description: str | None = Field(default=None)
    permissions: List[str] | None = Field(default=None)


@router.get("", summary="List all roles")
async def list_roles_endpoint(request: Request):
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可访问"})
    return {"items": list_roles()}


@router.get("/permissions", summary="List available permissions")
async def list_permissions_endpoint(request: Request):
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可访问"})
    perms = get_available_permissions()
    return {"permissions": [{"key": k, "label": v} for k, v in perms.items()]}


@router.post("", summary="Create a role")
async def create_role_endpoint(request: Request, body: CreateRoleRequest):
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})
    role = create_role(
        name=body.name.strip(),
        display_name=body.display_name,
        description=body.description,
        permissions=body.permissions,
    )
    if not role:
        return JSONResponse(status_code=400, content={"error": "create_failed", "message": "创建失败，角色名可能已存在"})
    return {"ok": True, "role": role}


@router.put("/{role_id}", summary="Update a role")
async def update_role_endpoint(request: Request, role_id: int, body: UpdateRoleRequest):
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})
    kwargs = {}
    if body.display_name is not None:
        kwargs["display_name"] = body.display_name
    if body.description is not None:
        kwargs["description"] = body.description
    if body.permissions is not None:
        kwargs["permissions"] = body.permissions
    role = update_role(role_id, **kwargs)
    if not role:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "角色不存在或为系统内置"})
    return {"ok": True, "role": role}


@router.delete("/{role_id}", summary="Delete a role")
async def delete_role_endpoint(request: Request, role_id: int):
    if not require_admin(request):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "仅管理员可操作"})
    ok = delete_role(role_id)
    if not ok:
        return JSONResponse(status_code=400, content={"error": "delete_failed", "message": "系统内置角色不可删除"})
    return {"ok": True}
