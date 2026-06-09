import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, BriefcaseBusiness, Home, Key, LogOut, MessageSquareQuote, Search, Settings2, Shield, User, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ALPHASIFT_CONFIG_CHANGED_EVENT, SYSTEM_CONFIG_CHANGED_EVENT, alphasiftApi } from '../../api/alphasift';
import { authApi } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useAgentChatStore } from '../../stores/agentChatStore';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StatusDot } from '../common/StatusDot';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useNavigate } from 'react-router-dom';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  variant?: 'default' | 'rail';
};

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: 'completion';
  permission: string;  // required permission key
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: '首页', to: '/', icon: Home, exact: true, permission: 'home:view' },
  { key: 'chat', label: '问股', to: '/chat', icon: MessageSquareQuote, badge: 'completion', permission: 'chat:use' },
  { key: 'screening', label: '选股', to: '/screening', icon: Search, permission: 'screening:use' },
  { key: 'portfolio', label: '持仓', to: '/portfolio', icon: BriefcaseBusiness, permission: 'portfolio:read' },
  { key: 'backtest', label: '回测', to: '/backtest', icon: BarChart3, permission: 'backtest:view' },
  { key: 'alerts', label: '告警', to: '/alerts', icon: Bell, permission: 'alerts:read' },
  { key: 'users', label: '用户', to: '/users', icon: Users, permission: 'users:read' },
  { key: 'roles', label: '角色', to: '/roles', icon: Shield, permission: 'roles:read' },
  { key: 'settings', label: '设置', to: '/settings', icon: Settings2, permission: 'system:config' },
];

