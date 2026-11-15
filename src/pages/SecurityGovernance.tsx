import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSearch,
  History,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import {
  buildAuditLogsCsv,
  clearLocalSecurityBuffers,
  createAdminAccount,
  createRoleDefinition,
  fetchAdminAccounts,
  fetchAuditLogs,
  fetchLoginHistory,
  fetchRoleDefinitions,
  resetAdminAccountPassword,
  revokeAdminAccountSessions,
  saveRolePermissions,
  toggleAdminAccountLock,
  updateAdminAccountRole,
} from '../services/adminSecurityService';
import { formatRemainingDuration, getTokenExpiryMs } from '../utils/authSession';
import { DEFAULT_ROLE_DEFINITIONS, PERMISSION_CATALOG } from '../utils/permissions';
import type {
  AdminAccountSummary,
  AdminPermissionKey,
  AuditLogEntry,
  AuditLogSeverity,
  CounselRole,
  DataSourceOrigin,
  LoginHistoryEntry,
  LoginHistoryStatus,
  RoleDefinition,
} from '../types';

interface SecurityGovernanceProps {
  currentUsername: string;
  currentRole: CounselRole;
}

type SecurityTab = 'accounts' | 'roles' | 'audit' | 'logins';

interface SecuritySnapshot {
  accounts: AdminAccountSummary[];
  accountsConnected: boolean;
  accountsNotice?: string;
  roles: RoleDefinition[];
  rolesConnected: boolean;
  rolesNotice?: string;
  auditLogs: AuditLogEntry[];
  auditConnected: boolean;
  auditNotice?: string;
  loginHistory: LoginHistoryEntry[];
  loginConnected: boolean;
  loginNotice?: string;
  fetchedAt: number;
}

interface PendingSensitiveGuard {
  title: string;
  description: string;
  severity: 'HIGH' | 'CRITICAL';
  actionLabel: string;
  targetSummary?: string;
  requireKeyword?: string;
  onExecute: (rationale: string) => Promise<void>;
}

async function loadSecuritySnapshot(): Promise<SecuritySnapshot> {
  const [accountsRes, rolesRes, auditRes, loginRes] = await Promise.all([
    fetchAdminAccounts(),
    fetchRoleDefinitions(),
    fetchAuditLogs(),
    fetchLoginHistory(),
  ]);

  return {
    accounts: accountsRes.items,
    accountsConnected: accountsRes.backendConnected,
    accountsNotice: accountsRes.notice,
    roles: rolesRes.items,
    rolesConnected: rolesRes.backendConnected,
    rolesNotice: rolesRes.notice,
    auditLogs: auditRes.items,
    auditConnected: auditRes.backendConnected,
    auditNotice: auditRes.notice,
    loginHistory: loginRes.items,
    loginConnected: loginRes.backendConnected,
    loginNotice: loginRes.notice,
    fetchedAt: Date.now(),
  };
}

function formatIsoTime(iso?: string): string {
  if (!iso) return 'Never';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function severityBadgeClass(severity: AuditLogSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    case 'HIGH':
      return 'bg-amber-500/15 text-amber-300 border-amber-400/35';
    case 'MEDIUM':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35';
    default:
      return 'bg-slate-700/40 text-slate-300 border-white/10';
  }
}

function sourceBadgeLabel(source?: DataSourceOrigin): { text: string; cls: string } {
  if (source === 'BACKEND_API') {
    return {
      text: 'SERVER API',
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  }
  if (source === 'SYSTEM_DEFAULT') {
    return {
      text: 'DEFAULT RBAC',
      cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    };
  }
  return {
    text: 'SESSION BUFFER',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  };
}

function loginStatusBadge(status: LoginHistoryStatus): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'FAILED':
    case 'DENIED_PLAYER':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'SESSION_EXPIRED':
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    case 'LOGOUT':
    default:
      return 'bg-slate-700/40 text-slate-300 border-white/15';
  }
}

