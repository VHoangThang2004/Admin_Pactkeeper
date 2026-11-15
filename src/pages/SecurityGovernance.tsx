import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import {
  Activity,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileClock,
  Key,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ConsolePage } from '../components/ConsolePage';
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
  AdminAccountStatus,
  AdminAccountSummary,
  AdminPermissionKey,
  AuditLogEntry,
  AuditLogSeverity,
  CounselRole,
  LoginHistoryEntry,
  LoginHistoryStatus,
  RoleDefinition,
} from '../types';

export interface SecurityGovernanceProps {
  currentUsername: string;
  currentRole: CounselRole | string;
}

type GovernanceTab = 'accounts' | 'roles' | 'audit' | 'logins';
type AccountStatusFilter = 'ALL' | AdminAccountStatus;
type AuditCategoryFilter = 'ALL' | AuditLogEntry['category'];
type AuditSeverityFilter = 'ALL' | AuditLogSeverity;
type AuditStatusFilter = 'ALL' | 'SUCCESS' | 'FAILED';
type LoginStatusFilter = 'ALL' | LoginHistoryStatus;

type AdminAccountRow = AdminAccountSummary & Record<string, unknown>;
type AuditLogRow = AuditLogEntry & Record<string, unknown>;
type LoginHistoryRow = LoginHistoryEntry & Record<string, unknown>;

interface PendingSensitiveGovernanceAction {
  title: string;
  description: string;
  targetLabel?: string;
  targetSummary: string;
  severity: 'HIGH' | 'CRITICAL';
  actionLabel: string;
  requireKeyword?: string;
  execute: (rationale: string) => Promise<void>;
}

const ACCOUNT_STATUS_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'DISABLED', label: 'Disabled' },
];

const AUDIT_CATEGORY_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'AUTH', label: 'Authentication' },
  { value: 'SERVER', label: 'Server Ops' },
  { value: 'PLAYER', label: 'Players' },
  { value: 'TREASURY', label: 'Treasury' },
  { value: 'GACHA', label: 'Gacha' },
  { value: 'CONTENT', label: 'SRPG Content' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'SECURITY', label: 'Security' },
];

const AUDIT_SEVERITY_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const AUDIT_STATUS_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Outcomes' },
  { value: 'SUCCESS', label: 'Success Only' },
  { value: 'FAILED', label: 'Failed Only' },
];

const LOGIN_STATUS_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Auth Events' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'DENIED_PLAYER', label: 'Denied Player' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'SESSION_EXPIRED', label: 'Session Expired' },
];

const SEVERITY_BADGE_MAP: Record<AuditLogSeverity, BadgeVariant> = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

const ACCOUNT_STATUS_BADGE_MAP: Record<AdminAccountStatus, BadgeVariant> = {
  ACTIVE: 'success',
  LOCKED: 'error',
  DISABLED: 'warning',
};

const LOGIN_STATUS_BADGE_MAP: Record<LoginHistoryStatus, BadgeVariant> = {
  SUCCESS: 'success',
  FAILED: 'error',
  DENIED_PLAYER: 'warning',
  LOGOUT: 'info',
  SESSION_EXPIRED: 'neutral',
};

const DATE_INPUT_CLASS =
  'h-8 rounded-lg border px-2.5 text-xs outline-none transition-colors focus:ring-2';

const DATE_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-elevated, var(--color-surface))',
  borderColor: 'var(--color-border-primary)',
  color: 'var(--color-text-primary)',
};

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRoleBadgeVariant(roleName: string): BadgeVariant {
  const lower = roleName.trim().toLowerCase();
  if (lower === 'admin' || lower === 'server') return 'purple';
  if (lower === 'moderator' || lower === 'mod') return 'info';
  if (lower.includes('support') || lower === 'cskh') return 'teal';
  return 'warning';
}

function isWithinDateRange(timestamp: string, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return false;
  if (fromDate) {
    const startMs = new Date(`${fromDate}T00:00:00`).getTime();
    if (parsed.getTime() < startMs) return false;
  }
  if (toDate) {
    const endMs = new Date(`${toDate}T23:59:59.999`).getTime();
    if (parsed.getTime() > endMs) return false;
  }
  return true;
}

