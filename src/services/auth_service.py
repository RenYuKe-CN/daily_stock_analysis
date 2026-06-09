# -*- coding: utf-8 -*-
"""
JWT-based authentication and user management service.

Replaces file-based admin auth (src/auth.py) with database-backed multi-user auth:
- bcrypt password hashing
- JWT access + refresh tokens
- User CRUD with role-based access control
"""

from __future__ import annotations

import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import bcrypt
import jwt

from src.storage import DatabaseManager, User, Role, seed_default_admin

logger = logging.getLogger(__name__)

# JWT configuration
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Roles
ROLE_ADMIN = "admin"
ROLE_USER = "user"
ROLE_VIEWER = "viewer"
VALID_ROLES = {ROLE_ADMIN, ROLE_USER, ROLE_VIEWER}

# Permissions matrix: role → set of allowed actions
ROLE_PERMISSIONS: Dict[str, set] = {
    ROLE_ADMIN: {
        "analysis:run", "analysis:read",
        "portfolio:read", "portfolio:write",
        "backtest:run", "backtest:read",
        "alerts:read", "alerts:write",
        "users:read", "users:write",
        "system:config", "system:read",
        "chat:use",
    },
    ROLE_USER: {
        "analysis:run", "analysis:read",
        "portfolio:read", "portfolio:write",
        "backtest:run", "backtest:read",
        "alerts:read", "alerts:write",
        "chat:use",
    },
    ROLE_VIEWER: {
        "analysis:read",
        "backtest:read",
        "alerts:read",
        "system:read",
    },
}


def _get_jwt_secret() -> str:
    """Get or generate JWT signing secret."""
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret
    # Auto-generate and persist for this process lifetime
    from pathlib import Path
    data_dir = Path(os.getenv("DATABASE_PATH", "./data/stock_analysis.db")).resolve().parent
    secret_path = data_dir / ".jwt_secret"
    try:
        if secret_path.exists():
            return secret_path.read_text().strip()
        data_dir.mkdir(parents=True, exist_ok=True)
        new_secret = secrets.token_urlsafe(64)
        secret_path.write_text(new_secret)
        secret_path.chmod(0o600)
        return new_secret
    except OSError:
        return secrets.token_urlsafe(64)


JWT_SECRET = _get_jwt_secret()


@dataclass
class AuthResult:
    """Result of authentication attempt."""
    success: bool
    user: Optional[User] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    error: str = ""


def hash_password(password: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    """Create a JWT access token for a user."""
    now = datetime.utcnow()
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user: User) -> str:
    """Create a long-lived refresh token."""
    now = datetime.utcnow()
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_by_id(user_id: int) -> Optional[User]:
    """Get a user by ID."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        return session.query(User).filter(User.id == user_id).first()
    finally:
        session.close()


def get_user_by_username(username: str) -> Optional[User]:
    """Get a user by username."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        return session.query(User).filter(User.username == username).first()
    finally:
        session.close()


def authenticate(username: str, password: str) -> AuthResult:
    """Authenticate a user with username and password. Returns tokens on success."""
    user = get_user_by_username(username)
    if not user:
        return AuthResult(success=False, error="用户名或密码错误")
    if not user.is_active:
        return AuthResult(success=False, error="账号已被禁用")

    if not verify_password(password, user.password_hash):
        return AuthResult(success=False, error="用户名或密码错误")

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    return AuthResult(success=True, user=user, access_token=access_token, refresh_token=refresh_token)


