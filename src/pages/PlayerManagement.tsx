import React, { useEffect, useMemo, useState } from 'react';
import {
  Coins,
  Copy,
  Edit3,
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
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Section } from '@astryxdesign/core/Section';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { StackItem } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
} from '../services/playerPresenceService';
import type { CounselRole, PlayerProfile } from '../types';
import {
  getPresenceBadgeVariant,
  getPresenceDisplayLabel,
  getPresenceStatusDotVariant,
} from '../utils/presenceAstryx';

interface PlayerManagementProps {
  role?: CounselRole;
}

type PresenceFilter = 'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE';
type BanDuration = 'TEMPORARY_24H' | 'TEMPORARY_7D' | 'PERMANENT';
type PlayerTableRow = PlayerProfile & Record<string, unknown>;

const BAN_DURATION_OPTIONS = [
  { value: 'TEMPORARY_24H', label: 'Temporary Suspension (24 Hours)' },
  { value: 'TEMPORARY_7D', label: 'Extended Suspension (7 Days)' },
  { value: 'PERMANENT', label: 'Permanent Account Ban' },
];

export const PlayerManagement: React.FC<PlayerManagementProps> = ({ role = 'Admin' }) => {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlayerIdInput, setNewPlayerIdInput] = useState('');

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
        const newP: PlayerProfile = {
          playerId: targetId,
          username: d.username || d.playerName || `Wanderer #${targetId.slice(-4).toUpperCase()}`,
          level: d.level ?? 1,
          experience: d.experience ?? 0,
          gold: d.gold ?? 0,
          gems: d.gems ?? 0,
          lastLogin: new Date().toLocaleString(),
          isBanned: Boolean(d.isBanned),
          presence: 'Online',
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

  const presenceCounts = useMemo(() => {
    let online = 0;
    let battle = 0;
    let offline = 0;
    for (const p of players) {
      if (p.presence === 'Online') online += 1;
      else if (p.presence === 'InBattle') battle += 1;
      else offline += 1;
    }
    return { online, battle, offline };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return players.filter((p) => {
      const matchesSearch =
        p.username.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (presenceFilter === 'ONLINE') return p.presence === 'Online';
      if (presenceFilter === 'BATTLE') return p.presence === 'InBattle';
      if (presenceFilter === 'OFFLINE') return p.presence === 'Offline';
      return true;
    });
  }, [players, searchTerm, presenceFilter]);

  const isSupport = role === 'Technical Support' || role === 'Support';
  const isAdmin = role === 'Admin' || role === 'Server';

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
            {player.presence === 'InBattle' && (
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
      renderCell: (player) =>
        isSupport ? (
          <Badge label="Read-Only" variant="neutral" />
        ) : (
          <HStack gap={2} hAlign="end" vAlign="center">
            {isAdmin && (
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
          </HStack>
        ),
    },
  ];

  return (
    <VStack gap={5}>
      {/* Hero Banner */}
      <Section padding={5}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge label="SCREEN 29 & 30 • PLAYER CARE & DISCIPLINE" variant="yellow" />
              <Text type="code" size="xsm" color="secondary">
                {role === 'Moderator' ? 'User Directory' : 'Accounts Management'}
              </Text>
            </HStack>
            <Heading level={1} type="display-2" className="font-cinzel pk-gold-text">
              {role === 'Moderator'
                ? 'USER DIRECTORY & DISCIPLINARY LOGS'
                : 'MANAGE USER ACCOUNTS & TREASURY'}
            </Heading>
            <Text type="supporting" size="sm">
              Authoritative aggregation across Google OAuth sessions, Live Support Tickets, and
              In-Match Combatants.
            </Text>
          </VStack>

          <StackItem size="static">
            <Button
              variant="primary"
              size="md"
              isLoading={loading}
              icon={<Icon icon={RefreshCw} />}
              label="Sync Players"
              onClick={fetchPlayers}
            />
          </StackItem>
        </HStack>
      </Section>

      {/* Role Notice */}
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

      {/* Search & Load Player ID Controls */}
      <Section padding={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <TextInput
            label="Search by Player ID or Username"
            isLabelHidden
            value={searchTerm}
            onChange={setSearchTerm}
            startIcon={Search}
            placeholder="Search by Player ID or Username..."
            hasClear
            width={340}
          />

          <InputGroup label="Load Player ID from database" isLabelHidden>
            <TextInput
              label="Player ID"
              isLabelHidden
              value={newPlayerIdInput}
              onChange={setNewPlayerIdInput}
              placeholder="Enter Player ID from DB (e.g. Google ID)..."
              onEnter={handleAddPlayerById}
              width={280}
            />
            <Button
              variant="primary"
              icon={<Icon icon={UserPlus} />}
              label="Load ID"
              isDisabled={!newPlayerIdInput.trim()}
              onClick={handleAddPlayerById}
            />
          </InputGroup>
        </HStack>
      </Section>

      {/* Presence Filter Controls */}
      <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
        <SegmentedControl
          label="Filter players by presence"
          value={presenceFilter}
          onChange={(val) => setPresenceFilter(val as PresenceFilter)}
          size="sm"
        >
          <SegmentedControlItem value="ALL" label={`All Players (${players.length})`} />
          <SegmentedControlItem value="ONLINE" label={`Online (${presenceCounts.online})`} />
          <SegmentedControlItem value="BATTLE" label={`In Battle (${presenceCounts.battle})`} />
          <SegmentedControlItem value="OFFLINE" label={`Offline (${presenceCounts.offline})`} />
        </SegmentedControl>

        <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
          Showing {filteredPlayers.length} of {players.length} Heroes
        </Text>
      </HStack>

      {/* Player Table */}
      <Section padding={4}>
        {filteredPlayers.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Inbox} size="lg" color="accent" />}
            title="No player accounts match current search and presence filters"
            description="Type a Player ID into 'Load ID' above to query details directly."
          />
        ) : (
          <Table
            data={filteredPlayers as PlayerTableRow[]}
            columns={columns}
            idKey="playerId"
            density="balanced"
            dividers="rows"
            hasHover
          />
        )}
      </Section>

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
    </VStack>
  );
};