export const SecurityGovernance: React.FC<SecurityGovernanceProps> = ({
  currentUsername,
  currentRole,
}) => {
  const [activeTab, setActiveTab] = useState<SecurityTab>('accounts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [accounts, setAccounts] = useState<AdminAccountSummary[]>([]);
  const [accountsConnected, setAccountsConnected] = useState(false);
  const [accountsNotice, setAccountsNotice] = useState<string | undefined>();

  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLE_DEFINITIONS);
  const [rolesConnected, setRolesConnected] = useState(false);
  const [rolesNotice, setRolesNotice] = useState<string | undefined>();

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditConnected, setAuditConnected] = useState(false);
  const [auditNotice, setAuditNotice] = useState<string | undefined>();

  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loginConnected, setLoginConnected] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | undefined>();

  const [snapshotTimeMs, setSnapshotTimeMs] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Accounts filters & modals
  const [accountSearch, setAccountSearch] = useState('');
  const [accountRoleFilter, setAccountRoleFilter] = useState('ALL');
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [newAccUsername, setNewAccUsername] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccRole, setNewAccRole] = useState('Moderator');
  const [newAccPassword, setNewAccPassword] = useState('');
  const [createAccRationale, setCreateAccRationale] = useState('');
  const [createAccError, setCreateAccError] = useState<string | null>(null);
  const [createAccSubmitting, setCreateAccSubmitting] = useState(false);

  const [roleEditAccount, setRoleEditAccount] = useState<AdminAccountSummary | null>(null);
  const [targetAccountRole, setTargetAccountRole] = useState('Moderator');
  const [resetPwdAccount, setResetPwdAccount] = useState<AdminAccountSummary | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdRationale, setResetPwdRationale] = useState('');
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);
  const [resetPwdSubmitting, setResetPwdSubmitting] = useState(false);

  // Roles matrix state
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-admin');
  const [draftPermissions, setDraftPermissions] = useState<AdminPermissionKey[]>(
    DEFAULT_ROLE_DEFINITIONS[0].permissions
  );
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleRationale, setNewRoleRationale] = useState('');
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);
  const [createRoleSubmitting, setCreateRoleSubmitting] = useState(false);

  // Audit Log filters & inspect modal
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | AuditLogSeverity>('ALL');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [inspectingAudit, setInspectingAudit] = useState<AuditLogEntry | null>(null);

  // Login History filters
  const [loginSearch, setLoginSearch] = useState('');
  const [loginStatusFilter, setLoginStatusFilter] = useState<'ALL' | LoginHistoryStatus>('ALL');

  // Shared sensitive action modal
  const [sensitiveGuard, setSensitiveGuard] = useState<PendingSensitiveGuard | null>(null);
  const [guardLoading, setGuardLoading] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);

  const applySnapshot = (snap: SecuritySnapshot) => {
    setAccounts(snap.accounts);
    setAccountsConnected(snap.accountsConnected);
    setAccountsNotice(snap.accountsNotice);

    setRoles(snap.roles);
    setRolesConnected(snap.rolesConnected);
    setRolesNotice(snap.rolesNotice);
    const activeRole = snap.roles.find((r) => r.id === selectedRoleId) || snap.roles[0];
    if (activeRole) {
      setSelectedRoleId(activeRole.id);
      setDraftPermissions(activeRole.permissions);
    }

    setAuditLogs(snap.auditLogs);
    setAuditConnected(snap.auditConnected);
    setAuditNotice(snap.auditNotice);

    setLoginHistory(snap.loginHistory);
    setLoginConnected(snap.loginConnected);
    setLoginNotice(snap.loginNotice);
    setSnapshotTimeMs(snap.fetchedAt);
  };

  useEffect(() => {
    let active = true;
    loadSecuritySnapshot()
      .then((snap) => {
        if (!active) return;
        setAccounts(snap.accounts);
        setAccountsConnected(snap.accountsConnected);
        setAccountsNotice(snap.accountsNotice);

        setRoles(snap.roles);
        setRolesConnected(snap.rolesConnected);
        setRolesNotice(snap.rolesNotice);
        if (snap.roles[0]) {
          setSelectedRoleId(snap.roles[0].id);
          setDraftPermissions(snap.roles[0].permissions);
        }

        setAuditLogs(snap.auditLogs);
        setAuditConnected(snap.auditConnected);
        setAuditNotice(snap.auditNotice);

        setLoginHistory(snap.loginHistory);
        setLoginConnected(snap.loginConnected);
        setLoginNotice(snap.loginNotice);
        setSnapshotTimeMs(snap.fetchedAt);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (text: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ text, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const snap = await loadSecuritySnapshot();
      applySnapshot(snap);
      showToast('Security telemetry refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const sessionExpiryText = useMemo(() => {
    const token = sessionStorage.getItem('adminToken');
    const expiryMs = getTokenExpiryMs(token);
    if (!expiryMs || snapshotTimeMs === 0) return 'Session token active (no exp claim)';
    return formatRemainingDuration(expiryMs - snapshotTimeMs);
  }, [snapshotTimeMs]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (accountRoleFilter !== 'ALL' && acc.role !== accountRoleFilter) return false;
      if (!q) return true;
      return (
        acc.username.toLowerCase().includes(q) ||
        (acc.email || '').toLowerCase().includes(q) ||
        acc.role.toLowerCase().includes(q)
      );
    });
  }, [accounts, accountSearch, accountRoleFilter]);

  const selectedRoleDef = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, typeof PERMISSION_CATALOG>();
    for (const item of PERMISSION_CATALOG) {
      const list = groups.get(item.group) ?? [];
      list.push(item);
      groups.set(item.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const hasUnsavedRoleChanges = useMemo(() => {
    if (!selectedRoleDef) return false;
    if (draftPermissions.length !== selectedRoleDef.permissions.length) return true;
    const baseline = new Set(selectedRoleDef.permissions);
    return draftPermissions.some((p) => !baseline.has(p));
  }, [selectedRoleDef, draftPermissions]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    const minMs = auditStartDate ? new Date(`${auditStartDate}T00:00:00`).getTime() : null;
    const maxMs = auditEndDate ? new Date(`${auditEndDate}T23:59:59.999`).getTime() : null;

    return auditLogs.filter((entry) => {
      if (auditSeverityFilter !== 'ALL' && entry.severity !== auditSeverityFilter) return false;
      if (auditCategoryFilter !== 'ALL' && entry.category !== auditCategoryFilter) return false;

      const ts = new Date(entry.timestamp).getTime();
      if (minMs !== null && !Number.isNaN(ts) && ts < minMs) return false;
      if (maxMs !== null && !Number.isNaN(ts) && ts > maxMs) return false;

      if (!q) return true;
      return (
        entry.actorUsername.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        (entry.targetLabel || '').toLowerCase().includes(q) ||
        (entry.targetId || '').toLowerCase().includes(q) ||
        (entry.rationale || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, auditSeverityFilter, auditCategoryFilter, auditStartDate, auditEndDate]);

  const filteredLoginHistory = useMemo(() => {
    const q = loginSearch.trim().toLowerCase();
    return loginHistory.filter((item) => {
      if (loginStatusFilter !== 'ALL' && item.status !== loginStatusFilter) return false;
      if (!q) return true;
      return (
        item.username.toLowerCase().includes(q) ||
        (item.resolvedRole || '').toLowerCase().includes(q) ||
        (item.attemptedRole || '').toLowerCase().includes(q) ||
        (item.ipAddress || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q)
      );
    });
  }, [loginHistory, loginSearch, loginStatusFilter]);

  const openGuard = (config: PendingSensitiveGuard) => {
    setGuardError(null);
    setSensitiveGuard(config);
  };

  const handleConfirmGuard = async (rationale: string) => {
    if (!sensitiveGuard) return;
    setGuardLoading(true);
    setGuardError(null);
    try {
      await sensitiveGuard.onExecute(rationale);
      setSensitiveGuard(null);
      const snap = await loadSecuritySnapshot();
      applySnapshot(snap);
    } catch (err) {
      setGuardError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setGuardLoading(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAccError(null);
    if (!newAccUsername.trim() || newAccPassword.length < 8 || createAccRationale.trim().length < 5) {
      setCreateAccError(
        'Username, initial passcode (>= 8 chars), and audit rationale (>= 5 chars) are required.'
      );
      return;
    }
    setCreateAccSubmitting(true);
    try {
      await createAdminAccount(
        {
          username: newAccUsername.trim(),
          email: newAccEmail.trim() || undefined,
          role: newAccRole,
          password: newAccPassword,
        },
        createAccRationale.trim()
      );
      setIsCreateAccountOpen(false);
      setNewAccUsername('');
      setNewAccEmail('');
      setNewAccPassword('');
      setCreateAccRationale('');
      showToast(`Created High Counsel account "${newAccUsername.trim()}".`);
      await handleRefresh();
    } catch (err) {
      setCreateAccError(err instanceof Error ? err.message : 'Failed to create account.');
      const snap = await loadSecuritySnapshot();
      applySnapshot(snap);
    } finally {
      setCreateAccSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdAccount) return;
    setResetPwdError(null);
    if (resetPwdValue.length < 8 || resetPwdRationale.trim().length < 5) {
      setResetPwdError('Temporary passcode (>= 8 chars) and rationale (>= 5 chars) are required.');
      return;
    }
    setResetPwdSubmitting(true);
    try {
      await resetAdminAccountPassword(resetPwdAccount, resetPwdValue, resetPwdRationale.trim());
      showToast(`Password reset completed for "${resetPwdAccount.username}".`);
      setResetPwdAccount(null);
      setResetPwdValue('');
      setResetPwdRationale('');
      await handleRefresh();
    } catch (err) {
      setResetPwdError(err instanceof Error ? err.message : 'Failed to reset passcode.');
    } finally {
      setResetPwdSubmitting(false);
    }
  };

  const handleSelectRoleForMatrix = (role: RoleDefinition) => {
    setSelectedRoleId(role.id);
    setDraftPermissions([...role.permissions]);
  };

  const toggleDraftPermission = (permKey: AdminPermissionKey) => {
    setDraftPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    );
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleError(null);
    if (!newRoleName.trim() || newRoleRationale.trim().length < 5) {
      setCreateRoleError('Role name and audit rationale (>= 5 chars) are required.');
      return;
    }
    setCreateRoleSubmitting(true);
    try {
      await createRoleDefinition(
        {
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || `Custom role created by ${currentUsername}`,
          permissions: ['dashboard.view'],
        },
        newRoleRationale.trim()
      );
      setIsCreateRoleOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRoleRationale('');
      showToast(`Created role "${newRoleName.trim()}".`);
      await handleRefresh();
    } catch (err) {
      setCreateRoleError(err instanceof Error ? err.message : 'Failed to create role.');
    } finally {
      setCreateRoleSubmitting(false);
    }
  };

  const handleExportAuditCsv = () => {
    if (filteredAuditLogs.length === 0) {
      showToast('No matching audit entries to export.', 'error');
      return;
    }
    const csv = buildAuditLogsCsv(filteredAuditLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pactkeeper-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredAuditLogs.length} audit log records to CSV.`);
  };

  const handleClearSessionBuffers = () => {
    openGuard({
      title: 'Clear Local Session Telemetry Buffers',
      description:
        'Clears only the local browser audit/login history buffer stored in localStorage. Backend server records remain untouched.',
      severity: 'HIGH',
      actionLabel: 'Clear Browser Buffer',
      targetSummary: 'Local Browser Security Buffers',
      onExecute: async () => {
        clearLocalSecurityBuffers();
        showToast('Cleared local browser security buffers.');
      },
    });
  };

  const criticalAuditCount = useMemo(
    () => auditLogs.filter((a) => a.severity === 'CRITICAL').length,
    [auditLogs]
  );

  const failedLoginCount = useMemo(
    () => loginHistory.filter((l) => l.status === 'FAILED' || l.status === 'DENIED_PLAYER').length,
    [loginHistory]
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
            toast.tone === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
              : 'bg-slate-900/95 border-amber-400/40 text-amber-100'
          }`}
        >
          {toast.tone === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-100"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="hy-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-300/90">
              High Counsel Security &amp; Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold font-cinzel hy-gold-text mt-1">
            ADMIN ACCOUNTS, ROLES &amp; AUDIT CENTER
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage counsel operator access, inspect RBAC permission matrices, track authentication history, and audit sensitive actions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="hy-btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 self-start lg:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Refresh Security Telemetry'}</span>
        </button>
      </div>

      {/* Security Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="hy-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-semibold">Active Operator</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 mt-1 font-mono truncate">
            {currentUsername}
          </div>
          <div className="text-[11px] text-amber-300 mt-0.5">
            {currentRole} · TTL: {sessionExpiryText}
          </div>
        </div>

        <div className="hy-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-semibold">Counsel Directory</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-200 mt-1 font-mono">
            {accountsConnected ? `${accounts.length} Accounts` : 'API Not Connected'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {roles.length} configured role definitions
          </div>
        </div>

        <div className="hy-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-semibold">Sensitive Audit Trail</span>
            <FileSearch className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-200 mt-1 font-mono">
            {auditLogs.length} Events
          </div>
          <div className="text-[11px] text-rose-300 mt-0.5">
            {criticalAuditCount} CRITICAL sensitivity actions logged
          </div>
        </div>

        <div className="hy-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-semibold">Authentication Monitor</span>
            <History className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-200 mt-1 font-mono">
            {loginHistory.length} Auth Events
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {failedLoginCount} failed / denied attempts recorded
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'accounts', label: 'Admin Accounts', icon: Users },
            { id: 'roles', label: 'Roles & RBAC Matrix', icon: Shield },
            { id: 'audit', label: `Audit Log (${auditLogs.length})`, icon: FileSearch },
            { id: 'logins', label: `Login History (${loginHistory.length})`, icon: History },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'hy-tab-active'
                  : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ADMIN ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="hy-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100">High Counsel Staff Accounts</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Create, suspend, rotate passwords, and assign authority roles for administrative accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateAccError(null);
                setIsCreateAccountOpen(true);
              }}
              className="hy-btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto text-slate-950"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Counsel Account</span>
            </button>
          </div>

          {!accountsConnected && accountsNotice && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Backend Admin Account API Status</div>
                <div className="text-amber-200/85 mt-0.5">{accountsNotice}</div>
              </div>
            </div>
          )}

          {/* Verified Current Operator Session Card */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300 font-bold font-cinzel">
                {currentUsername.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-slate-100">
                  {currentUsername}{' '}
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                    CURRENT SESSION
                  </span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Active Role: <strong className="text-amber-300">{currentRole}</strong> · Token TTL:{' '}
                  <span className="font-mono text-slate-200">{sessionExpiryText}</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-300">Authenticated via /Auth/login</span>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search by username, email, or role..."
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <select
              value={accountRoleFilter}
              onChange={(e) => setAccountRoleFilter(e.target.value)}
              aria-label="Filter accounts by role"
              className="bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="ALL" className="bg-slate-900">
                All Roles
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.name} className="bg-slate-900">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login / IP</th>
                  <th className="py-3 px-4 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      {accountsConnected
                        ? 'No staff accounts match your search filter.'
                        : 'No remote staff directory loaded. Connect GET /api/admin/accounts on .NET 9 to list and manage all counsel accounts.'}
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isSelf = acc.username.toLowerCase() === currentUsername.toLowerCase();
                    const isLocked = acc.status === 'LOCKED' || acc.status === 'DISABLED';
                    return (
                      <tr key={acc.id} className="hover:bg-white/[0.03]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100 font-mono">
                            {acc.username}
                            {isSelf && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
                                YOU
                              </span>
                            )}
                          </div>
                          {acc.email && <div className="text-[11px] text-slate-400">{acc.email}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {acc.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              acc.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <div>{formatIsoTime(acc.lastLoginAt)}</div>
                          {acc.lastLoginIp && (
                            <div className="text-[11px] font-mono text-slate-500">{acc.lastLoginIp}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setRoleEditAccount(acc);
                                setTargetAccountRole(acc.role);
                              }}
                              className="hy-btn-glass px-2.5 py-1 rounded-lg text-[11px]"
                            >
                              Role
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetPwdAccount(acc);
                                setResetPwdValue('');
                                setResetPwdRationale('');
                                setResetPwdError(null);
                              }}
                              className="hy-btn-glass px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1"
                            >
                              <KeyRound className="w-3 h-3 text-amber-300" />
                              Reset
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() =>
                                openGuard({
                                  title: isLocked ? 'Unlock Counsel Account' : 'Lock Counsel Account',
                                  description: isLocked
                                    ? `Restore portal login access for ${acc.username}.`
                                    : `Immediately suspend portal login access for ${acc.username}.`,
                                  severity: 'CRITICAL',
                                  actionLabel: isLocked ? 'Unlock Account' : 'Lock Account',
                                  targetSummary: `${acc.username} (${acc.role})`,
                                  requireKeyword: isLocked ? undefined : 'CONFIRM',
                                  onExecute: async (rationale) => {
                                    await toggleAdminAccountLock(
                                      acc,
                                      isLocked ? 'ACTIVE' : 'LOCKED',
                                      rationale
                                    );
                                    showToast(
                                      `${acc.username} is now ${isLocked ? 'ACTIVE' : 'LOCKED'}.`
                                    );
                                  },
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] border inline-flex items-center gap-1 disabled:opacity-40 ${
                                isLocked
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {isLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {isLocked ? 'Unlock' : 'Lock'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openGuard({
                                  title: 'Revoke Active Sessions',
                                  description: `Invalidate active JWT/refresh tokens for ${acc.username}.`,
                                  severity: 'HIGH',
                                  actionLabel: 'Revoke Sessions',
                                  targetSummary: acc.username,
                                  onExecute: async (rationale) => {
                                    await revokeAdminAccountSessions(acc, rationale);
                                    showToast(`Sessions revoked for ${acc.username}.`);
                                  },
                                })
                              }
                              className="hy-btn-glass px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1"
                              title="Revoke active sessions"
                            >
                              <LogOut className="w-3 h-3 text-rose-300" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & RBAC MATRIX */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {!rolesConnected && rolesNotice && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Built-in RBAC Matrix Fallback</div>
                <div className="text-amber-200/85 mt-0.5">
                  {rolesNotice} Currently displaying the portal&apos;s verified default RBAC rules for inspection. Saving edits requires backend <code className="font-mono text-amber-300">PUT /api/admin/roles/&#123;id&#125;/permissions</code>.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Role Selector Column */}
            <div className="lg:col-span-4 hy-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-100">Defined Roles</h2>
                <button
                  type="button"
                  onClick={() => {
                    setCreateRoleError(null);
                    setIsCreateRoleOpen(true);
                  }}
                  className="hy-btn-glass px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                  New Role
                </button>
              </div>

              <div className="space-y-2.5">
                {roles.map((roleItem) => {
                  const isSelected = selectedRoleDef?.id === roleItem.id;
                  const srcBadge = sourceBadgeLabel(roleItem.source);
                  return (
                    <button
                      key={roleItem.id}
                      type="button"
                      onClick={() => handleSelectRoleForMatrix(roleItem)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400/50 shadow'
                          : 'bg-slate-950/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-100">{roleItem.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${srcBadge.cls}`}
                        >
                          {srcBadge.text}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        {roleItem.description}
                      </p>
                      <div className="text-[11px] font-mono text-amber-300 mt-2">
                        {roleItem.permissions.length} / {PERMISSION_CATALOG.length} permissions enabled
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission Matrix Column */}
            <div className="lg:col-span-8 hy-card p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    Permission Matrix —{' '}
                    <span className="text-amber-300">{selectedRoleDef?.name}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure granular access capabilities per operational domain.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasUnsavedRoleChanges && selectedRoleDef && (
                    <button
                      type="button"
                      onClick={() => setDraftPermissions([...selectedRoleDef.permissions])}
                      className="hy-btn-glass px-3 py-1.5 rounded-lg text-xs"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!selectedRoleDef || !hasUnsavedRoleChanges}
                    onClick={() => {
                      if (!selectedRoleDef) return;
                      openGuard({
                        title: `Update Permissions for "${selectedRoleDef.name}"`,
                        description: `Modifies RBAC permissions (${draftPermissions.length} selected). Changes affect all accounts assigned to this role.`,
                        severity: 'CRITICAL',
                        actionLabel: 'Save Role Matrix',
                        targetSummary: `${selectedRoleDef.name} (${draftPermissions.length} permissions)`,
                        requireKeyword: 'CONFIRM',
                        onExecute: async (rationale) => {
                          await saveRolePermissions(selectedRoleDef, draftPermissions, rationale);
                          showToast(`Saved permissions for role "${selectedRoleDef.name}".`);
                        },
                      });
                    }}
                    className="hy-btn-gold px-4 py-2 rounded-xl text-xs font-bold text-slate-950 disabled:opacity-40"
                  >
                    Save Matrix Changes
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {permissionGroups.map(([groupName, descriptors]) => (
                  <div
                    key={groupName}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-2.5"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-cinzel">
                      {groupName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {descriptors.map((perm) => {
                        const checked = draftPermissions.includes(perm.key);
                        const protectAdminCore =
                          selectedRoleDef?.name === 'Admin' && perm.key.startsWith('security.');
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              checked
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                            } ${protectAdminCore ? 'opacity-85' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={protectAdminCore}
                              onChange={() => toggleDraftPermission(perm.key)}
                              className="mt-0.5 accent-amber-400"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-100">{perm.label}</span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${severityBadgeClass(
                                    perm.risk
                                  )}`}
                                >
                                  {perm.risk}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{perm.description}</p>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                {perm.key}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOG & SENSITIVE ACTIONS */}
      {activeTab === 'audit' && (
        <div className="hy-card p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                System Audit Log &amp; Sensitive Actions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tracks privileged actions, operator rationale, target IDs, and state diffs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAuditCsv}
                disabled={filteredAuditLogs.length === 0}
                className="hy-btn-glass px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                Export CSV ({filteredAuditLogs.length})
              </button>
              <button
                type="button"
                onClick={handleClearSessionBuffers}
                className="hy-btn-glass px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Browser Buffer
              </button>
            </div>
          </div>

          {!auditConnected && auditNotice && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Audit Backend Sync Notice</div>
                <div className="text-amber-200/85 mt-0.5">
                  {auditNotice} Sensitive actions performed in this browser remain captured with the{' '}
                  <code className="font-mono text-amber-300">SESSION BUFFER</code> tag until backend persistence is enabled.
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search actor, action, target ID, or rationale..."
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 outline-none focus:border-amber-400/50"
              />
            </div>

            <select
              value={auditSeverityFilter}
              onChange={(e) => setAuditSeverityFilter(e.target.value as 'ALL' | AuditLogSeverity)}
              aria-label="Filter audit logs by severity"
              className="bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="ALL" className="bg-slate-900">
                All Severities
              </option>
              <option value="CRITICAL" className="bg-slate-900">
                CRITICAL
              </option>
              <option value="HIGH" className="bg-slate-900">
                HIGH
              </option>
              <option value="MEDIUM" className="bg-slate-900">
                MEDIUM
              </option>
              <option value="LOW" className="bg-slate-900">
                LOW
              </option>
            </select>

            <select
              value={auditCategoryFilter}
              onChange={(e) => setAuditCategoryFilter(e.target.value)}
              aria-label="Filter audit logs by category"
              className="bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="ALL" className="bg-slate-900">
                All Categories
              </option>
              {['AUTH', 'SERVER', 'PLAYER', 'TREASURY', 'GACHA', 'CONTENT', 'PAYMENT', 'SECURITY'].map(
                (cat) => (
                  <option key={cat} value={cat} className="bg-slate-900">
                    {cat}
                  </option>
                )
              )}
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                aria-label="Audit start date"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2.5 py-2 text-[11px] text-slate-200 outline-none"
              />
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                aria-label="Audit end date"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2.5 py-2 text-[11px] text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action &amp; Severity</th>
                  <th className="py-3 px-4">Target &amp; Rationale</th>
                  <th className="py-3 px-4">Source / Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No sensitive actions match the selected filters yet.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((entry) => {
                    const src = sourceBadgeLabel(entry.source);
                    return (
                      <tr key={entry.id} className="hover:bg-white/[0.03]">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {formatIsoTime(entry.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-100">
                            {entry.actorUsername}
                          </div>
                          <div className="text-[11px] text-amber-300/90">{entry.actorRole}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-100">
                            {entry.action}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${severityBadgeClass(
                                entry.severity
                              )}`}
                            >
                              {entry.severity}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {entry.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-slate-200 font-medium truncate">
                            {entry.targetLabel || entry.targetId || 'Realm System'}
                          </div>
                          {entry.rationale && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {entry.rationale}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${src.cls}`}
                            >
                              {src.text}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                entry.status === 'SUCCESS' ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectingAudit(entry)}
                            className="hy-btn-glass px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-300" />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LOGIN HISTORY */}
      {activeTab === 'logins' && (
        <div className="hy-card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Admin Login History &amp; Session Events
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor successful logins, failed passcodes, denied player attempts, logouts, and session expirations.
            </p>
          </div>

          {!loginConnected && loginNotice && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Login History Telemetry Notice</div>
                <div className="text-amber-200/85 mt-0.5">
                  {loginNotice} Currently showing authentication events captured on this browser client (IP addresses require backend telemetry).
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                placeholder="Search by username, role, IP, or reason..."
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 outline-none focus:border-amber-400/50"
              />
            </div>

            <select
              value={loginStatusFilter}
              onChange={(e) =>
                setLoginStatusFilter(e.target.value as 'ALL' | LoginHistoryStatus)
              }
              aria-label="Filter login history by status"
              className="bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="ALL" className="bg-slate-900">
                All Auth Statuses
              </option>
              <option value="SUCCESS" className="bg-slate-900">
                SUCCESS
              </option>
              <option value="FAILED" className="bg-slate-900">
                FAILED
              </option>
              <option value="DENIED_PLAYER" className="bg-slate-900">
                DENIED_PLAYER
              </option>
              <option value="LOGOUT" className="bg-slate-900">
                LOGOUT
              </option>
              <option value="SESSION_EXPIRED" className="bg-slate-900">
                SESSION_EXPIRED
              </option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role / Attempt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Client / IP &amp; Notes</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLoginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No authentication events match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLoginHistory.map((item) => {
                    const src = sourceBadgeLabel(item.source);
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.03]">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatIsoTime(item.timestamp)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                          {item.username}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>{item.resolvedRole || item.attemptedRole || '—'}</div>
                          {item.attemptedRole &&
                            item.resolvedRole &&
                            item.attemptedRole !== item.resolvedRole && (
                              <div className="text-[10px] text-slate-500">
                                Requested: {item.attemptedRole}
                              </div>
                            )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${loginStatusBadge(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-slate-200 truncate">
                            {item.reason || 'Standard gateway authentication'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                            {item.ipAddress ? `IP: ${item.ipAddress}` : 'IP: Server-side only'}
                            {item.userAgent ? ` · ${item.userAgent}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${src.cls}`}
                          >
                            {src.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ADMIN ACCOUNT MODAL */}
      {isCreateAccountOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => !createAccSubmitting && setIsCreateAccountOpen(false)}
        >
          <div
            className="hy-glass w-full max-w-md rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-300" />
                CREATE COUNSEL ACCOUNT
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateAccountOpen(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createAccError && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
                {createAccError}
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Username *</label>
                <input
                  type="text"
                  value={newAccUsername}
                  onChange={(e) => setNewAccUsername(e.target.value)}
                  placeholder="e.g. mod_nguyen"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 font-mono outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newAccEmail}
                  onChange={(e) => setNewAccEmail(e.target.value)}
                  placeholder="staff@pactkeeper.local"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Assigned Role *</label>
                <select
                  value={newAccRole}
                  onChange={(e) => setNewAccRole(e.target.value)}
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name} className="bg-slate-900">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Initial Passcode (&ge; 8 chars) *
                </label>
                <input
                  type="password"
                  value={newAccPassword}
                  onChange={(e) => setNewAccPassword(e.target.value)}
                  placeholder="Temporary password"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 font-mono outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Audit Rationale *</label>
                <input
                  type="text"
                  value={createAccRationale}
                  onChange={(e) => setCreateAccRationale(e.target.value)}
                  placeholder="e.g. Onboarding Q4 LiveOps Moderator"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateAccountOpen(false)}
                  className="hy-btn-glass px-3.5 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccSubmitting}
                  className="hy-btn-gold px-4 py-2 rounded-xl font-bold text-slate-950 disabled:opacity-50"
                >
                  {createAccSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN ROLE MODAL */}
      {roleEditAccount && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setRoleEditAccount(null)}
        >
          <div
            className="hy-glass w-full max-w-sm rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold font-cinzel text-slate-100">
              REASSIGN ROLE — {roleEditAccount.username}
            </h3>
            <select
              value={targetAccountRole}
              onChange={(e) => setTargetAccountRole(e.target.value)}
              className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name} className="bg-slate-900">
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRoleEditAccount(null)}
                className="hy-btn-glass px-3 py-1.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = roleEditAccount;
                  const nextRole = targetAccountRole;
                  setRoleEditAccount(null);
                  openGuard({
                    title: 'Authorize Role Reassignment',
                    description: `Reassigns ${target.username} from "${target.role}" to "${nextRole}".`,
                    severity: 'CRITICAL',
                    actionLabel: 'Apply Role Change',
                    targetSummary: `${target.username}: ${target.role} -> ${nextRole}`,
                    requireKeyword: 'CONFIRM',
                    onExecute: async (rationale) => {
                      await updateAdminAccountRole(target, nextRole, rationale);
                      showToast(`Updated role for "${target.username}" to ${nextRole}.`);
                    },
                  });
                }}
                className="hy-btn-gold px-4 py-1.5 rounded-lg font-bold text-slate-950"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET ACCOUNT PASSWORD MODAL */}
      {resetPwdAccount && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => !resetPwdSubmitting && setResetPwdAccount(null)}
        >
          <div
            className="hy-glass w-full max-w-md rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold font-cinzel text-slate-100">
              ADMIN PASSWORD RESET — {resetPwdAccount.username}
            </h3>
            {resetPwdError && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-rose-200">
                {resetPwdError}
              </div>
            )}
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  New Temporary Passcode (&ge; 8 chars) *
                </label>
                <input
                  type="password"
                  value={resetPwdValue}
                  onChange={(e) => setResetPwdValue(e.target.value)}
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 font-mono outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Audit Rationale *
                </label>
                <input
                  type="text"
                  value={resetPwdRationale}
                  onChange={(e) => setResetPwdRationale(e.target.value)}
                  placeholder="Reason for administrative password reset"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setResetPwdAccount(null)}
                  className="hy-btn-glass px-3.5 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPwdSubmitting}
                  className="hy-btn-gold px-4 py-2 rounded-xl font-bold text-slate-950 disabled:opacity-50"
                >
                  {resetPwdSubmitting ? 'Resetting...' : 'Reset Passcode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM ROLE MODAL */}
      {isCreateRoleOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => !createRoleSubmitting && setIsCreateRoleOpen(false)}
        >
          <div
            className="hy-glass w-full max-w-md rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold font-cinzel text-slate-100">CREATE COUNSEL ROLE</h3>
            {createRoleError && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-rose-200">
                {createRoleError}
              </div>
            )}
            <form onSubmit={handleCreateRoleSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Finance Auditor"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Scope & duties"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Audit Rationale *</label>
                <input
                  type="text"
                  value={newRoleRationale}
                  onChange={(e) => setNewRoleRationale(e.target.value)}
                  placeholder="e.g. Least-privilege role for payment review"
                  className="w-full bg-[#090d1a] border border-white/15 rounded-xl px-3 py-2 text-slate-100 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  className="hy-btn-glass px-3.5 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoleSubmitting}
                  className="hy-btn-gold px-4 py-2 rounded-xl font-bold text-slate-950 disabled:opacity-50"
                >
                  {createRoleSubmitting ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT ENTRY INSPECT MODAL */}
      {inspectingAudit && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setInspectingAudit(null)}
        >
          <div
            className="hy-glass w-full max-w-lg rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <span
                  className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border ${severityBadgeClass(
                    inspectingAudit.severity
                  )}`}
                >
                  {inspectingAudit.severity} · {inspectingAudit.category}
                </span>
                <h3 className="text-base font-bold font-mono text-slate-100 mt-1">
                  {inspectingAudit.action}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingAudit(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Audit ID:</span>
                <span className="font-mono text-slate-200">{inspectingAudit.id}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">{formatIsoTime(inspectingAudit.timestamp)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Actor:</span>
                <span className="font-mono text-amber-300">
                  {inspectingAudit.actorUsername} ({inspectingAudit.actorRole})
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Target:</span>
                <span className="font-mono text-slate-200">
                  {inspectingAudit.targetType || 'System'}:{' '}
                  {inspectingAudit.targetLabel || inspectingAudit.targetId || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Status:</span>
                <span
                  className={
                    inspectingAudit.status === 'SUCCESS'
                      ? 'text-emerald-300 font-bold'
                      : 'text-rose-300 font-bold'
                  }
                >
                  {inspectingAudit.status}
                </span>
              </div>
            </div>

            {inspectingAudit.rationale && (
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3">
                <div className="text-[11px] font-semibold text-amber-300 mb-1">
                  Operator Rationale
                </div>
                <p className="text-slate-200">{inspectingAudit.rationale}</p>
              </div>
            )}

            {inspectingAudit.errorMessage && (
              <div className="rounded-xl bg-rose-950/50 border border-rose-500/35 p-3 text-rose-200">
                <div className="font-semibold mb-1">Error</div>
                <p>{inspectingAudit.errorMessage}</p>
              </div>
            )}

            {(inspectingAudit.beforeState || inspectingAudit.afterState) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inspectingAudit.beforeState && (
                  <div className="rounded-xl bg-slate-950/80 border border-white/10 p-3">
                    <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Before State
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(inspectingAudit.beforeState, null, 2)}
                    </pre>
                  </div>
                )}
                {inspectingAudit.afterState && (
                  <div className="rounded-xl bg-slate-950/80 border border-emerald-500/20 p-3">
                    <div className="text-[10px] font-mono uppercase text-emerald-300 mb-1">
                      After State
                    </div>
                    <pre className="text-[11px] font-mono text-emerald-100 whitespace-pre-wrap break-all">
                      {JSON.stringify(inspectingAudit.afterState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setInspectingAudit(null)}
                className="hy-btn-glass px-4 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENSITIVE ACTION RATIONALE GUARD MODAL */}
      <SensitiveActionModal
        isOpen={sensitiveGuard !== null}
        title={sensitiveGuard?.title || ''}
        description={sensitiveGuard?.description || ''}
        severity={sensitiveGuard?.severity || 'HIGH'}
        actionLabel={sensitiveGuard?.actionLabel || 'Confirm'}
        targetSummary={sensitiveGuard?.targetSummary}
        requireKeyword={sensitiveGuard?.requireKeyword}
        loading={guardLoading}
        error={guardError}
        onCancel={() => {
          setSensitiveGuard(null);
          setGuardError(null);
        }}
        onConfirm={handleConfirmGuard}
      />
    </div>
  );
};
