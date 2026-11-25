import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  SideNav,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import {
  CreditCard,
  Database,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Scale,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { WEB_TOPUP_URL } from '../constants/links';
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
        <div className="pk-sidebar-brand-card pk-gold-frame p-3">
          <img
            src="/game-assets/mainmenu-bg.jpg"
            alt=""
            aria-hidden="true"
            className="pk-sidebar-brand-bg"
          />
          <div className="relative z-10 flex flex-col gap-2">
            <HStack vAlign="center" gap={2}>
              <img
                src="/logo.png"
                alt="PactKeeper Crest"
                className="w-8 h-8 object-contain shrink-0 drop-shadow"
              />
              <div className="min-w-0">
                <div className="font-cinzel pk-gold-text text-xs font-bold tracking-wider truncate">
                  PACTKEEPER
                </div>
                <Text type="supporting" size="sm" color="secondary" maxLines={1}>
                  Tactical SRPG Realm
                </Text>
              </div>
            </HStack>
            <HStack vAlign="center" justify="between" gap={2}>
              <Text type="supporting" size="sm" weight="semibold" color="secondary">
                COUNCIL TIER
              </Text>
              <Badge variant={getRoleBadgeVariant(role)} label={getRoleDeskLabel(role)} />
            </HStack>
          </div>
        </div>
      }
      footer={
        <VStack gap={3}>
          <Card variant="muted" padding={3} className="pk-gold-frame">
            <VStack gap={1.5}>
              <HStack gap={2} vAlign="center" justify="between">
                <HStack gap={1.5} vAlign="center">
                  <StatusDot variant="success" label="Realm cluster live" isPulsing />
                  <Text type="supporting" size="sm" weight="semibold" color="primary">
                    Realm Cluster Live
                  </Text>
                </HStack>
                <Badge variant="green" label="NGO :7777" />
              </HStack>
              <Text type="supporting" size="sm" color="secondary">
                Role: {role || 'Admin'}
              </Text>
            </VStack>
          </Card>

          <Button
            variant="secondary"
            size="sm"
            width="100%"
            label="Web Top-Up Portal"
            href={WEB_TOPUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            icon={<Icon icon={ExternalLink} />}
          />

          <Button
            variant="destructive"
            size="sm"
            width="100%"
            label="Exit Counsel"
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