def refresh_access_token(refresh_token: str) -> Optional[str]:
    """Validate refresh token and issue a new access token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None
    user = get_user_by_id(int(payload["sub"]))
    if not user or not user.is_active:
        return None
    return create_access_token(user)


def create_user(username: str, password: str, email: str = "", role: str = ROLE_USER) -> Optional[User]:
    """Create a new user with role assignment. Returns the User or None on failure."""
    if not username or not password:
        logger.warning("创建用户失败: 用户名或密码为空")
        return None
    if len(password) < 6:
        logger.warning("创建用户失败: 密码少于6位")
        return None

    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        existing = session.query(User).filter(User.username == username).first()
        if existing:
            logger.warning(f"创建用户失败: 用户名已存在 {username}")
            return None

        user = User(
            username=username,
            password_hash=hash_password(password),
            email=email,
            role=role,  # primary/display role
            is_active=True,
        )
        session.add(user)
        session.flush()

        # Assign role
        from src.storage import UserRole as UR
        role_obj = session.query(Role).filter(Role.name == role).first()
        if role_obj:
            session.add(UR(user_id=user.id, role_id=role_obj.id))

        session.commit()
        session.refresh(user)
        logger.info(f"用户创建成功: {username} (role={role})")
        return user
    except Exception as e:
        session.rollback()
        logger.error(f"创建用户失败: {e}")
        return None
    finally:
        session.close()


def update_user(user_id: int, **kwargs) -> Optional[User]:
    """Update user fields. Supports: email, role, is_active, password."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        if "email" in kwargs:
            user.email = kwargs["email"]
        if "role" in kwargs and kwargs["role"] in VALID_ROLES:
            user.role = kwargs["role"]
        if "is_active" in kwargs:
            user.is_active = bool(kwargs["is_active"])
        if "password" in kwargs:
            user.password_hash = hash_password(kwargs["password"])
        user.updated_at = datetime.now()

        session.commit()
        session.refresh(user)
        return user
    except Exception as e:
        session.rollback()
        logger.error(f"更新用户失败: {e}")
        return None
    finally:
        session.close()


def delete_user(user_id: int) -> bool:
    """Delete a user. Cannot delete the last admin."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        # Prevent deleting last admin
        if user.role == ROLE_ADMIN:
            admin_count = session.query(User).filter(
                User.role == ROLE_ADMIN, User.is_active == True
            ).count()
            if admin_count <= 1:
                logger.warning("不能删除最后一个管理员")
                return False
        session.delete(user)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"删除用户失败: {e}")
        return False
    finally:
        session.close()


def list_users(page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """List users with pagination."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        total = session.query(User).count()
        users = (
            session.query(User)
            .order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        items = []
        for u in users:
            d = u.to_dict()
            d['roles'] = get_user_roles(u.id)
            items.append(d)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }
    finally:
        session.close()


def get_current_user_from_token(authorization_header: Optional[str]) -> Optional[User]:
    """Extract and validate user from Bearer token in Authorization header."""
    if not authorization_header:
        return None
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    payload = decode_token(parts[1])
    if not payload:
        return None
    if payload.get("type") != "access":
        return None
    user_id = int(payload.get("sub", 0))
    if not user_id:
        return None
    return get_user_by_id(user_id)


def has_permission(user: User, permission: str) -> bool:
    """Check if a user has the given permission (aggregates all roles)."""
    perms = get_user_permissions(user)
    return permission in perms or 'admin' in user.get_role_names()


def require_role(user: User, roles: List[str]) -> bool:
    """Check if user has one of the required roles."""
    user_roles = set(user.get_role_names())
    return bool(user_roles & set(roles))


# ============================================================
# Role management
# ============================================================

def get_user_permissions(user: User) -> List[str]:
    """Get effective permissions for a user (aggregates ALL assigned roles)."""
    import json as _json
    from src.storage import Role, UserRole, DEFAULT_ROLE_PERMISSIONS
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        roles = session.query(Role).join(UserRole, UserRole.role_id == Role.id).filter(
            UserRole.user_id == user.id
        ).all()
        if roles:
            perms = set()
            for role in roles:
                try:
                    perms.update(_json.loads(role.permissions or '[]'))
                except Exception:
                    pass
            return sorted(perms)
    except Exception:
        pass
    finally:
        session.close()
    # Fallback to single-role (backward compat)
    role_perms = DEFAULT_ROLE_PERMISSIONS.get(user.role, [])
    return list(role_perms) if role_perms else []


