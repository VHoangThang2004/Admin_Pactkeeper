import type {
  AdminPermissionKey,
  AuditLogSeverity,
  CounselRole,
  RoleDefinition,
} from '../types';

export interface PermissionDescriptor {
  key: AdminPermissionKey;
  label: string;
  group:
    | 'Command & Infrastructure'
    | 'Players & Treasury'
    | 'Matches & Diagnostics'
    | 'Balance & Releases'
    | 'Gacha & Content CMS'
    | 'PayOS Finance'
    | 'Player Support'
    | 'Security & Governance';
  description: string;
  risk: AuditLogSeverity;
}

export const PERMISSION_CATALOG: PermissionDescriptor[] = [
  {
    key: 'dashboard.view',
    label: 'View System & Realm Telemetry',
    group: 'Command & Infrastructure',
    description: 'Inspect CCU counters, active NGO node status, and server metrics.',
    risk: 'LOW',
  },
  {
    key: 'server.killswitch',
    label: 'Execute Server Killswitches',
    group: 'Command & Infrastructure',
    description: 'Toggle Login Block, Matchmaking Queue Block, or Force Stop All matches.',
    risk: 'CRITICAL',
  },
  {
    key: 'players.view',
    label: 'Inspect Player Directory',
    group: 'Players & Treasury',
    description: 'Search unified player rosters, wallet balances, and presence.',
    risk: 'LOW',
  },
  {
    key: 'players.ban',
    label: 'Enforce Ban / Unban Sanctions',
    group: 'Players & Treasury',
    description: 'Suspend or restore player accounts with mandatory violation rationale.',
    risk: 'HIGH',
  },
  {
    key: 'treasury.adjust',
    label: 'Adjust Player Gold & Gems',
    group: 'Players & Treasury',
    description: 'Credit or deduct player currency balances for compensation or audits.',
    risk: 'CRITICAL',
  },
  {
    key: 'matches.view',
    label: 'Supervise Live & Past Matches',
    group: 'Matches & Diagnostics',
    description: 'Inspect match rosters, duration, and active combat state.',
    risk: 'LOW',
  },
  {
    key: 'matches.logs',
    label: 'Inspect Dedicated Server Logs',
    group: 'Matches & Diagnostics',
    description: 'Stream and filter VPS NGO battle logs for crash/desync diagnostics.',
    risk: 'MEDIUM',
  },
  {
    key: 'balance.view',
    label: 'View Balance Telemetry & AI Advisor',
    group: 'Balance & Releases',
    description: 'Inspect winrate, pickrate, damage telemetry, AI balance suggestions, and active client version.',
    risk: 'LOW',
  },
  {
    key: 'balance.manage',
    label: 'Publish Game Versions & Releases',
    group: 'Balance & Releases',
    description: 'Trigger AI balance reports and publish latest/min supported game versions & patch notes.',
    risk: 'CRITICAL',
  },
  {
    key: 'gacha.manage',
    label: 'Orchestrate Gacha Banners',
    group: 'Gacha & Content CMS',
    description: 'Create summon banners, configure pity rates, and toggle live windows.',
    risk: 'HIGH',
  },
  {
    key: 'content.manage',
    label: 'Edit SRPG Game Definitions',
    group: 'Gacha & Content CMS',
    description: 'Create, edit, and delete Units, Weapons, Trinkets, Chapters, Classes, Skills.',
    risk: 'HIGH',
  },
  {
    key: 'payments.view',
    label: 'View PayOS Revenue Ledger',
    group: 'PayOS Finance',
    description: 'Inspect VND revenue KPIs, charts, receipts, and export payment CSV.',
    risk: 'MEDIUM',
  },
  {
    key: 'payments.manage',
    label: 'Toggle Top-Up Pack Availability',
    group: 'PayOS Finance',
    description: 'Enable or hide storefront crystal packs and bundles on the top-up portal.',
    risk: 'HIGH',
  },
  {
    key: 'support.chat',
    label: 'Operate Player Support Desk',
    group: 'Player Support',
    description: 'Reply to live player tickets over the SignalR /hubs/support channel.',
    risk: 'LOW',
  },
  {
    key: 'security.accounts',
    label: 'Manage Counsel Admin Accounts',
    group: 'Security & Governance',
    description: 'Create, lock/unlock, reset passwords, and revoke sessions for staff.',
    risk: 'CRITICAL',
  },
  {
    key: 'security.roles',
    label: 'Manage Roles & Permissions',
    group: 'Security & Governance',
    description: 'Define roles and modify RBAC permission matrices.',
    risk: 'CRITICAL',
  },
  {
    key: 'security.audit',
    label: 'Inspect Audit Log & Login History',
    group: 'Security & Governance',
    description: 'Review sensitive action trails, auth events, and export compliance logs.',
    risk: 'HIGH',
  },
];

