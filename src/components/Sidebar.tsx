import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  SideNav,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import {
  Award,
  CreditCard,
  Database,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Scale,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import type { AdminPermissionKey } from '../types';
import { hasAnyPermission } from '../utils/permissions';

interface SidebarProps {
  role: string;
  permissions: AdminPermissionKey[];
  onLogout: () => void;
}

interface NavItemDef {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissions: AdminPermissionKey[];
  group: 'operations' | 'liveops' | 'governance';
}

const NAV_ITEMS: NavItemDef[] = [
  {
    path: '/',
    label: 'Dashboard Overview',
    icon: LayoutDashboard,
    permissions: ['dashboard.view'],
    group: 'operations',
  },
  {
    path: '/players',
    label: 'Player Management',
    icon: Users,
    permissions: ['players.view'],
    group: 'operations',
  },
  {
    path: '/matches',
    label: 'Match Supervision',
    icon: Swords,
    permissions: ['matches.view'],
    group: 'operations',
  },
  {
    path: '/support',
    label: 'Live Support Desk',
    icon: LifeBuoy,
    permissions: ['support.chat'],
    group: 'operations',
  },
  {
    path: '/balance',
    label: 'Balance & Releases',
    icon: Scale,
    permissions: ['balance.view', 'balance.manage'],
    group: 'liveops',
  },
  {
    path: '/rewards',
    label: 'Quests & Rewards',
    icon: Award,
    permissions: ['rewards.view', 'rewards.manage'],
    group: 'liveops',
  },
  {
    path: '/gacha',
    label: 'Gacha & Banners',
    icon: Sparkles,
    permissions: ['gacha.manage'],
    group: 'liveops',
  },
  {
    path: '/content',
    label: 'Game Content Codex',
    icon: Database,
    permissions: ['content.manage'],
    group: 'liveops',
  },
  {
    path: '/payments',
    label: 'PayOS & Top-Up Vault',
    icon: CreditCard,
    permissions: ['payments.view'],
    group: 'liveops',
  },
  {
    path: '/security',
    label: 'Security & RBAC',
    icon: ShieldAlert,
    permissions: ['security.accounts', 'security.roles', 'security.audit'],
    group: 'governance',
  },
];

function getRoleDeskLabel(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes('mod')) return 'Moderator Desk';
  if (normalized.includes('tech') || normalized.includes('support')) return 'Technical Support';
  if (normalized.includes('finance') || normalized.includes('auditor')) return 'Finance Counsel';
  return 'High Counsel';
}

function getRoleBadgeVariant(role: string): 'yellow' | 'cyan' | 'purple' | 'blue' {
  const normalized = role.toLowerCase();
  if (normalized.includes('mod')) return 'cyan';
  if (normalized.includes('tech') || normalized.includes('support')) return 'purple';
  if (normalized.includes('finance')) return 'blue';
  return 'yellow';
}

export const Sidebar: React.FC<SidebarProps> = ({ role, permissions, onLogout }) => {
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((item) =>
    hasAnyPermission(role, item.permissions, permissions)
  );
  const opItems = visibleItems.filter((item) => item.group === 'operations');
  const liveOpsItems = visibleItems.filter((item) => item.group === 'liveops');
  const govItems = visibleItems.filter((item) => item.group === 'governance');

  const isRouteActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <SideNav
      aria-label="Admin Portal Navigation"
      topContent={
        <HStack vAlign="center" justify="between" gap={2} className="px-1 py-0.5">
          <Text type="supporting" size="sm" weight="medium" color="secondary">
            Role
          </Text>
          <Badge variant={getRoleBadgeVariant(role)} label={getRoleDeskLabel(role)} />
        </HStack>
      }
      footer={
        <VStack gap={2}>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-card)] px-3 py-2.5">
            <HStack gap={2} vAlign="center" justify="between">
              <HStack gap={1.5} vAlign="center">
                <StatusDot variant="success" label="Realm cluster live" isPulsing />
                <Text type="supporting" size="sm" weight="semibold" color="primary">
                  Cluster Live
                </Text>
              </HStack>
              <Text type="code" size="sm" color="secondary">
                :7777
              </Text>
            </HStack>
          </div>

          <Button
            variant="ghost"
            size="sm"
            width="100%"
            label="Sign Out"
            icon={<Icon icon={LogOut} />}
            onClick={onLogout}
          />
        </VStack>
      }
    >
      {opItems.length > 0 && (
        <SideNavSection title="Command Operations">
          {opItems.map((item) => (
            <SideNavItem
              key={item.path}
              label={item.label}
              icon={item.icon}
              href={item.path}
              isSelected={isRouteActive(item.path)}
            />
          ))}
        </SideNavSection>
      )}

      {liveOpsItems.length > 0 && (
        <SideNavSection title="LiveOps & Economy">
          {liveOpsItems.map((item) => (
            <SideNavItem
              key={item.path}
              label={item.label}
              icon={item.icon}
              href={item.path}
              isSelected={isRouteActive(item.path)}
            />
          ))}
        </SideNavSection>
      )}

      {govItems.length > 0 && (
        <SideNavSection title="Governance">
          {govItems.map((item) => (
            <SideNavItem
              key={item.path}
              label={item.label}
              icon={item.icon}
              href={item.path}
              isSelected={isRouteActive(item.path)}
            />
          ))}
        </SideNavSection>
      )}
    </SideNav>
  );
};

export default Sidebar;
