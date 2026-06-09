# 权限体系规划文档

## 已完成

- [x] MySQL 全量迁移（23 张表）
- [x] JWT 多用户认证（登录/注册/token 刷新）
- [x] 全站登录守卫（未登录强制跳转登录页）
- [x] 侧边栏用户头像菜单（个人信息/修改密码/退出）
- [x] 19 张业务表 `user_id` 数据隔离
- [x] Roles 表 + 权限管理页（16 项权限可视化编辑）
- [x] 用户管理页（创建/删除/多角色分配/角色切换）
- [x] 用户-角色 N:M 关联（一个用户可拥有多个角色，权限取并集）
- [x] 菜单权限过滤（viewer 只能看到 3 个菜单，admin 看到全部）
- [x] API 层权限拦截（router 级 Depends 校验，403 拒绝）
- [x] 按钮级权限控制（`usePermission` hook，无权限按钮自动隐藏）

## 待处理

### 高优先级

- [ ] 默认密码强制修改（首次登录检测 `admin123`，弹窗要求改密码）
- [ ] 定时任务/CLI 分析数据归属（`--schedule` 模式指定 user_id）
- [ ] 清理旧认证代码（`src/auth.py` 文件密码 + Cookie session 与 JWT 并存，择机移除旧逻辑）
- [ ] 登录限流（`/api/v1/auth/token` 接口加 IP 限流，防暴力破解）

### 中优先级

- [ ] 移动端侧边抽屉显示用户头像
- [ ] 用户管理页：批量导入/导出
- [ ] 注册审批（当前开放注册，首用户=admin，后续=viewer。生产环境建议改为仅 admin 创建账号）

### 低优先级

- [ ] 菜单项配置化（`menu_config` 表存可见性/排序/显示名，不动前端代码即可调整菜单）

    > **关于菜单 DB 化的决策**：当前 9 个固定菜单，用角色权限系统已完全控制可见性。菜单动态化（如 RuoYi 的 `sys_menu` 表）需要「新增菜单 = 自动生成前端页面 + 路由」，这与本项目的独立 React 页面架构冲突——新增菜单仍然必须写前端代码。因此菜单 DB 化当前投入产出比不合理，等菜单数量达到 15+ 时再评估。

- [ ] 操作日志（审计用户增删改操作）
- [ ] 多语言支持（英文版权限管理页）

## 已完成的结构

```
数据库层:
  users ──N:M── user_roles ──N:M── roles (permissions JSON)

认证层:
  LoginPage → JWT token → localStorage → axios interceptor (Bearer)

权限层:
  1. 菜单过滤: SidebarNav 读 /api/v1/users/me/permissions → 过滤 NavItem
  2. API 拦截: router Depends(require_xxx) → 403
  3. 按钮控制: usePermission().has('xxx:write') → 隐藏按钮
  4. 数据隔离: middleware set_current_user_id() → WHERE user_id = ?

角色默认权限:
  admin  → 16 项全部
  user   → 12 项（分析/回测/持仓/告警/问股）
  viewer → 4 项（分析查看/回测查看/告警查看/系统查看）
```

## 备注

- 所有角色和权限可通过 Web UI 的「角色管理」页实时修改，无需重启
- 系统内置角色（admin/user/viewer）不可删除，但可编辑其权限
- 侧边栏「用户」「角色」菜单仅对拥有对应权限的角色可见
