# -*- coding: utf-8 -*-
"""
===================================
API v1 路由聚合
===================================

职责：
1. 聚合 v1 版本的所有 endpoint 路由
2. 统一添加 /api/v1 前缀
3. 为各路由组添加基础权限校验
"""

from fastapi import APIRouter, Depends

from api.deps import (
    require_analysis_read,
    require_chat_use,
    require_portfolio_read,
    require_backtest_view,
    require_alerts_read,
    require_system_config,
)
from api.v1.endpoints import alerts, analysis, auth, history, stocks, backtest, system_config, agent, usage, portfolio, alphasift, health, users, roles

router = APIRouter(prefix="/api/v1")

# Public: no permission needed
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(health.router, tags=["Health"])

# Requires 'chat:use'
router.include_router(agent.router, prefix="/agent", tags=["Agent"],
                       dependencies=[Depends(require_chat_use)])

# Requires 'analysis:read' (write ops check 'analysis:run' internally)
router.include_router(analysis.router, prefix="/analysis", tags=["Analysis"],
                       dependencies=[Depends(require_analysis_read)])
router.include_router(history.router, prefix="/history", tags=["History"],
                       dependencies=[Depends(require_analysis_read)])
router.include_router(stocks.router, prefix="/stocks", tags=["Stocks"],
                       dependencies=[Depends(require_analysis_read)])
router.include_router(usage.router, prefix="/usage", tags=["Usage"],
                       dependencies=[Depends(require_analysis_read)])

# Requires 'backtest:view'
router.include_router(backtest.router, prefix="/backtest", tags=["Backtest"],
                       dependencies=[Depends(require_backtest_view)])

# Requires 'system:config'
router.include_router(system_config.router, prefix="/system", tags=["SystemConfig"],
                       dependencies=[Depends(require_system_config)])

# Requires 'portfolio:read'
router.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"],
                       dependencies=[Depends(require_portfolio_read)])

# Requires 'alerts:read'
router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"],
                       dependencies=[Depends(require_alerts_read)])

# Requires 'analysis:read'
router.include_router(alphasift.router, prefix="/alphasift", tags=["AlphaSift"],
                       dependencies=[Depends(require_analysis_read)])

# Admin-protected endpoints (check internally via require_admin)
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(roles.router, prefix="/roles", tags=["Roles"])
