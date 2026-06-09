import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';

/**
 * Hook: check if current user has a permission.
 * Usage:
 *   const { has } = usePermission();
 *   {has('users:write') && <DeleteButton />}
 */
export function usePermission() {
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    authApi.getMyPermissions().then(d => {
      setPerms(d.permissions ?? []);
    }).catch(() => setPerms([]));
  }, []);

  const has = (permission: string) => perms.includes(permission);
  const hasAny = (...permissions: string[]) => permissions.some(p => perms.includes(p));
  const hasAll = (...permissions: string[]) => permissions.every(p => perms.includes(p));

  return { has, hasAny, hasAll, permissions: perms };
}
