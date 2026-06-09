import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Trash2, Check } from 'lucide-react';
import { authApi } from '../api/auth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface RoleItem {
  id: number;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
}

interface PermItem {
  key: string;
  label: string;
}

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Edit (permission toggles only)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([authApi.listRoles(), authApi.getPermissions()]);
      setRoles(r.items);
      setPermissions(p.permissions);
    } catch (err: any) {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { document.title = '角色管理 - DSA'; }, []);

  const togglePerm = (permKey: string, permSet: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(permSet);
    if (next.has(permKey)) next.delete(permKey); else next.add(permKey);
    setter(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDisplayName.trim()) return;
    setCreating(true);
    try {
      await authApi.createRole(newName.trim(), newDisplayName.trim(), [...newPerms]);
      setShowCreate(false);
      setNewName(''); setNewDisplayName('');
      setNewPerms(new Set());
      setSuccess('角色创建成功');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '创建失败');
    } finally { setCreating(false); }
  };

  const handleSavePerms = async (roleId: number) => {
    try {
      await authApi.updateRole(roleId, { permissions: [...editPerms] });
      setEditingRoleId(null);
      setSuccess('权限已保存');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '保存失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await authApi.deleteRole(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(`角色「${deleteTarget.display_name}」已删除`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '删除失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-text" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">角色管理</h1>
          <p className="mt-1 text-sm text-muted-text">管理系统角色及其权限。系统内置角色不可删除。</p>
        </div>
        <Button type="button" onClick={() => { setShowCreate(v => !v); setError(null); }}>
          <Plus className="h-4 w-4 mr-1.5" />新建角色
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">{error} <button className="ml-2 underline" onClick={() => setError(null)}>关闭</button></div>}
      {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">{success} <button className="ml-2 underline" onClick={() => setSuccess(null)}>关闭</button></div>}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-2xl border border-[var(--nav-active-border)] bg-card/60 p-5 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">新建角色</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="角色标识 (英文)" placeholder="如: operator" value={newName} onChange={e => setNewName(e.target.value)} required />
              <Input label="显示名称" placeholder="如: 运营人员" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} required />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">权限选择</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                {permissions.map(p => (
                  <label key={p.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${newPerms.has(p.key) ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border/40 text-muted-text hover:border-border'}`}>
                    <input type="checkbox" checked={newPerms.has(p.key)} onChange={() => togglePerm(p.key, newPerms, setNewPerms)} className="rounded" />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}创建</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </form>
        </div>
      )}

      {/* Role cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {roles.map(role => {
          const isEditing = editingRoleId === role.id;
          const currentPerms = isEditing ? editPerms : new Set(role.permissions);
          return (
            <div key={role.id} className={`rounded-2xl border bg-card/60 p-5 backdrop-blur-sm transition-colors ${isEditing ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${role.name === 'admin' ? 'text-rose-500' : role.name === 'user' ? 'text-blue-500' : 'text-gray-400'}`} />
                    <h3 className="text-sm font-semibold text-foreground">{role.display_name}</h3>
                    <span className="text-xs text-muted-text">({role.name})</span>
                    {role.is_system && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">系统</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-text">{role.description || `${role.permissions.length} 项权限`}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <button onClick={() => handleSavePerms(role.id)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="保存">
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => { setEditingRoleId(role.id); setEditPerms(new Set(role.permissions)); }} className="rounded-lg px-2.5 py-1 text-xs font-medium text-secondary-text hover:bg-[var(--nav-hover-bg)] hover:text-foreground transition-colors">
                      编辑权限
                    </button>
                  )}
                  {!role.is_system && (
                    <button onClick={() => setDeleteTarget(role)} className="rounded-lg p-1.5 text-muted-text hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20" title="删除">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions grid */}
              <div className="flex flex-wrap gap-1">
                {permissions.map(p => {
                  const has = currentPerms.has(p.key);
                  return isEditing ? (
                    <button
                      key={p.key}
                      onClick={() => togglePerm(p.key, editPerms, (s) => setEditPerms(new Set(s)))}
                      className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${has ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted/30 text-muted-text border border-transparent hover:border-border'}`}
                    >
                      {p.label}
                    </button>
                  ) : (
                    <span key={p.key} className={`rounded-lg px-2 py-1 text-xs ${has ? 'bg-primary/5 text-primary' : 'bg-muted/10 text-muted-text/50'}`}>
                      {p.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="删除角色" message={`确定要删除角色「${deleteTarget?.display_name}」吗？`} confirmText="删除" cancelText="取消" isDanger onConfirm={() => void handleDelete()} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
};

export default RoleManagementPage;
