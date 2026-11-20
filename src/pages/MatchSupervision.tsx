import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Radio,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  Swords,
  Terminal,
  User,
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
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
import { fetchAvailableLogFiles, fetchMatchLogs } from '../api/matchLogApi';
import { ConsolePage } from '../components/ConsolePage';
import { LogTerminalView } from '../components/LogTerminalView';
import { MatchLogInspector } from '../components/MatchLogInspector';
import type {
  AdminPermissionKey,
  CounselRole,
  LogFileInfo,
  MatchHistoryItem,
  MatchLogLevel,
  MatchLogResponse,
} from '../types';
import { downloadLogText, filterMatchLogLines, formatLogDateTime } from '../utils/logFormat';
import { hasPermission } from '../utils/permissions';
import { isAiOrVirtualPlayerId } from '../utils/presence';

type MatchStatusFilter = 'ALL' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
type MatchModeFilter = 'ALL' | 'PVP' | 'RANKED' | 'FRIENDLY';
type MatchLogFilter = 'ALL' | 'HAS_LOG' | 'NO_LOG';
type MatchTableRow = MatchHistoryItem & Record<string, unknown>;

const MODE_OPTIONS = [
  { value: 'ALL', label: 'All Modes' },
  { value: 'PVP', label: 'PVP' },
  { value: 'RANKED', label: 'Ranked' },
  { value: 'FRIENDLY', label: 'Friendly' },
];

interface MatchSupervisionProps {
  role?: CounselRole;
  permissions?: AdminPermissionKey[];
}

