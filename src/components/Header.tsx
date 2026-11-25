import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@astryxdesign/core/TopNav';
import { MobileNavToggle } from '@astryxdesign/core/MobileNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu, type DropdownMenuOption } from '@astryxdesign/core/DropdownMenu';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import {
  Clock,
  ExternalLink,
  KeyRound,
  LogOut,
  Moon,
  Rows2,
  Rows3,
  Search,
  ShieldAlert,
  Sun,
  UserCheck,
} from 'lucide-react';
import { WEB_TOPUP_URL } from '../constants/links';
import { useWorkspacePrefs } from '../context/WorkspacePrefsContext';
import { useThemeMode } from '../hooks/useThemeMode';
import type { AdminPermissionKey } from '../types';
import { hasPermission } from '../utils/permissions';
import ChangePasswordModal from './ChangePasswordModal';
import { CommandPalette } from './ui/CommandPalette';

interface HeaderProps {
  role: string;
  permissions: AdminPermissionKey[];
  adminName: string;
  adminToken?: string;
  onLogout: () => void;
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
  onLogout,
}) => {
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const { density, toggleDensity } = useWorkspacePrefs();
  const isDevEnv = import.meta.env.DEV;

  const [serverTime, setServerTime] = useState<string>(() => formatServerTimeUtc7(new Date()));
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setServerTime(formatServerTimeUtc7(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
      label: 'Sign Out',
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
                className="w-7 h-7 object-contain shrink-0"
              />
              <span className="pk-brand-title pk-gold-text text-base font-bold">
                PACTKEEPER
              </span>
              <Badge
                variant={isDevEnv ? 'yellow' : 'success'}
                label={isDevEnv ? 'DEV' : 'LIVE'}
              />
            </HStack>
          </HStack>
        }
        startContent={
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              label="Search..."
              icon={<Icon icon={Search} size="sm" />}
              endContent={<Badge label="Ctrl+K" variant="neutral" />}
              onClick={() => setIsCommandOpen(true)}
            />
          </div>
        }
        endContent={
          <HStack gap={2} vAlign="center">
            <div className="hidden xl:flex items-center gap-1.5 text-sm font-mono text-[var(--color-text-secondary)] px-1.5">
              <Clock className="w-3.5 h-3.5 opacity-75" />
              <span className="pk-tabular">{serverTime}</span>
            </div>

            <div className="hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                label="Top-Up Portal"
                href={WEB_TOPUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                icon={<Icon icon={ExternalLink} />}
              />
            </div>

            <IconButton
              variant="ghost"
              size="sm"
              label={density === 'compact' ? 'Switch to comfortable density' : 'Switch to compact density'}
              tooltip={density === 'compact' ? 'Density: Compact' : 'Density: Comfortable'}
              icon={<Icon icon={density === 'compact' ? Rows3 : Rows2} />}
              onClick={toggleDensity}
            />

            <IconButton
              variant="ghost"
              size="sm"
              label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              tooltip={mode === 'light' ? 'Dark Mode' : 'Light Mode'}
              icon={<Icon icon={mode === 'light' ? Moon : Sun} />}
              onClick={toggleMode}
            />

            <DropdownMenu
              placement="below"
              alignment="end"
              menuWidth={240}
              button={{
                variant: 'secondary',
                size: 'sm',
                label: adminName || 'Admin',
                icon: <Icon icon={UserCheck} />,
                endContent: <Badge variant={roleMeta.variant} label={roleMeta.label} />,
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

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        role={role}
        permissions={permissions}
        onOpenChangePassword={() => setIsPasswordModalOpen(true)}
      />
    </>
  );
};

export default Header;