def assign_user_roles(user_id: int, role_names: List[str]) -> bool:
    """Replace a user's roles with the given set."""
    from src.storage import UserRole, Role
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        # Delete existing
        session.query(UserRole).filter(UserRole.user_id == user_id).delete()
        # Insert new
        for rn in role_names:
            role = session.query(Role).filter(Role.name == rn).first()
            if role:
                session.add(UserRole(user_id=user_id, role_id=role.id))
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"分配角色失败: {e}")
        return False
    finally:
        session.close()


def get_user_roles(user_id: int) -> List[str]:
    """Get role names for a user."""
    from src.storage import UserRole, Role
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        roles = session.query(Role.name).join(UserRole, UserRole.role_id == Role.id).filter(
            UserRole.user_id == user_id
        ).all()
        return [r[0] for r in roles]
    finally:
        session.close()


def list_roles() -> List[Dict[str, Any]]:
    """List all roles."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        roles = session.query(Role).order_by(Role.id).all()
        return [r.to_dict() for r in roles]
    finally:
        session.close()


def get_role(role_id: int) -> Optional[Dict[str, Any]]:
    """Get a single role by ID."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        role = session.query(Role).filter(Role.id == role_id).first()
        return role.to_dict() if role else None
    finally:
        session.close()


def create_role(name: str, display_name: str, description: str = "",
                permissions: List[str] = None) -> Optional[Dict[str, Any]]:
    """Create a new role."""
    import json as _json
    if not name or not display_name:
        return None
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        existing = session.query(Role).filter(Role.name == name).first()
        if existing:
            return None
        role = Role(
            name=name,
            display_name=display_name,
            description=description or '',
            permissions=_json.dumps(permissions or [], ensure_ascii=False),
            is_system=False,
        )
        session.add(role)
        session.commit()
        session.refresh(role)
        return role.to_dict()
    except Exception as e:
        session.rollback()
        logger.error(f"创建角色失败: {e}")
        return None
    finally:
        session.close()


def update_role(role_id: int, **kwargs) -> Optional[Dict[str, Any]]:
    """Update a role's fields."""
    import json as _json
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        role = session.query(Role).filter(Role.id == role_id).first()
        if not role:
            return None
        if "display_name" in kwargs:
            role.display_name = kwargs["display_name"]
        if "description" in kwargs:
            role.description = kwargs["description"]
        if "permissions" in kwargs:
            role.permissions = _json.dumps(kwargs["permissions"], ensure_ascii=False)
        role.updated_at = datetime.now()
        session.commit()
        session.refresh(role)
        return role.to_dict()
    except Exception as e:
        session.rollback()
        logger.error(f"更新角色失败: {e}")
        return None
    finally:
        session.close()


def delete_role(role_id: int) -> bool:
    """Delete a non-system role."""
    db = DatabaseManager.get_instance()
    session = db.get_session()
    try:
        role = session.query(Role).filter(Role.id == role_id).first()
        if not role or role.is_system:
            return False
        session.delete(role)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"删除角色失败: {e}")
        return False
    finally:
        session.close()


def get_available_permissions() -> Dict[str, str]:
    """Return all available permission keys and their display names."""
    from src.storage import AVAILABLE_PERMISSIONS
    return dict(AVAILABLE_PERMISSIONS)


def initialize_auth_system() -> None:
    """Initialize auth system: create tables and seed default admin/roles if needed."""
    db = DatabaseManager.get_instance()
    # Ensure tables exist
    from src.storage import Base, Role
    Base.metadata.create_all(db._engine, tables=[User.__table__, Role.__table__])
    # Seed default roles and admin
    from src.storage import seed_default_roles
    seed_default_roles(db)
    seed_default_admin(db)
    # Ensure VALID_ROLES stays in sync with DB roles
    global VALID_ROLES
    VALID_ROLES = {r.name for r in db.get_session().query(Role).all()} or {'admin', 'user', 'viewer'}