export const SecurityGovernance: React.FC<SecurityGovernanceProps> = ({
  currentUsername,
  currentRole,
}) => {
  const [activeTab, setActiveTab] = useState<GovernanceTab>('accounts');
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [notices, setNotices] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; title: string; detail: string } | null>(
    null
  );

  // Collections
  const [accounts, setAccounts] = useState<AdminAccountSummary[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLE_DEFINITIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);

  // Active JWT session expiry ticker
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const tokenExpiryMs = useMemo(
    () => getTokenExpiryMs(sessionStorage.getItem('adminToken')),
    // Re-read when sync runs or ticker advances
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowMs, lastSyncedAt]
  );

  // Tab 1: Account Directory filters & modals
  const [accountQuery, setAccountQuery] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>('ALL');

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<string>('Moderator');
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  const [roleEditAccount, setRoleEditAccount] = useState<AdminAccountSummary | null>(null);
  const [roleEditNextRole, setRoleEditNextRole] = useState<string>('Moderator');

  const [resetPwdAccount, setResetPwdAccount] = useState<AdminAccountSummary | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);

  // Tab 2: RBAC Matrix state
  const [selectedRoleId, setSelectedRoleId] = useState<string>(DEFAULT_ROLE_DEFINITIONS[0].id);
  const [draftPermissions, setDraftPermissions] = useState<AdminPermissionKey[]>(
    DEFAULT_ROLE_DEFINITIONS[0].permissions
  );

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<AdminPermissionKey[]>([
    'dashboard.view',
    'players.view',
  ]);
  const [newRoleError, setNewRoleError] = useState<string | null>(null);

  // Tab 3: Audit Log filters & detail modal
  const [auditQuery, setAuditQuery] = useState('');
  const [auditCategory, setAuditCategory] = useState<AuditCategoryFilter>('ALL');
  const [auditSeverity, setAuditSeverity] = useState<AuditSeverityFilter>('ALL');
  const [auditStatus, setAuditStatus] = useState<AuditStatusFilter>('ALL');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [inspectingAudit, setInspectingAudit] = useState<AuditLogEntry | null>(null);

  // Tab 4: Login History filters
  const [loginQuery, setLoginQuery] = useState('');
  const [loginStatus, setLoginStatus] = useState<LoginStatusFilter>('ALL');
  const [loginDateFrom, setLoginDateFrom] = useState('');
  const [loginDateTo, setLoginDateTo] = useState('');

  // Shared SensitiveActionModal flow
  const [pendingAction, setPendingAction] = useState<PendingSensitiveGovernanceAction | null>(null);

  const loadSecuritySnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, rolesRes, auditsRes, loginsRes] = await Promise.all([
        fetchAdminAccounts(),
        fetchRoleDefinitions(),
        fetchAuditLogs(),
        fetchLoginHistory(),
      ]);

      setAccounts(accountsRes.items);
      const nextRoles = rolesRes.items.length > 0 ? rolesRes.items : DEFAULT_ROLE_DEFINITIONS;
      setRoles(nextRoles);
      setAuditLogs(auditsRes.items);
      setLoginHistory(loginsRes.items);

      setSelectedRoleId((prevId) => {
        const matched = nextRoles.find((r) => r.id === prevId) || nextRoles[0];
        if (matched) {
          setDraftPermissions([...matched.permissions]);
          return matched.id;
        }
        return prevId;
      });

      const activeNotices = [
        accountsRes.notice,
        rolesRes.notice,
        auditsRes.notice,
        loginsRes.notice,
      ].filter((msg): msg is string => Boolean(msg));
      setNotices(Array.from(new Set(activeNotices)));
      setLastSyncedAt(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecuritySnapshot();
  }, [loadSecuritySnapshot]);

  // Derived collections & counts
  const availableRoleOptions = useMemo<SelectorOptionData[]>(() => {
    const names = Array.from(
      new Set([
        ...roles.map((r) => r.name),
        ...DEFAULT_ROLE_DEFINITIONS.map((r) => r.name),
      ])
    );
    return names.map((name) => ({ value: name, label: name }));
  }, [roles]);

  const filteredAccounts = useMemo<AdminAccountRow[]>(() => {
    const q = accountQuery.trim().toLowerCase();
    return accounts
      .filter((acc) => {
        if (accountStatusFilter !== 'ALL' && acc.status !== accountStatusFilter) {
          return false;
        }
        if (!q) return true;
        return (
          acc.username.toLowerCase().includes(q) ||
          (acc.email && acc.email.toLowerCase().includes(q)) ||
          String(acc.role).toLowerCase().includes(q) ||
          acc.id.toLowerCase().includes(q)
        );
      })
      .map((acc) => ({ ...acc }));
  }, [accounts, accountQuery, accountStatusFilter]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0] || DEFAULT_ROLE_DEFINITIONS[0],
    [roles, selectedRoleId]
  );

  const isSelectedRoleSovereignAdmin = useMemo(
    () => selectedRole.isSystemDefault === true && selectedRole.name.trim().toLowerCase() === 'admin',
    [selectedRole]
  );

  const roleDiffCount = useMemo(() => {
    const orig = new Set(selectedRole.permissions);
    const draft = new Set(draftPermissions);
    let diff = 0;
    for (const p of orig) if (!draft.has(p)) diff += 1;
    for (const p of draft) if (!orig.has(p)) diff += 1;
    return diff;
  }, [selectedRole, draftPermissions]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, typeof PERMISSION_CATALOG>();
    for (const perm of PERMISSION_CATALOG) {
      const list = groups.get(perm.group) || [];
      list.push(perm);
      groups.set(perm.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const filteredAudits = useMemo<AuditLogRow[]>(() => {
    const q = auditQuery.trim().toLowerCase();
    return auditLogs
      .filter((entry) => {
        if (auditCategory !== 'ALL' && entry.category !== auditCategory) return false;
        if (auditSeverity !== 'ALL' && entry.severity !== auditSeverity) return false;
        if (auditStatus !== 'ALL' && entry.status !== auditStatus) return false;
        if (!isWithinDateRange(entry.timestamp, auditDateFrom, auditDateTo)) return false;
        if (!q) return true;
        return (
          entry.action.toLowerCase().includes(q) ||
          entry.actorUsername.toLowerCase().includes(q) ||
          (entry.targetLabel && entry.targetLabel.toLowerCase().includes(q)) ||
          (entry.targetId && entry.targetId.toLowerCase().includes(q)) ||
          (entry.rationale && entry.rationale.toLowerCase().includes(q))
        );
      })
      .map((entry) => ({ ...entry }));
  }, [auditLogs, auditQuery, auditCategory, auditSeverity, auditStatus, auditDateFrom, auditDateTo]);

  const filteredLogins = useMemo<LoginHistoryRow[]>(() => {
    const q = loginQuery.trim().toLowerCase();
    return loginHistory
      .filter((entry) => {
        if (loginStatus !== 'ALL' && entry.status !== loginStatus) return false;
        if (!isWithinDateRange(entry.timestamp, loginDateFrom, loginDateTo)) return false;
        if (!q) return true;
        return (
          entry.username.toLowerCase().includes(q) ||
          (entry.ipAddress && entry.ipAddress.toLowerCase().includes(q)) ||
          (entry.resolvedRole && entry.resolvedRole.toLowerCase().includes(q)) ||
          (entry.reason && entry.reason.toLowerCase().includes(q))
        );
      })
      .map((entry) => ({ ...entry }));
  }, [loginHistory, loginQuery, loginStatus, loginDateFrom, loginDateTo]);

  const summaryStats = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE').length;
    const lockedAccounts = accounts.filter((a) => a.status === 'LOCKED').length;
    const criticalAudits = auditLogs.filter((a) => a.severity === 'CRITICAL').length;
    const failedAudits = auditLogs.filter((a) => a.status === 'FAILED').length;
    const deniedOrFailedLogins = loginHistory.filter(
      (l) => l.status === 'FAILED' || l.status === 'DENIED_PLAYER'
    ).length;
    return {
      activeAccounts,
      lockedAccounts,
      criticalAudits,
      failedAudits,
      deniedOrFailedLogins,
    };
  }, [accounts, auditLogs, loginHistory]);

  // Handlers
  const handleSelectRoleForMatrix = (roleItem: RoleDefinition) => {
    setSelectedRoleId(roleItem.id);
    setDraftPermissions([...roleItem.permissions]);
  };

  const toggleDraftPermission = (permKey: AdminPermissionKey, checked: boolean) => {
    if (isSelectedRoleSovereignAdmin) return;
    setDraftPermissions((prev) => {
      if (checked) {
        return prev.includes(permKey) ? prev : [...prev, permKey];
      }
      return prev.filter((k) => k !== permKey);
    });
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = createUsername.trim();
    if (trimmedUser.length < 3) {
      setCreateFormError('Username must be at least 3 characters.');
      return;
    }
    if (createPassword.length < 8) {
      setCreateFormError('Temporary password must be at least 8 characters.');
      return;
    }

    const payload = {
      username: trimmedUser,
      password: createPassword,
      email: createEmail.trim() || undefined,
      role: createRole,
    };

    setCreateFormError(null);
    setIsCreateAccountOpen(false);
    setPendingAction({
      title: 'Authorize New Counsel Staff Account',
      description:
        'Creates a privileged staff operator account with access to the High Counsel Admin Portal.',
      targetLabel: 'New Operator',
      targetSummary: `${payload.username} • Role: ${payload.role}`,
      severity: 'CRITICAL',
      actionLabel: 'Provision Staff Account',
      requireKeyword: 'CREATE',
      execute: async (rationale: string) => {
        await createAdminAccount(payload, rationale);
        setCreateUsername('');
        setCreateEmail('');
        setCreatePassword('');
        setFeedback({
          status: 'success',
          title: 'Staff Account Provisioned',
          detail: `Operator "${payload.username}" created with role ${payload.role}.`,
        });
        await loadSecuritySnapshot();
      },
    });
  };

  const handleAssignRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleEditAccount) return;
    const targetAccount = roleEditAccount;
    const nextRole = roleEditNextRole;
    setRoleEditAccount(null);
    setPendingAction({
      title: 'Reassign Counsel Staff Role',
      description: `Changes RBAC authority tier for ${targetAccount.username} from "${targetAccount.role}" to "${nextRole}".`,
      targetLabel: 'Staff Operator',
      targetSummary: `${targetAccount.username}: ${targetAccount.role} → ${nextRole}`,
      severity: 'CRITICAL',
      actionLabel: 'Apply Role Change',
      requireKeyword: 'ROLE',
      execute: async (rationale: string) => {
        await updateAdminAccountRole(targetAccount, nextRole, rationale);
        setFeedback({
          status: 'success',
          title: 'Role Updated',
          detail: `${targetAccount.username} assigned to ${nextRole}.`,
        });
        await loadSecuritySnapshot();
      },
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdAccount) return;
    if (resetPwdValue.length < 8) {
      setResetPwdError('New password must be at least 8 characters.');
      return;
    }
    if (resetPwdValue !== resetPwdConfirm) {
      setResetPwdError('Password confirmation does not match.');
      return;
    }

    const targetAccount = resetPwdAccount;
    const nextPassword = resetPwdValue;
    setResetPwdError(null);
    setResetPwdAccount(null);
    setResetPwdValue('');
    setResetPwdConfirm('');

    setPendingAction({
      title: 'Force Reset Staff Credentials',
      description: `Overwrites the login password for counsel account "${targetAccount.username}".`,
      targetLabel: 'Target Account',
      targetSummary: `${targetAccount.username} (${targetAccount.role})`,
      severity: 'CRITICAL',
      actionLabel: 'Reset Password',
      requireKeyword: 'RESET',
      execute: async (rationale: string) => {
        await resetAdminAccountPassword(targetAccount, nextPassword, rationale);
        setFeedback({
          status: 'success',
          title: 'Password Reset Complete',
          detail: `Updated credentials for ${targetAccount.username}.`,
        });
        await loadSecuritySnapshot();
      },
    });
  };

  const requestAccountLockToggle = useCallback(
    (acc: AdminAccountSummary) => {
      const nextStatus: AdminAccountStatus = acc.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
      const isLocking = nextStatus === 'LOCKED';
      setPendingAction({
        title: isLocking ? 'Lock Staff Account' : 'Unlock Staff Account',
        description: isLocking
          ? `Immediately suspends authentication for "${acc.username}".`
          : `Restores login privileges for suspended operator "${acc.username}".`,
        targetLabel: 'Target Operator',
        targetSummary: `${acc.username} (${acc.status} → ${nextStatus})`,
        severity: 'CRITICAL',
        actionLabel: isLocking ? 'Lock Account' : 'Unlock Account',
        requireKeyword: isLocking ? 'LOCK' : 'UNLOCK',
        execute: async (rationale: string) => {
          await toggleAdminAccountLock(acc, nextStatus, rationale);
          setFeedback({
            status: 'success',
            title: isLocking ? 'Account Locked' : 'Account Unlocked',
            detail: `${acc.username} is now ${nextStatus}.`,
          });
          await loadSecuritySnapshot();
        },
      });
    },
    [loadSecuritySnapshot]
  );

  const requestRevokeSessions = useCallback(
    (acc: AdminAccountSummary) => {
      setPendingAction({
        title: 'Revoke Active JWT Sessions',
        description: `Invalidates active bearer tokens and refresh sessions for "${acc.username}".`,
        targetLabel: 'Target Operator',
        targetSummary: `${acc.username} • ${acc.role}`,
        severity: 'HIGH',
        actionLabel: 'Revoke Sessions',
        execute: async (rationale: string) => {
          await revokeAdminAccountSessions(acc, rationale);
          setFeedback({
            status: 'success',
            title: 'Sessions Revoked',
            detail: `Active tokens terminated for ${acc.username}.`,
          });
          await loadSecuritySnapshot();
        },
      });
    },
    [loadSecuritySnapshot]
  );

  const requestSaveRoleMatrix = () => {
    if (isSelectedRoleSovereignAdmin || roleDiffCount === 0) return;
    const targetRole = selectedRole;
    const permsCopy = [...draftPermissions];
    setPendingAction({
      title: 'Commit RBAC Permission Matrix',
      description: `Updates ${permsCopy.length} permissions assigned to role "${targetRole.name}".`,
      targetLabel: 'Target Role',
      targetSummary: `${targetRole.name} (${roleDiffCount} permission change${roleDiffCount === 1 ? '' : 's'})`,
      severity: 'CRITICAL',
      actionLabel: 'Save Permissions',
      requireKeyword: 'MATRIX',
      execute: async (rationale: string) => {
        await saveRolePermissions(targetRole, permsCopy, rationale);
        setFeedback({
          status: 'success',
          title: 'RBAC Matrix Updated',
          detail: `Saved ${permsCopy.length} permissions for role "${targetRole.name}".`,
        });
        await loadSecuritySnapshot();
      },
    });
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newRoleName.trim();
    if (trimmedName.length < 3) {
      setNewRoleError('Role name must be at least 3 characters.');
      return;
    }
    if (newRolePermissions.length === 0) {
      setNewRoleError('Select at least one permission capability for this role.');
      return;
    }
    const payload = {
      name: trimmedName,
      description: newRoleDescription.trim() || `Custom High Counsel role: ${trimmedName}`,
      permissions: [...newRolePermissions],
    };

    setNewRoleError(null);
    setIsCreateRoleOpen(false);
    setPendingAction({
      title: 'Create Custom RBAC Role',
      description: `Registers a new staff authorization role "${payload.name}" with ${payload.permissions.length} capabilities.`,
      targetLabel: 'Role Definition',
      targetSummary: `${payload.name} (${payload.permissions.length} perms)`,
      severity: 'CRITICAL',
      actionLabel: 'Create Role',
      requireKeyword: 'ROLE',
      execute: async (rationale: string) => {
        await createRoleDefinition(payload, rationale);
        setNewRoleName('');
        setNewRoleDescription('');
        setFeedback({
          status: 'success',
          title: 'Custom Role Created',
          detail: `Registered role "${payload.name}" with ${payload.permissions.length} permissions.`,
        });
        await loadSecuritySnapshot();
      },
    });
  };

  const handleExportAuditCsv = () => {
    const csvContent = buildAuditLogsCsv(filteredAudits);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pactkeeper-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleClearSessionBuffers = () => {
    setPendingAction({
      title: 'Purge Local Browser Telemetry Buffers',
      description:
        'Clears the local session audit & login fallback cache stored in this browser. Server-side MongoDB/API logs remain untouched.',
      targetLabel: 'Storage Scope',
      targetSummary: 'Local Browser Audit & Auth Buffer',
      severity: 'HIGH',
      actionLabel: 'Clear Local Buffer',
      execute: async () => {
        clearLocalSecurityBuffers();
        setFeedback({
          status: 'success',
          title: 'Local Telemetry Buffer Cleared',
          detail: 'Browser session buffers emptied and re-synced from server telemetry.',
        });
        await loadSecuritySnapshot();
      },
    });
  };

  // Table column schemas
  const accountColumns = useMemo<TableColumn<AdminAccountRow>[]>(
    () => [
      {
        key: 'username',
        header: 'Counsel Operator',
        width: proportional(2, { minWidth: 180 }),
        renderCell: (row) => {
          const isSelf = row.username.toLowerCase() === currentUsername.toLowerCase();
          return (
            <VStack gap={0.5}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text weight="semibold" color="primary">
                  {row.username}
                </Text>
                {isSelf && <Badge variant="yellow" label="YOU" />}
              </HStack>
              <Text type="supporting" size="xsm" color="secondary">
                {row.email || `ID: ${row.id}`}
              </Text>
            </VStack>
          );
        },
      },
      {
        key: 'role',
        header: 'Assigned Role',
        width: pixel(160),
        renderCell: (row) => (
          <Badge variant={getRoleBadgeVariant(String(row.role))} label={String(row.role)} />
        ),
      },
      {
        key: 'status',
        header: 'Account Status',
        width: pixel(140),
        renderCell: (row) => (
          <Badge
            variant={ACCOUNT_STATUS_BADGE_MAP[row.status] ?? 'neutral'}
            label={row.status}
          />
        ),
      },
      {
        key: 'lastLoginAt',
        header: 'Last Auth Telemetry',
        width: proportional(1.5, { minWidth: 170 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" color="primary">
              {formatDateTime(row.lastLoginAt)}
            </Text>
            <Text type="code" size="xsm" color="secondary">
              {row.lastLoginIp || 'IP unavailable'}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'actions',
        header: 'Governance Controls',
        width: pixel(310),
        align: 'end',
        renderCell: (row) => {
          const isSelf = row.username.toLowerCase() === currentUsername.toLowerCase();
          const isLocked = row.status === 'LOCKED';
          return (
            <HStack gap={1.5} justify="end" wrap="wrap">
              <Button
                size="sm"
                variant="secondary"
                label="Role"
                icon={<Shield className="w-3.5 h-3.5" />}
                onClick={() => {
                  setRoleEditAccount(row);
                  setRoleEditNextRole(String(row.role));
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                label="Password"
                icon={<Key className="w-3.5 h-3.5" />}
                onClick={() => {
                  setResetPwdAccount(row);
                  setResetPwdValue('');
                  setResetPwdConfirm('');
                  setResetPwdError(null);
                }}
              />
              <IconButton
                size="sm"
                variant="ghost"
                label="Revoke active JWT sessions"
                icon={<LogOut className="w-3.5 h-3.5" />}
                onClick={() => requestRevokeSessions(row)}
              />
              <Button
                size="sm"
                variant={isLocked ? 'primary' : 'destructive'}
                label={isLocked ? 'Unlock' : 'Lock'}
                icon={isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                isDisabled={isSelf}
                onClick={() => requestAccountLockToggle(row)}
              />
            </HStack>
          );
        },
      },
    ],
    [currentUsername, requestAccountLockToggle, requestRevokeSessions]
  );

  const auditColumns = useMemo<TableColumn<AuditLogRow>[]>(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        width: pixel(175),
        renderCell: (row) => (
          <Text type="code" size="xsm" color="secondary">
            {formatDateTime(row.timestamp)}
          </Text>
        ),
      },
      {
        key: 'actorUsername',
        header: 'Operator',
        width: pixel(165),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="semibold" color="primary">
              {row.actorUsername}
            </Text>
            <Text type="supporting" size="xsm" color="secondary">
              {row.actorRole}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'action',
        header: 'Action & Category',
        width: proportional(1.6, { minWidth: 200 }),
        renderCell: (row) => (
          <VStack gap={1}>
            <Text type="code" size="sm" weight="semibold" color="primary">
              {row.action}
            </Text>
            <HStack gap={1.5} wrap="wrap">
              <Badge variant="neutral" label={row.category} />
              <Badge
                variant={row.source === 'BACKEND_API' ? 'info' : 'yellow'}
                label={row.source === 'BACKEND_API' ? 'SERVER' : 'LOCAL'}
              />
            </HStack>
          </VStack>
        ),
      },
      {
        key: 'severity',
        header: 'Severity',
        width: pixel(110),
        renderCell: (row) => (
          <Badge variant={SEVERITY_BADGE_MAP[row.severity] ?? 'neutral'} label={row.severity} />
        ),
      },
      {
        key: 'targetLabel',
        header: 'Target & Rationale',
        width: proportional(1.8, { minWidth: 190 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="medium" color="primary">
              {row.targetLabel || row.targetId || row.targetType || '—'}
            </Text>
            <Text type="supporting" size="xsm" color="secondary">
              {row.rationale || row.errorMessage || 'No rationale recorded'}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'status',
        header: 'Outcome',
        width: pixel(110),
        renderCell: (row) => (
          <Badge variant={row.status === 'FAILED' ? 'error' : 'success'} label={row.status} />
        ),
      },
      {
        key: 'inspect',
        header: '',
        width: pixel(64),
        align: 'end',
        renderCell: (row) => (
          <IconButton
            size="sm"
            variant="ghost"
            label={`Inspect audit entry ${row.id}`}
            icon={<Eye className="w-4 h-4" />}
            onClick={() => setInspectingAudit(row)}
          />
        ),
      },
    ],
    []
  );

  const loginColumns = useMemo<TableColumn<LoginHistoryRow>[]>(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        width: pixel(180),
        renderCell: (row) => (
          <Text type="code" size="xsm" color="secondary">
            {formatDateTime(row.timestamp)}
          </Text>
        ),
      },
      {
        key: 'username',
        header: 'Account / Subject',
        width: pixel(175),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="semibold" color="primary">
              {row.username}
            </Text>
            <Text type="supporting" size="xsm" color="secondary">
              Role: {row.resolvedRole || row.attemptedRole || 'Unknown'}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'status',
        header: 'Auth Outcome',
        width: pixel(150),
        renderCell: (row) => (
          <Badge variant={LOGIN_STATUS_BADGE_MAP[row.status] ?? 'neutral'} label={row.status} />
        ),
      },
      {
        key: 'ipAddress',
        header: 'Origin & Agent',
        width: proportional(1.5, { minWidth: 180 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text type="code" size="xsm" color="primary">
              {row.ipAddress || 'Client Browser Session'}
            </Text>
            <Text type="supporting" size="xsm" color="secondary">
              {row.userAgent ? `${row.userAgent.slice(0, 68)}${row.userAgent.length > 68 ? '…' : ''}` : '—'}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'reason',
        header: 'Details / Telemetry Source',
        width: proportional(1.4, { minWidth: 170 }),
        renderCell: (row) => (
          <VStack gap={1}>
            <Text size="sm" color="primary">
              {row.reason || 'Standard counsel portal authentication event'}
            </Text>
            <Badge
              variant={row.source === 'BACKEND_API' ? 'info' : 'yellow'}
              label={row.source === 'BACKEND_API' ? 'SERVER' : 'LOCAL'}
            />
          </VStack>
        ),
      },
    ],
    []
  );

  const sessionRemainingLabel = useMemo(() => {
    if (tokenExpiryMs === null) return 'No expiry claim in token';
    return formatRemainingDuration(tokenExpiryMs - nowMs);
  }, [tokenExpiryMs, nowMs]);

  const topBanner =
    feedback || notices.length > 0 ? (
      <VStack gap={2}>
        {feedback && (
          <Banner
            status={feedback.status}
            title={feedback.title}
            description={feedback.detail}
            isDismissable
            onDismiss={() => setFeedback(null)}
          />
        )}
        {notices.length > 0 && (
          <Banner
            status="info"
            title="Security API Fallback / Notice"
            description={notices.join(' | ')}
            isDismissable
            onDismiss={() => setNotices([])}
          />
        )}
      </VStack>
    ) : undefined;

  return (
    <ConsolePage
      badge="GOVERNANCE & RBAC COUNCIL"
      badgeVariant="purple"
      icon={<ShieldCheck className="w-6 h-6 text-amber-500" />}
      meta={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <HStack gap={1.5} vAlign="center">
            <UserCheck className="w-3.5 h-3.5 text-amber-500" />
            <Text size="xsm" weight="bold" color="primary">
              {currentUsername}
            </Text>
            <Badge
              variant={getRoleBadgeVariant(String(currentRole))}
              label={String(currentRole)}
            />
          </HStack>

          <HStack gap={1} vAlign="center">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <Badge
              variant={
                tokenExpiryMs !== null && tokenExpiryMs - nowMs < 300_000
                  ? 'warning'
                  : 'info'
              }
              label={`TTL ${sessionRemainingLabel}`}
            />
          </HStack>

          <Badge
            variant="neutral"
            label={`${summaryStats.activeAccounts}/${accounts.length} Active Staff • ${summaryStats.criticalAudits} Critical`}
          />

          <Badge
            variant={summaryStats.deniedOrFailedLogins > 0 ? 'warning' : 'success'}
            icon={<Activity className="w-3 h-3" />}
            label={`${summaryStats.deniedOrFailedLogins} Auth Alerts`}
          />

          {lastSyncedAt && (
            <HStack gap={1} vAlign="center">
              <StatusDot variant="success" label="Security snapshot synchronized" />
              <Text type="code" size="xsm" color="secondary">
                {lastSyncedAt}
              </Text>
            </HStack>
          )}
        </HStack>
      }
      title="SECURITY & GOVERNANCE"
      subtitle="High Counsel RBAC access matrix, staff directory, immutable audit trail & authentication telemetry"
      actions={
        <HStack gap={2} wrap="wrap" vAlign="center">
          <Button
            variant="secondary"
            size="sm"
            label="Refresh"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => void loadSecuritySnapshot()}
            isDisabled={loading}
          />
          <Button
            variant="secondary"
            size="sm"
            label="Purge Local Buffers"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleClearSessionBuffers}
          />
          <Button
            variant="primary"
            size="sm"
            label="Create Staff"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setCreateFormError(null);
              setIsCreateAccountOpen(true);
            }}
          />
        </HStack>
      }
      banner={topBanner}
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabList
            value={activeTab}
            onChange={(val) => setActiveTab(val as GovernanceTab)}
            role="tablist"
          >
            <Tab
              value="accounts"
              panelId="panel-accounts"
              label="Staff Accounts"
              icon={<Users className="w-4 h-4" />}
              endContent={<Badge variant="neutral" label={accounts.length} />}
            />
            <Tab
              value="roles"
              panelId="panel-roles"
              label="RBAC Permissions"
              icon={<Shield className="w-4 h-4" />}
              endContent={<Badge variant="purple" label={roles.length} />}
            />
            <Tab
              value="audit"
              panelId="panel-audit"
              label="Audit Log"
              icon={<FileClock className="w-4 h-4" />}
              endContent={<Badge variant="warning" label={auditLogs.length} />}
            />
            <Tab
              value="logins"
              panelId="panel-logins"
              label="Login History"
              icon={<KeyRound className="w-4 h-4" />}
              endContent={<Badge variant="info" label={loginHistory.length} />}
            />
          </TabList>

          {activeTab === 'roles' && roleDiffCount > 0 && (
            <Badge
              variant="warning"
              label={`${roleDiffCount} Unsaved RBAC Change${roleDiffCount > 1 ? 's' : ''} (${selectedRole.name})`}
            />
          )}
        </div>
      }
    >
      {/* Main Tab Body Card */}
      <Card padding={4}>
        <VStack gap={4}>

          {/* TAB 1: STAFF ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div role="tabpanel" id="panel-accounts">
              <VStack gap={4}>
                <HStack justify="between" vAlign="end" gap={3} wrap="wrap">
                  <HStack gap={3} vAlign="end" wrap="wrap" className="flex-1 min-w-[260px]">
                    <div className="flex-1 min-w-[220px] max-w-md">
                      <TextInput
                        label="Search Staff Accounts"
                        type="search"
                        value={accountQuery}
                        onChange={setAccountQuery}
                        placeholder="Search username, email, role, or ID..."
                      />
                    </div>
                    <div className="w-44">
                      <Selector
                        label="Status Filter"
                        options={ACCOUNT_STATUS_OPTIONS}
                        value={accountStatusFilter}
                        onChange={(val) => setAccountStatusFilter(val as AccountStatusFilter)}
                      />
                    </div>
                  </HStack>

                  <Button
                    variant="primary"
                    label="New Staff Account"
                    icon={<UserPlus className="w-4 h-4" />}
                    onClick={() => {
                      setCreateFormError(null);
                      setIsCreateAccountOpen(true);
                    }}
                  />
                </HStack>

                {filteredAccounts.length === 0 ? (
                  <EmptyState
                    title={loading ? 'Loading Counsel Directory...' : 'No Staff Accounts Matched'}
                    description={
                      loading
                        ? 'Fetching privileged accounts from the High Counsel security service.'
                        : 'Try clearing the search query or create a new counsel staff account.'
                    }
                    icon={<Users className="w-8 h-8" />}
                    actions={
                      !loading ? (
                        <Button
                          variant="secondary"
                          label="Create Staff Account"
                          icon={<UserPlus className="w-4 h-4" />}
                          onClick={() => setIsCreateAccountOpen(true)}
                        />
                      ) : undefined
                    }
                  />
                ) : (
                  <Table
                    columns={accountColumns}
                    data={filteredAccounts}
                    idKey="id"
                    density="balanced"
                    hasHover
                    aria-label="Counsel Admin Accounts"
                  />
                )}
              </VStack>
            </div>
          )}

          {/* TAB 2: RBAC PERMISSIONS MATRIX */}
          {activeTab === 'roles' && (
            <div role="tabpanel" id="panel-roles">
              <Grid columns={{ minWidth: 300, max: 3, repeat: 'fit' }} gap={4}>
                {/* Role selector rail (1 column on wide grid, full width on narrow) */}
                <VStack gap={3}>
                  <HStack justify="between" vAlign="center">
                    <Heading level={3} type="display-3">
                      Roles
                    </Heading>
                    <Button
                      size="sm"
                      variant="primary"
                      label="New Role"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setNewRoleError(null);
                        setIsCreateRoleOpen(true);
                      }}
                    />
                  </HStack>

                  <VStack gap={2}>
                    {roles.map((r) => {
                      const isSelected = r.id === selectedRole.id;
                      return (
                        <Card
                          key={r.id}
                          variant={isSelected ? 'default' : 'muted'}
                          padding={3}
                          onClick={() => handleSelectRoleForMatrix(r)}
                          className={`cursor-pointer transition-all ${
                            isSelected ? 'ring-2 ring-amber-500/60' : 'hover:opacity-95'
                          }`}
                        >
                          <VStack gap={1.5}>
                            <HStack justify="between" vAlign="center" gap={2}>
                              <HStack gap={2} vAlign="center">
                                <Badge variant={getRoleBadgeVariant(r.name)} label={r.name} />
                                {r.isSystemDefault && <Badge variant="neutral" label="SYSTEM" />}
                              </HStack>
                              <Text type="code" size="xsm" color="secondary">
                                {r.permissions.length} perms
                              </Text>
                            </HStack>
                            <Text type="supporting" size="xsm" color="secondary">
                              {r.description}
                            </Text>
                          </VStack>
                        </Card>
                      );
                    })}
                  </VStack>
                </VStack>

                {/* Permission Matrix Editor */}
                <div className="lg:col-span-2">
                  <VStack gap={4}>
                    <Card variant="muted" padding={4}>
                      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
                        <VStack gap={1}>
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Heading level={3} type="display-3">
                              {selectedRole.name} Matrix
                            </Heading>
                            <Badge
                              variant="info"
                              label={`${draftPermissions.length}/${PERMISSION_CATALOG.length} active`}
                            />
                            {roleDiffCount > 0 && (
                              <Badge variant="warning" label={`${roleDiffCount} unsaved`} />
                            )}
                          </HStack>
                          <Text size="sm" color="secondary">
                            {selectedRole.description}
                          </Text>
                        </VStack>

                        <HStack gap={2} wrap="wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            label="Reset Draft"
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            isDisabled={roleDiffCount === 0}
                            onClick={() => setDraftPermissions([...selectedRole.permissions])}
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            label="Save Matrix"
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            isDisabled={isSelectedRoleSovereignAdmin || roleDiffCount === 0}
                            onClick={requestSaveRoleMatrix}
                          />
                        </HStack>
                      </HStack>
                    </Card>

                    {isSelectedRoleSovereignAdmin && (
                      <Banner
                        status="info"
                        title="Protected System Sovereign Role"
                        description='The built-in "Admin" role retains unconditional access across all portal capabilities to guarantee administrative recovery.'
                        collapsible={false}
                      />
                    )}

                    <VStack gap={3}>
                      {permissionGroups.map(([groupName, groupPerms]) => (
                        <Card key={groupName} variant="default" padding={4}>
                          <VStack gap={3}>
                            <HStack justify="between" vAlign="center">
                              <Text weight="bold" color="primary">
                                {groupName}
                              </Text>
                              <Badge
                                variant="neutral"
                                label={`${groupPerms.filter((p) => draftPermissions.includes(p.key)).length}/${groupPerms.length}`}
                              />
                            </HStack>

                            <Grid columns={{ minWidth: 260, max: 2, repeat: 'fit' }} gap={3}>
                              {groupPerms.map((perm) => {
                                const isChecked =
                                  isSelectedRoleSovereignAdmin ||
                                  draftPermissions.includes(perm.key);
                                return (
                                  <Card key={perm.key} variant="muted" padding={3}>
                                    <HStack justify="between" vAlign="start" gap={2}>
                                      <CheckboxInput
                                        label={perm.label}
                                        description={`${perm.key} — ${perm.description}`}
                                        value={isChecked}
                                        isDisabled={isSelectedRoleSovereignAdmin}
                                        disabledMessage="Built-in sovereign Admin role permissions cannot be revoked."
                                        onChange={(checked) =>
                                          toggleDraftPermission(perm.key, checked)
                                        }
                                      />
                                      <Badge
                                        variant={SEVERITY_BADGE_MAP[perm.risk]}
                                        label={perm.risk}
                                      />
                                    </HStack>
                                  </Card>
                                );
                              })}
                            </Grid>
                          </VStack>
                        </Card>
                      ))}
                    </VStack>
                  </VStack>
                </div>
              </Grid>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div role="tabpanel" id="panel-audit">
              <VStack gap={4}>
                <Grid columns={{ minWidth: 170, max: 6, repeat: 'fit' }} gap={2}>
                  <TextInput
                    label="Search Audit Trail"
                    type="search"
                    value={auditQuery}
                    onChange={setAuditQuery}
                    placeholder="Action, actor, target..."
                  />
                  <Selector
                    label="Category"
                    options={AUDIT_CATEGORY_OPTIONS}
                    value={auditCategory}
                    onChange={(val) => setAuditCategory(val as AuditCategoryFilter)}
                  />
                  <Selector
                    label="Severity"
                    options={AUDIT_SEVERITY_OPTIONS}
                    value={auditSeverity}
                    onChange={(val) => setAuditSeverity(val as AuditSeverityFilter)}
                  />
                  <Selector
                    label="Outcome"
                    options={AUDIT_STATUS_OPTIONS}
                    value={auditStatus}
                    onChange={(val) => setAuditStatus(val as AuditStatusFilter)}
                  />
                  <VStack gap={1}>
                    <label
                      htmlFor="audit-date-from"
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      From Date
                    </label>
                    <input
                      id="audit-date-from"
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      className={DATE_INPUT_CLASS}
                      style={DATE_INPUT_STYLE}
                    />
                  </VStack>
                  <VStack gap={1}>
                    <label
                      htmlFor="audit-date-to"
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      To Date
                    </label>
                    <input
                      id="audit-date-to"
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      className={DATE_INPUT_CLASS}
                      style={DATE_INPUT_STYLE}
                    />
                  </VStack>
                </Grid>

                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text size="sm" color="secondary">
                    Showing {filteredAudits.length} of {auditLogs.length} audit events
                  </Text>
                  <HStack gap={2} wrap="wrap">
                    {(auditQuery ||
                      auditCategory !== 'ALL' ||
                      auditSeverity !== 'ALL' ||
                      auditStatus !== 'ALL' ||
                      auditDateFrom ||
                      auditDateTo) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        label="Reset Filters"
                        onClick={() => {
                          setAuditQuery('');
                          setAuditCategory('ALL');
                          setAuditSeverity('ALL');
                          setAuditStatus('ALL');
                          setAuditDateFrom('');
                          setAuditDateTo('');
                        }}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Export Filtered CSV"
                      icon={<Download className="w-4 h-4" />}
                      onClick={handleExportAuditCsv}
                      isDisabled={filteredAudits.length === 0}
                    />
                  </HStack>
                </HStack>

                {filteredAudits.length === 0 ? (
                  <EmptyState
                    title="No Audit Events Match Current Filters"
                    description="Adjust the date range, category, or search term to inspect administrative audit history."
                    icon={<FileClock className="w-8 h-8" />}
                  />
                ) : (
                  <Table
                    columns={auditColumns}
                    data={filteredAudits}
                    idKey="id"
                    density="compact"
                    hasHover
                    aria-label="Security Audit Log"
                  />
                )}
              </VStack>
            </div>
          )}

          {/* TAB 4: LOGIN HISTORY */}
          {activeTab === 'logins' && (
            <div role="tabpanel" id="panel-logins">
              <VStack gap={4}>
                <Grid columns={{ minWidth: 190, max: 4, repeat: 'fit' }} gap={3}>
                  <TextInput
                    label="Search Auth Subjects"
                    type="search"
                    value={loginQuery}
                    onChange={setLoginQuery}
                    placeholder="Username, IP address, reason..."
                  />
                  <Selector
                    label="Auth Outcome"
                    options={LOGIN_STATUS_OPTIONS}
                    value={loginStatus}
                    onChange={(val) => setLoginStatus(val as LoginStatusFilter)}
                  />
                  <VStack gap={1}>
                    <label
                      htmlFor="login-date-from"
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      From Date
                    </label>
                    <input
                      id="login-date-from"
                      type="date"
                      value={loginDateFrom}
                      onChange={(e) => setLoginDateFrom(e.target.value)}
                      className={DATE_INPUT_CLASS}
                      style={DATE_INPUT_STYLE}
                    />
                  </VStack>
                  <VStack gap={1}>
                    <label
                      htmlFor="login-date-to"
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      To Date
                    </label>
                    <input
                      id="login-date-to"
                      type="date"
                      value={loginDateTo}
                      onChange={(e) => setLoginDateTo(e.target.value)}
                      className={DATE_INPUT_CLASS}
                      style={DATE_INPUT_STYLE}
                    />
                  </VStack>
                </Grid>

                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text size="sm" color="secondary">
                    Showing {filteredLogins.length} of {loginHistory.length} authentication events
                  </Text>
                  {(loginQuery || loginStatus !== 'ALL' || loginDateFrom || loginDateTo) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      label="Reset Filters"
                      onClick={() => {
                        setLoginQuery('');
                        setLoginStatus('ALL');
                        setLoginDateFrom('');
                        setLoginDateTo('');
                      }}
                    />
                  )}
                </HStack>

                {filteredLogins.length === 0 ? (
                  <EmptyState
                    title="No Authentication Records Found"
                    description="Authentication events from logins, rejected player attempts, logouts, and expired JWT sessions appear here."
                    icon={<KeyRound className="w-8 h-8" />}
                  />
                ) : (
                  <Table
                    columns={loginColumns}
                    data={filteredLogins}
                    idKey="id"
                    density="compact"
                    hasHover
                    aria-label="Authentication Telemetry"
                  />
                )}
              </VStack>
            </div>
          )}
        </VStack>
      </Card>

      {/* DIALOG: Create Staff Account */}
      <Dialog
        isOpen={isCreateAccountOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateAccountOpen(false);
            setCreateFormError(null);
          }
        }}
        purpose="form"
        width={480}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Create Counsel Staff Account"
            subtitle="Provision a new backend administrator, moderator, or support operator."
            startContent={<UserPlus className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsCreateAccountOpen(false);
            }}
          />

          {createFormError && (
            <Banner
              status="error"
              title="Validation Error"
              description={createFormError}
              collapsible={false}
            />
          )}

          <form onSubmit={handleCreateAccountSubmit}>
            <VStack gap={3}>
              <TextInput
                label="Operator Username"
                value={createUsername}
                onChange={setCreateUsername}
                placeholder="e.g. counsel_mod_01"
                isRequired
              />
              <TextInput
                label="Staff Email (optional)"
                type="email"
                value={createEmail}
                onChange={setCreateEmail}
                placeholder="staff@pactkeeper.gg"
              />
              <TextInput
                label="Temporary Password"
                type="password"
                value={createPassword}
                onChange={setCreatePassword}
                placeholder="Minimum 8 characters"
                isRequired
              />
              <Selector
                label="Initial RBAC Role"
                options={availableRoleOptions}
                value={createRole}
                onChange={(val) => setCreateRole(String(val))}
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setIsCreateAccountOpen(false)}
                />
                <Button
                  type="submit"
                  variant="primary"
                  label="Continue to Authorization"
                />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Change Account Role */}
      <Dialog
        isOpen={roleEditAccount !== null}
        onOpenChange={(open) => {
          if (!open) setRoleEditAccount(null);
        }}
        purpose="form"
        width={440}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Reassign Operator Role"
            subtitle={roleEditAccount ? `Account: ${roleEditAccount.username}` : undefined}
            startContent={<Shield className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setRoleEditAccount(null);
            }}
          />

          <form onSubmit={handleAssignRoleSubmit}>
            <VStack gap={3}>
              <Selector
                label="Target RBAC Role"
                options={availableRoleOptions}
                value={roleEditNextRole}
                onChange={(val) => setRoleEditNextRole(String(val))}
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setRoleEditAccount(null)}
                />
                <Button
                  type="submit"
                  variant="primary"
                  label="Continue to Authorization"
                />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Reset Account Password */}
      <Dialog
        isOpen={resetPwdAccount !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetPwdAccount(null);
            setResetPwdError(null);
          }
        }}
        purpose="form"
        width={460}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Reset Staff Password"
            subtitle={resetPwdAccount ? `Operator: ${resetPwdAccount.username}` : undefined}
            startContent={<Key className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setResetPwdAccount(null);
            }}
          />

          {resetPwdError && (
            <Banner
              status="error"
              title="Invalid Password"
              description={resetPwdError}
              collapsible={false}
            />
          )}

          <form onSubmit={handleResetPasswordSubmit}>
            <VStack gap={3}>
              <TextInput
                label="New Temporary Password"
                type="password"
                value={resetPwdValue}
                onChange={setResetPwdValue}
                placeholder="Minimum 8 characters"
                isRequired
              />
              <TextInput
                label="Confirm New Password"
                type="password"
                value={resetPwdConfirm}
                onChange={setResetPwdConfirm}
                placeholder="Repeat temporary password"
                isRequired
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setResetPwdAccount(null)}
                />
                <Button
                  type="submit"
                  variant="destructive"
                  label="Continue to Reset"
                />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Create Custom Role */}
      <Dialog
        isOpen={isCreateRoleOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateRoleOpen(false);
            setNewRoleError(null);
          }
        }}
        purpose="form"
        width={620}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Create Custom RBAC Role"
            subtitle="Define a named security role and initial permission capabilities."
            startContent={<ShieldAlert className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsCreateRoleOpen(false);
            }}
          />

          {newRoleError && (
            <Banner
              status="error"
              title="Role Definition Incomplete"
              description={newRoleError}
              collapsible={false}
            />
          )}

          <form onSubmit={handleCreateRoleSubmit}>
            <VStack gap={3}>
              <TextInput
                label="Role Name"
                value={newRoleName}
                onChange={setNewRoleName}
                placeholder="e.g. Economy Auditor"
                isRequired
              />
              <TextArea
                label="Description"
                value={newRoleDescription}
                onChange={setNewRoleDescription}
                rows={2}
                placeholder="Describe scope of responsibility and escalation boundaries..."
              />

              <VStack gap={2}>
                <Text size="sm" weight="semibold" color="primary">
                  Select Initial Capabilities ({newRolePermissions.length} selected)
                </Text>
                <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                  {PERMISSION_CATALOG.map((perm) => (
                    <Card key={perm.key} variant="muted" padding={2}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <CheckboxInput
                          label={perm.label}
                          description={perm.key}
                          value={newRolePermissions.includes(perm.key)}
                          onChange={(checked) => {
                            setNewRolePermissions((prev) =>
                              checked
                                ? prev.includes(perm.key)
                                  ? prev
                                  : [...prev, perm.key]
                                : prev.filter((k) => k !== perm.key)
                            );
                          }}
                        />
                        <Badge variant={SEVERITY_BADGE_MAP[perm.risk]} label={perm.risk} />
                      </HStack>
                    </Card>
                  ))}
                </div>
              </VStack>

              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setIsCreateRoleOpen(false)}
                />
                <Button
                  type="submit"
                  variant="primary"
                  label="Continue to Authorization"
                />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Forensic Audit Event Inspector */}
      <Dialog
        isOpen={inspectingAudit !== null}
        onOpenChange={(open) => {
          if (!open) setInspectingAudit(null);
        }}
        purpose="info"
        width={620}
      >
        {inspectingAudit && (
          <VStack gap={4}>
            <DialogHeader
              title={inspectingAudit.action}
              subtitle={`Audit Record ${inspectingAudit.id} • ${formatDateTime(inspectingAudit.timestamp)}`}
              startContent={<FileClock className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setInspectingAudit(null);
              }}
            />

            <HStack gap={2} wrap="wrap">
              <Badge
                variant={SEVERITY_BADGE_MAP[inspectingAudit.severity]}
                label={inspectingAudit.severity}
              />
              <Badge variant="neutral" label={inspectingAudit.category} />
              <Badge
                variant={inspectingAudit.status === 'FAILED' ? 'error' : 'success'}
                label={inspectingAudit.status}
              />
              <Badge
                variant={inspectingAudit.source === 'BACKEND_API' ? 'info' : 'yellow'}
                label={inspectingAudit.source}
              />
            </HStack>

            <Grid columns={{ minWidth: 220, max: 2, repeat: 'fit' }} gap={3}>
              <Card variant="muted" padding={3}>
                <VStack gap={0.5}>
                  <Text type="supporting" size="xsm" color="secondary">
                    Actor
                  </Text>
                  <Text size="sm" weight="semibold" color="primary">
                    {inspectingAudit.actorUsername} ({inspectingAudit.actorRole})
                  </Text>
                </VStack>
              </Card>
              <Card variant="muted" padding={3}>
                <VStack gap={0.5}>
                  <Text type="supporting" size="xsm" color="secondary">
                    Target
                  </Text>
                  <Text size="sm" weight="semibold" color="primary">
                    {[inspectingAudit.targetType, inspectingAudit.targetLabel, inspectingAudit.targetId]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </Text>
                </VStack>
              </Card>
            </Grid>

            {inspectingAudit.rationale && (
              <Card variant="muted" padding={3}>
                <VStack gap={1}>
                  <Text type="supporting" size="xsm" color="secondary">
                    Operator Rationale
                  </Text>
                  <Text size="sm" color="primary">
                    {inspectingAudit.rationale}
                  </Text>
                </VStack>
              </Card>
            )}

            {inspectingAudit.errorMessage && (
              <Banner
                status="error"
                title="Failure Diagnostic"
                description={inspectingAudit.errorMessage}
                collapsible={false}
              />
            )}

            {(inspectingAudit.beforeState || inspectingAudit.afterState) && (
              <Grid columns={{ minWidth: 240, max: 2, repeat: 'fit' }} gap={3}>
                {inspectingAudit.beforeState && (
                  <Card variant="muted" padding={3}>
                    <VStack gap={1}>
                      <Text type="supporting" size="xsm" color="secondary">
                        Before State
                      </Text>
                      <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(inspectingAudit.beforeState, null, 2)}
                      </pre>
                    </VStack>
                  </Card>
                )}
                {inspectingAudit.afterState && (
                  <Card variant="muted" padding={3}>
                    <VStack gap={1}>
                      <Text type="supporting" size="xsm" color="secondary">
                        After State
                      </Text>
                      <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(inspectingAudit.afterState, null, 2)}
                      </pre>
                    </VStack>
                  </Card>
                )}
              </Grid>
            )}

            <HStack justify="end">
              <Button variant="primary" label="Close" onClick={() => setInspectingAudit(null)} />
            </HStack>
          </VStack>
        )}
      </Dialog>

      {/* Sensitive Action Authorization Modal */}
      <SensitiveActionModal
        isOpen={pendingAction !== null}
        title={pendingAction?.title || 'Authorize Security Action'}
        description={pendingAction?.description || ''}
        targetLabel={pendingAction?.targetLabel}
        targetSummary={pendingAction?.targetSummary}
        severity={pendingAction?.severity || 'HIGH'}
        actionLabel={pendingAction?.actionLabel || 'Confirm Action'}
        requireKeyword={pendingAction?.requireKeyword}
        onCancel={() => setPendingAction(null)}
        onConfirm={async (rationale) => {
          if (!pendingAction) return;
          await pendingAction.execute(rationale);
          setPendingAction(null);
        }}
      />
    </ConsolePage>
  );
};
