import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownUp,
  Bell,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Eye,
  Gem,
  Inbox,
  Megaphone,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Terminal,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { ConsolePage } from '../components/ConsolePage';
import { KpiSummaryStrip } from '../components/ui/KpiSummaryStrip';
import { ScrollableDataPanel } from '../components/ui/ScrollableDataPanel';
import { PlayerInspectorModal } from '../components/PlayerInspectorModal';
import { adminClient } from '../api/adminClient';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
} from '../services/playerPresenceService';
import type { AdminPermissionKey, CounselRole, PlayerProfile } from '../types';
import { hasPermission } from '../utils/permissions';
import {
  formatTelemetryTimestamp,
  getPlayerPresence,
  isAiOrVirtualPlayerId,
  isAiOrVirtualUsername,
} from '../utils/presence';
import {
  getPresenceBadgeVariant,
  getPresenceDisplayLabel,
  getPresenceStatusDotVariant,
} from '../utils/presenceAstryx';

interface PlayerManagementProps {
  role?: CounselRole;
  permissions?: AdminPermissionKey[];
}

type PresenceFilter = 'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE' | 'BANNED';
type PlayerSortOrder = 'PRESENCE' | 'GEMS_DESC' | 'GOLD_DESC' | 'LEVEL_DESC' | 'NAME_ASC';
type PageSizeOption = '20' | '50' | 'ALL';
type BanDuration = 'TEMPORARY_24H' | 'TEMPORARY_7D' | 'PERMANENT';
type NotificationTypeOption = 'Warning' | 'Moderation' | 'System' | 'Announcement';
type NotificationExpiryOption = 'NEVER' | '24H' | '7D' | '30D';
type PlayerTableRow = PlayerProfile & Record<string, unknown>;

const NOTIFICATION_TYPE_OPTIONS = [
  { value: 'Warning', label: 'Warning (Disciplinary Alert)' },
  { value: 'Moderation', label: 'Moderation Notice' },
  { value: 'System', label: 'System Notification' },
  { value: 'Announcement', label: 'Realm Announcement' },
];

const NOTIFICATION_EXPIRY_OPTIONS = [
  { value: 'NEVER', label: 'No Expiration' },
  { value: '24H', label: 'Expires in 24 Hours' },
  { value: '7D', label: 'Expires in 7 Days' },
  { value: '30D', label: 'Expires in 30 Days' },
];

const NOTIFICATION_PRESETS: Array<{
  label: string;
  type: NotificationTypeOption;
  title: string;
  message: string;
}> = [
  {
    label: 'AFK / Match Warning',
    type: 'Warning',
    title: 'Match Conduct Warning',
    message:
      'Our moderation team detected repeated match abandonment or AFK behavior on your account. Further violations may result in a temporary suspension.',
  },
  {
    label: 'Fair Play Reminder',
    type: 'Moderation',
    title: 'Fair Play Policy Reminder',
    message:
      'Please ensure your gameplay complies with PactKeeper community & combat integrity guidelines.',
  },
  {
    label: 'Maintenance Notice',
    type: 'System',
    title: 'Scheduled Realm Maintenance',
    message:
      'Realm servers will undergo brief scheduled maintenance soon. Please complete active battles beforehand.',
  },
];

const BAN_DURATION_OPTIONS = [
  { value: 'TEMPORARY_24H', label: 'Temporary Suspension (24 Hours)' },
  { value: 'TEMPORARY_7D', label: 'Extended Suspension (7 Days)' },
  { value: 'PERMANENT', label: 'Permanent Account Ban' },
];

const SORT_OPTIONS: { value: PlayerSortOrder; label: string }[] = [
  { value: 'PRESENCE', label: 'Sort: Presence Priority' },
  { value: 'GEMS_DESC', label: 'Sort: Most Gems' },
  { value: 'GOLD_DESC', label: 'Sort: Most Gold' },
  { value: 'LEVEL_DESC', label: 'Sort: Highest Level' },
  { value: 'NAME_ASC', label: 'Sort: Name (A–Z)' },
];