const ALL_PERMISSIONS: AdminPermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description:
      'High Counsel sovereign authority across treasury, accounts, security governance, game content, and emergency controls.',
    permissions: ALL_PERMISSIONS,
    isSystemDefault: true,
    source: 'SYSTEM_DEFAULT',
  },
  {
    id: 'role-moderator',
    name: 'Moderator',
    description:
      'Player Moderation specialist managing player directory, profile inspection, match behavior review, and disciplinary sanctions (no server/content config by default; Admin may assign extra permissions).',
    permissions: [
      'players.view',
      'players.ban',
      'matches.view',
      'balance.view',
    ],
    isSystemDefault: true,
    source: 'SYSTEM_DEFAULT',
  },
  {
    id: 'role-tech-support',
    name: 'Technical Support',
    description:
      'Technical Operations specialist monitoring infrastructure status, dedicated match diagnostics, emergency overrides, and live player support.',
    permissions: [
      'dashboard.view',
      'server.killswitch',
      'matches.view',
      'matches.logs',
      'support.chat',
    ],
    isSystemDefault: true,
    source: 'SYSTEM_DEFAULT',
  },
];

export function resolveDefaultRolePermissions(role: CounselRole | string): AdminPermissionKey[] {
  const lower = role.trim().toLowerCase();
  if (lower === 'admin' || lower === 'server') {
    return ALL_PERMISSIONS;
  }
  if (lower === 'moderator' || lower === 'mod') {
    return DEFAULT_ROLE_DEFINITIONS[1].permissions;
  }
  if (
    lower === 'technical support' ||
    lower === 'technicalsupport' ||
    lower === 'techsupport' ||
    lower === 'support' ||
    lower === 'cskh'
  ) {
    return DEFAULT_ROLE_DEFINITIONS[2].permissions;
  }
  return [];
}

export function hasPermission(
  role: CounselRole | string,
  permission: AdminPermissionKey,
  explicitPermissions?: AdminPermissionKey[] | null
): boolean {
  const lower = role.trim().toLowerCase();
  if (lower === 'admin' || lower === 'server') return true;
  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions.includes(permission);
  }
  return resolveDefaultRolePermissions(role).includes(permission);
}

export function hasAnyPermission(
  role: CounselRole | string,
  requiredPermissions: AdminPermissionKey[],
  explicitPermissions?: AdminPermissionKey[] | null
): boolean {
  return requiredPermissions.some((perm) => hasPermission(role, perm, explicitPermissions));
}

const LANDING_ROUTE_ORDER: Array<{ path: string; permissions: AdminPermissionKey[] }> = [
  { path: '/', permissions: ['dashboard.view'] },
  { path: '/players', permissions: ['players.view'] },
  { path: '/matches', permissions: ['matches.view'] },
  { path: '/balance', permissions: ['balance.view', 'balance.manage'] },
  { path: '/support', permissions: ['support.chat'] },
  { path: '/gacha', permissions: ['gacha.manage'] },
  { path: '/content', permissions: ['content.manage'] },
  { path: '/payments', permissions: ['payments.view'] },
  { path: '/security', permissions: ['security.accounts', 'security.roles', 'security.audit'] },
];

export function getDefaultLandingPath(
  role: CounselRole | string,
  explicitPermissions?: AdminPermissionKey[] | null
): string {
  const lower = role.trim().toLowerCase();
  if (lower === 'moderator' || lower === 'mod') {
    if (hasPermission(role, 'players.view', explicitPermissions)) {
      return '/players';
    }
  } else if (
    lower === 'admin' ||
    lower === 'server' ||
    lower === 'technical support' ||
    lower === 'technicalsupport' ||
    lower === 'techsupport' ||
    lower === 'support' ||
    lower === 'cskh'
  ) {
    if (hasPermission(role, 'dashboard.view', explicitPermissions)) {
      return '/';
    }
  }

  for (const candidate of LANDING_ROUTE_ORDER) {
    if (hasAnyPermission(role, candidate.permissions, explicitPermissions)) {
      return candidate.path;
    }
  }
  return '/login';
}
