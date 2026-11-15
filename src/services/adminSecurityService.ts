import axios from 'axios';
import { adminClient } from '../api/adminClient';
import { DEFAULT_ROLE_DEFINITIONS } from '../utils/permissions';
import type {
  AdminAccountStatus,
  AdminAccountSummary,
  AdminPermissionKey,
  AuditLogEntry,
  AuditLogSeverity,
  ChangePasswordRequest,
  CounselRole,
  CreateAdminAccountRequest,
  LoginHistoryEntry,
  LoginHistoryStatus,
  RoleDefinition,
} from '../types';

const AUDIT_BUFFER_KEY = 'pactkeeper_admin_audit_buffer_v1';
const LOGIN_BUFFER_KEY = 'pactkeeper_admin_login_buffer_v1';
const MAX_LOCAL_BUFFER_ITEMS = 250;

export interface ApiCollectionResult<T> {
  items: T[];
  backendConnected: boolean;
  statusCode?: number;
  notice?: string;
}

export interface RecordAuditInput {
  action: string;
  category: AuditLogEntry['category'];
  severity: AuditLogSeverity;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  rationale?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  status?: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  actorUsername?: string;
  actorRole?: CounselRole | string;
}

export interface RecordLoginInput {
  username: string;
  attemptedRole?: string;
  resolvedRole?: string;
  status: LoginHistoryStatus;
  reason?: string;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalBuffer<T>(storageKey: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalBuffer<T>(storageKey: string, items: T[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items.slice(0, MAX_LOCAL_BUFFER_ITEMS)));
  } catch {
    // Ignore storage quota restrictions without interrupting primary operations.
  }
}

export function getCurrentActor(): {
  actorUsername: string;
  actorRole: CounselRole | string;
} {
  return {
    actorUsername: sessionStorage.getItem('adminName') || 'Unknown Counsel',
    actorRole: sessionStorage.getItem('adminRole') || 'Admin',
  };
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (axios.isAxiosError(err)) {
    return err.response?.status;
  }
  return undefined;
}

export function extractSecurityApiError(
  err: unknown,
  fallback: string,
  endpointLabel?: string
): string {
  const status = getApiErrorStatus(err);
  if (status === 404 || status === 405 || status === 501) {
    return endpointLabel
      ? `Backend endpoint (${endpointLabel}) returned HTTP ${status} — feature is not yet exposed by the .NET 9 server.`
      : `Backend endpoint returned HTTP ${status} — not available on this server yet.`;
  }
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string; title?: string } | undefined;
    return data?.message || data?.error || data?.title || err.message || fallback;
  }
  return fallback;
}

/**
 * Records a sensitive operator action to the local browser audit buffer and dispatches best-effort telemetry to /admin/audit-logs.
 */
export async function recordAuditEvent(input: RecordAuditInput): Promise<AuditLogEntry> {
  const current = getCurrentActor();
  const entry: AuditLogEntry = {
    id: createId('aud'),
    timestamp: new Date().toISOString(),
    actorUsername: input.actorUsername || current.actorUsername,
    actorRole: input.actorRole || current.actorRole,
    action: input.action,
    category: input.category,
    severity: input.severity,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    rationale: input.rationale,
    beforeState: input.beforeState,
    afterState: input.afterState,
    status: input.status ?? 'SUCCESS',
    errorMessage: input.errorMessage,
    source: 'LOCAL_SESSION_BUFFER',
  };

  const existing = readLocalBuffer<AuditLogEntry>(AUDIT_BUFFER_KEY);
  writeLocalBuffer(AUDIT_BUFFER_KEY, [entry, ...existing]);

  try {
    await adminClient.post('/admin/audit-logs', entry);
  } catch {
    // Keep client audit buffer resilient when backend /admin/audit-logs is unavailable.
  }

  return entry;
}

/**
 * Records an authentication lifecycle event into the browser login telemetry buffer.
 */
export function recordLoginAttempt(input: RecordLoginInput): LoginHistoryEntry {
  const entry: LoginHistoryEntry = {
    id: createId('lgn'),
    timestamp: new Date().toISOString(),
    username: input.username,
    attemptedRole: input.attemptedRole,
    resolvedRole: input.resolvedRole,
    status: input.status,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    reason: input.reason,
    source: 'LOCAL_SESSION_BUFFER',
  };

  const existing = readLocalBuffer<LoginHistoryEntry>(LOGIN_BUFFER_KEY);
  writeLocalBuffer(LOGIN_BUFFER_KEY, [entry, ...existing]);
  return entry;
}

export function clearLocalSecurityBuffers(): void {
  localStorage.removeItem(AUDIT_BUFFER_KEY);
  localStorage.removeItem(LOGIN_BUFFER_KEY);
}

