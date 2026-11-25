import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { ScrollReveal } from '../components/ui/ScrollReveal';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
  type HubConnectionState,
  type TrackedPlayerPresence,
} from '../services/playerPresenceService';
import type { AdminPermissionKey, CounselRole, ServerState } from '../types';
import { hasPermission } from '../utils/permissions';
import {
  getPresenceBadgeVariant,
  getPresenceDisplayLabel,
  getPresenceStatusDotVariant,
} from '../utils/presenceAstryx';
import {
  isAiOrVirtualPlayerId,
  isAiOrVirtualUsername,
} from '../utils/presence';

interface DashboardOverviewProps {
  role?: CounselRole;
  permissions?: AdminPermissionKey[];
}

type PresenceFilter = 'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE';

type PresenceTableRow = TrackedPlayerPresence & Record<string, unknown>;

const DASHBOARD_TAB_ORDER = ['overview', 'roster', 'controls'] as const;

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  role = 'Admin',
  permissions,
}) => {
  const isTechSupport = role === 'Technical Support' || role === 'Support';
  const canOverride = hasPermission(role, 'server.killswitch', permissions);
  const canViewPayments = hasPermission(role, 'payments.view', permissions);
  const canManageGacha = hasPermission(role, 'gacha.manage', permissions);
  const canManageContent = hasPermission(role, 'content.manage', permissions);
  const canViewPlayers = hasPermission(role, 'players.view', permissions);
  const canViewMatches = hasPermission(role, 'matches.view', permissions);
  const canViewLogs = hasPermission(role, 'matches.logs', permissions);
  const canViewSupport = hasPermission(role, 'support.chat', permissions);

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
  const [hubState, setHubState] = useState<HubConnectionState>('disconnected');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [bannersCount, setBannersCount] = useState<number>(0);
  const [chaptersCount, setChaptersCount] = useState<number>(0);
  const [gatewayLive, setGatewayLive] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'overview' | 'roster' | 'controls'>('overview');
  const [tabDirection, setTabDirection] = useState<'right' | 'left'>('right');
  const [rosterCollapsed, setRosterCollapsed] = useState<boolean>(false);

  const handleTabChange = (nextVal: string) => {
    const next = nextVal as 'overview' | 'roster' | 'controls';
    const prevIdx = DASHBOARD_TAB_ORDER.indexOf(activeView);
    const nextIdx = DASHBOARD_TAB_ORDER.indexOf(next);
    setTabDirection(nextIdx >= prevIdx ? 'right' : 'left');
    setActiveView(next);
  };

  const loadTelemetrySnapshot = useCallback(async () => {
    const [uRes, bRes, pRes, hRes, cRes, stateRes, unifiedData] = await Promise.allSettled([
      adminClient.get('/UnitDefinition'),
      canManageGacha ? adminClient.get('/gachabanner') : Promise.resolve(null),
      canViewPayments ? adminClient.get('/topuppack/all') : Promise.resolve(null),
      canViewPayments ? adminClient.get('/payment/history') : Promise.resolve(null),
      adminClient.get('/ChapterConfig'),
      adminClient.get('/admin/system-state'),
      fetchUnifiedPlayerData(),
    ]);

    const orders =
      hRes.status === 'fulfilled' && hRes.value && Array.isArray(hRes.value.data)
        ? hRes.value.data
        : [];
    const paidOrders = orders.filter((o: any) => o.status === 'PAID');

    return {
      activeUnitsCount:
        uRes.status === 'fulfilled' && Array.isArray(uRes.value.data) ? uRes.value.data.length : 0,
      bannersCount:
        bRes.status === 'fulfilled' && bRes.value && Array.isArray(bRes.value.data)
          ? bRes.value.data.length
          : 0,
      packsCount:
        pRes.status === 'fulfilled' && pRes.value && Array.isArray(pRes.value.data)
          ? pRes.value.data.length
          : 0,
      chaptersCount:
        cRes.status === 'fulfilled' && Array.isArray(cRes.value.data) ? cRes.value.data.length : 0,
      totalOrdersCount: orders.length,
      paidOrdersCount: paidOrders.length,
      totalRevenue: paidOrders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0),
      unified: unifiedData.status === 'fulfilled' ? unifiedData.value : null,
      systemState: stateRes.status === 'fulfilled' ? stateRes.value.data : null,
      gatewayLive: stateRes.status === 'fulfilled' || unifiedData.status === 'fulfilled',
    };
  }, [canManageGacha, canViewPayments]);

  const applyTelemetrySnapshot = (snapshot: Awaited<ReturnType<typeof loadTelemetrySnapshot>>) => {
    setActiveUnitsCount(snapshot.activeUnitsCount);
    setBannersCount(snapshot.bannersCount);
    setPacksCount(snapshot.packsCount);
    setChaptersCount(snapshot.chaptersCount);
    setTotalOrdersCount(snapshot.totalOrdersCount);
    setPaidOrdersCount(snapshot.paidOrdersCount);
    setTotalRevenue(snapshot.totalRevenue);
    setGatewayLive(snapshot.gatewayLive);

    if (snapshot.unified) {
      setTrackedPlayers(snapshot.unified.trackedPlayers);
      setOnlinePlayersCount(snapshot.unified.counts.online);
      setInMatchPlayersCount(snapshot.unified.counts.inBattle);
      setActiveMatchesCount(snapshot.unified.activeMatchesCount);
      setTotalMatchesCount(snapshot.unified.totalMatchesCount);
      setHubState(snapshot.unified.hubState);
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
    setGatewayLive(false);
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
      setHubState(data.hubState);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadTelemetrySnapshot]);

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

  const validTrackedPlayers = useMemo(() => {
    return trackedPlayers.filter(
      (p) => !isAiOrVirtualPlayerId(p.playerId) && !isAiOrVirtualUsername(p.username)
    );
  }, [trackedPlayers]);

  const presenceCounts = useMemo(() => {
    let online = 0;
    let battle = 0;
    let offline = 0;
    for (const p of validTrackedPlayers) {
      if (p.presence.state === 'Online') online += 1;
      else if (p.presence.state === 'InBattle') battle += 1;
      else offline += 1;
    }
    return { online, battle, offline };
  }, [validTrackedPlayers]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return validTrackedPlayers.filter((p) => {
      if (presenceFilter === 'ONLINE' && p.presence.state !== 'Online') return false;
      if (presenceFilter === 'BATTLE' && p.presence.state !== 'InBattle') return false;
      if (presenceFilter === 'OFFLINE' && p.presence.state !== 'Offline') return false;
      if (q) {
        return p.username.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [validTrackedPlayers, presenceFilter, searchQuery]);

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
          {player.presence.state === 'InBattle' && (canViewLogs || canViewMatches) && (
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

  const settlementConversionPct =
    totalOrdersCount > 0 ? ((paidOrdersCount / totalOrdersCount) * 100).toFixed(1) : '0.0';

  const heroRosterCard = (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={2} vAlign="center">
            <Icon icon={Radio} size="md" color="success" />
            <VStack gap={0.5}>
              <Heading level={3}>
                Real-Time Hero Presence Roster
              </Heading>
              <Text type="supporting" size="sm" color="secondary">
                Verified across Realm Gateway &amp; SignalR Lobby Hub
              </Text>
            </VStack>
          </HStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            {!rosterCollapsed && (
              <>
                <TextInput
                  label="Search Hero or Reference"
                  isLabelHidden
                  value={searchQuery}
                  onChange={setSearchQuery}
                  startIcon={Search}
                  placeholder="Search Hero or Ref..."
                  hasClear
                  size="sm"
                  width={200}
                />
                <SegmentedControl
                  label="Filter hero presence"
                  value={presenceFilter}
                  onChange={(val) => setPresenceFilter(val as PresenceFilter)}
                  size="sm"
                >
                  <SegmentedControlItem value="ALL" label={`All (${validTrackedPlayers.length})`} />
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
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              label={rosterCollapsed ? 'Expand' : 'Collapse'}
              onClick={() => setRosterCollapsed((prev) => !prev)}
            />
          </HStack>
        </HStack>

        {!rosterCollapsed && (
          <>
            {validTrackedPlayers.length === 0 ? (
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
              <div
                className={`rounded-lg border border-[var(--color-border)] overflow-hidden ${
                  activeView === 'roster' ? '' : 'max-h-[440px] overflow-y-auto pk-sticky-table'
                }`}
              >
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
              <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                Showing {filteredPlayers.length} of {validTrackedPlayers.length} Heroes across Realm
              </Text>
              {canViewPlayers && (
                <Link href="/players">
                  <HStack gap={1} vAlign="center">
                    <Text weight="semibold" size="sm" color="accent">
                      Manage in Accounts
                    </Text>
                    <Text size="sm" color="accent">
                      →
                    </Text>
                  </HStack>
                </Link>
              )}
            </HStack>
          </>
        )}
      </VStack>
    </Card>
  );

  const emergencyOverridesPanel = (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon={ShieldAlert} size="md" color="error" />
            <VStack gap={0}>
              <Heading level={3} className="font-cinzel">
                EMERGENCY REALM OVERRIDES
              </Heading>
              <Text type="supporting" size="xsm">
                Direct AdminController safety switches
              </Text>
            </VStack>
          </HStack>
          {!canOverride && (
            <Badge label="RESTRICTED" variant="error" icon={<Icon icon={ShieldX} />} />
          )}
        </HStack>

        {!canOverride && (
          <Banner
            status="warning"
            title="Restricted Operations"
            description="Emergency overrides are reserved for Technical Support & Administrators."
          />
        )}

        <VStack gap={2}>
          <Card variant="muted" padding={3}>
            <HStack justify="between" vAlign="center" gap={2}>
              <VStack gap={0.5}>
                <Text weight="semibold" size="xsm" className="font-cinzel">
                  PLAYER AUTHENTICATION
                </Text>
                <HStack gap={1.5} vAlign="center">
                  <Badge
                    label={serverState.loginBlocked ? 'BLOCKED' : 'ACTIVE'}
                    variant={serverState.loginBlocked ? 'error' : 'success'}
                  />
                  <Text type="code" size="xsm" color="secondary">
                    Login Gate
                  </Text>
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

          <Card variant="muted" padding={3}>
            <HStack justify="between" vAlign="center" gap={2}>
              <VStack gap={0.5}>
                <Text weight="semibold" size="xsm" className="font-cinzel">
                  PVP MATCH QUEUE
                </Text>
                <HStack gap={1.5} vAlign="center">
                  <Badge
                    label={serverState.matchmakingBlocked ? 'PAUSED' : 'ACTIVE'}
                    variant={serverState.matchmakingBlocked ? 'warning' : 'success'}
                  />
                  <Text type="code" size="xsm" color="secondary">
                    Matchmaker
                  </Text>
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

          <Card variant="red" padding={3}>
            <HStack justify="between" vAlign="center" gap={2}>
              <VStack gap={0.5}>
                <Text weight="semibold" size="xsm" className="font-cinzel">
                  RESET MATCHES
                </Text>
                <Text size="xsm" color="secondary">
                  Terminates {activeMatchesCount} active sessions
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
        </VStack>
      </VStack>
    </Card>
  );

  const archivesSummaryPanel = (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" vAlign="center">
          <Heading level={3} className="font-cinzel">
            REALM ARCHIVES &amp; GATEWAY
          </Heading>
          <Badge label=".NET 9 + MongoDB" variant="info" />
        </HStack>

        <Grid columns={{ minWidth: 135, max: 2 }} gap={2}>
          <Card variant="muted" padding={3}>
            <VStack gap={0.5}>
              <HStack justify="between" vAlign="center">
                <Text type="label" size="xsm" color="secondary">
                  Heroes
                </Text>
                <Icon icon={Swords} size="sm" color="info" />
              </HStack>
              <Text size="xl" weight="bold" type="code" hasTabularNumbers>
                {activeUnitsCount}
              </Text>
              {canManageContent ? (
                <Link href="/content">
                  <Text size="xsm" color="accent">
                    Open Codex →
                  </Text>
                </Link>
              ) : (
                <Text type="code" size="xsm" color="secondary">
                  Unit Codex
                </Text>
              )}
            </VStack>
          </Card>

          <Card variant="muted" padding={3}>
            <VStack gap={0.5}>
              <HStack justify="between" vAlign="center">
                <Text type="label" size="xsm" color="secondary">
                  Gacha Pools
                </Text>
                <Icon icon={Gem} size="sm" color="accent" />
              </HStack>
              <Text size="xl" weight="bold" type="code" hasTabularNumbers>
                {canManageGacha ? bannersCount : '—'}
              </Text>
              {canManageGacha ? (
                <Link href="/gacha">
                  <Text size="xsm" color="accent">
                    View Banners →
                  </Text>
                </Link>
              ) : (
                <Text type="code" size="xsm" color="secondary">
                  Restricted
                </Text>
              )}
            </VStack>
          </Card>

          <Card variant="muted" padding={3}>
            <VStack gap={0.5}>
              <HStack justify="between" vAlign="center">
                <Text type="label" size="xsm" color="secondary">
                  Chapters
                </Text>
                <Icon icon={BookOpen} size="sm" color="success" />
              </HStack>
              <Text size="xl" weight="bold" type="code" hasTabularNumbers>
                {chaptersCount}
              </Text>
              <Text type="code" size="xsm" color="secondary">
                PvE Story
              </Text>
            </VStack>
          </Card>

          <Card variant="muted" padding={3}>
            <VStack gap={0.5}>
              <HStack justify="between" vAlign="center">
                <Text type="label" size="xsm" color="secondary">
                  Lobby Hub
                </Text>
                <Icon icon={Server} size="sm" color="info" />
              </HStack>
              <HStack gap={1} vAlign="center">
                <StatusDot
                  variant={hubState === 'connected' ? 'success' : 'warning'}
                  isPulsing={hubState === 'connected'}
                  label={hubState === 'connected' ? 'Hub Connected' : 'Polling Fallback'}
                />
                <Text size="sm" weight="bold" type="code">
                  {hubState === 'connected' ? 'LIVE' : 'POLL'}
                </Text>
              </HStack>
              {canViewSupport ? (
                <Link href="/support">
                  <Text type="code" size="xsm" color="accent">
                    Support Desk →
                  </Text>
                </Link>
              ) : (
                <Text type="code" size="xsm" color="secondary">
                  /hubs/lobby
                </Text>
              )}
            </VStack>
          </Card>
        </Grid>
      </VStack>
    </Card>
  );

  return (
    <ConsolePage
      badge="TACTICAL COMMAND HQ"
      badgeVariant="yellow"
      icon={<Icon icon={Crown} size="md" color="accent" />}
      title={isTechSupport ? 'SYSTEM STATUS & TELEMETRY MONITOR' : 'TREASURY & REALM COMMAND'}
      subtitle={
        isTechSupport
          ? 'Monitor infrastructure health, NGO servers, live presence, and emergency overrides.'
          : 'Live telemetry across player concurrency, PayOS settlements, realm overrides, and game archives.'
      }
      meta={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <HStack gap={1} vAlign="center">
            <StatusDot
              variant={gatewayLive ? 'success' : 'error'}
              isPulsing={gatewayLive}
              label={gatewayLive ? 'Gateway Reachable' : 'Gateway Unreachable'}
            />
            <Text type="code" size="xsm" color="secondary">
              {gatewayLive ? 'Gateway Live' : 'Gateway Offline'}
            </Text>
          </HStack>
          {serverState.loginBlocked && <Badge label="LOGIN BLOCKED" variant="error" />}
          {serverState.matchmakingBlocked && <Badge label="QUEUE PAUSED" variant="warning" />}
        </HStack>
      }
      actions={
        <HStack gap={2} vAlign="center">
          {(canViewLogs || canViewMatches) && (
            <Button
              href="/matches"
              variant="secondary"
              size="md"
              icon={<Icon icon={Terminal} />}
              label="Server Logs"
            />
          )}
          <Button
            variant="primary"
            size="md"
            isLoading={loading}
            icon={<Icon icon={RotateCcw} />}
            label="Sync Data"
            onClick={fetchRealTelemetry}
          />
        </HStack>
      }
      toolbar={
        <TabList
          value={activeView}
          onChange={handleTabChange}
          role="tablist"
        >
          <Tab value="overview" label="Command Overview" icon={<Icon icon={Activity} />} />
          <Tab
            value="roster"
            label="Live Hero Roster"
            icon={<Icon icon={Users} />}
            endContent={<Badge label={validTrackedPlayers.length} variant="neutral" />}
          />
          <Tab
            value="controls"
            label="Overrides & Archives"
            icon={<Icon icon={ShieldAlert} />}
            endContent={
              serverState.loginBlocked || serverState.matchmakingBlocked ? (
                <Badge label="OVERRIDE" variant="warning" />
              ) : undefined
            }
          />
        </TabList>
      }
      banner={
        message ? (
          <Banner
            status={message.type === 'success' ? 'success' : 'error'}
            title={message.type === 'success' ? 'Telemetry Action Complete' : 'Operation Failed'}
            description={message.text}
            isDismissable
            onDismiss={() => setMessage(null)}
          />
        ) : undefined
      }
    >
      <VStack gap={4}>
        {activeView === 'overview' && (
          <div
            key="dash-tab-overview"
            className={`${tabDirection === 'right' ? 'pk-tab-slide-right' : 'pk-tab-slide-left'} flex flex-col gap-4`}
          >
            {/* Clean Executive Treasury / Cluster Summary Bar */}
            <Card
              variant="default"
              padding={5}
              className="pk-gold-frame"
              style={{ borderLeftWidth: 3, borderLeftColor: 'var(--color-accent)' }}
            >
              {canViewPayments ? (
                <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
                  <VStack gap={1}>
                    <Text type="label" size="sm" color="secondary" weight="semibold">
                      Realm Treasury Revenue (PayOS Ledger)
                    </Text>
                    <HStack gap={3} vAlign="center" wrap="wrap">
                      <span className="text-3xl font-bold tracking-tight pk-tabular text-[var(--color-text-primary)]">
                        {totalRevenue.toLocaleString()} <span className="text-lg font-semibold text-[var(--color-text-secondary)]">VND</span>
                      </span>
                      <Badge
                        label={`${settlementConversionPct}% Settled`}
                        variant="success"
                      />
                    </HStack>
                  </VStack>
                  <HStack gap={3} vAlign="center" wrap="wrap">
                    <VStack gap={0.5} hAlign="end">
                      <Text size="sm" weight="semibold" className="pk-tabular">
                        {paidOrdersCount} / {totalOrdersCount} Completed Receipts
                      </Text>
                      <Text type="supporting" size="sm" color="secondary">
                        {packsCount} Store Packs • PayOS Gateway Live
                      </Text>
                    </VStack>
                    <Button
                      href="/payments"
                      variant="primary"
                      size="sm"
                      icon={<Icon icon={TrendingUp} />}
                      label="Open Treasury"
                    />
                  </HStack>
                </HStack>
              ) : (
                <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
                  <VStack gap={1}>
                    <Text type="label" size="sm" color="secondary" weight="semibold">
                      Dedicated Server Cluster &amp; Nodes
                    </Text>
                    <HStack gap={2} vAlign="center">
                      <Icon icon={Server} size="lg" color="accent" />
                      <span className="text-2xl font-bold tracking-tight pk-tabular">
                        {activeMatchesCount} Headless Nodes Active
                      </span>
                    </HStack>
                  </VStack>
                  <VStack gap={0.5} hAlign="end">
                    <Text type="code" size="sm" weight="semibold">
                      UDP 7777–7800 • Ubuntu 22.04 LTS
                    </Text>
                    <Text type="supporting" size="sm" color="secondary">
                      Unity Netcode (NGO) • {totalMatchesCount} Matches Recorded
                    </Text>
                  </VStack>
                </HStack>
              )}
            </Card>

            {/* Primary Live KPI Grid (Clean Sans-Serif Tabular Figures) */}
            <Grid columns={{ minWidth: 210, max: 4 }} gap={3} className="pk-kpi-strip">
              <Card variant="default" padding={4} className="pk-interactive-card">
                <VStack gap={2}>
                  <HStack justify="between" vAlign="start">
                    <VStack gap={0.5}>
                      <Text type="label" size="sm" color="secondary" weight="medium">
                        Online Players (CCU)
                      </Text>
                      <span className="text-2xl font-bold tracking-tight pk-tabular">
                        {onlinePlayersCount} <span className="text-sm font-medium text-[var(--color-text-secondary)]">Online</span>
                      </span>
                    </VStack>
                    <Icon icon={Users} size="md" color="success" />
                  </HStack>
                  <HStack justify="between" vAlign="center">
                    <Text type="supporting" size="sm" color="secondary">
                      SignalR LobbyHub
                    </Text>
                    <Badge
                      label={
                        hubState === 'connected'
                          ? 'Connected'
                          : hubState === 'reconnecting'
                            ? 'Reconnecting'
                            : hubState === 'connecting'
                              ? 'Connecting'
                              : 'Polling Sync'
                      }
                      variant={
                        hubState === 'connected'
                          ? 'success'
                          : hubState === 'reconnecting' || hubState === 'connecting'
                            ? 'warning'
                            : 'info'
                      }
                    />
                  </HStack>
                </VStack>
              </Card>

              <Card variant="default" padding={4} className="pk-interactive-card">
                <VStack gap={2}>
                  <HStack justify="between" vAlign="start">
                    <VStack gap={0.5}>
                      <Text type="label" size="sm" color="secondary" weight="medium">
                        In-Match Players
                      </Text>
                      <span className="text-2xl font-bold tracking-tight pk-tabular">
                        {inMatchPlayersCount} <span className="text-sm font-medium text-[var(--color-text-secondary)]">{inMatchPlayersCount === 1 ? 'Hero' : 'Heroes'}</span>
                      </span>
                    </VStack>
                    <Icon icon={Swords} size="md" color="info" />
                  </HStack>
                  <HStack justify="between" vAlign="center">
                    <HStack gap={1} vAlign="center">
                      <Icon icon={Flame} size="sm" color="info" />
                      <Text type="supporting" size="sm" color="secondary" className="pk-tabular">
                        {activeMatchesCount} Live / {totalMatchesCount} Total
                      </Text>
                    </HStack>
                    {canViewMatches && (
                      <Button
                        href="/matches"
                        variant="ghost"
                        size="sm"
                        label="Inspect"
                      />
                    )}
                  </HStack>
                </VStack>
              </Card>

              <Card variant="default" padding={4} className="pk-interactive-card">
                <VStack gap={2}>
                  <HStack justify="between" vAlign="start">
                    <VStack gap={1}>
                      <Text type="label" size="sm" color="secondary" weight="medium">
                        Matchmaking Queue
                      </Text>
                      <Badge
                        label={serverState.matchmakingBlocked ? 'PAUSED' : 'ACTIVE (OPEN)'}
                        variant={serverState.matchmakingBlocked ? 'error' : 'success'}
                      />
                    </VStack>
                    <Icon icon={Clock} size="md" color="accent" />
                  </HStack>
                  <HStack justify="between" vAlign="center">
                    <Text type="supporting" size="sm" color="secondary">
                      {serverState.matchmakingBlocked ? 'Lock Engaged' : 'Turn-Based SRPG'}
                    </Text>
                    <Badge label={serverState.loginBlocked ? 'Login Blocked' : 'Auth Open'} variant={serverState.loginBlocked ? 'error' : 'neutral'} />
                  </HStack>
                </VStack>
              </Card>

              {canViewPayments ? (
                <Card variant="default" padding={4} className="pk-interactive-card">
                  <VStack gap={2}>
                    <HStack justify="between" vAlign="start">
                      <VStack gap={0.5}>
                        <Text type="label" size="sm" color="secondary" weight="medium">
                          Treasury Receipts
                        </Text>
                        <span className="text-2xl font-bold tracking-tight pk-tabular">
                          {paidOrdersCount} <span className="text-sm font-medium text-[var(--color-text-secondary)]">Paid</span>
                        </span>
                      </VStack>
                      <Icon icon={Coins} size="md" color="accent" />
                    </HStack>
                    <HStack justify="between" vAlign="center">
                      <Text type="supporting" size="sm" color="secondary" className="pk-tabular">
                        {totalOrdersCount} Orders
                      </Text>
                      <Button href="/payments" variant="ghost" size="sm" label="Ledger" />
                    </HStack>
                  </VStack>
                </Card>
              ) : (
                <Card variant="default" padding={4} className="pk-interactive-card">
                  <VStack gap={2}>
                    <HStack justify="between" vAlign="start">
                      <VStack gap={0.5}>
                        <Text type="label" size="sm" color="secondary" weight="medium">
                          Netcode Instances
                        </Text>
                        <span className="text-2xl font-bold tracking-tight pk-tabular">
                          {activeMatchesCount} <span className="text-sm font-medium text-[var(--color-text-secondary)]">Live</span>
                        </span>
                      </VStack>
                      <Icon icon={Server} size="md" color="info" />
                    </HStack>
                    <HStack justify="between" vAlign="center">
                      <Text type="code" size="sm" color="secondary">
                        7777–7800 RUDP
                      </Text>
                      <Badge label="Dedicated" variant="info" />
                    </HStack>
                  </VStack>
                </Card>
              )}
            </Grid>

            {/* Operational 2-Column Cockpit: Live Roster + Side Control Stack */}
            <ScrollReveal delayMs={60}>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                <div className="xl:col-span-8">{heroRosterCard}</div>
                <div className="xl:col-span-4 flex flex-col gap-4">
                  {emergencyOverridesPanel}
                  {archivesSummaryPanel}
                </div>
              </div>
            </ScrollReveal>
          </div>
        )}

        {activeView === 'roster' && (
          <div
            key="dash-tab-roster"
            className={tabDirection === 'right' ? 'pk-tab-slide-right' : 'pk-tab-slide-left'}
          >
            {heroRosterCard}
          </div>
        )}

        {activeView === 'controls' && (
          <div
            key="dash-tab-controls"
            className={`${tabDirection === 'right' ? 'pk-tab-slide-right' : 'pk-tab-slide-left'} grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`}
          >
            {emergencyOverridesPanel}
            {archivesSummaryPanel}
          </div>
        )}
      </VStack>

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
    </ConsolePage>
  );
};