const roleLabel: Record<string, string> = {
  admin: '管理员',
  user: '用户',
  viewer: '只读',
};

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed = false, onNavigate, variant = 'default' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const completionBadge = useAgentChatStore((state) => state.completionBadge);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAlphaSiftNav, setShowAlphaSiftNav] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userPerms, setUserPerms] = useState<Set<string>>(new Set());
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load user permissions on mount
  useEffect(() => {
    if (!user) return;
    authApi.getMyPermissions().then(d => setUserPerms(new Set(d.permissions))).catch(() => {});
  }, [user]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    let active = true;

    const refreshAlphaSiftStatus = async () => {
      try {
        const status = await alphasiftApi.getStatus();
        if (active) {
          setShowAlphaSiftNav(status.enabled);
        }
      } catch {
        if (active) {
          setShowAlphaSiftNav(false);
        }
      }
    };

    void refreshAlphaSiftStatus();
    window.addEventListener(ALPHASIFT_CONFIG_CHANGED_EVENT, refreshAlphaSiftStatus);
    window.addEventListener(SYSTEM_CONFIG_CHANGED_EVENT, refreshAlphaSiftStatus);

    return () => {
      active = false;
      window.removeEventListener(ALPHASIFT_CONFIG_CHANGED_EVENT, refreshAlphaSiftStatus);
      window.removeEventListener(SYSTEM_CONFIG_CHANGED_EVENT, refreshAlphaSiftStatus);
    };
  }, []);

  const navItems = NAV_ITEMS
    .filter((item) => !showAlphaSiftNav ? item.key !== 'screening' : true)
    .filter((item) => userPerms.has(item.permission) || userPerms.size === 0);
  // When perms not loaded yet (size=0), show all to avoid flicker — they'll filter once loaded
  const isRail = variant === 'rail';
  const itemBaseClass = cn(
    'group relative flex h-[var(--nav-item-height)] w-full items-center overflow-hidden rounded-2xl border border-transparent text-sm leading-none text-secondary-text transition-all',
    isRail
      ? 'justify-center gap-2.5 px-2'
      : collapsed
        ? 'justify-center px-0'
        : 'gap-3 px-[var(--nav-item-padding-x)]'
  );
  const itemInteractiveClass = cn(
    itemBaseClass,
    'hover:bg-[var(--nav-hover-bg)] hover:text-foreground'
  );
  const itemActiveClass = 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] font-medium text-[hsl(var(--primary))]';
  const itemIconClass = cn(isRail ? 'h-[18px] w-[18px]' : 'h-5 w-5', 'shrink-0');
  const itemLabelClass = cn('truncate', isRail ? 'text-center' : '');

  const userInitial = user?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          'flex items-center',
          isRail ? 'mb-5 justify-center gap-2 pt-1' : 'mb-4 gap-2 px-1',
          collapsed || isRail ? 'justify-center' : ''
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]',
            isRail ? 'h-9 w-9 rounded-[1rem]' : 'h-10 w-10 rounded-2xl'
          )}
        >
          <BarChart3 className={cn(isRail ? 'h-[19px] w-[19px]' : 'h-5 w-5')} />
        </div>
        {!collapsed ? (
          <p className={cn('min-w-0 truncate font-semibold text-foreground', isRail ? 'text-[0.95rem] leading-none' : 'text-sm')}>DSA</p>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1.5" aria-label="主导航">
        {navItems.map(({ key, label, to, icon: Icon, exact, badge }) => (
          <NavLink
            key={key}
            to={to}
            end={exact}
            onClick={onNavigate}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                itemInteractiveClass,
                isActive ? itemActiveClass : ''
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn(itemIconClass, isActive ? 'text-[var(--nav-icon-active)]' : 'text-current')} />
                {!collapsed ? <span className={itemLabelClass}>{label}</span> : null}
                {badge === 'completion' && completionBadge ? (
                  <StatusDot
                    tone="info"
                    data-testid="chat-completion-badge"
                    className={cn(
                      'absolute right-3 border-2 border-background shadow-[0_0_10px_var(--nav-indicator-shadow)]',
                      collapsed ? 'right-2 top-2' : ''
                    )}
                    aria-label="问股有新消息"
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}

        <ThemeToggle
          variant={isRail ? 'rail' : 'nav'}
          collapsed={collapsed}
          wrapperClassName="w-full"
          triggerClassName={itemInteractiveClass}
          triggerActiveClassName={itemActiveClass}
          iconClassName={itemIconClass}
          labelClassName={itemLabelClass}
        />
      </nav>

      {/* User section at bottom */}
      {user && (
        <div ref={userMenuRef} className={cn('relative shrink-0', isRail ? 'mt-1.5' : 'mt-3')}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl border p-1.5 transition-all',
              userMenuOpen
                ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)]'
                : 'border-transparent hover:border-[var(--nav-active-border)] hover:bg-[var(--nav-hover-bg)]',
              isRail || collapsed ? 'justify-center px-1.5' : 'px-2',
            )}
            aria-label="用户菜单"
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-sm',
                isRail || collapsed ? 'h-8 w-8' : 'h-9 w-9',
              )}
            >
              {userInitial}
            </div>
            {!collapsed && !isRail && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-foreground leading-tight">{user.username}</p>
                <p className="text-[11px] text-muted-text leading-tight">{roleLabel[user.role] ?? user.role}</p>
              </div>
            )}
          </button>

          {/* Dropdown — opens upward */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-2xl border border-[var(--login-border-card)] bg-[var(--login-bg-card)]/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-1 origin-bottom-left">
              {/* User info */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-text">
                      {user.role === 'admin' ? <Shield className="h-3 w-3 text-rose-500" /> : <User className="h-3 w-3 text-blue-500" />}
                      {roleLabel[user.role] ?? user.role}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mx-2 h-px bg-[var(--login-grid-line)]" />

              {/* Menu actions */}
              <div className="space-y-0.5 p-1">
                {userPerms.has('users:read') && (
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); onNavigate?.(); navigate('/users'); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
                  >
                    <Users className="h-4 w-4" />
                    用户管理
                  </button>
                )}
                {userPerms.has('roles:read') && (
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); onNavigate?.(); navigate('/roles'); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
                  >
                    <Shield className="h-4 w-4" />
                    角色管理
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); onNavigate?.(); navigate('/settings'); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
                >
                  <Settings2 className="h-4 w-4" />
                  系统设置
                </button>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); onNavigate?.(); navigate('/settings'); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
                >
                  <Key className="h-4 w-4" />
                  修改密码
                </button>
              </div>

              <div className="mx-2 h-px bg-[var(--login-grid-line)]" />

              <div className="p-1">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); setShowLogoutConfirm(true); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="退出登录"
        message="确认退出当前登录状态吗？退出后需要重新输入密码。"
        confirmText="确认退出"
        cancelText="取消"
        isDanger
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onNavigate?.();
          void logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};