/**
 * Notifies backend /Auth/logout (best-effort) and appends a LOGOUT event to browser login history.
 */
export async function logoutAdminSession(
  actorUsername: string,
  actorRole: CounselRole | string
): Promise<void> {
  recordLoginAttempt({
    username: actorUsername,
    resolvedRole: String(actorRole),
    status: 'LOGOUT',
    reason: 'Manual operator sign-out',
  });

  await recordAuditEvent({
    action: 'ADMIN_LOGOUT',
    category: 'AUTH',
    severity: 'LOW',
    targetType: 'Session',
    targetLabel: actorUsername,
    actorUsername,
    actorRole,
  });

  try {
    await adminClient.post('/Auth/logout');
  } catch {
    // Backend logout revocation endpoint is optional; client session cleanup still proceeds.
  }
}

export async function changeOwnPassword(
  payload: ChangePasswordRequest
): Promise<{ message: string }> {
  const actor = getCurrentActor();
  try {
    const res = await adminClient.post('/Auth/change-password', payload);
    await recordAuditEvent({
      action: 'PASSWORD_CHANGED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetLabel: actor.actorUsername,
      rationale: 'Self-service password rotation via High Counsel portal',
      status: 'SUCCESS',
    });
    return {
      message: res.data?.message || 'Password updated successfully.',
    };
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to change password.',
      'POST /api/Auth/change-password'
    );
    await recordAuditEvent({
      action: 'PASSWORD_CHANGE_ATTEMPT',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetLabel: actor.actorUsername,
      status: 'FAILED',
      errorMessage: reason,
    });
    throw new Error(reason);
  }
}

export async function fetchAdminAccounts(): Promise<ApiCollectionResult<AdminAccountSummary>> {
  try {
    const res = await adminClient.get('/admin/accounts');
    const rawList = Array.isArray(res.data) ? res.data : [];
    const items: AdminAccountSummary[] = rawList.map((raw: Record<string, unknown>) => ({
      id: String(raw.id || raw.accountId || raw.username || ''),
      username: String(raw.username || ''),
      email: typeof raw.email === 'string' ? raw.email : undefined,
      role: String(raw.role || 'Admin'),
      status: (String(raw.status || (raw.isLocked ? 'LOCKED' : 'ACTIVE')).toUpperCase() as AdminAccountStatus),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      lastLoginAt: typeof raw.lastLoginAt === 'string' ? raw.lastLoginAt : undefined,
      lastLoginIp: typeof raw.lastLoginIp === 'string' ? raw.lastLoginIp : undefined,
      customPermissions: Array.isArray(raw.permissions)
        ? (raw.permissions as AdminPermissionKey[])
        : undefined,
      source: 'BACKEND_API',
    }));
    return { items, backendConnected: true, statusCode: res.status };
  } catch (err) {
    const status = getApiErrorStatus(err);
    return {
      items: [],
      backendConnected: false,
      statusCode: status,
      notice: extractSecurityApiError(
        err,
        'Unable to load staff accounts.',
        'GET /api/admin/accounts'
      ),
    };
  }
}

