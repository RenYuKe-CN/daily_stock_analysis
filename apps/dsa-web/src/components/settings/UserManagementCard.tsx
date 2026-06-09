import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Shield, User, Eye } from 'lucide-react';
import { authApi, type UserInfo } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsSectionCard } from './SettingsSectionCard';
import { SettingsAlert } from './SettingsAlert';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const UserManagementCard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.listUsers();
      setUsers(data.items);
    } catch (err: any) {
      setError(err?.message ?? '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword) return;
    setCreating(true);
    try {
      await authApi.createUser(newUsername.trim(), newPassword, newRole);
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      await loadUsers();
    } catch (err: any) {
      setError(err?.message ?? '创建用户失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await authApi.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message ?? '删除失败');
    }
  };

  if (!isAdmin) return null;

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    const icons: Record<string, React.ReactNode> = {
      admin: <Shield className="h-3 w-3" />,
      user: <User className="h-3 w-3" />,
      viewer: <Eye className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? ''}`}>
        {icons[role]}
        {role}
      </span>
    );
  };

  return (
    <SettingsSectionCard
      title="用户管理"
      description="管理系统用户账号与角色权限。"
    >
      {error && (
        <div className="mb-3">
          <SettingsAlert title="操作失败" message={error} variant="error" />
        </div>
      )}

      {/* User list */}
      <div className="mb-4 divide-y settings-border rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-text" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-text">暂无用户</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{u.username}</span>
                {roleBadge(u.role)}
                {!u.is_active && (
                  <span className="text-xs text-muted-text">已禁用</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-text hidden sm:inline">{u.email || '—'}</span>
                {u.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(u)}
                    className="rounded-lg p-1.5 text-muted-text hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                    title="删除用户"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create new user */}
      {showCreate ? (
        <div className="space-y-3 rounded-xl border settings-border bg-background/40 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="用户名"
              placeholder="请输入用户名"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <Input
              label="密码"
              type="password"
              placeholder="至少 6 位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-text">角色：</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="rounded-lg border settings-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="user">user — 完整功能</option>
              <option value="viewer">viewer — 只读</option>
              <option value="admin">admin — 管理员</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCreate} disabled={creating || !newUsername.trim() || !newPassword}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              创建
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新建用户
        </Button>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除用户"
        message={`确定要删除用户「${deleteTarget?.username}」吗？此操作不可撤销。`}
        confirmText="删除"
        isDanger={true}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </SettingsSectionCard>
  );
};
