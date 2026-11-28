import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CreditCard,
  Database,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Moon,
  Rows2,
  Rows3,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Sun,
  Swords,
  Users,
  CornerDownLeft,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { WEB_TOPUP_URL } from '../../constants/links';
import { useWorkspacePrefs } from '../../context/WorkspacePrefsContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { AdminPermissionKey } from '../../types';
import { hasAnyPermission } from '../../utils/permissions';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  permissions: AdminPermissionKey[];
  onOpenChangePassword: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  group: 'Navigation' | 'Quick Actions';
  icon: typeof LayoutDashboard;
  badge?: string;
  keywords: string;
  action: () => void;
}

/**
 * Global Ctrl+K Command Palette for rapid RBAC-aware navigation and actions.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  role,
  permissions,
  onOpenChangePassword,
}) => {
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const { density, toggleDensity, ambientFx, toggleAmbientFx } = useWorkspacePrefs();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allItems = useMemo<CommandItem[]>(() => {
    const navDefs: Array<{
      id: string;
      path: string;
      label: string;
      description: string;
      icon: typeof LayoutDashboard;
      perms: AdminPermissionKey[];
      keywords: string;
    }> = [
      {
        id: 'nav-dashboard',
        path: '/',
        label: 'Dashboard Overview',
        description: 'Live telemetry, concurrency, PayOS summary & realm overrides',
        icon: LayoutDashboard,
        perms: ['dashboard.view'],
        keywords: 'home overview ccu telemetry server status',
      },
      {
        id: 'nav-players',
        path: '/players',
        label: 'Player Management',
        description: 'Inspect traveler profiles, currencies, story progress & sanctions',
        icon: Users,
        perms: ['players.view'],
        keywords: 'users accounts ban gems gold profile',
      },
      {
        id: 'nav-matches',
        path: '/matches',
        label: 'Match Supervision',
        description: 'Active PvP sessions, match directory & VPS combat logs',
        icon: Swords,
        perms: ['matches.view'],
        keywords: 'battle pvp logs terminal combat ngo',
      },
      {
        id: 'nav-support',
        path: '/support',
        label: 'Live Support Desk',
        description: 'Real-time SignalR player support chat & triage replies',
        icon: LifeBuoy,
        perms: ['support.chat'],
        keywords: 'chat helpdesk ticket missive',
      },
      {
        id: 'nav-balance',
        path: '/balance',
        label: 'Balance & Releases',
        description: 'Combat telemetry, AI Balance Advisor & game version releases',
        icon: Scale,
        perms: ['balance.view', 'balance.manage'],
        keywords: 'ai advisor winrate patch version',
      },
      {
        id: 'nav-rewards',
        path: '/rewards',
        label: 'Quests & Rewards',
        description: 'Manage live quests, milestones, reward grants & rule tester',
        icon: Award,
        perms: ['rewards.view', 'rewards.manage'],
        keywords: 'quests rewards milestones achievements rules tester claim',
      },
      {
        id: 'nav-shops',
        path: '/shops',
        label: 'In-Game Shops',
        description: 'Manage Gem storefronts, event shops, daily hours & item purchase limits',
        icon: Store,
        perms: ['shops.manage'],
        keywords: 'shop store event gem catalog items daily weekly limit',
      },
      {
        id: 'nav-gacha',
        path: '/gacha',
        label: 'Gacha & Banners',
        description: 'Summon rotations, rate-up pools & drop-rate probability audits',
        icon: Sparkles,
        perms: ['gacha.manage'],
        keywords: 'summon pool banner pity rates',
      },
      {
        id: 'nav-content',
        path: '/content',
        label: 'Game Content Codex',
        description: 'Chapters, Hero Units, Weapons, Trinkets, Classes & Skills',
        icon: Database,
        perms: ['content.manage'],
        keywords: 'cms units chapters weapons skills trinkets',
      },
      {
        id: 'nav-payments',
        path: '/payments',
        label: 'PayOS & Top-Up Vault',
        description: 'Settlement ledger, revenue analytics & storefront pack catalog',
        icon: CreditCard,
        perms: ['payments.view'],
        keywords: 'revenue orders topup packs payos treasury',
      },
      {
        id: 'nav-security',
        path: '/security',
        label: 'Security & RBAC',
        description: 'Admin accounts, role permissions matrix, audit log & login history',
        icon: ShieldAlert,
        perms: ['security.accounts', 'security.roles', 'security.audit'],
        keywords: 'rbac roles audit trail login history admin',
      },
    ];

    const visibleNav: CommandItem[] = navDefs
      .filter((item) => hasAnyPermission(role, item.perms, permissions))
      .map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        group: 'Navigation',
        icon: item.icon,
        badge: item.path,
        keywords: item.keywords,
        action: () => {
          navigate(item.path);
          onClose();
        },
      }));

    const quickActions: CommandItem[] = [
      {
        id: 'act-theme',
        label: mode === 'dark' ? 'Switch to Light Mode (Parchment)' : 'Switch to Dark Mode (Obsidian Gold)',
        description: 'Toggle High Counsel visual theme immediately',
        group: 'Quick Actions',
        icon: mode === 'dark' ? Sun : Moon,
        badge: 'Theme',
        keywords: 'theme dark light mode parchment obsidian',
        action: () => {
          toggleMode();
          onClose();
        },
      },
      {
        id: 'act-density',
        label:
          density === 'compact'
            ? 'Switch Table Density to Comfortable'
            : 'Switch Table Density to Compact (High-Density)',
        description: 'Adjust row height and table compactness across all data consoles',
        group: 'Quick Actions',
        icon: density === 'compact' ? Rows2 : Rows3,
        badge: density === 'compact' ? 'Compact' : 'Comfortable',
        keywords: 'density compact comfortable table rows zoom',
        action: () => {
          toggleDensity();
          onClose();
        },
      },
      {
        id: 'act-ambient-fx',
        label: ambientFx
          ? 'Disable Workspace Ambient FX (Clean Mode)'
          : 'Enable Citadel Ambient FX (Embers & Sweep)',
        description: 'Toggle floating golden embers and route light sweep inside the workspace',
        group: 'Quick Actions',
        icon: Sparkles,
        badge: ambientFx ? 'FX: ON' : 'FX: OFF',
        keywords: 'fx embers particles animation atmosphere motion',
        action: () => {
          toggleAmbientFx();
          onClose();
        },
      },
      {
        id: 'act-password',
        label: 'Change Own Passcode',
        description: 'Rotate your current counselor credentials',
        group: 'Quick Actions',
        icon: KeyRound,
        badge: 'Security',
        keywords: 'password passcode credentials security',
        action: () => {
          onClose();
          onOpenChangePassword();
        },
      },
      {
        id: 'act-topup-portal',
        label: 'Open Player Web Top-Up Portal',
        description: 'Launch live SDK_Pactkeeper storefront in a new tab',
        group: 'Quick Actions',
        icon: ExternalLink,
        badge: 'External',
        keywords: 'sdk web topup storefront external',
        action: () => {
          window.open(WEB_TOPUP_URL, '_blank', 'noopener,noreferrer');
          onClose();
        },
      },
    ];

    return [...visibleNav, ...quickActions];
  }, [
    role,
    permissions,
    mode,
    density,
    ambientFx,
    navigate,
    onClose,
    toggleMode,
    toggleDensity,
    toggleAmbientFx,
    onOpenChangePassword,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  const handleClose = () => {
    setQuery('');
    setActiveIndex(0);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        setActiveIndex(0);
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
        );
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        setQuery('');
        setActiveIndex(0);
        filtered[activeIndex].action();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, filtered, activeIndex, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="High Counsel Command Palette"
      onClick={handleClose}
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/65 backdrop-blur-md pt-[10dvh] px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pk-gold-frame pk-corner-frame w-full max-w-xl overflow-hidden rounded-2xl bg-[var(--color-background-card)] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3.5">
          <Icon icon={Search} size="md" color="accent" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to module, action, or setting..."
            className="flex-1 bg-transparent text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none border-0 shadow-none"
          />
          <Badge label="ESC" variant="neutral" />
        </div>

        <div className="max-h-[56dvh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Text type="supporting" size="sm" color="secondary">
                No matching modules or commands for “{query}”.
              </Text>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-overlay-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg pk-icon-emblem flex items-center justify-center shrink-0">
                      <Icon icon={item.icon} size="sm" color={isSelected ? 'accent' : 'secondary'} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.label}</div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && <Badge label={item.badge} variant={isSelected ? 'yellow' : 'neutral'} />}
                    {isSelected && <Icon icon={CornerDownLeft} size="sm" color="accent" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-background-muted)_45%,transparent)] px-4 py-2 text-xs text-[var(--color-text-secondary)]">
          <span>↑↓ Navigate • Enter Open • / Focus Search</span>
          <span className="font-mono">PactKeeper Workbench</span>
        </div>
      </div>
    </div>,
    document.querySelector('[data-astryx-theme]') ?? document.body,
  );
};
