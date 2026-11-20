import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Edit3,
  Eye,
  Gem,
  Inbox,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Terminal,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
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
import { adminClient } from '../api/adminClient';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
} from '../services/playerPresenceService';
import type { AdminPermissionKey, CounselRole, PlayerProfile } from '../types';
import { hasPermission } from '../utils/permissions';
import {
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
type PlayerTableRow = PlayerProfile & Record<string, unknown>;

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
  const navigate = useNavigate();
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
  const canInspectLogs =
    hasPermission(role, 'matches.logs', permissions) ||
    hasPermission(role, 'matches.view', permissions);

  const columns: TableColumn<PlayerTableRow>[] = [
    {
      key: 'account',
      header: 'Player Account',
      width: proportional(2),
      renderCell: (player) => (
        <HStack gap={3} vAlign="center">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
            <Text weight="bold" size="xsm" color="accent" className="font-cinzel">
              {player.username.slice(0, 2).toUpperCase()}
            </Text>
          </div>
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
        </HStack>
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
      width: proportional(1.4),
      renderCell: (player) => (
        <HStack gap={3} vAlign="center" wrap="wrap">
          <HStack gap={1} vAlign="center">
            <Icon icon={Coins} size="sm" color="accent" />
            <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
              {(player.gold ?? 0).toLocaleString()}
            </Text>
          </HStack>
          <HStack gap={1} vAlign="center">
            <Icon icon={Gem} size="sm" color="info" />
            <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
              {(player.gems ?? 0).toLocaleString()}
            </Text>
          </HStack>
        </HStack>
      ),
    },
    {
      key: 'presence',
      header: 'Live Presence',
      width: proportional(1.6),
      renderCell: (player) => (
        <VStack gap={1}>
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
          <Text type="code" size="xsm" color="secondary" maxLines={1}>
            {player.presenceDetails ||
              (player.presence === 'InBattle'
                ? 'In Active Match'
                : player.presence === 'Online'
                  ? 'Lobby & Realm Sanctuary'
                  : 'Inactive')}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'standing',
      header: 'Standing',
      width: pixel(120),
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
      width: pixel(180),
      align: 'end',
      renderCell: (player) => (
        <HStack gap={2} hAlign="end" vAlign="center">
          <IconButton
            label={`Inspect profile for ${player.username}`}
            tooltip="Quick Inspect"
            variant="secondary"
            size="sm"
            icon={<Icon icon={Eye} />}
            onClick={() => setInspectPlayer(player)}
          />
          {canAdjustTreasury && (
            <IconButton
              label={`Adjust currencies for ${player.username}`}
              tooltip="Adjust Currencies"
              variant="secondary"
              size="sm"
              icon={<Icon icon={Edit3} />}
              onClick={() => {
                setModalError(null);
                setSelectedPlayer(player);
              }}
            />
          )}
          {canBanPlayers && (
            <Button
              variant={player.isBanned ? 'secondary' : 'destructive'}
              size="sm"
              label={player.isBanned ? 'Unban' : 'Ban'}
              onClick={() => {
                setModalError(null);
                if (player.isBanned) {
                  setUnbanTargetPlayer(player);
                } else {
                  setBanTargetPlayer(player);
                }
              }}
            />
          )}
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
      {/* Player Table */}
      <Card padding={3}>
        {sortedPlayers.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Inbox} size="lg" color="accent" />}
            title="No player accounts match current search and presence filters"
            description="Type a Player ID into 'Load ID' above to query details directly, or clear filters."
          />
        ) : (
          <VStack gap={3}>
            <Table
              data={paginatedPlayers as PlayerTableRow[]}
              columns={columns}
              idKey="playerId"
              density="balanced"
              dividers="rows"
              hasHover
            />

            {totalPages > 1 && (
              <>
                <Divider />
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                    Page {safePage} of {totalPages} ({sortedPlayers.length} filtered accounts)
                  </Text>
                  <HStack gap={2} vAlign="center">
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
                </HStack>
              </>
            )}
          </VStack>
        )}
      </Card>

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
        padding={5}
      >
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

          <Divider />

          <HStack gap={2} hAlign="end">
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
        </VStack>
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
        padding={5}
      >
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

          <Divider />

          <HStack gap={2} hAlign="end">
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
        </VStack>
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
        padding={5}
      >
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
        <VStack gap={4}>
          {modalError && <Banner status="error" title="Restore Failed" description={modalError} />}

          <Card variant="muted" padding={3}>
            <Text size="sm">
              Restore normal game access and matchmaking eligibility for wanderer{' '}
              <strong>{unbanTargetPlayer?.username}</strong>?
            </Text>
          </Card>

          <Divider />

          <HStack gap={2} hAlign="end">
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
        </VStack>
      </Dialog>

      {/* Quick Player Inspector Dialog */}
      <Dialog
        isOpen={inspectPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setInspectPlayer(null);
        }}
        purpose="info"
        width={520}
        padding={5}
      >
        <DialogHeader
          title={inspectPlayer?.username || 'Player Profile'}
          subtitle="Unified OAuth & Live Presence Dossier"
          startContent={<Icon icon={Eye} size="md" color="accent" />}
          onOpenChange={(open) => {
            if (!open) setInspectPlayer(null);
          }}
        />
        {inspectPlayer && (
          <VStack gap={4}>
            <Card variant="muted" padding={3}>
              <VStack gap={2}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Badge
                    label={getPresenceDisplayLabel(inspectPlayer.presence || 'Offline', inspectPlayer.isBanned)}
                    variant={getPresenceBadgeVariant(inspectPlayer.presence || 'Offline', inspectPlayer.isBanned)}
                  />
                  <Badge
                    label={inspectPlayer.isBanned ? 'BANNED SANCTION' : 'STANDING: NORMAL'}
                    variant={inspectPlayer.isBanned ? 'red' : 'green'}
                  />
                </HStack>

                <Divider />

                <HStack justify="between" vAlign="center" gap={2}>
                  <Text type="label" size="xsm" color="secondary">
                    FULL PLAYER ID
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={Copy} />}
                    label="Copy ID"
                    onClick={() => {
                      navigator.clipboard?.writeText(inspectPlayer.playerId);
                      setNotification(`Copied Player ID for ${inspectPlayer.username}`);
                    }}
                  />
                </HStack>
                <Text type="code" size="xsm" className="break-all">
                  {inspectPlayer.playerId}
                </Text>
              </VStack>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card variant="muted" padding={3}>
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary">
                    PROGRESSION
                  </Text>
                  <Text type="display-3" weight="bold" hasTabularNumbers>
                    Level {inspectPlayer.level}
                  </Text>
                  <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                    {(inspectPlayer.experience ?? 0).toLocaleString()} EXP
                  </Text>
                </VStack>
              </Card>
              <Card variant="muted" padding={3}>
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary">
                    TREASURY BALANCES
                  </Text>
                  <HStack gap={3} vAlign="center" wrap="wrap">
                    <HStack gap={1} vAlign="center">
                      <Icon icon={Coins} size="sm" color="warning" />
                      <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
                        {(inspectPlayer.gold ?? 0).toLocaleString()}
                      </Text>
                    </HStack>
                    <HStack gap={1} vAlign="center">
                      <Icon icon={Gem} size="sm" color="accent" />
                      <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
                        {(inspectPlayer.gems ?? 0).toLocaleString()}
                      </Text>
                    </HStack>
                  </HStack>
                </VStack>
              </Card>
            </div>

            {inspectPlayer.activeMatch?.matchId && (
              <Card variant="muted" padding={3}>
                <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                  <VStack gap={0.5}>
                    <Text type="label" size="xsm" color="secondary">
                      ACTIVE / RECENT MATCH ID
                    </Text>
                    <Text type="code" size="xsm">
                      {inspectPlayer.activeMatch.matchId}
                    </Text>
                  </VStack>
                  {canInspectLogs && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={Terminal} />}
                      label="Inspect Match Log"
                      onClick={() => {
                        const targetId = inspectPlayer.activeMatch?.matchId;
                        setInspectPlayer(null);
                        if (targetId) {
                          navigate(`/matches?matchId=${encodeURIComponent(targetId)}`);
                        }
                      }}
                    />
                  )}
                </HStack>
              </Card>
            )}

            <Divider />

            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={2}>
                {canAdjustTreasury && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={Edit3} />}
                    label="Adjust Currencies"
                    onClick={() => {
                      const target = inspectPlayer;
                      setInspectPlayer(null);
                      setModalError(null);
                      setSelectedPlayer(target);
                    }}
                  />
                )}
                {canBanPlayers && (
                  <Button
                    variant={inspectPlayer.isBanned ? 'secondary' : 'destructive'}
                    size="sm"
                    icon={<Icon icon={inspectPlayer.isBanned ? UserCheck : UserX} />}
                    label={inspectPlayer.isBanned ? 'Unban' : 'Ban'}
                    onClick={() => {
                      const target = inspectPlayer;
                      setInspectPlayer(null);
                      setModalError(null);
                      if (target.isBanned) setUnbanTargetPlayer(target);
                      else setBanTargetPlayer(target);
                    }}
                  />
                )}
              </HStack>
              <Button variant="primary" size="sm" label="Close" onClick={() => setInspectPlayer(null)} />
            </HStack>
          </VStack>
        )}
      </Dialog>
    </ConsolePage>
  );
};