export const PlayerManagement: React.FC<PlayerManagementProps> = ({
  role = 'Admin',
  permissions,
}) => {
  const [searchParams] = useSearchParams();
  const querySearch = searchParams.get('search') || '';
  const [prevQuerySearch, setPrevQuerySearch] = useState(querySearch);

  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('ALL');
  const [sortBy, setSortBy] = useState<PlayerSortOrder>('PRESENCE');
  const [pageSize, setPageSize] = useState<PageSizeOption>('20');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [newPlayerIdInput, setNewPlayerIdInput] = useState('');
  const [inspectPlayer, setInspectPlayer] = useState<PlayerProfile | null>(null);

  if (querySearch !== prevQuerySearch) {
    setPrevQuerySearch(querySearch);
    setSearchTerm(querySearch);
    setCurrentPage(1);
  }

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [adjustGems, setAdjustGems] = useState<number>(0);
  const [adjustGold, setAdjustGold] = useState<number>(0);
  const [compensationReason, setCompensationReason] = useState<string>('');

  const [banTargetPlayer, setBanTargetPlayer] = useState<PlayerProfile | null>(null);
  const [banReason, setBanReason] = useState<string>('');
  const [banDuration, setBanDuration] = useState<BanDuration>('PERMANENT');

  const [unbanTargetPlayer, setUnbanTargetPlayer] = useState<PlayerProfile | null>(null);

  const [notifyTarget, setNotifyTarget] = useState<'GLOBAL' | PlayerProfile | null>(null);
  const [notifyType, setNotifyType] = useState<NotificationTypeOption>('Warning');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyExpiry, setNotifyExpiry] = useState<NotificationExpiryOption>('7D');
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifySubmitting, setNotifySubmitting] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const unified = await fetchUnifiedPlayerData();
      setPlayers(unified.players);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchUnifiedPlayerData()
      .then((unified) => {
        if (active) setPlayers(unified.players);
      })
      .catch(() => {
        // Graceful fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToUnifiedPresence((data) => {
      if (active) setPlayers(data.players);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleAddPlayerById = async () => {
    if (!newPlayerIdInput.trim()) return;
    const targetId = newPlayerIdInput.trim();

    try {
      setLoading(true);
      const res = await adminClient.get(`/player/profile/${targetId}`);
      if (res.data) {
        const d = res.data;
        const rawIsOnline = d.isOnline ?? d.IsOnline;
        const rawPresenceStatus = d.presenceStatus ?? d.PresenceStatus;
        const presenceInfo = getPlayerPresence(targetId, new Map(), d.lastLogin, {
          isOnlineExplicit:
            typeof rawIsOnline === 'boolean' ? rawIsOnline : undefined,
          realtimeStatus:
            typeof rawPresenceStatus === 'string'
              ? rawPresenceStatus.toLowerCase()
              : undefined,
        });
        const newP: PlayerProfile = {
          playerId: targetId,
          username: d.username || d.playerName || `Wanderer #${targetId.slice(-4).toUpperCase()}`,
          level: d.level ?? 1,
          experience: d.experience ?? 0,
          gold: d.gold ?? 0,
          gems: d.gems ?? 0,
          lastLogin: d.lastLogin ? new Date(d.lastLogin).toLocaleString() : new Date().toLocaleString(),
          isBanned: Boolean(d.isBanned),
          isOnline: typeof rawIsOnline === 'boolean' ? rawIsOnline : undefined,
          presenceStatus:
            typeof rawPresenceStatus === 'string' ? rawPresenceStatus.toLowerCase() : undefined,
          presence: presenceInfo.state,
          presenceDetails: presenceInfo.activityDescription,
          presenceInfo,
        };
        setPlayers((prev) => [newP, ...prev.filter((p) => p.playerId !== targetId)]);
        setNewPlayerIdInput('');
        setNotification(`Loaded player profile for "${newP.username}" from Database.`);
      }
    } catch {
      const fallbackP: PlayerProfile = {
        playerId: targetId,
        username: `Wanderer #${targetId.slice(-4).toUpperCase()}`,
        level: 1,
        experience: 0,
        gold: 0,
        gems: 0,
        lastLogin: new Date().toLocaleString(),
        isBanned: false,
        presence: 'Offline',
      };
      setPlayers((prev) => [fallbackP, ...prev.filter((p) => p.playerId !== targetId)]);
      setNewPlayerIdInput('');
      setNotification(`Added placeholder for Player ID "${targetId}".`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedPlayer) return;
    const finalReason = compensationReason.trim() || 'Admin Manual Treasury Adjustment';
    const isLargeDelta = Math.abs(adjustGems) >= 10000 || Math.abs(adjustGold) >= 100000;
    setModalError(null);
    setSubmitting(true);
    try {
      await adminClient.post(`/player/adjust-currencies`, {
        playerId: selectedPlayer.playerId,
        gems: adjustGems,
        gold: adjustGold,
        reason: finalReason,
      });
      void recordAuditEvent({
        action: 'PLAYER_CURRENCY_ADJUSTED',
        category: 'TREASURY',
        severity: isLargeDelta ? 'CRITICAL' : 'HIGH',
        targetType: 'PlayerAccount',
        targetId: selectedPlayer.playerId,
        targetLabel: selectedPlayer.username,
        rationale: finalReason,
        beforeState: { gems: selectedPlayer.gems ?? 0, gold: selectedPlayer.gold ?? 0 },
        afterState: { deltaGems: adjustGems, deltaGold: adjustGold },
      });
      setNotification(
        `Successfully adjusted currencies for ${selectedPlayer.username} (${adjustGems >= 0 ? '+' : ''}${adjustGems} Gems, ${adjustGold >= 0 ? '+' : ''}${adjustGold} Gold).`
      );
      setSelectedPlayer(null);
      setAdjustGems(0);
      setAdjustGold(0);
      setCompensationReason('');
      fetchPlayers();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to apply currency adjustments.';
      void recordAuditEvent({
        action: 'PLAYER_CURRENCY_ADJUST_FAILED',
        category: 'TREASURY',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: selectedPlayer.playerId,
        targetLabel: selectedPlayer.username,
        rationale: finalReason,
        status: 'FAILED',
        errorMessage: msg,
      });
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmBan = async () => {
    if (!banTargetPlayer) return;
    if (!banReason.trim()) {
      setModalError(
        'Violation rationale is required to enforce an authoritative disciplinary sanction.'
      );
      return;
    }
    setModalError(null);
    setSubmitting(true);
    try {
      await adminClient.post(`/player/ban`, {
        playerId: banTargetPlayer.playerId,
        duration: banDuration,
        reason: banReason.trim(),
      });
      void recordAuditEvent({
        action: 'PLAYER_BANNED',
        category: 'PLAYER',
        severity: banDuration === 'PERMANENT' ? 'CRITICAL' : 'HIGH',
        targetType: 'PlayerAccount',
        targetId: banTargetPlayer.playerId,
        targetLabel: banTargetPlayer.username,
        rationale: banReason.trim(),
        beforeState: { isBanned: Boolean(banTargetPlayer.isBanned) },
        afterState: { isBanned: true, duration: banDuration },
      });
      setNotification(
        `Account sanction enforced against ${banTargetPlayer.username} (${banDuration}) for: "${banReason.trim()}".`
      );
      setBanTargetPlayer(null);
      setBanReason('');
      fetchPlayers();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to enforce disciplinary ban.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmUnban = async () => {
    if (!unbanTargetPlayer) return;
    setModalError(null);
    setSubmitting(true);
    try {
      await adminClient.post(`/player/unban`, {
        playerId: unbanTargetPlayer.playerId,
      });
      void recordAuditEvent({
        action: 'PLAYER_UNBANNED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: unbanTargetPlayer.playerId,
        targetLabel: unbanTargetPlayer.username,
        rationale: 'Account sanction lifted via Player Directory',
        beforeState: { isBanned: true },
        afterState: { isBanned: false },
      });
      setNotification(`Account access successfully restored for ${unbanTargetPlayer.username}.`);
      setUnbanTargetPlayer(null);
      fetchPlayers();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to restore player account.');
    } finally {
      setSubmitting(false);
    }
  };

  const openNotifyModal = (target: 'GLOBAL' | PlayerProfile) => {
    setNotifyTarget(target);
    setNotifyType(target === 'GLOBAL' ? 'Announcement' : 'Warning');
    setNotifyTitle('');
    setNotifyMessage('');
    setNotifyExpiry('7D');
    setNotifyError(null);
  };

  const handleSendNotification = async () => {
    if (!notifyTarget) return;
    if (!notifyTitle.trim()) {
      setNotifyError('Notification title is required.');
      return;
    }
    if (!notifyMessage.trim()) {
      setNotifyError('Notification message body is required.');
      return;
    }

    let expiresAt: string | null = null;
    if (notifyExpiry !== 'NEVER') {
      const hours = notifyExpiry === '24H' ? 24 : notifyExpiry === '7D' ? 24 * 7 : 24 * 30;
      expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    }

    const targetPlayerId = notifyTarget === 'GLOBAL' ? null : notifyTarget.playerId;
    const targetLabel =
      notifyTarget === 'GLOBAL' ? 'All Players (Global Broadcast)' : notifyTarget.username;

    setNotifyError(null);
    setNotifySubmitting(true);
    try {
      await adminClient.post('/game-notification', {
        playerId: targetPlayerId,
        type: notifyType,
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
        expiresAt,
      });
      void recordAuditEvent({
        action:
          notifyTarget === 'GLOBAL'
            ? 'GLOBAL_NOTIFICATION_BROADCAST'
            : notifyType === 'Warning'
              ? 'PLAYER_WARNING_SENT'
              : 'PLAYER_NOTIFICATION_SENT',
        category: 'PLAYER',
        severity: notifyType === 'Warning' ? 'HIGH' : 'MEDIUM',
        targetType: notifyTarget === 'GLOBAL' ? 'RealmBroadcast' : 'PlayerAccount',
        targetId: targetPlayerId || undefined,
        targetLabel,
        rationale: `${notifyType}: ${notifyTitle.trim()}`,
        afterState: {
          type: notifyType,
          title: notifyTitle.trim(),
          expiresAt,
        },
      });
      setNotification(
        notifyTarget === 'GLOBAL'
          ? `Broadcast announcement "${notifyTitle.trim()}" dispatched to all players.`
          : `Sent ${notifyType.toLowerCase()} "${notifyTitle.trim()}" to ${notifyTarget.username}.`
      );
      setNotifyTarget(null);
    } catch (err: any) {
      setNotifyError(
        err.response?.data?.message ||
          'Failed to dispatch game notification. Verify role permissions on /api/game-notification.'
      );
    } finally {
      setNotifySubmitting(false);
    }
  };

  const validPlayers = useMemo(() => {
    return players.filter(
      (p) => !isAiOrVirtualPlayerId(p.playerId) && !isAiOrVirtualUsername(p.username)
    );
  }, [players]);

  const presenceCounts = useMemo(() => {
    let online = 0;
    let battle = 0;
    let offline = 0;
    let banned = 0;
    for (const p of validPlayers) {
      if (p.isBanned) banned += 1;
      if (p.presence === 'Online') online += 1;
      else if (p.presence === 'InBattle') battle += 1;
      else offline += 1;
    }
    return { online, battle, offline, banned };
  }, [validPlayers]);

  const sortedPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = validPlayers.filter((p) => {
      const matchesSearch =
        !q || p.username.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (presenceFilter === 'ONLINE') return p.presence === 'Online';
      if (presenceFilter === 'BATTLE') return p.presence === 'InBattle';
      if (presenceFilter === 'OFFLINE') return p.presence === 'Offline';
      if (presenceFilter === 'BANNED') return Boolean(p.isBanned);
      return true;
    });

    const presenceRank = (p: PlayerProfile) =>
      p.presence === 'InBattle' ? 0 : p.presence === 'Online' ? 1 : 2;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'GEMS_DESC':
          return (b.gems ?? 0) - (a.gems ?? 0) || a.username.localeCompare(b.username);
        case 'GOLD_DESC':
          return (b.gold ?? 0) - (a.gold ?? 0) || a.username.localeCompare(b.username);
        case 'LEVEL_DESC':
          return (
            b.level - a.level ||
            (b.experience ?? 0) - (a.experience ?? 0) ||
            a.username.localeCompare(b.username)
          );
        case 'NAME_ASC':
          return a.username.localeCompare(b.username);
        case 'PRESENCE':
        default:
          return (
            presenceRank(a) - presenceRank(b) ||
            a.username.localeCompare(b.username)
          );
      }
    });
  }, [validPlayers, searchTerm, presenceFilter, sortBy]);

  const numericPageSize = pageSize === 'ALL' ? Math.max(sortedPlayers.length, 1) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / numericPageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedPlayers = useMemo(() => {
    if (pageSize === 'ALL') return sortedPlayers;
    const start = (safePage - 1) * numericPageSize;
    return sortedPlayers.slice(start, start + numericPageSize);
  }, [sortedPlayers, pageSize, safePage, numericPageSize]);

  const pageStart = sortedPlayers.length === 0 ? 0 : (safePage - 1) * numericPageSize + 1;
  const pageEnd =
    pageSize === 'ALL'
      ? sortedPlayers.length
      : Math.min(safePage * numericPageSize, sortedPlayers.length);

  const handleExportCsv = () => {
    const headers = ['playerId', 'username', 'level', 'exp', 'gold', 'gems', 'presence', 'isBanned', 'matchId'];
    const escapeCell = (val: unknown) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const csvRows = [
      headers.join(','),
      ...sortedPlayers.map((p) =>
        [
          p.playerId,
          p.username,
          p.level,
          p.experience ?? 0,
          p.gold ?? 0,
          p.gems ?? 0,
          p.presence || 'Offline',
          Boolean(p.isBanned),
          p.activeMatch?.matchId || '',
        ]
          .map(escapeCell)
          .join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pactkeeper-players-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canAdjustTreasury = hasPermission(role, 'treasury.adjust', permissions);
  const canBanPlayers = hasPermission(role, 'players.ban', permissions);
  const canSendNotification = canBanPlayers || role === 'Admin' || role === 'Server' || role === 'Moderator';
  const canBroadcast = role === 'Admin' || role === 'Server';
  const canInspectLogs =
    hasPermission(role, 'matches.logs', permissions) ||
    hasPermission(role, 'matches.view', permissions);

  const columns: TableColumn<PlayerTableRow>[] = [
    {
      key: 'account',
      header: 'Player Account',
      width: proportional(2, { minWidth: 230 }),
      renderCell: (player) => (
        <VStack gap={0.5}>
          <HStack gap={2} vAlign="center">
            <Text weight="semibold" size="sm">
              {player.username}
            </Text>
            <StatusDot
              variant={getPresenceStatusDotVariant(player.presence || 'Offline', player.isBanned)}
              isPulsing={player.presence !== 'Offline' && !player.isBanned}
              label={player.presence || 'Offline'}
            />
          </HStack>
          <HStack gap={1} vAlign="center">
            <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
              Ref: #{player.playerId.slice(-6).toUpperCase()}
            </Text>
            <IconButton
              label={`Copy Player ID for ${player.username}`}
              tooltip={`Copy: ${player.playerId}`}
              variant="ghost"
              size="sm"
              icon={<Icon icon={Copy} />}
              onClick={() => {
                navigator.clipboard.writeText(player.playerId);
                setNotification(`Copied Player ID ${player.playerId} to clipboard.`);
              }}
            />
          </HStack>
        </VStack>
      ),
    },
    {
      key: 'level',
      header: 'Level & EXP',
      width: pixel(130),
      renderCell: (player) => (
        <VStack gap={1}>
          <Badge label={`LV. ${player.level}`} variant="yellow" />
          <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
            {player.experience.toLocaleString()} EXP
          </Text>
        </VStack>
      ),
    },
    {
      key: 'currencies',
      header: 'Currencies',
      width: pixel(155),
      renderCell: (player) => {
        const goldText = (player.gold ?? 0).toLocaleString();
        const gemsText = (player.gems ?? 0).toLocaleString();
        return (
          <div className="inline-flex flex-col gap-1 w-full max-w-[130px] mx-auto">
            <div
              className="flex items-center justify-between gap-2 whitespace-nowrap min-w-0"
              title={`Gold: ${goldText}`}
            >
              <Icon icon={Coins} size="sm" color="accent" className="shrink-0" />
              <Text
                type="code"
                size="sm"
                weight="semibold"
                hasTabularNumbers
                className="truncate whitespace-nowrap text-right"
              >
                {goldText}
              </Text>
            </div>
            <div
              className="flex items-center justify-between gap-2 whitespace-nowrap min-w-0"
              title={`Gems: ${gemsText}`}
            >
              <Icon icon={Gem} size="sm" color="info" className="shrink-0" />
              <Text
                type="code"
                size="sm"
                weight="semibold"
                hasTabularNumbers
                className="truncate whitespace-nowrap text-right"
              >
                {gemsText}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      key: 'presence',
      header: 'Presence Status',
      width: pixel(165),
      renderCell: (player) => (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge
            label={getPresenceDisplayLabel(player.presence || 'Offline')}
            variant={getPresenceBadgeVariant(player.presence || 'Offline')}
            icon={player.presence === 'InBattle' ? <Icon icon={Swords} /> : undefined}
          />
          {player.presence === 'InBattle' && canInspectLogs && (
            <Button
              href="/matches"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Terminal} />}
              label="LOGS"
              tooltip="Inspect Combat Logs for this Battle"
            />
          )}
        </HStack>
      ),
    },
    {
      key: 'location',
      header: 'Active Realm Location',
      width: proportional(1.5, { minWidth: 220 }),
      renderCell: (player) => (
        <Text type="code" size="xsm" color="secondary" maxLines={1}>
          {player.presenceInfo?.activityDescription ||
            player.presenceDetails ||
            (player.presence === 'InBattle'
              ? 'In Active Match'
              : player.presence === 'Online'
                ? 'Lobby & Realm Sanctuary'
                : 'Inactive')}
        </Text>
      ),
    },
    {
      key: 'telemetry',
      header: 'Last Telemetry',
      width: pixel(155),
      renderCell: (player) => {
        const formatted = formatTelemetryTimestamp(player.lastLogin);
        return (
          <div
            className="inline-flex flex-col items-center gap-0.5 whitespace-nowrap"
            title={player.presenceInfo?.relativeTime || player.lastLogin || undefined}
          >
            <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
              {formatted.isValid ? formatted.time : player.presenceInfo?.relativeTime || '—'}
            </Text>
            <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
              {formatted.isValid ? formatted.date : '—'}
            </Text>
          </div>
        );
      },
    },
    {
      key: 'standing',
      header: 'Standing',
      width: pixel(145),
      renderCell: (player) =>
        player.isBanned ? (
          <Badge label="EXILED" variant="error" icon={<Icon icon={UserX} />} />
        ) : (
          <Badge label="NORMAL" variant="success" icon={<Icon icon={UserCheck} />} />
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(145),
      align: 'end',
      renderCell: (player) => (
        <HStack gap={2} hAlign="end" vAlign="center">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon icon={Eye} />}
            label="Details"
            onClick={() => setInspectPlayer(player)}
          />
        </HStack>
      ),
    },
  ];

  const topBanner =
    role === 'Moderator' || notification ? (
      <VStack gap={2}>
        {role === 'Moderator' && (
          <Banner
            status="info"
            title="Realm Moderator Inspection Mode"
            description="Live presence tracking and match inspection enabled. Account balance adjustments are reserved for High Counsel Administrators."
          />
        )}
        {notification && (
          <Banner
            status="success"
            title="Player Directory Updated"
            description={notification}
            isDismissable
            onDismiss={() => setNotification(null)}
          />
        )}
      </VStack>
    ) : undefined;

  return (
    <ConsolePage
      badge="SCREEN 29 & 30 • PLAYER CARE & DISCIPLINE"
      badgeVariant="yellow"
      meta={
        <HStack gap={2} vAlign="center">
          <Text type="code" size="xsm" color="secondary">
            {role === 'Moderator' ? 'User Directory' : 'Accounts Management'}
          </Text>
          <Badge
            label={`${validPlayers.length} Accounts • ${presenceCounts.online + presenceCounts.battle} Active`}
            variant="info"
          />
          {presenceCounts.banned > 0 && (
            <Badge label={`${presenceCounts.banned} Banned`} variant="red" />
          )}
        </HStack>
      }
      title={
        role === 'Moderator'
          ? 'USER DIRECTORY & DISCIPLINARY LOGS'
          : 'MANAGE USER ACCOUNTS & TREASURY'
      }
      subtitle="Authoritative aggregation across Google OAuth sessions, Live Support Tickets, and In-Match Combatants."
      actions={
        <HStack gap={2} vAlign="center">
          {canBroadcast && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={Megaphone} />}
              label="Broadcast Notice"
              onClick={() => openNotifyModal('GLOBAL')}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon icon={Download} />}
            label={`Export CSV (${sortedPlayers.length})`}
            isDisabled={sortedPlayers.length === 0}
            onClick={handleExportCsv}
          />
          <Button
            variant="primary"
            size="sm"
            isLoading={loading}
            icon={<Icon icon={RefreshCw} />}
            label="Sync Players"
            onClick={fetchPlayers}
          />
        </HStack>
      }
      banner={topBanner}
      toolbar={
        <VStack gap={2}>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                label="Search by Player ID or Username"
                isLabelHidden
                size="sm"
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val);
                  setCurrentPage(1);
                }}
                startIcon={Search}
                placeholder="Search by Player ID or Username..."
                hasClear
                width={300}
              />
              <div className="w-[210px]">
                <Selector
                  label="Sort players"
                  isLabelHidden
                  size="sm"
                  value={sortBy}
                  onChange={(val) => {
                    if (val) {
                      setSortBy(val as PlayerSortOrder);
                      setCurrentPage(1);
                    }
                  }}
                  options={SORT_OPTIONS}
                  startIcon={ArrowDownUp}
                />
              </div>
            </div>

            <InputGroup label="Load Player ID from database" isLabelHidden>
              <TextInput
                label="Player ID"
                isLabelHidden
                size="sm"
                value={newPlayerIdInput}
                onChange={setNewPlayerIdInput}
                placeholder="Paste Player GUID / Google ID..."
                onEnter={handleAddPlayerById}
                width={300}
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Icon icon={UserPlus} />}
                label="Load ID"
                isDisabled={!newPlayerIdInput.trim()}
                onClick={handleAddPlayerById}
              />
            </InputGroup>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              label="Filter players by presence"
              value={presenceFilter}
              onChange={(val) => {
                setPresenceFilter(val as PresenceFilter);
                setCurrentPage(1);
              }}
              size="sm"
            >
              <SegmentedControlItem value="ALL" label={`All (${validPlayers.length})`} />
              <SegmentedControlItem value="ONLINE" label={`Online (${presenceCounts.online})`} />
              <SegmentedControlItem value="BATTLE" label={`In Battle (${presenceCounts.battle})`} />
              <SegmentedControlItem value="OFFLINE" label={`Offline (${presenceCounts.offline})`} />
              <SegmentedControlItem value="BANNED" label={`Banned (${presenceCounts.banned})`} />
            </SegmentedControl>

            <HStack gap={2} vAlign="center">
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                {sortedPlayers.length === 0
                  ? '0 of 0 Heroes'
                  : `${pageStart}–${pageEnd} of ${sortedPlayers.length} Heroes`}
              </Text>
              <SegmentedControl
                label="Rows per page"
                size="sm"
                value={pageSize}
                onChange={(val) => {
                  setPageSize(val as PageSizeOption);
                  setCurrentPage(1);
                }}
              >
                <SegmentedControlItem value="20" label="20" />
                <SegmentedControlItem value="50" label="50" />
                <SegmentedControlItem value="ALL" label="All" />
              </SegmentedControl>
            </HStack>
          </div>
        </VStack>
      }
    >
      {/* Player KPI Summary Strip + Scrollable Directory Table */}
      <VStack gap={4}>
        <KpiSummaryStrip
          items={[
            {
              id: 'players-total',
              label: 'Total Heroes',
              value: validPlayers.length.toLocaleString(),
              helper: `${sortedPlayers.length.toLocaleString()} matching filter`,
              icon: <Icon icon={Users} size="sm" color="accent" />,
              highlight: true,
            },
            {
              id: 'players-online',
              label: 'Online Now',
              value: presenceCounts.online.toLocaleString(),
              helper: 'Active lobby presence',
              icon: <Icon icon={UserCheck} size="sm" color="success" />,
              badge: { label: 'LIVE', variant: 'success' },
            },
            {
              id: 'players-battle',
              label: 'In Combat',
              value: presenceCounts.battle.toLocaleString(),
              helper: 'Active tactical matches',
              icon: <Icon icon={Shield} size="sm" color="info" />,
              badge: { label: 'PVP/PVE', variant: 'info' },
            },
            {
              id: 'players-banned',
              label: 'Sanctioned',
              value: presenceCounts.banned.toLocaleString(),
              helper: 'Restricted accounts',
              icon: <Icon icon={UserX} size="sm" color="error" />,
              badge: presenceCounts.banned > 0 ? { label: 'REVIEW', variant: 'error' } : undefined,
            },
          ]}
        />

        {sortedPlayers.length === 0 ? (
          <Card padding={6}>
            <EmptyState
              icon={<Icon icon={Inbox} size="lg" color="accent" />}
              title="No player accounts match current search and presence filters"
              description="Type a Player ID into 'Load ID' above to query details directly, or clear filters."
            />
          </Card>
        ) : (
          <ScrollableDataPanel
            footerLeft={
              sortedPlayers.length === 0
                ? '0 accounts'
                : `Showing ${pageStart}–${pageEnd} of ${sortedPlayers.length} filtered accounts (${validPlayers.length} total)`
            }
            footerRight={
              totalPages > 1 ? (
                <HStack gap={2} vAlign="center">
                  <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                    Page {safePage} / {totalPages}
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={ChevronLeft} />}
                    label="Previous"
                    isDisabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    endContent={<Icon icon={ChevronRight} />}
                    label="Next"
                    isDisabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  />
                </HStack>
              ) : (
                `${sortedPlayers.length} accounts loaded`
              )
            }
          >
            <Table
              data={paginatedPlayers as PlayerTableRow[]}
              columns={columns}
              idKey="playerId"
              density="balanced"
              dividers="rows"
              hasHover
            />
          </ScrollableDataPanel>
        )}
      </VStack>

      {/* Adjust Treasury Dialog */}
      <Dialog
        isOpen={selectedPlayer !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setSelectedPlayer(null);
            setModalError(null);
          }
        }}
        purpose="form"
        width={480}
        maxHeight="90dvh"
        padding={5}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <DialogHeader
              title={`ADJUST TREASURY — ${selectedPlayer?.username ?? ''}`}
              subtitle={
                selectedPlayer
                  ? `Ref #${selectedPlayer.playerId.slice(-6).toUpperCase()}`
                  : undefined
              }
              startContent={<Icon icon={Shield} size="md" color="accent" />}
              onOpenChange={(open) => {
                if (!open && !submitting) {
                  setSelectedPlayer(null);
                  setModalError(null);
                }
              }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={4}>
              {modalError && <Banner status="error" title="Adjustment Failed" description={modalError} />}

              <NumberInput
                label="Add / Deduct Gems (+/-)"
                value={adjustGems}
                onChange={(val) => setAdjustGems(val)}
                step={10}
                isIntegerOnly
                hasNumberSteppers
                units="Gems"
                width="100%"
              />

              <NumberInput
                label="Add / Deduct Gold (+/-)"
                value={adjustGold}
                onChange={(val) => setAdjustGold(val)}
                step={100}
                isIntegerOnly
                hasNumberSteppers
                units="Gold"
                width="100%"
              />

              <TextInput
                label="Audit Rationale / Compensation Reason"
                value={compensationReason}
                onChange={setCompensationReason}
                placeholder="e.g. Server rollback compensation, test credit"
                width="100%"
              />
            </VStack>
          </div>
          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                isDisabled={submitting}
                onClick={() => {
                  setSelectedPlayer(null);
                  setModalError(null);
                }}
              />
              <Button
                variant="primary"
                label="Apply Adjustments"
                isLoading={submitting}
                onClick={handleSaveAdjustment}
              />
            </HStack>
          </div>
        </div>
      </Dialog>

      {/* Disciplinary Ban Sanction Dialog */}
      <Dialog
        isOpen={banTargetPlayer !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setBanTargetPlayer(null);
            setBanReason('');
            setModalError(null);
          }
        }}
        purpose="form"
        width={480}
        maxHeight="90dvh"
        padding={5}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <DialogHeader
              title="ENFORCE DISCIPLINARY SANCTION"
              subtitle={
                banTargetPlayer
                  ? `Target: ${banTargetPlayer.username} (ID: ${banTargetPlayer.playerId})`
                  : undefined
              }
              startContent={<Icon icon={UserX} size="md" color="error" />}
              onOpenChange={(open) => {
                if (!open && !submitting) {
                  setBanTargetPlayer(null);
                  setBanReason('');
                  setModalError(null);
                }
              }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={4}>
              {modalError && <Banner status="error" title="Sanction Error" description={modalError} />}

              <Selector
                label="Sanction Duration"
                options={BAN_DURATION_OPTIONS}
                value={banDuration}
                onChange={(val) => setBanDuration(val as BanDuration)}
                width="100%"
              />

              <TextArea
                label="Violation Rationale"
                isRequired
                rows={3}
                value={banReason}
                onChange={setBanReason}
                placeholder="Specify violation rationale (e.g. Speed hack in combat timeline, malicious desync, harassment)..."
                width="100%"
              />
            </VStack>
          </div>
          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                isDisabled={submitting}
                onClick={() => {
                  setBanTargetPlayer(null);
                  setBanReason('');
                  setModalError(null);
                }}
              />
              <Button
                variant="destructive"
                label="Confirm Ban Sanction"
                isLoading={submitting}
                onClick={handleConfirmBan}
              />
            </HStack>
          </div>
        </div>
      </Dialog>

      {/* Lift Sanction Dialog */}
      <Dialog
        isOpen={unbanTargetPlayer !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setUnbanTargetPlayer(null);
            setModalError(null);
          }
        }}
        purpose="form"
        width={440}
        maxHeight="90dvh"
        padding={5}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <DialogHeader
              title="LIFT ACCOUNT SANCTION"
              subtitle="Restore game access and matchmaking eligibility"
              startContent={<Icon icon={UserCheck} size="md" color="success" />}
              onOpenChange={(open) => {
                if (!open && !submitting) {
                  setUnbanTargetPlayer(null);
                  setModalError(null);
                }
              }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={4}>
              {modalError && <Banner status="error" title="Restore Failed" description={modalError} />}

              <Card variant="muted" padding={3}>
                <Text size="sm">
                  Restore normal game access and matchmaking eligibility for wanderer{' '}
                  <strong>{unbanTargetPlayer?.username}</strong>?
                </Text>
              </Card>
            </VStack>
          </div>
          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                isDisabled={submitting}
                onClick={() => {
                  setUnbanTargetPlayer(null);
                  setModalError(null);
                }}
              />
              <Button
                variant="primary"
                label="Restore Account"
                isLoading={submitting}
                onClick={handleConfirmUnban}
              />
            </HStack>
          </div>
        </div>
      </Dialog>

      <PlayerInspectorModal
        key={inspectPlayer?.playerId ?? 'closed'}
        player={inspectPlayer}
        canAdjustTreasury={canAdjustTreasury}
        canBanPlayers={canBanPlayers}
        canSendNotification={canSendNotification}
        canInspectLogs={canInspectLogs}
        onClose={() => setInspectPlayer(null)}
        onOpenNotify={(target) => openNotifyModal(target)}
        onOpenAdjustCurrencies={(target) => {
          setModalError(null);
          setSelectedPlayer(target);
        }}
        onOpenBanToggle={(target) => {
          setModalError(null);
          if (target.isBanned) setUnbanTargetPlayer(target);
          else setBanTargetPlayer(target);
        }}
        onPlayerUpdated={() => void fetchPlayers()}
        onStatusMessage={(msg) => setNotification(msg)}
      />

      {/* Send Warning / Game Notification Dialog */}
      <Dialog
        isOpen={notifyTarget !== null}
        onOpenChange={(open) => {
          if (!open && !notifySubmitting) {
            setNotifyTarget(null);
            setNotifyError(null);
          }
        }}
        purpose="form"
        width={520}
        maxHeight="88dvh"
        padding={5}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <DialogHeader
              title={
                notifyTarget === 'GLOBAL'
                  ? 'BROADCAST REALM NOTIFICATION'
                  : `SEND WARNING / NOTICE — ${notifyTarget?.username ?? ''}`
              }
              subtitle={
                notifyTarget === 'GLOBAL'
                  ? 'Dispatches a system-wide in-game notification via POST /api/game-notification'
                  : notifyTarget
                    ? `Target Player ID: ${notifyTarget.playerId}`
                    : undefined
              }
              startContent={
                <Icon
                  icon={notifyTarget === 'GLOBAL' ? Megaphone : AlertTriangle}
                  size="md"
                  color={notifyType === 'Warning' ? 'error' : 'accent'}
                />
              }
              onOpenChange={(open) => {
                if (!open && !notifySubmitting) {
                  setNotifyTarget(null);
                  setNotifyError(null);
                }
              }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={4}>
              {notifyError && (
                <Banner status="error" title="Dispatch Failed" description={notifyError} />
              )}

              <VStack gap={1.5}>
                <Text type="label" size="xsm" color="secondary">
                  QUICK TEMPLATES
                </Text>
                <HStack gap={1.5} wrap="wrap">
                  {NOTIFICATION_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="secondary"
                      size="sm"
                      label={preset.label}
                      onClick={() => {
                        setNotifyType(preset.type);
                        setNotifyTitle(preset.title);
                        setNotifyMessage(preset.message);
                        setNotifyError(null);
                      }}
                    />
                  ))}
                </HStack>
              </VStack>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Selector
                  label="Notification Type"
                  options={NOTIFICATION_TYPE_OPTIONS}
                  value={notifyType}
                  onChange={(val) => {
                    if (val) setNotifyType(val as NotificationTypeOption);
                  }}
                  width="100%"
                />
                <Selector
                  label="Expiration Window"
                  options={NOTIFICATION_EXPIRY_OPTIONS}
                  value={notifyExpiry}
                  onChange={(val) => {
                    if (val) setNotifyExpiry(val as NotificationExpiryOption);
                  }}
                  width="100%"
                />
              </div>

              <TextInput
                label="Title"
                isRequired
                value={notifyTitle}
                onChange={setNotifyTitle}
                placeholder="e.g. Match Conduct Warning"
                width="100%"
              />

              <TextArea
                label="Message Content"
                isRequired
                rows={4}
                value={notifyMessage}
                onChange={setNotifyMessage}
                placeholder="Specify the warning details or announcement message delivered to the player..."
                width="100%"
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} hAlign="end">
              <Button
                variant="secondary"
                label="Cancel"
                isDisabled={notifySubmitting}
                onClick={() => {
                  setNotifyTarget(null);
                  setNotifyError(null);
                }}
              />
              <Button
                variant={notifyType === 'Warning' ? 'destructive' : 'primary'}
                label={notifyTarget === 'GLOBAL' ? 'Dispatch Broadcast' : 'Send Notification'}
                icon={<Icon icon={notifyTarget === 'GLOBAL' ? Megaphone : Bell} />}
                isLoading={notifySubmitting}
                onClick={handleSendNotification}
              />
            </HStack>
          </div>
        </div>
      </Dialog>
    </ConsolePage>
  );
};
