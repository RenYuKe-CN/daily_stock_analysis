import React, { useRef, useState } from 'react';
import { LogOut, Settings2, Shield, User, Key, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();
  const roleLabel: Record<string, string> = {
    admin: '管理员',
    user: '用户',
    viewer: '只读',
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2.5 rounded-2xl p-1.5 pr-3 transition-all',
          'border border-transparent hover:border-[var(--nav-active-border)] hover:bg-[var(--nav-hover-bg)]',
          open && 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)]',
        )}
        aria-label="用户菜单"
      >
        {/* Avatar */}
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold',
          'bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-sm',
        )}>
          {initial}
        </div>
        <span className="hidden text-sm font-medium text-foreground sm:inline">
          {user.username}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[var(--login-border-card)] bg-[var(--login-bg-card)]/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 origin-top-right">
          {/* User info header */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-base font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                <p className="flex items-center gap-1 text-xs text-muted-text">
                  {user.role === 'admin' ? <Shield className="h-3 w-3 text-rose-500" /> : user.role === 'user' ? <User className="h-3 w-3 text-blue-500" /> : <User className="h-3 w-3" />}
                  {roleLabel[user.role] ?? user.role}
                </p>
              </div>
            </div>
            {user.email && (
              <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-text">
                <Mail className="h-3 w-3 shrink-0" />
                {user.email}
              </p>
            )}
          </div>

          <div className="my-1 h-px bg-[var(--login-grid-line)]" />

          {/* Menu items */}
          <div className="space-y-0.5 py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
              系统设置
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary-text transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground"
            >
              <Key className="h-4 w-4" />
              修改密码
            </button>
          </div>

          <div className="my-1 h-px bg-[var(--login-grid-line)]" />

          <div className="py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); setShowLogoutConfirm(true); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="退出登录"
        message="确认退出当前登录状态吗？退出后需要重新登录。"
        confirmText="确认退出"
        cancelText="取消"
        isDanger={true}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          void logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};
