# -*- coding: utf-8 -*-
"""
===================================
API 依赖注入模块
===================================

职责：
1. 提供数据库 Session 依赖
2. 提供配置依赖
3. 提供服务层依赖
4. 提供权限校验依赖
"""

from typing import Generator

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from src.storage import DatabaseManager
from src.config import get_config, Config
from src.services.system_config_service import SystemConfigService


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库 Session 依赖

    使用 FastAPI 依赖注入机制，确保请求结束后自动关闭 Session

    Yields:
        Session: SQLAlchemy Session 对象

    Example:
        @router.get("/items")
        async def get_items(db: Session = Depends(get_db)):
            ...
    """
    db_manager = DatabaseManager.get_instance()
    session = db_manager.get_session()
    try:
        yield session
    finally:
        session.close()


def get_config_dep() -> Config:
    """
    获取配置依赖

    Returns:
        Config: 配置单例对象
    """
    return get_config()


def get_database_manager() -> DatabaseManager:
    """
    获取数据库管理器依赖

    Returns:
        DatabaseManager: 数据库管理器单例对象
    """
    return DatabaseManager.get_instance()


def get_system_config_service(request: Request) -> SystemConfigService:
    """Get app-lifecycle shared SystemConfigService instance."""
    service = getattr(request.app.state, "system_config_service", None)
    if service is None:
        service = SystemConfigService()
        request.app.state.system_config_service = service
    return service


# --- Permission dependencies (use with Depends) ---

def _check_permission(request: Request, permission: str) -> None:
    """Raise 403 if the current user lacks the required permission."""
    from api.middlewares.auth import require_permission
    if not require_permission(request, permission):
        raise HTTPException(status_code=403, detail="权限不足")


def require_perm(permission: str):
    """FastAPI dependency factory: requires a specific permission."""
    def checker(request: Request):
        _check_permission(request, permission)
    return Depends(checker)


def require_analysis_run(request: Request):
    _check_permission(request, "analysis:run")

def require_analysis_read(request: Request):
    _check_permission(request, "analysis:read")

def require_chat_use(request: Request):
    _check_permission(request, "chat:use")

def require_portfolio_read(request: Request):
    _check_permission(request, "portfolio:read")

def require_portfolio_write(request: Request):
    _check_permission(request, "portfolio:write")

def require_backtest_view(request: Request):
    _check_permission(request, "backtest:view")

def require_backtest_run(request: Request):
    _check_permission(request, "backtest:run")

def require_alerts_read(request: Request):
    _check_permission(request, "alerts:read")

def require_alerts_write(request: Request):
    _check_permission(request, "alerts:write")

def require_system_config(request: Request):
    _check_permission(request, "system:config")

