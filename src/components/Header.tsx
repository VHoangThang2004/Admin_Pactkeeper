import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@astryxdesign/core/TopNav';
import { MobileNavToggle } from '@astryxdesign/core/MobileNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu, type DropdownMenuOption } from '@astryxdesign/core/DropdownMenu';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import {
  Clock,
  ExternalLink,
  KeyRound,
  LogOut,
  Moon,
  ShieldAlert,
  Sun,
  UserCheck,
} from 'lucide-react';
import { WEB_TOPUP_URL } from '../constants/links';
import { useThemeMode } from '../hooks/useThemeMode';
import type { AdminPermissionKey } from '../types';
import { hasPermission } from '../utils/permissions';
import ChangePasswordModal from './ChangePasswordModal';

interface HeaderProps {
  role: string;
  permissions: AdminPermissionKey[];
  adminName: string;
  adminToken?: string;
  onLogout: () => void;
}

function resolveSessionToken(providedToken?: string): string {
  if (providedToken) return providedToken;
  try {
    return sessionStorage.getItem('adminToken') || '';
  } catch {
    return '';
  }
}

function getTokenExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof decoded.exp === 'number') {
      return decoded.exp * 1000;
    }
  } catch {
    // Ignore malformed JWT tokens
  }
  return null;
}

function formatRemainingDuration(remainingMs: number): string {
  if (remainingMs <= 0) return 'Expired';
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function formatServerTimeUtc7(now: Date): string {
  return now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRoleMeta(role: string): {
  label: string;
  variant: 'yellow' | 'cyan' | 'purple' | 'blue';
} {
  const normalized = role.toLowerCase();
  if (normalized.includes('mod')) {
    return { label: 'MODERATOR', variant: 'cyan' };
  }
  if (normalized.includes('tech') || normalized.includes('support')) {
    return { label: 'TECH SUPPORT', variant: 'purple' };
  }
  if (normalized.includes('finance')) {
    return { label: 'FINANCE', variant: 'blue' };
  }
  return { label: 'HIGH COUNSEL', variant: 'yellow' };
}

export const Header: React.FC<HeaderProps> = ({
  role,
  permissions,
  adminName,
  adminToken,
  onLogout,
}) => {
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const resolvedToken = resolveSessionToken(adminToken);

  const [serverTime, setServerTime] = useState<string>(() => formatServerTimeUtc7(new Date()));
  const [sessionTtl, setSessionTtl] = useState<string>(() => {
    const exp = getTokenExpiryMs(resolvedToken);
    return exp ? formatRemainingDuration(exp - Date.now()) : 'Active';
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setServerTime(formatServerTimeUtc7(now));
      const token = resolveSessionToken(adminToken);
      const exp = getTokenExpiryMs(token);
      setSessionTtl(exp ? formatRemainingDuration(exp - now.getTime()) : 'Active');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [adminToken]);

  const roleMeta = getRoleMeta(role);
  const canSecurity =
    hasPermission(role, 'security.accounts', permissions) ||
    hasPermission(role, 'security.roles', permissions);

  const accountMenuItems: DropdownMenuOption[] = [
    {
      id: 'change-password',
      label: 'Change Own Passcode',
      description: 'Rotate your counsel credentials',
      icon: KeyRound,
      onClick: () => setIsPasswordModalOpen(true),
    },
    ...(canSecurity
      ? [
          {
            id: 'security-center',
            label: 'Security & Audit Center',
            description: 'Accounts, RBAC & audit trail',
            icon: ShieldAlert,
            onClick: () => navigate('/security'),
          } satisfies DropdownMenuOption,
        ]
      : []),
    { type: 'divider' },
    {
      id: 'sign-out',
      label: 'Exit Counsel (Sign Out)',
      icon: LogOut,
      variant: 'destructive',
      onClick: onLogout,
    },
  ];

  return (
    <>
      <TopNav
        label="PactKeeper Admin Header"
        heading={
          <HStack gap={2} vAlign="center">
            <MobileNavToggle label="Open navigation menu" />
            <HStack gap={2} vAlign="center">
              <img
                src="/logo.png"
                alt="PactKeeper Logo"
                className="pk-brand-logo-nav"
              />
              <div className="flex flex-col leading-tight">
                <Heading level={4} weight="bold" className="font-cinzel pk-gold-text tracking-wider">
                  PACTKEEPER
                </Heading>
                <span className="hidden sm:inline">
                  <Text type="supporting" size="sm" color="secondary">
                    High Counsel Console
                  </Text>
                </span>
              </div>
            </HStack>
          </HStack>
        }
        startContent={
          <div className="hidden md:flex items-center gap-2">
            <Badge
              variant="neutral"
              icon={<Clock className="w-3 h-3" />}
              label={<span className="pk-tabular">{serverTime} UTC+7</span>}
            />
          </div>
        }
        endContent={
          <HStack gap={2} vAlign="center">
            <div className="hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                label="Web Top-Up"
                href={WEB_TOPUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                icon={<Icon icon={ExternalLink} />}
              />
            </div>

            <IconButton
              variant="secondary"
              size="sm"
              label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              tooltip={mode === 'light' ? 'Dark Mode (Obsidian Gold)' : 'Light Mode (Parchment)'}
              icon={<Icon icon={mode === 'light' ? Moon : Sun} />}
              onClick={toggleMode}
            />

            <div className="hidden sm:block">
              <Badge
                variant="neutral"
                label={<span className="pk-tabular">TTL {sessionTtl}</span>}
              />
            </div>

            <div className="hidden md:block">
              <Badge variant={roleMeta.variant} label={roleMeta.label} />
            </div>

            <DropdownMenu
              placement="below"
              alignment="end"
              menuWidth={240}
              button={{
                variant: 'secondary',
                size: 'sm',
                label: adminName || 'Counselor',
                icon: <Icon icon={UserCheck} />,
              }}
              items={accountMenuItems}
            />
          </HStack>
        }
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        username={adminName || 'Admin'}
        role={role}
      />
    </>
  );
};

export default Header;