export async function createAdminAccount(
  payload: CreateAdminAccountRequest,
  rationale: string
): Promise<void> {
  try {
    await adminClient.post('/admin/accounts', { ...payload, rationale });
    await recordAuditEvent({
      action: 'ADMIN_ACCOUNT_CREATED',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'AdminAccount',
      targetLabel: payload.username,
      rationale,
      afterState: { username: payload.username, role: payload.role, email: payload.email },
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to create admin account.',
      'POST /api/admin/accounts'
    );
    await recordAuditEvent({
      action: 'ADMIN_ACCOUNT_CREATE_FAILED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetLabel: payload.username,
      rationale,
      status: 'FAILED',
      errorMessage: reason,
    });
    throw new Error(reason);
  }
}

export async function updateAdminAccountRole(
  account: AdminAccountSummary,
  nextRole: string,
  rationale: string
): Promise<void> {
  try {
    await adminClient.put(`/admin/accounts/${encodeURIComponent(account.id)}/role`, {
      role: nextRole,
      rationale,
    });
    await recordAuditEvent({
      action: 'ADMIN_ROLE_ASSIGNED',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      beforeState: { role: account.role },
      afterState: { role: nextRole },
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to update admin role.',
      `PUT /api/admin/accounts/${account.id}/role`
    );
    await recordAuditEvent({
      action: 'ADMIN_ROLE_ASSIGN_FAILED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      status: 'FAILED',
      errorMessage: reason,
    });
    throw new Error(reason);
  }
}

export async function toggleAdminAccountLock(
  account: AdminAccountSummary,
  nextStatus: AdminAccountStatus,
  rationale: string
): Promise<void> {
  try {
    await adminClient.patch(`/admin/accounts/${encodeURIComponent(account.id)}/status`, {
      status: nextStatus,
      rationale,
    });
    await recordAuditEvent({
      action: nextStatus === 'LOCKED' ? 'ADMIN_ACCOUNT_LOCKED' : 'ADMIN_ACCOUNT_UNLOCKED',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      beforeState: { status: account.status },
      afterState: { status: nextStatus },
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to update account status.',
      `PATCH /api/admin/accounts/${account.id}/status`
    );
    await recordAuditEvent({
      action: 'ADMIN_ACCOUNT_STATUS_FAILED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      status: 'FAILED',
      errorMessage: reason,
    });
    throw new Error(reason);
  }
}

export async function resetAdminAccountPassword(
  account: AdminAccountSummary,
  newPassword: string,
  rationale: string
): Promise<void> {
  try {
    await adminClient.post(
      `/admin/accounts/${encodeURIComponent(account.id)}/reset-password`,
      { newPassword, rationale }
    );
    await recordAuditEvent({
      action: 'ADMIN_PASSWORD_RESET',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to reset staff password.',
      `POST /api/admin/accounts/${account.id}/reset-password`
    );
    throw new Error(reason);
  }
}

export async function revokeAdminAccountSessions(
  account: AdminAccountSummary,
  rationale: string
): Promise<void> {
  try {
    await adminClient.post(
      `/admin/accounts/${encodeURIComponent(account.id)}/revoke-sessions`,
      { rationale }
    );
    await recordAuditEvent({
      action: 'ADMIN_SESSIONS_REVOKED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'AdminAccount',
      targetId: account.id,
      targetLabel: account.username,
      rationale,
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to revoke active sessions.',
      `POST /api/admin/accounts/${account.id}/revoke-sessions`
    );
    throw new Error(reason);
  }
}

export async function fetchRoleDefinitions(): Promise<ApiCollectionResult<RoleDefinition>> {
  try {
    const res = await adminClient.get('/admin/roles');
    const rawList = Array.isArray(res.data) ? res.data : [];
    const items: RoleDefinition[] = rawList.map((raw: Record<string, unknown>) => ({
      id: String(raw.id || raw.name || ''),
      name: String(raw.name || ''),
      description: String(raw.description || ''),
      permissions: Array.isArray(raw.permissions)
        ? (raw.permissions as AdminPermissionKey[])
        : [],
      isSystemDefault: Boolean(raw.isSystemDefault),
      accountCount: typeof raw.accountCount === 'number' ? raw.accountCount : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      source: 'BACKEND_API',
    }));
    return {
      items: items.length > 0 ? items : DEFAULT_ROLE_DEFINITIONS,
      backendConnected: true,
      statusCode: res.status,
    };
  } catch (err) {
    const status = getApiErrorStatus(err);
    return {
      items: DEFAULT_ROLE_DEFINITIONS,
      backendConnected: false,
      statusCode: status,
      notice: extractSecurityApiError(
        err,
        'Using built-in portal RBAC matrix.',
        'GET /api/admin/roles'
      ),
    };
  }
}

export async function saveRolePermissions(
  role: RoleDefinition,
  permissions: AdminPermissionKey[],
  rationale: string
): Promise<void> {
  try {
    await adminClient.put(`/admin/roles/${encodeURIComponent(role.id)}/permissions`, {
      permissions,
      rationale,
    });
    await recordAuditEvent({
      action: 'ROLE_PERMISSIONS_UPDATED',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'Role',
      targetId: role.id,
      targetLabel: role.name,
      rationale,
      beforeState: { permissions: role.permissions },
      afterState: { permissions },
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to save role permissions.',
      `PUT /api/admin/roles/${role.id}/permissions`
    );
    await recordAuditEvent({
      action: 'ROLE_PERMISSIONS_UPDATE_FAILED',
      category: 'SECURITY',
      severity: 'HIGH',
      targetType: 'Role',
      targetId: role.id,
      targetLabel: role.name,
      rationale,
      status: 'FAILED',
      errorMessage: reason,
    });
    throw new Error(reason);
  }
}

export async function createRoleDefinition(
  payload: { name: string; description: string; permissions: AdminPermissionKey[] },
  rationale: string
): Promise<void> {
  try {
    await adminClient.post('/admin/roles', { ...payload, rationale });
    await recordAuditEvent({
      action: 'ROLE_CREATED',
      category: 'SECURITY',
      severity: 'CRITICAL',
      targetType: 'Role',
      targetLabel: payload.name,
      rationale,
      afterState: { name: payload.name, permissionCount: payload.permissions.length },
      status: 'SUCCESS',
    });
  } catch (err) {
    const reason = extractSecurityApiError(
      err,
      'Failed to create role.',
      'POST /api/admin/roles'
    );
    throw new Error(reason);
  }
}

export async function fetchAuditLogs(): Promise<ApiCollectionResult<AuditLogEntry>> {
  const localItems = readLocalBuffer<AuditLogEntry>(AUDIT_BUFFER_KEY);

  try {
    const res = await adminClient.get('/admin/audit-logs');
    const rawList = Array.isArray(res.data) ? res.data : [];
    const serverItems: AuditLogEntry[] = rawList.map((raw: Record<string, unknown>) => ({
      id: String(raw.id || createId('srv-aud')),
      timestamp: String(raw.timestamp || raw.createdAt || ''),
      actorUsername: String(raw.actorUsername || raw.username || 'Unknown'),
      actorRole: String(raw.actorRole || raw.role || 'Admin'),
      action: String(raw.action || 'UNKNOWN_ACTION'),
      category: (String(raw.category || 'SECURITY').toUpperCase() as AuditLogEntry['category']),
      severity: (String(raw.severity || 'MEDIUM').toUpperCase() as AuditLogSeverity),
      targetType: typeof raw.targetType === 'string' ? raw.targetType : undefined,
      targetId: typeof raw.targetId === 'string' ? raw.targetId : undefined,
      targetLabel: typeof raw.targetLabel === 'string' ? raw.targetLabel : undefined,
      rationale: typeof raw.rationale === 'string' ? raw.rationale : undefined,
      beforeState:
        raw.beforeState && typeof raw.beforeState === 'object'
          ? (raw.beforeState as Record<string, unknown>)
          : undefined,
      afterState:
        raw.afterState && typeof raw.afterState === 'object'
          ? (raw.afterState as Record<string, unknown>)
          : undefined,
      status: String(raw.status || 'SUCCESS').toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
      errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined,
      source: 'BACKEND_API',
    }));

    const seen = new Set(serverItems.map((i) => i.id));
    const merged = [...serverItems, ...localItems.filter((i) => !seen.has(i.id))].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return { items: merged, backendConnected: true, statusCode: res.status };
  } catch (err) {
    return {
      items: localItems,
      backendConnected: false,
      statusCode: getApiErrorStatus(err),
      notice: extractSecurityApiError(
        err,
        'Showing local browser session audit buffer.',
        'GET /api/admin/audit-logs'
      ),
    };
  }
}

export async function fetchLoginHistory(): Promise<ApiCollectionResult<LoginHistoryEntry>> {
  const localItems = readLocalBuffer<LoginHistoryEntry>(LOGIN_BUFFER_KEY);

  try {
    const res = await adminClient.get('/admin/login-history');
    const rawList = Array.isArray(res.data) ? res.data : [];
    const serverItems: LoginHistoryEntry[] = rawList.map((raw: Record<string, unknown>) => ({
      id: String(raw.id || createId('srv-lgn')),
      timestamp: String(raw.timestamp || raw.createdAt || ''),
      username: String(raw.username || 'Unknown'),
      attemptedRole: typeof raw.attemptedRole === 'string' ? raw.attemptedRole : undefined,
      resolvedRole: typeof raw.resolvedRole === 'string' ? raw.resolvedRole : undefined,
      status: (String(raw.status || 'SUCCESS').toUpperCase() as LoginHistoryStatus),
      ipAddress: typeof raw.ipAddress === 'string' ? raw.ipAddress : undefined,
      userAgent: typeof raw.userAgent === 'string' ? raw.userAgent : undefined,
      reason: typeof raw.reason === 'string' ? raw.reason : undefined,
      source: 'BACKEND_API',
    }));

    const seen = new Set(serverItems.map((i) => i.id));
    const merged = [...serverItems, ...localItems.filter((i) => !seen.has(i.id))].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return { items: merged, backendConnected: true, statusCode: res.status };
  } catch (err) {
    return {
      items: localItems,
      backendConnected: false,
      statusCode: getApiErrorStatus(err),
      notice: extractSecurityApiError(
        err,
        'Showing local browser session login events.',
        'GET /api/admin/login-history'
      ),
    };
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildAuditLogsCsv(entries: AuditLogEntry[]): string {
  const headers = [
    'Id',
    'Timestamp',
    'Actor',
    'Role',
    'Category',
    'Severity',
    'Action',
    'Status',
    'TargetType',
    'TargetId',
    'TargetLabel',
    'Rationale',
    'Source',
  ];
  const rows = entries.map((e) =>
    [
      e.id,
      e.timestamp,
      e.actorUsername,
      e.actorRole,
      e.category,
      e.severity,
      e.action,
      e.status,
      e.targetType || '',
      e.targetId || '',
      e.targetLabel || '',
      e.rationale || '',
      e.source,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
}
