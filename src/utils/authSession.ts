import type { AdminPermissionKey, CounselRole } from '../types';

export interface DecodedJwtClaims {
  sub?: string;
  username?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  exp?: number;
  iat?: number;
}

const SESSION_KEYS = [
  'adminToken',
  'adminName',
  'adminRole',
  'adminPermissions',
  'adminLoginAt',
] as const;

const MS_ROLE_CLAIM =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const MS_NAME_CLAIM =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';

/**
 * Decodes the middle payload segment of a JWT on the client without asserting signature trust.
 */
export function parseJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64Url.length % 4)) % 4;
    const padded = base64Url + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Extracts normalized identity, role, permissions, and expiration claims from a JWT.
 */
export function extractClaimsFromToken(token: string | null): DecodedJwtClaims | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;

  const rawRole = payload.role ?? payload[MS_ROLE_CLAIM];
  const roleList: string[] = Array.isArray(rawRole)
    ? rawRole.map(String)
    : typeof rawRole === 'string'
    ? [rawRole]
    : [];

  const rawPerms = payload.permissions ?? payload.permission;
  const permissions: string[] = Array.isArray(rawPerms)
    ? rawPerms.map(String)
    : typeof rawPerms === 'string'
    ? rawPerms.split(/[\s,]+/).filter(Boolean)
    : [];

  const username =
    (typeof payload.unique_name === 'string' && payload.unique_name) ||
    (typeof payload.name === 'string' && payload.name) ||
    (typeof payload[MS_NAME_CLAIM] === 'string' && String(payload[MS_NAME_CLAIM])) ||
    (typeof payload.sub === 'string' && payload.sub) ||
    undefined;

  return {
    sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    username,
    role: roleList[0],
    roles: roleList.length > 0 ? roleList : undefined,
    permissions: permissions.length > 0 ? permissions : undefined,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
  };
}

export function getTokenExpiryMs(token: string | null): number | null {
  const claims = extractClaimsFromToken(token);
  if (!claims?.exp || !Number.isFinite(claims.exp)) return null;
  return claims.exp * 1000;
}

export function isTokenExpired(token: string | null, nowMs: number = Date.now()): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) return false;
  return nowMs >= expiryMs;
}

/**
 * Maps raw role strings from backend API or JWT claims to a valid CounselRole, returning null for Player/unknown.
 */
export function normalizeCounselRole(rawRole?: string | null): CounselRole | null {
  if (!rawRole) return null;
  const lower = rawRole.trim().toLowerCase();
  if (lower === 'admin') return 'Admin';
  if (lower === 'server') return 'Server';
  if (lower === 'moderator' || lower === 'mod') return 'Moderator';
  if (
    lower === 'technical support' ||
    lower === 'technicalsupport' ||
    lower === 'techsupport' ||
    lower === 'support' ||
    lower === 'cskh'
  ) {
    return 'Technical Support';
  }
  return null;
}

export function getStoredPermissions(): AdminPermissionKey[] {
  try {
    const raw = sessionStorage.getItem('adminPermissions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminPermissionKey[]) : [];
  } catch {
    return [];
  }
}

export function setStoredPermissions(permissions: AdminPermissionKey[]): void {
  if (permissions.length === 0) {
    sessionStorage.removeItem('adminPermissions');
    return;
  }
  sessionStorage.setItem('adminPermissions', JSON.stringify(permissions));
}

export function clearAdminSession(): void {
  for (const key of SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
}

export function formatRemainingDuration(remainingMs: number): string {
  if (remainingMs <= 0) return 'Expired';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${totalSeconds % 60}s`;
}
