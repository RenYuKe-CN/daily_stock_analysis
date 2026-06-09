import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Shield, Trash2, User, Eye } from 'lucide-react';
import { authApi, type UserInfo } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

// --- Role icon & color helpers ---

const roleIconMap: Record<string, React.ReactNode> = {
  admin: <Shield className="h-3 w-3" />,
  user: <User className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

const roleColorMap: Record<string, string> = {
  admin: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  user: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

// --- MultiRolePicker: checkboxes dropdown for N:M role assignment ---

const MultiRolePicker: React.FC<{
  selected: string[];
  allRoles: { name: string; display_name: string }[];
  onChange: (roles: string[]) => void;
}> = ({ selected, allRoles, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = new Set(selected);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (name: string) => {
    const next = sel.has(name) ? selected.filter(r => r !== name) : [...selected, name];
    onChange(next);
  };

  const displayText = selected.length === 0 ? '未分配' : selected.map(r => allRoles.find(a => a.name === r)?.display_name ?? r).join(' / ');

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
        <span className="max-w-[100px] truncate">{displayText}</span>
        <ChevronDown className={`h-3 w-3 text-muted-text transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-xl border border-[var(--login-border-card)] bg-[var(--login-bg-card)]/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 origin-top">
          {allRoles.map(r => {
            const active = sel.has(r.name);
            const c = roleColorMap[r.name] ?? roleColorMap.user;
            return (
              <label key={r.name}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-[var(--nav-hover-bg)] ${active ? 'font-medium text-foreground' : 'text-secondary-text'}`}>
                <input type="checkbox" checked={active} onChange={() => toggle(r.name)} className="rounded" />
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${c}`}>
                  {roleIconMap[r.name] ?? <User className="h-3 w-3" />}{r.display_name}
                </span>
              </label>
            );
          })}
          <div className="mt-1 border-t border-border/30 pt-1">
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-muted-text hover:text-foreground transition-colors">
              清除全部
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Page ---

const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { has } = usePermission();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.listUsers(1, 100);
      setUsers(data.items);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await authApi.createUser(newUsername.trim(), newPassword, newRole, newEmail.trim());
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setNewEmail('');
      setSuccess(`用户「${newUsername.trim()}」创建成功`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await authApi.deleteUser(deleteTarget.id);
      setSuccess(`用户「${deleteTarget.username}」已删除`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '删除失败');
    }
  };

  const handleToggleActive = async (u: UserInfo) => {
    try {
      await authApi.updateUser(u.id, { is_active: !u.is_active });
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '操作失败');
    }
  };

  const handleRolesChange = async (u: UserInfo, roles: string[]) => {
    try {
      await authApi.assignRoles(u.id, roles);
      setSuccess(`用户「${u.username}」角色已更新`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '修改失败');
    }
  };

  const [roles, setRoles] = useState<{ name: string; display_name: string }[]>([]);
  useEffect(() => {
    authApi.listRoles().then(d => setRoles(d.items)).catch(() => {});
  }, []);

  useEffect(() => { document.title = '用户管理 - DSA'; }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="mt-1 text-sm text-muted-text">
            管理系统用户账号与角色权限。当前共 {users.length} 个用户。
          </p>
        </div>
        {has('users:write') && (
          <Button type="button" onClick={() => { setShowCreate((v) => !v); setError(null); setSuccess(null); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            新建用户
          </Button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => setError(null)}>关闭</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          {success}
          <button type="button" className="ml-2 underline" onClick={() => setSuccess(null)}>关闭</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-2xl border border-[var(--nav-active-border)] bg-card/60 p-5 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">新建用户</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="用户名"
                placeholder="请输入用户名"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
              <Input
                label="邮箱"
                type="email"
                placeholder="选填"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Input
                label="密码"
                type="password"
                placeholder="至少 6 位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">角色</label>
                <div className="flex gap-2">
                  {[
                    { k: 'user', v: '用户', d: '完整功能' },
                    { k: 'viewer', v: '只读', d: '仅查看' },
                    { k: 'admin', v: '管理员', d: '全部权限' },
                  ].map(({ k, v, d }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewRole(k)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs transition-all ${
                        newRole === k
                          ? `${roleColorMap[k] ?? ''} font-semibold shadow-sm`
                          : 'border-border/40 text-muted-text hover:border-border hover:text-secondary-text'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        {roleIconMap[k] ?? <User className="h-3 w-3" />}
                        {v}
                      </span>
                      <span className="mt-0.5 block text-[10px] opacity-70">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                创建
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-text" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-text">用户</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-text hidden sm:table-cell">邮箱</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-text">角色</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-text">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-text hidden md:table-cell">创建时间</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-text">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-gradient text-xs font-bold text-[hsl(var(--primary-foreground))]">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.username}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[11px] text-muted-text">当前用户</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-text hidden sm:table-cell">{u.email || '—'}</td>
                    <td className="px-5 py-3.5">
                      {u.id === currentUser?.id ? (
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? [u.role]).map(rn => {
                            const r = roles.find(rr => rr.name === rn);
                            return (
                              <span key={rn} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleColorMap[rn] ?? ''}`}>
                                {roleIconMap[rn] ?? <User className="h-3 w-3" />}
                                {r?.display_name ?? rn}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <MultiRolePicker
                          selected={u.roles ?? [u.role]}
                          allRoles={roles}
                          onChange={(newRoles) => handleRolesChange(u, newRoles)}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => u.id !== currentUser?.id && handleToggleActive(u)}
                        disabled={u.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          u.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        } ${u.id !== currentUser?.id ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {u.is_active ? '正常' : '已禁用'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-text hidden md:table-cell whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.id !== currentUser?.id && has('users:write') && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-lg p-1.5 text-muted-text transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                          title="删除用户"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-text">
                      暂无用户数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除用户"
        message={`确定要删除用户「${deleteTarget?.username}」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        isDanger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default UserManagementPage;
