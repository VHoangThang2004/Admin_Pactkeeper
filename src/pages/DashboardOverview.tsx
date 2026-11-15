import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Clock,
  Coins,
  Copy,
  Crown,
  Flame,
  Gem,
  Lock,
  Power,
  Radio,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldX,
  Swords,
  Terminal,
  TrendingUp,
  Unlock,
  Users,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Link } from '@astryxdesign/core/Link';
import { Section } from '@astryxdesign/core/Section';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StackItem } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
  type TrackedPlayerPresence,
} from '../services/playerPresenceService';
import type { CounselRole, ServerState } from '../types';
import {
  getPresenceBadgeVariant,
  getPresenceDisplayLabel,
  getPresenceStatusDotVariant,
} from '../utils/presenceAstryx';

interface DashboardOverviewProps {
  role?: CounselRole;
}

type PresenceFilter = 'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE';

type PresenceTableRow = TrackedPlayerPresence & Record<string, unknown>;

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ role = 'Admin' }) => {
  const isAdmin = role === 'Admin' || role === 'Server';
  const isTechSupport = role === 'Technical Support' || role === 'Support';
  const canOverride = isAdmin || isTechSupport;

  const [serverState, setServerState] = useState<ServerState>(() => {
    const saved =
      sessionStorage.getItem('admin_server_state') || localStorage.getItem('admin_server_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore malformed saved state
      }
    }
    return { loginBlocked: false, matchmakingBlocked: false };
  });

  useEffect(() => {
    sessionStorage.setItem('admin_server_state', JSON.stringify(serverState));
  }, [serverState]);

  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingOverride, setPendingOverride] = useState<'login' | 'queue' | 'forceStop' | null>(
    null
  );
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [paidOrdersCount, setPaidOrdersCount] = useState<number>(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  const [packsCount, setPacksCount] = useState<number>(0);

  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(0);
  const [inMatchPlayersCount, setInMatchPlayersCount] = useState<number>(0);
  const [activeMatchesCount, setActiveMatchesCount] = useState<number>(0);
  const [totalMatchesCount, setTotalMatchesCount] = useState<number>(0);
  const [trackedPlayers, setTrackedPlayers] = useState<TrackedPlayerPresence[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [bannersCount, setBannersCount] = useState<number>(0);
  const [chaptersCount, setChaptersCount] = useState<number>(0);

  const loadTelemetrySnapshot = async () => {
    const [uRes, bRes, pRes, hRes, cRes, stateRes, unifiedData] = await Promise.allSettled([
      adminClient.get('/UnitDefinition'),
      adminClient.get('/gachabanner'),
      adminClient.get('/topuppack/all'),
      adminClient.get('/payment/history'),
      adminClient.get('/ChapterConfig'),
      adminClient.get('/admin/system-state'),
      fetchUnifiedPlayerData(),
    ]);

    const orders =
      hRes.status === 'fulfilled' && Array.isArray(hRes.value.data) ? hRes.value.data : [];
    const paidOrders = orders.filter((o: any) => o.status === 'PAID');

    return {
      activeUnitsCount:
        uRes.status === 'fulfilled' && Array.isArray(uRes.value.data) ? uRes.value.data.length : 0,
      bannersCount:
        bRes.status === 'fulfilled' && Array.isArray(bRes.value.data) ? bRes.value.data.length : 0,
      packsCount:
        pRes.status === 'fulfilled' && Array.isArray(pRes.value.data) ? pRes.value.data.length : 0,
      chaptersCount:
        cRes.status === 'fulfilled' && Array.isArray(cRes.value.data) ? cRes.value.data.length : 0,
      totalOrdersCount: orders.length,
      paidOrdersCount: paidOrders.length,
      totalRevenue: paidOrders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0),
      unified: unifiedData.status === 'fulfilled' ? unifiedData.value : null,
      systemState: stateRes.status === 'fulfilled' ? stateRes.value.data : null,
    };
  };

  const applyTelemetrySnapshot = (snapshot: Awaited<ReturnType<typeof loadTelemetrySnapshot>>) => {
    setActiveUnitsCount(snapshot.activeUnitsCount);
    setBannersCount(snapshot.bannersCount);
    setPacksCount(snapshot.packsCount);
    setChaptersCount(snapshot.chaptersCount);
    setTotalOrdersCount(snapshot.totalOrdersCount);
    setPaidOrdersCount(snapshot.paidOrdersCount);
    setTotalRevenue(snapshot.totalRevenue);

    if (snapshot.unified) {
      setTrackedPlayers(snapshot.unified.trackedPlayers);
      setOnlinePlayersCount(snapshot.unified.counts.online);
      setInMatchPlayersCount(snapshot.unified.counts.inBattle);
      setActiveMatchesCount(snapshot.unified.activeMatchesCount);
      setTotalMatchesCount(snapshot.unified.totalMatchesCount);
    }

    if (snapshot.systemState) {
      setServerState({
        loginBlocked: Boolean(snapshot.systemState.loginBlocked),
        matchmakingBlocked: Boolean(snapshot.systemState.matchmakingBlocked),
      });
    }
  };

  const resetTelemetryMetrics = () => {
    setActiveUnitsCount(0);
    setBannersCount(0);
    setPacksCount(0);
    setChaptersCount(0);
    setTotalRevenue(0);
    setPaidOrdersCount(0);
    setTotalOrdersCount(0);
    setOnlinePlayersCount(0);
    setInMatchPlayersCount(0);
    setActiveMatchesCount(0);
    setTotalMatchesCount(0);
    setTrackedPlayers([]);
  };

  const fetchRealTelemetry = async () => {
    setLoading(true);
    try {
      const snapshot = await loadTelemetrySnapshot();
      applyTelemetrySnapshot(snapshot);
    } catch {
      resetTelemetryMetrics();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadTelemetrySnapshot()
      .then((snapshot) => {
        if (active) applyTelemetrySnapshot(snapshot);
      })
      .catch(() => {
        if (active) resetTelemetryMetrics();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToUnifiedPresence((data) => {
      if (!active) return;
      setTrackedPlayers(data.trackedPlayers);
      setOnlinePlayersCount(data.counts.online);
      setInMatchPlayersCount(data.counts.inBattle);
      setActiveMatchesCount(data.activeMatchesCount);
      setTotalMatchesCount(data.totalMatchesCount);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const toggleLoginStatus = () => {
    setOverrideError(null);
    setPendingOverride('login');
  };

  const toggleQueueStatus = () => {
    setOverrideError(null);
    setPendingOverride('queue');
  };

  const handleForceStopAll = () => {
    setOverrideError(null);
    setPendingOverride('forceStop');
  };

  const executePendingOverride = async (rationale: string) => {
    if (!pendingOverride) return;
    setOverrideError(null);
    setLoadingAction(pendingOverride);

    try {
      if (pendingOverride === 'login') {
        const prev = serverState.loginBlocked;
        const newStatus = !prev;
        await adminClient.post('/admin/update-login-status', newStatus);
        setServerState((state) => ({ ...state, loginBlocked: newStatus }));
        await recordAuditEvent({
          action: newStatus ? 'SERVER_LOGIN_BLOCKED' : 'SERVER_LOGIN_RESTORED',
          category: 'SERVER',
          severity: 'HIGH',
          targetType: 'RealmGateway',
          targetLabel: 'Player Authentication Gate',
          rationale,
          beforeState: { loginBlocked: prev },
          afterState: { loginBlocked: newStatus },
        });
        setMessage({
          text: `Player Login Status updated: ${newStatus ? 'BLOCKED' : 'ALLOWED'}.`,
          type: 'success',
        });
      } else if (pendingOverride === 'queue') {
        const prev = serverState.matchmakingBlocked;
        const newStatus = !prev;
        await adminClient.post('/admin/update-queue-status', newStatus);
        setServerState((state) => ({ ...state, matchmakingBlocked: newStatus }));
        await recordAuditEvent({
          action: newStatus ? 'MATCHMAKING_PAUSED' : 'MATCHMAKING_RESUMED',
          category: 'SERVER',
          severity: 'HIGH',
          targetType: 'MatchmakingQueue',
          targetLabel: 'PvP Queue Override',
          rationale,
          beforeState: { matchmakingBlocked: prev },
          afterState: { matchmakingBlocked: newStatus },
        });
        setMessage({
          text: `Matchmaking Queue Status updated: ${newStatus ? 'PAUSED' : 'ALLOWED'}.`,
          type: 'success',
        });
      } else {
        const res = await adminClient.post('/admin/force-stop-all');
        await recordAuditEvent({
          action: 'FORCE_STOP_ALL_MATCHES',
          category: 'SERVER',
          severity: 'CRITICAL',
          targetType: 'NGOServerCluster',
          targetLabel: 'All Active PvP Match Instances',
          rationale,
          beforeState: { activeMatchesCount },
          afterState: { terminated: true },
        });
        setMessage({
          text: res.data?.message || 'All matches ended & queue cleared on live server.',
          type: 'success',
        });
        await fetchRealTelemetry();
      }
      setPendingOverride(null);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to execute emergency server override.';
      setOverrideError(errMsg);
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const presenceCounts = useMemo(() => {
    let online = 0;
    let battle = 0;
    let offline = 0;
    for (const p of trackedPlayers) {
      if (p.presence.state === 'Online') online += 1;
      else if (p.presence.state === 'InBattle') battle += 1;
      else offline += 1;
    }
    return { online, battle, offline };
  }, [trackedPlayers]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trackedPlayers.filter((p) => {
      if (presenceFilter === 'ONLINE' && p.presence.state !== 'Online') return false;
      if (presenceFilter === 'BATTLE' && p.presence.state !== 'InBattle') return false;
      if (presenceFilter === 'OFFLINE' && p.presence.state !== 'Offline') return false;
      if (q) {
        return p.username.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [trackedPlayers, presenceFilter, searchQuery]);

  const presenceColumns: TableColumn<PresenceTableRow>[] = [
    {
      key: 'hero',
      header: 'Hero & Account',
      width: proportional(2),
      renderCell: (player) => (
        <HStack gap={3} vAlign="center">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
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
                variant={getPresenceStatusDotVariant(player.presence.state)}
                isPulsing={player.presence.state !== 'Offline'}
                label={player.presence.label}
              />
            </HStack>
            <HStack gap={1} vAlign="center">
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                Ref: #{player.playerId.slice(-6).toUpperCase()}
              </Text>
              <IconButton
                label={`Copy full Player ID for ${player.username}`}
                tooltip={`Copy ID: ${player.playerId}`}
                variant="ghost"
                size="sm"
                icon={<Icon icon={Copy} />}
                onClick={() => {
                  navigator.clipboard.writeText(player.playerId);
                  setMessage({
                    text: `Copied Player ID for ${player.username} to clipboard.`,
                    type: 'success',
                  });
                }}
              />
            </HStack>
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'status',
      header: 'Presence Status',
      width: proportional(1.5),
      renderCell: (player) => (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge
            label={getPresenceDisplayLabel(player.presence.state)}
            variant={getPresenceBadgeVariant(player.presence.state)}
            icon={
              player.presence.state === 'InBattle' ? <Icon icon={Swords} /> : undefined
            }
          />
          {player.presence.state === 'InBattle' && (
            <Button
              href="/matches"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Terminal} />}
              label="LOGS"
              tooltip="Inspect Dedicated Server Log for this Battle"
            />
          )}
        </HStack>
      ),
    },
    {
      key: 'location',
      header: 'Active Realm Location',
      width: proportional(2),
      renderCell: (player) => (
        <Text type="code" size="xsm" color="secondary">
          {player.presence.activityDescription}
        </Text>
      ),
    },
    {
      key: 'telemetry',
      header: 'Last Telemetry',
      width: pixel(140),
      align: 'end',
      renderCell: (player) => (
        <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
          {player.presence.relativeTime}
        </Text>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      {/* Top Command Hero */}
      <Section padding={5}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge label="TACTICAL COMMAND HQ" variant="yellow" />
              <Text type="code" size="xsm" color="secondary">
                Live Telemetry &amp; Controls
              </Text>
            </HStack>
            <Heading level={1} type="display-2" className="font-cinzel pk-gold-text">
              {isTechSupport ? 'SYSTEM STATUS & TELEMETRY MONITOR' : 'TREASURY & REALM COMMAND'}
            </Heading>
            <Text type="supporting" size="sm">
              {isTechSupport
                ? 'Technical Support Station: Monitor System/Server Status and Configure System Overrides'
                : 'Admin Dashboard: Live Telemetry, Player Concurrency, Revenue and High Counsel Controls'}
            </Text>
          </VStack>

          <StackItem size="static">
            <Button
              variant="primary"
              size="md"
              isLoading={loading}
              icon={<Icon icon={RotateCcw} />}
              label="Sync Data"
              onClick={fetchRealTelemetry}
            />
          </StackItem>
        </HStack>
      </Section>

      {message && (
        <Banner
          status={message.type === 'success' ? 'success' : 'error'}
          title={message.type === 'success' ? 'Telemetry Action Complete' : 'Operation Failed'}
          description={message.text}
          isDismissable
          onDismiss={() => setMessage(null)}
        />
      )}

      {/* Keeper Profile / Realm Revenue / Server Nodes */}
      <Section padding={5}>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <VStack gap={1}>
              <Text type="code" size="xsm" color="accent" weight="semibold">
                {isTechSupport
                  ? 'TECHNICAL SUPPORT & INFRASTRUCTURE'
                  : 'HIGH COUNSEL RECORD OFFICE'}
              </Text>
              <Heading level={2} className="font-cinzel">
                {isTechSupport ? 'SYSTEM MONITOR & SERVER NODES' : 'KEEPER OF RECORDS'}
              </Heading>
              <HStack gap={2} vAlign="center">
                <StatusDot variant="success" isPulsing label="Gateway Live" />
                <Badge label="GATEWAY LIVE" variant="success" />
              </HStack>
            </VStack>
            <div className="w-12 h-12 rounded-xl bg-[var(--color-accent-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center">
              <Icon icon={Crown} size="lg" color="accent" />
            </div>
          </HStack>

          <Card variant={isTechSupport ? 'green' : 'yellow'} padding={4}>
            {!isTechSupport ? (
              <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                <VStack gap={1}>
                  <Text type="label" size="xsm" className="font-cinzel">
                    CURRENT REALM TREASURY REVENUE (PAYOS LEDGER)
                  </Text>
                  <HStack gap={3} vAlign="center">
                    <Icon icon={Coins} size="lg" color="accent" />
                    <Text size="3xl" weight="bold" type="code" hasTabularNumbers>
                      {totalRevenue.toLocaleString()} VND
                    </Text>
                  </HStack>
                </VStack>
                <VStack gap={0.5} hAlign="end">
                  <Text type="code" size="xsm" weight="semibold" color="accent" hasTabularNumbers>
                    {paidOrdersCount} / {totalOrdersCount} Completed Receipts
                  </Text>
                  <Text type="supporting" size="xsm">
                    {packsCount} Active Store Packs Configured • payOS Gateway Live
                  </Text>
                </VStack>
              </HStack>
            ) : (
              <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                <VStack gap={1}>
                  <Text type="label" size="xsm" className="font-cinzel">
                    SERVER NODES &amp; DEDICATED INSTANCES
                  </Text>
                  <HStack gap={3} vAlign="center">
                    <Icon icon={Server} size="lg" color="accent" />
                    <Text size="3xl" weight="bold" type="code" hasTabularNumbers>
                      {activeMatchesCount} HEADLESS NODES ACTIVE
                    </Text>
                  </HStack>
                </VStack>
                <VStack gap={0.5} hAlign="end">
                  <Text type="code" size="xsm" weight="semibold">
                    UDP Port Pool: 7777 - 7800 • Ubuntu 22.04 LTS
                  </Text>
                  <Text type="supporting" size="xsm">
                    Unity Netcode for GameObjects (NGO) • Dedicated Server Architecture
                  </Text>
                </VStack>
              </HStack>
            )}
          </Card>
        </VStack>
      </Section>

      {/* Live Population & Combat Telemetry */}
      <VStack gap={3}>
        <Heading level={3} className="font-cinzel">
          Live Player Population &amp; Combat Telemetry
        </Heading>

        <Grid columns={{ minWidth: 220, max: 4 }} gap={3}>
          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    ONLINE PLAYERS (CCU)
                  </Text>
                  <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                    {onlinePlayersCount} Online
                  </Text>
                  <HStack gap={1.5} vAlign="center">
                    <StatusDot variant="success" isPulsing label="Live Hub Active" />
                    <Text size="xsm" color="secondary">
                      Live Hub Active
                    </Text>
                  </HStack>
                </VStack>
                <Icon icon={Users} size="lg" color="success" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  SignalR WebSocket
                </Text>
                <Badge label="Connected" variant="success" />
              </HStack>
            </VStack>
          </Card>

          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    IN-MATCH PLAYERS
                  </Text>
                  <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                    {inMatchPlayersCount} Combatants
                  </Text>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={Flame} size="xsm" color="info" />
                    <Text size="xsm" color="secondary" hasTabularNumbers>
                      {activeMatchesCount} Active Battles
                    </Text>
                  </HStack>
                </VStack>
                <Icon icon={Swords} size="lg" color="info" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                  {totalMatchesCount} Total Matches
                </Text>
                <Button
                  href="/matches"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Terminal} />}
                  label="Inspect"
                />
              </HStack>
            </VStack>
          </Card>

          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    MATCHMAKING QUEUE
                  </Text>
                  <HStack gap={2} vAlign="center">
                    <Badge
                      label={serverState.matchmakingBlocked ? 'PAUSED' : 'ACTIVE (OPEN)'}
                      variant={serverState.matchmakingBlocked ? 'error' : 'success'}
                    />
                  </HStack>
                  <Text size="xsm" color="secondary">
                    {serverState.matchmakingBlocked
                      ? 'Emergency Lock Engaged'
                      : 'Auto Match Allocation'}
                  </Text>
                </VStack>
                <Icon icon={Clock} size="lg" color="accent" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  PvP Engine
                </Text>
                <Badge label="Turn-Based SRPG" variant="success" />
              </HStack>
            </VStack>
          </Card>

          {!isTechSupport ? (
            <Card variant="default" padding={4}>
              <VStack gap={3}>
                <HStack justify="between" vAlign="start">
                  <VStack gap={1}>
                    <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                      TREASURY RECEIPTS
                    </Text>
                    <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                      {paidOrdersCount} Paid
                    </Text>
                    <Text size="xsm" color="secondary">
                      Webhooks Verified
                    </Text>
                  </VStack>
                  <Icon icon={Coins} size="lg" color="accent" />
                </HStack>
                <Divider />
                <HStack justify="between" vAlign="center">
                  <Text type="code" size="xsm" color="secondary">
                    Total Orders
                  </Text>
                  <Text type="code" size="xsm" weight="semibold" hasTabularNumbers>
                    {totalOrdersCount} Receipts
                  </Text>
                </HStack>
              </VStack>
            </Card>
          ) : (
            <Card variant="default" padding={4}>
              <VStack gap={3}>
                <HStack justify="between" vAlign="start">
                  <VStack gap={1}>
                    <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                      NETCODE INSTANCES
                    </Text>
                    <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                      {activeMatchesCount} Live
                    </Text>
                    <Text size="xsm" color="secondary">
                      Dedicated Processes
                    </Text>
                  </VStack>
                  <Icon icon={Server} size="lg" color="info" />
                </HStack>
                <Divider />
                <HStack justify="between" vAlign="center">
                  <Text type="code" size="xsm" color="secondary">
                    Port Allocation
                  </Text>
                  <Text type="code" size="xsm" weight="semibold">
                    7777 - 7800 RUDP
                  </Text>
                </HStack>
              </VStack>
            </Card>
          )}
        </Grid>
      </VStack>

      {/* Real-Time Hero Presence Roster */}
      <Section padding={5}>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <HStack gap={3} vAlign="center">
              <Icon icon={Radio} size="md" color="success" />
              <VStack gap={0.5}>
                <Heading level={3} className="font-cinzel">
                  REAL-TIME HERO PRESENCE ROSTER
                </Heading>
                <Text type="supporting" size="xsm">
                  Ground-truth presence verified across Realm Gateway &amp; SignalR Support Hub
                </Text>
              </VStack>
            </HStack>

            <HStack gap={2} vAlign="center" wrap="wrap">
              <TextInput
                label="Search Hero or Reference"
                isLabelHidden
                value={searchQuery}
                onChange={setSearchQuery}
                startIcon={Search}
                placeholder="Search Hero or Ref..."
                hasClear
                size="sm"
                width={220}
              />
              <SegmentedControl
                label="Filter hero presence"
                value={presenceFilter}
                onChange={(val) => setPresenceFilter(val as PresenceFilter)}
                size="sm"
              >
                <SegmentedControlItem value="ALL" label={`All (${trackedPlayers.length})`} />
                <SegmentedControlItem value="ONLINE" label={`Online (${presenceCounts.online})`} />
                <SegmentedControlItem
                  value="BATTLE"
                  label={`In Battle (${presenceCounts.battle})`}
                />
                <SegmentedControlItem
                  value="OFFLINE"
                  label={`Offline (${presenceCounts.offline})`}
                />
              </SegmentedControl>
            </HStack>
          </HStack>

          {trackedPlayers.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Users} size="lg" color="accent" />}
              title="No active player sessions currently detected"
              description="Gateway telemetry is listening for hero logins in real-time."
            />
          ) : filteredPlayers.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Search} size="lg" color="secondary" />}
              title="No heroes match the active filter"
              description="Adjust the search query or switch presence state filter."
              actions={
                <Button
                  label="Reset Filter"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPresenceFilter('ALL');
                    setSearchQuery('');
                  }}
                />
              }
            />
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <Table
                data={filteredPlayers as PresenceTableRow[]}
                columns={presenceColumns}
                idKey="playerId"
                density="balanced"
                dividers="rows"
                hasHover
              />
            </div>
          )}

          <Divider />

          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
              Showing {filteredPlayers.length} of {trackedPlayers.length} Heroes across Realm
            </Text>
            <Link href="/players">
              <HStack gap={1} vAlign="center">
                <Text weight="semibold" size="xsm" color="accent" className="font-cinzel">
                  MANAGE IN ACCOUNTS
                </Text>
                <Text size="xsm" color="accent">
                  →
                </Text>
              </HStack>
            </Link>
          </HStack>
        </VStack>
      </Section>

      {/* Game Archives & Realm Infrastructure */}
      <VStack gap={3}>
        <Heading level={3} className="font-cinzel">
          Game Archives &amp; Realm Infrastructure
        </Heading>

        <Grid columns={{ minWidth: 220, max: 4 }} gap={3}>
          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    HERO ARCHIVES
                  </Text>
                  <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                    {activeUnitsCount} Heroes
                  </Text>
                  <Text size="xsm" color="secondary">
                    MongoDB Collection
                  </Text>
                </VStack>
                <Icon icon={Swords} size="lg" color="info" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  Endpoint
                </Text>
                <Text type="code" size="xsm" weight="semibold">
                  /api/UnitDefinition
                </Text>
              </HStack>
            </VStack>
          </Card>

          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    SUMMON BANNERS
                  </Text>
                  <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                    {bannersCount} Banners
                  </Text>
                  <Text size="xsm" color="secondary">
                    Active Gacha Pools
                  </Text>
                </VStack>
                <Icon icon={Gem} size="lg" color="accent" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  Endpoint
                </Text>
                <Text type="code" size="xsm" weight="semibold">
                  /api/gachabanner
                </Text>
              </HStack>
            </VStack>
          </Card>

          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    STORY CHAPTERS
                  </Text>
                  <Text size="2xl" weight="bold" type="code" hasTabularNumbers>
                    {chaptersCount} Chapters
                  </Text>
                  <HStack gap={1} vAlign="center">
                    <Icon icon={TrendingUp} size="xsm" color="success" />
                    <Text size="xsm" color="secondary">
                      Story Maps Configured
                    </Text>
                  </HStack>
                </VStack>
                <Icon icon={BookOpen} size="lg" color="success" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  Endpoint
                </Text>
                <Text type="code" size="xsm" weight="semibold">
                  /api/ChapterConfig
                </Text>
              </HStack>
            </VStack>
          </Card>

          <Card variant="default" padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="start">
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary" className="font-cinzel">
                    REALM GATEWAY
                  </Text>
                  <HStack gap={1.5} vAlign="center">
                    <Activity size={16} />
                    <Text size="lg" weight="bold" type="code">
                      ONLINE (.NET 9)
                    </Text>
                  </HStack>
                  <Text type="code" size="xsm" color="secondary">
                    Active / MongoDB Atlas
                  </Text>
                </VStack>
                <Icon icon={Server} size="lg" color="info" />
              </HStack>
              <Divider />
              <HStack justify="between" vAlign="center">
                <Text type="code" size="xsm" color="secondary">
                  SignalR Hub
                </Text>
                <Badge label="/hubs/support" variant="success" />
              </HStack>
            </VStack>
          </Card>
        </Grid>
      </VStack>

      {/* Emergency Counsel Override Actions */}
      <Section padding={5}>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <HStack gap={3} vAlign="center">
              <Icon icon={ShieldAlert} size="lg" color="error" />
              <VStack gap={0.5}>
                <Heading level={3} className="font-cinzel">
                  EMERGENCY REALM OVERRIDES
                </Heading>
                <Text type="supporting" size="xsm">
                  Direct operational overrides via AdminController endpoints.
                </Text>
              </VStack>
            </HStack>
            {!canOverride && (
              <Badge
                label="RESTRICTED"
                variant="error"
                icon={<Icon icon={ShieldX} />}
              />
            )}
          </HStack>

          {!canOverride && (
            <Banner
              status="warning"
              title="Restricted Operations"
              description="Emergency server overrides are restricted to Technical Support & Administrators (Use Case: Configure System)."
            />
          )}

          <Grid columns={{ minWidth: 260, max: 3 }} gap={3}>
            <Card variant="default" padding={4}>
              <HStack justify="between" vAlign="center" gap={3}>
                <VStack gap={1}>
                  <Text weight="semibold" size="xsm" className="font-cinzel">
                    PLAYER AUTHENTICATION
                  </Text>
                  <HStack gap={1.5} vAlign="center">
                    <Text type="code" size="xsm" color="secondary">
                      Status:
                    </Text>
                    <Badge
                      label={serverState.loginBlocked ? 'BLOCKED' : 'ACTIVE'}
                      variant={serverState.loginBlocked ? 'error' : 'success'}
                    />
                  </HStack>
                </VStack>
                <Button
                  variant={serverState.loginBlocked ? 'secondary' : 'destructive'}
                  size="sm"
                  isDisabled={!canOverride}
                  isLoading={loadingAction === 'login'}
                  icon={<Icon icon={serverState.loginBlocked ? Unlock : Lock} />}
                  label={serverState.loginBlocked ? 'Unblock' : 'Block'}
                  tooltip={!canOverride ? 'Privilege required' : 'Toggle login status'}
                  onClick={toggleLoginStatus}
                />
              </HStack>
            </Card>

            <Card variant="default" padding={4}>
              <HStack justify="between" vAlign="center" gap={3}>
                <VStack gap={1}>
                  <Text weight="semibold" size="xsm" className="font-cinzel">
                    PVP MATCH QUEUE
                  </Text>
                  <HStack gap={1.5} vAlign="center">
                    <Text type="code" size="xsm" color="secondary">
                      Status:
                    </Text>
                    <Badge
                      label={serverState.matchmakingBlocked ? 'PAUSED' : 'ACTIVE'}
                      variant={serverState.matchmakingBlocked ? 'warning' : 'success'}
                    />
                  </HStack>
                </VStack>
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={!canOverride}
                  isLoading={loadingAction === 'queue'}
                  icon={<Icon icon={serverState.matchmakingBlocked ? Unlock : Lock} />}
                  label={serverState.matchmakingBlocked ? 'Resume' : 'Pause'}
                  tooltip={!canOverride ? 'Privilege required' : 'Toggle queue status'}
                  onClick={toggleQueueStatus}
                />
              </HStack>
            </Card>

            <Card variant="red" padding={4}>
              <HStack justify="between" vAlign="center" gap={3}>
                <VStack gap={1}>
                  <Text weight="semibold" size="xsm" className="font-cinzel">
                    RESET MATCHES
                  </Text>
                  <Text size="xsm" color="secondary">
                    Terminates active sessions
                  </Text>
                </VStack>
                <Button
                  variant="destructive"
                  size="sm"
                  isDisabled={!canOverride}
                  isLoading={loadingAction === 'forceStop'}
                  icon={<Icon icon={Power} />}
                  label="Force Stop"
                  tooltip={!canOverride ? 'Privilege required' : 'Force stop all active sessions'}
                  onClick={handleForceStopAll}
                />
              </HStack>
            </Card>
          </Grid>
        </VStack>
      </Section>

      <SensitiveActionModal
        isOpen={pendingOverride !== null}
        title={
          pendingOverride === 'forceStop'
            ? 'Force Stop All Active Matches'
            : pendingOverride === 'login'
              ? serverState.loginBlocked
                ? 'Restore Player Logins'
                : 'Block Player Logins'
              : serverState.matchmakingBlocked
                ? 'Resume PvP Matchmaking Queue'
                : 'Pause PvP Matchmaking Queue'
        }
        description={
          pendingOverride === 'forceStop'
            ? 'Immediately terminates all ongoing dedicated PvP match instances and clears active queues across the realm cluster.'
            : pendingOverride === 'login'
              ? 'Modifies the realm player authentication gateway status via /admin/update-login-status.'
              : 'Modifies PvP matchmaking intake status via /admin/update-queue-status.'
        }
        severity={pendingOverride === 'forceStop' ? 'CRITICAL' : 'HIGH'}
        actionLabel={
          pendingOverride === 'forceStop' ? 'Execute Force Stop' : 'Apply Server Override'
        }
        targetSummary={
          pendingOverride === 'forceStop'
            ? `${activeMatchesCount} active NGO match instances`
            : pendingOverride === 'login'
              ? `Next state: ${!serverState.loginBlocked ? 'BLOCKED' : 'ALLOWED'}`
              : `Next state: ${!serverState.matchmakingBlocked ? 'PAUSED' : 'ACTIVE'}`
        }
        requireKeyword={pendingOverride === 'forceStop' ? 'FORCE STOP' : undefined}
        loading={loadingAction !== null}
        error={overrideError}
        onCancel={() => {
          setPendingOverride(null);
          setOverrideError(null);
        }}
        onConfirm={executePendingOverride}
      />
    </VStack>
  );
};