export const MatchSupervision: React.FC<MatchSupervisionProps> = ({
  role = 'Admin',
  permissions,
}) => {
  const canInspectLogs = hasPermission(role, 'matches.logs', permissions);
  const [searchParams] = useSearchParams();
  const queryMatchId = searchParams.get('matchId') || '';
  const [prevQueryMatchId, setPrevQueryMatchId] = useState<string>(queryMatchId);

  const [activeTab, setActiveTab] = useState<'diagnostics' | 'sessions'>(
    canInspectLogs ? 'diagnostics' : 'sessions'
  );
  const [targetMatchId, setTargetMatchId] = useState<string>(queryMatchId);

  if (queryMatchId !== prevQueryMatchId) {
    setPrevQueryMatchId(queryMatchId);
    if (queryMatchId) {
      setTargetMatchId(queryMatchId);
      setActiveTab(canInspectLogs ? 'diagnostics' : 'sessions');
    }
  }

  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [playerNamesMap, setPlayerNamesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  const [inspectingMatch, setInspectingMatch] = useState<MatchHistoryItem | null>(null);

  const [inspectingLogMatch, setInspectingLogMatch] = useState<MatchHistoryItem | null>(null);
  const [modalLogData, setModalLogData] = useState<MatchLogResponse | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalFilterLevel, setModalFilterLevel] = useState<MatchLogLevel | 'ALL'>('ALL');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalCopied, setModalCopied] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('ALL');
  const [modeFilter, setModeFilter] = useState<MatchModeFilter>('ALL');
  const [logFilter, setLogFilter] = useState<MatchLogFilter>('ALL');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(50);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMatchTelemetry = useCallback(async () => {
    const [matchRes, logFilesData, playerRes] = await Promise.allSettled([
      adminClient.get('/Match/history'),
      canInspectLogs ? fetchAvailableLogFiles(200) : Promise.resolve<LogFileInfo[]>([]),
      adminClient.get('/player/all'),
    ]);

    const matchesList =
      matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)
        ? matchRes.value.data
        : null;
    const filesList =
      logFilesData.status === 'fulfilled' && Array.isArray(logFilesData.value)
        ? logFilesData.value
        : null;

    let pMap: Map<string, string> | null = null;
    if (playerRes.status === 'fulfilled' && Array.isArray(playerRes.value.data)) {
      pMap = new Map<string, string>();
      playerRes.value.data.forEach((p: any) => {
        if (p.playerId && !isAiOrVirtualPlayerId(p.playerId)) {
          const name =
            (p.username || '').trim() || `Traveler #${p.playerId.slice(-4).toUpperCase()}`;
          pMap!.set(p.playerId, name);
        }
      });
    }

    return { matchesList, filesList, pMap };
  }, [canInspectLogs]);

  const applyMatchTelemetry = (snapshot: Awaited<ReturnType<typeof loadMatchTelemetry>>) => {
    if (snapshot.matchesList) setMatches(snapshot.matchesList);
    if (snapshot.filesList) setLogFiles(snapshot.filesList);
    if (snapshot.pMap) setPlayerNamesMap(snapshot.pMap);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const snapshot = await loadMatchTelemetry();
      applyMatchTelemetry(snapshot);
    } catch {
      // Graceful error fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadMatchTelemetry()
      .then((snapshot) => {
        if (active) applyMatchTelemetry(snapshot);
      })
      .catch(() => {
        // Graceful error fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadMatchTelemetry]);

  const logFileSet = useMemo(() => {
    const set = new Set<string>();
    logFiles.forEach((f) => {
      if (f.matchId) set.add(f.matchId.toLowerCase().trim());
    });
    return set;
  }, [logFiles]);

  const liveMatches = useMemo(() => {
    return matches.filter((m) => {
      const s = String(m.status || '').toLowerCase();
      return (
        s === 'inprogress' ||
        s === 'active' ||
        s === 'playing' ||
        s === 'running' ||
        m.status === 1
      );
    });
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return matches.filter((m) => {
      const mId = (m.matchId || '').toLowerCase();
      const p1 = (m.player1Id || '').toLowerCase();
      const p2 = (m.player2Id || '').toLowerCase();
      const p1Name = (playerNamesMap.get(m.player1Id || '') || '').toLowerCase();
      const p2Name = (playerNamesMap.get(m.player2Id || '') || '').toLowerCase();
      const mode = String(m.mode || 'pvp').toLowerCase();
      const status = String(m.status || 'completed').toLowerCase();
      const isLive =
        status.includes('progress') ||
        status.includes('active') ||
        status.includes('playing') ||
        m.status === 1;
      const hasLog = logFileSet.has(mId);

      if (q) {
        const matchesQuery =
          mId.includes(q) ||
          p1.includes(q) ||
          p2.includes(q) ||
          p1Name.includes(q) ||
          p2Name.includes(q) ||
          mode.includes(q);
        if (!matchesQuery) return false;
      }

      if (statusFilter === 'LIVE' && !isLive) return false;
      if (statusFilter === 'COMPLETED' && (isLive || status.includes('cancel'))) return false;
      if (statusFilter === 'CANCELLED' && !status.includes('cancel')) return false;
      if (modeFilter !== 'ALL' && mode !== modeFilter.toLowerCase()) return false;
      if (logFilter === 'HAS_LOG' && !hasLog) return false;
      if (logFilter === 'NO_LOG' && hasLog) return false;

      return true;
    });
  }, [matches, searchQuery, statusFilter, modeFilter, logFilter, logFileSet, playerNamesMap]);

  const displayedMatches = useMemo(() => {
    const list = displayLimit === 'ALL' ? filteredMatches : filteredMatches.slice(0, displayLimit);
    return list.map((m, idx) => ({
      ...m,
      _rowKey: m.matchId || m.id || `match-row-${idx}`,
    }));
  }, [filteredMatches, displayLimit]);

  const handleCopy = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openInspectLogModal = async (match: MatchHistoryItem) => {
    setInspectingLogMatch(match);
    setModalLogData(null);
    setModalError(null);
    setModalFilterLevel('ALL');
    setModalSearch('');
    setModalLoading(true);
    try {
      const data = await fetchMatchLogs(match.matchId);
      setModalLogData(data);
    } catch (err: any) {
      setModalLogData(null);
      if (err.response?.status === 404) {
        setModalError('No physical .log file found on VPS disk.');
      } else {
        setModalError(err.message || 'Error reaching backend server.');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const closeInspectLogModal = () => {
    setInspectingLogMatch(null);
    setModalLogData(null);
    setModalError(null);
    setModalLoading(false);
  };

  const filteredModalLines = useMemo(
    () => (modalLogData ? filterMatchLogLines(modalLogData.lines, modalFilterLevel, modalSearch) : []),
    [modalLogData, modalFilterLevel, modalSearch]
  );

  const handleCopyModalLogs = () => {
    if (!modalLogData) return;
    navigator.clipboard.writeText(modalLogData.rawText);
    setModalCopied(true);
    setTimeout(() => setModalCopied(false), 2000);
  };

  const handleDownloadModalLog = () => {
    if (!modalLogData || !inspectingLogMatch) return;
    downloadLogText(inspectingLogMatch.matchId, modalLogData.rawText);
  };

  const logFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Logs' },
      { value: 'HAS_LOG', label: `Has VPS Log (${logFileSet.size})` },
      { value: 'NO_LOG', label: 'No Log / Archived' },
    ],
    [logFileSet.size]
  );

  const displayLimitOptions = useMemo(
    () => [
      { value: '25', label: '25' },
      { value: '50', label: '50' },
      { value: '100', label: '100' },
      { value: '200', label: '200' },
      { value: 'ALL', label: `All (${filteredMatches.length})` },
    ],
    [filteredMatches.length]
  );

  const columns: TableColumn<MatchTableRow>[] = [
    {
      key: 'matchId',
      header: 'Match ID / Mode',
      width: proportional(1.5),
      renderCell: (m) => {
        const mId = m.matchId || m.id || '';
        const dt = formatLogDateTime(m.createdAt);
        return (
          <VStack gap={1}>
            <HStack gap={1.5} vAlign="center">
              <Button
                variant="ghost"
                size="sm"
                label={`#${mId.slice(0, 8)}`}
                onClick={() => setInspectingMatch(m)}
              />
              <IconButton
                label="Copy full GUID"
                tooltip="Copy full GUID"
                variant="ghost"
                size="sm"
                icon={<Icon icon={copiedId === mId ? Check : Copy} />}
                onClick={(e) => handleCopy(mId, e)}
              />
            </HStack>
            <HStack gap={2} vAlign="center">
              <Badge label={String(m.mode || 'PVP').toUpperCase()} variant="yellow" />
              <Text type="code" size="2xs" color="secondary" hasTabularNumbers>
                {dt.date} {dt.time}
              </Text>
            </HStack>
          </VStack>
        );
      },
    },
    {
      key: 'status',
      header: 'Status & Server Host',
      width: proportional(1.4),
      renderCell: (m) => {
        const isLive =
          String(m.status || '').toLowerCase().includes('progress') ||
          String(m.status || '').toLowerCase().includes('active') ||
          String(m.status || '').toLowerCase().includes('playing') ||
          m.status === 1;
        return (
          <VStack gap={1}>
            <HStack gap={1.5} vAlign="center">
              {isLive ? (
                <>
                  <StatusDot variant="error" isPulsing label="Live combat" />
                  <Badge label="LIVE COMBAT" variant="error" icon={<Icon icon={Radio} />} />
                </>
              ) : (
                <Badge label={String(m.status || 'Finished')} variant="neutral" />
              )}
            </HStack>
            <HStack gap={1} vAlign="center">
              <Icon icon={Server} size="xsm" color="info" />
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                {m.serverIp || 'VPS'}:{m.serverPort || '7777'}
              </Text>
            </HStack>
          </VStack>
        );
      },
    },
    {
      key: 'combatants',
      header: 'Combatants (P1 vs P2)',
      width: proportional(2),
      renderCell: (m) => {
        const p1Name = isAiOrVirtualPlayerId(m.player1Id)
          ? 'AI Opponent'
          : playerNamesMap.get(m.player1Id || '') ||
            (m.player1Id ? `Traveler #${m.player1Id.slice(-4).toUpperCase()}` : 'Player 1');
        const p2Name = isAiOrVirtualPlayerId(m.player2Id)
          ? 'AI Opponent'
          : playerNamesMap.get(m.player2Id || '') ||
            (m.player2Id ? `Traveler #${m.player2Id.slice(-4).toUpperCase()}` : 'Player 2');
        return (
          <VStack gap={0.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text size="xsm" weight="semibold" color="accent">
                {p1Name}
              </Text>
              <Badge label="VS" variant="neutral" />
              <Text size="xsm" weight="semibold">
                {p2Name}
              </Text>
            </HStack>
            <Text type="code" size="2xs" color="secondary" maxLines={1}>
              P1: {isAiOrVirtualPlayerId(m.player1Id) ? 'AI' : `${m.player1Id?.slice(0, 10)}...`} • P2: {isAiOrVirtualPlayerId(m.player2Id) ? 'AI' : `${m.player2Id?.slice(0, 10)}...`}
            </Text>
          </VStack>
        );
      },
    },
    {
      key: 'diagnostics',
      header: 'Diagnostics Log',
      width: pixel(150),
      renderCell: (m) => {
        const mId = m.matchId || m.id || '';
        const hasLog = logFileSet.has(mId.toLowerCase());
        return hasLog ? (
          <Badge label="VPS Log Ready" variant="success" icon={<Icon icon={CheckCircle2} />} />
        ) : (
          <Badge label="Archived / Rotated" variant="neutral" />
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(240),
      align: 'end',
      renderCell: (m) => {
        const mId = m.matchId || m.id || '';
        const hasLog = logFileSet.has(mId.toLowerCase());
        return (
          <HStack gap={1.5} hAlign="end" vAlign="center">
            {canInspectLogs && (
              <IconButton
                label={`Open ${mId} in Live Log Terminal`}
                tooltip="Open in Live Log Terminal"
                variant="secondary"
                size="sm"
                icon={<Icon icon={Terminal} />}
                onClick={() => {
                  setTargetMatchId(mId);
                  setActiveTab('diagnostics');
                }}
              />
            )}
            <Button
              variant="secondary"
              size="sm"
              label="Details"
              onClick={() => setInspectingMatch(m)}
            />
            {canInspectLogs && (
              <Button
                variant={hasLog ? 'primary' : 'secondary'}
                size="sm"
                label="Inspect Log"
                endContent={<Icon icon={ChevronRight} />}
                onClick={() => openInspectLogModal(m)}
              />
            )}
          </HStack>
        );
      },
    },
  ];

  return (
    <ConsolePage
      fillBody={activeTab === 'diagnostics'}
      badge="OPERATIONAL TELEMETRY & DIAGNOSTICS"
      badgeVariant="info"
      meta={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="code" size="xsm" color="secondary">
            Netcode NGO 7777–7800
          </Text>
          <Badge
            label={loading ? 'Live: ...' : `${liveMatches.length} Live Battles`}
            variant={liveMatches.length > 0 ? 'success' : 'neutral'}
            icon={<Icon icon={Activity} />}
          />
          <Badge
            label={loading ? 'Matches: ...' : `${matches.length} Recorded`}
            variant="info"
          />
          <Badge
            label={loading ? 'VPS Logs: ...' : `${logFiles.length} VPS Files`}
            variant="yellow"
          />
        </HStack>
      }
      icon={<Icon icon={Swords} size="lg" color="accent" />}
      title="MATCH SUPERVISION & SERVER LOGS"
      subtitle="Authoritative overview of live and historical SRPG battles alongside raw dedicated VPS diagnostic logs."
      actions={
        <Button
          variant="secondary"
          size="sm"
          isLoading={loading}
          icon={<Icon icon={RefreshCw} />}
          label="Sync Telemetry"
          onClick={fetchAllData}
        />
      }
      toolbar={
        <VStack gap={2}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabList
              value={canInspectLogs ? activeTab : 'sessions'}
              onChange={(val) => setActiveTab(val as 'diagnostics' | 'sessions')}
              role="tablist"
            >
              {canInspectLogs && (
                <Tab
                  value="diagnostics"
                  label="Dedicated Server Diagnostics"
                  icon={<Icon icon={Server} />}
                  panelId="match-panel-diagnostics"
                />
              )}
              <Tab
                value="sessions"
                label={`Match Sessions Directory (${matches.length})`}
                icon={<Icon icon={Swords} />}
                endContent={
                  liveMatches.length > 0 ? (
                    <Badge label={`${liveMatches.length} LIVE`} variant="error" />
                  ) : undefined
                }
                panelId="match-panel-sessions"
              />
            </TabList>

            {canInspectLogs && activeTab === 'diagnostics' && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="code" size="xsm" color="secondary">
                  VPS disk retains {logFiles.length} recent logs; older files rotate.
                </Text>
                {targetMatchId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Clear Target"
                    onClick={() => setTargetMatchId('')}
                  />
                )}
              </HStack>
            )}
          </div>

          {(!canInspectLogs || activeTab === 'sessions') && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--color-border-subtle)]">
              <div className="flex-1 min-w-[240px]">
                <TextInput
                  label="Search Match GUID, Player, or Mode"
                  isLabelHidden
                  size="sm"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  startIcon={Search}
                  placeholder="Search by Match GUID, Player ID, Alias, or Mode..."
                  hasClear
                  width="100%"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Match status filter"
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as MatchStatusFilter)}
                  size="sm"
                >
                  <SegmentedControlItem value="ALL" label="ALL" />
                  <SegmentedControlItem value="LIVE" label="LIVE" />
                  <SegmentedControlItem value="COMPLETED" label="COMPLETED" />
                  <SegmentedControlItem value="CANCELLED" label="CANCELLED" />
                </SegmentedControl>

                <Selector
                  label="Mode filter"
                  isLabelHidden
                  startIcon={Swords}
                  options={MODE_OPTIONS}
                  value={modeFilter}
                  onChange={(val) => setModeFilter(val as MatchModeFilter)}
                  variant="secondary"
                  size="sm"
                  width={125}
                />

                <Selector
                  label="Log filter"
                  isLabelHidden
                  startIcon={FileText}
                  options={logFilterOptions}
                  value={logFilter}
                  onChange={(val) => setLogFilter(val as MatchLogFilter)}
                  variant="secondary"
                  size="sm"
                  width={165}
                />

                <Selector
                  label="Rows display limit"
                  isLabelHidden
                  startIcon={SlidersHorizontal}
                  options={displayLimitOptions}
                  value={String(displayLimit)}
                  onChange={(val) => setDisplayLimit(val === 'ALL' ? 'ALL' : Number(val))}
                  variant="secondary"
                  size="sm"
                  width={118}
                />

                <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                  {displayedMatches.length}/{filteredMatches.length}
                </Text>
              </div>
            </div>
          )}
        </VStack>
      }
    >
      {/* Tab 1: Dedicated Server Diagnostics (IDE Split Workbench) */}
      {canInspectLogs && activeTab === 'diagnostics' && (
        <div id="match-panel-diagnostics" className="flex-1 min-h-0 flex flex-col">
          <MatchLogInspector
            initialMatchId={targetMatchId}
            onSelectMatch={setTargetMatchId}
            fillHeight
          />
        </div>
      )}

      {/* Tab 2: Match Sessions Directory */}
      {(!canInspectLogs || activeTab === 'sessions') && (
        <div id="match-panel-sessions">
          <Card padding={3}>
            {displayedMatches.length === 0 ? (
              <EmptyState
                icon={<Icon icon={Swords} size="lg" color="secondary" />}
                title="No match sessions found matching your filters"
                description="Try clearing search criteria or switching status filters."
              />
            ) : (
              <Table
                data={displayedMatches as MatchTableRow[]}
                columns={columns}
                idKey="_rowKey"
                density="balanced"
                dividers="rows"
                hasHover
              />
            )}
          </Card>
        </div>
      )}

      {/* Match Detail Dialog */}
      <Dialog
        isOpen={inspectingMatch !== null}
        onOpenChange={(open) => {
          if (!open) setInspectingMatch(null);
        }}
        purpose="info"
        width={560}
        padding={5}
      >
        <DialogHeader
          title={`Match #${inspectingMatch?.matchId?.slice(0, 10) ?? ''}`}
          subtitle="MATCH SESSION RECORD"
          startContent={<Icon icon={Swords} size="md" color="accent" />}
          onOpenChange={(open) => {
            if (!open) setInspectingMatch(null);
          }}
        />
        {inspectingMatch && (
          <VStack gap={4}>
            <Card variant="muted" padding={3}>
              <VStack gap={2}>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Full Match GUID:
                  </Text>
                  <Text type="code" size="xsm" weight="bold" color="accent">
                    {inspectingMatch.matchId}
                  </Text>
                </HStack>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Game Mode:
                  </Text>
                  <Badge
                    label={String(inspectingMatch.mode || 'PVP').toUpperCase()}
                    variant="yellow"
                  />
                </HStack>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Server Host:
                  </Text>
                  <Text type="code" size="xsm" hasTabularNumbers>
                    {inspectingMatch.serverIp || 'VPS'}:{inspectingMatch.serverPort || '7777'}
                  </Text>
                </HStack>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Recorded Status:
                  </Text>
                  <Badge label={String(inspectingMatch.status || 'Finished')} variant="success" />
                </HStack>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Created At:
                  </Text>
                  <Text type="code" size="xsm" hasTabularNumbers>
                    {formatLogDateTime(inspectingMatch.createdAt).full}
                  </Text>
                </HStack>
              </VStack>
            </Card>

            <Card variant="default" padding={3}>
              <VStack gap={2}>
                <Text type="label" size="xsm" className="font-cinzel">
                  Combatants
                </Text>
                <HStack justify="between" wrap="wrap" gap={2}>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={User} size="xsm" color="info" />
                    <Text size="xsm" weight="semibold">
                      Player 1:
                    </Text>
                  </HStack>
                  <Text type="code" size="xsm">
                    {playerNamesMap.get(inspectingMatch.player1Id || '') ||
                      inspectingMatch.player1Id ||
                      'N/A'}
                  </Text>
                </HStack>
                <Divider />
                <HStack justify="between" wrap="wrap" gap={2}>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={User} size="xsm" color="error" />
                    <Text size="xsm" weight="semibold">
                      Player 2:
                    </Text>
                  </HStack>
                  <Text type="code" size="xsm">
                    {isAiOrVirtualPlayerId(inspectingMatch.player2Id)
                      ? 'AI Opponent (PvE / Story)'
                      : playerNamesMap.get(inspectingMatch.player2Id || '') ||
                        inspectingMatch.player2Id ||
                        'N/A'}
                  </Text>
                </HStack>
              </VStack>
            </Card>

            <Banner
              status={
                logFileSet.has((inspectingMatch.matchId || '').toLowerCase()) ? 'success' : 'info'
              }
              title={
                logFileSet.has((inspectingMatch.matchId || '').toLowerCase())
                  ? 'VPS Log Ready'
                  : 'Archived Session'
              }
              description={
                logFileSet.has((inspectingMatch.matchId || '').toLowerCase())
                  ? 'Physical .log file is present on Dedicated VPS disk ready for diagnostic streaming.'
                  : 'Log file has been rotated/archived from VPS disk. Older sessions retain database records without raw logs.'
              }
            />

            <Divider />

            <HStack gap={2} hAlign="end">
              <Button variant="secondary" label="Close" onClick={() => setInspectingMatch(null)} />
              {canInspectLogs && (
                <Button
                  variant="primary"
                  icon={<Icon icon={Terminal} />}
                  label="Inspect Logs"
                  onClick={() => {
                    const m = inspectingMatch;
                    setInspectingMatch(null);
                    void openInspectLogModal(m);
                  }}
                />
              )}
            </HStack>
          </VStack>
        )}
      </Dialog>

      {/* Inspect Log Dialog */}
      <Dialog
        isOpen={inspectingLogMatch !== null}
        onOpenChange={(open) => {
          if (!open) closeInspectLogModal();
        }}
        purpose="info"
        width={900}
        padding={5}
      >
        <DialogHeader
          title={`Match #${inspectingLogMatch?.matchId ?? ''}`}
          subtitle={
            inspectingLogMatch
              ? `Combatants: ${isAiOrVirtualPlayerId(inspectingLogMatch.player1Id) ? 'AI Opponent' : (playerNamesMap.get(inspectingLogMatch.player1Id || '') || inspectingLogMatch.player1Id || 'P1')} vs ${isAiOrVirtualPlayerId(inspectingLogMatch.player2Id) ? 'AI Opponent' : (playerNamesMap.get(inspectingLogMatch.player2Id || '') || inspectingLogMatch.player2Id || 'P2')} • Server: ${inspectingLogMatch.serverIp || 'VPS'}:${inspectingLogMatch.serverPort || '7777'}`
              : undefined
          }
          startContent={<Icon icon={Terminal} size="md" color="accent" />}
          endContent={
            inspectingLogMatch ? (
              <HStack gap={2} vAlign="center">
                <Badge
                  label={String(inspectingLogMatch.mode || 'PVP').toUpperCase()}
                  variant="yellow"
                />
                <IconButton
                  label="Copy Match GUID"
                  tooltip="Copy GUID"
                  variant="secondary"
                  size="sm"
                  icon={
                    <Icon
                      icon={copiedId === inspectingLogMatch.matchId ? Check : Copy}
                    />
                  }
                  onClick={() => handleCopy(inspectingLogMatch.matchId)}
                />
              </HStack>
            ) : undefined
          }
          onOpenChange={(open) => {
            if (!open) closeInspectLogModal();
          }}
        />

        {inspectingLogMatch && (
          <VStack gap={3}>
            <LogTerminalView
              logData={modalLogData}
              loading={modalLoading}
              errorMessage={modalError}
              selectedMatchId={inspectingLogMatch.matchId}
              filterLevel={modalFilterLevel}
              onFilterLevelChange={setModalFilterLevel}
              searchQuery={modalSearch}
              onSearchQueryChange={setModalSearch}
              maxHeightClass="max-h-[50vh] min-h-[260px]"
              extraControls={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={modalCopied ? Check : Copy} />}
                    label={modalCopied ? 'Copied' : 'Copy'}
                    onClick={handleCopyModalLogs}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={Download} />}
                    label="Export"
                    onClick={handleDownloadModalLog}
                  />
                </>
              }
              errorFallbackDetail={
                <Card variant="muted" padding={3}>
                  <VStack gap={1}>
                    <Text type="code" size="xsm">
                      Match ID: {inspectingLogMatch.matchId}
                    </Text>
                    <Text type="code" size="xsm">
                      Mode: {String(inspectingLogMatch.mode || 'PVP').toUpperCase()}
                    </Text>
                    <Text type="code" size="xsm">
                      Status: {inspectingLogMatch.status || 'Finished'}
                    </Text>
                    <Text type="code" size="xsm">
                      Recorded At: {formatLogDateTime(inspectingLogMatch.createdAt).full}
                    </Text>
                    <Text type="code" size="xsm" color="secondary">
                      Lines Loaded: {filteredModalLines.length}
                    </Text>
                  </VStack>
                </Card>
              }
            />

            <HStack gap={2} hAlign="end">
              <Button variant="secondary" label="Close" onClick={closeInspectLogModal} />
            </HStack>
          </VStack>
        )}
      </Dialog>
    </ConsolePage>
  );
};

export default MatchSupervision;
