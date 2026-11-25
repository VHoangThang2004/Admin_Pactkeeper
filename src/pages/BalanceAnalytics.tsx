import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Filter,
  Flame,
  PackageCheck,
  RefreshCw,
  Rocket,
  Scale,
  Search,
  Shield,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { ConsolePage } from '../components/ConsolePage';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  fetchBalanceTelemetry,
  fetchGameVersion,
  requestAiBalanceSuggestions,
  updateGameVersion,
} from '../services/balanceService';
import type {
  AdminPermissionKey,
  AiBalanceAction,
  AiBalanceAnalysisResponse,
  AiBalancePriority,
  BalanceEntityType,
  BalanceModeFilter,
  BalanceTelemetryMetric,
  BalanceTelemetryResponse,
  CounselRole,
  GameVersionConfig,
} from '../types';
import { hasPermission } from '../utils/permissions';

const WINRATE_HIGH_THRESHOLD = 60;
const WINRATE_LOW_THRESHOLD = 40;

type BalanceSectionTab = 'telemetry' | 'ai' | 'version';
type TelemetryRow = BalanceTelemetryMetric & { _rowKey: string } & Record<string, unknown>;
type BalanceThresholdFilter = 'ALL' | 'IMBALANCED';

const MODE_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Modes' },
  { value: 'PVP', label: 'PVP' },
  { value: 'RANKED', label: 'Ranked' },
  { value: 'FRIENDLY', label: 'Friendly' },
];

const AI_FOCUS_OPTIONS: SelectorOptionData[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'unit', label: 'Units Only' },
  { value: 'weapon', label: 'Weapons Only' },
  { value: 'trinket', label: 'Trinkets Only' },
  { value: 'skill', label: 'Skills Only' },
];

function entityTypeToCmsTab(entityType: BalanceEntityType): 'units' | 'weapons' | 'trinkets' | 'skills' {
  switch (entityType) {
    case 'unit':
      return 'units';
    case 'weapon':
      return 'weapons';
    case 'trinket':
      return 'trinkets';
    case 'skill':
      return 'skills';
  }
}

function isOutOfBalance(metric: BalanceTelemetryMetric): boolean {
  if (metric.pickCount <= 0) return false;
  return metric.winRate > WINRATE_HIGH_THRESHOLD || metric.winRate < WINRATE_LOW_THRESHOLD;
}

function getWinrateBadge(metric: BalanceTelemetryMetric): {
  label: string;
  variant: BadgeVariant;
} {
  if (metric.pickCount <= 0) {
    return { label: 'NO DATA', variant: 'neutral' };
  }
  if (metric.winRate > WINRATE_HIGH_THRESHOLD) {
    return { label: 'OVERPOWERED', variant: 'error' };
  }
  if (metric.winRate < WINRATE_LOW_THRESHOLD) {
    return { label: 'UNDERPERFORMING', variant: 'yellow' };
  }
  return { label: 'BALANCED', variant: 'success' };
}

function getActionBadgeVariant(action: AiBalanceAction): BadgeVariant {
  switch (action) {
    case 'NERF':
      return 'error';
    case 'BUFF':
      return 'success';
    case 'ADJUST':
      return 'yellow';
    case 'MONITOR':
      return 'neutral';
  }
}

function getPriorityBadgeVariant(priority: AiBalancePriority): BadgeVariant {
  switch (priority) {
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'yellow';
    case 'LOW':
      return 'neutral';
  }
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface BalanceAnalyticsProps {
  role?: CounselRole;
  permissions?: AdminPermissionKey[];
}

export const BalanceAnalytics: React.FC<BalanceAnalyticsProps> = ({
  role = 'Admin',
  permissions,
}) => {
  const navigate = useNavigate();
  const canManageBalance = hasPermission(role, 'balance.manage', permissions);
  const canManageContent = hasPermission(role, 'content.manage', permissions);

  // Top-level workspace section tab
  const [activeSection, setActiveSection] = useState<BalanceSectionTab>('telemetry');

  // Telemetry state
  const [patchFilter, setPatchFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<BalanceModeFilter>('ALL');
  const [entityTab, setEntityTab] = useState<BalanceEntityType>('unit');
  const [thresholdFilter, setThresholdFilter] = useState<BalanceThresholdFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [telemetry, setTelemetry] = useState<BalanceTelemetryResponse | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(true);
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);

  // AI Balance Advisor state
  const [aiFocus, setAiFocus] = useState<BalanceEntityType | 'all'>('all');
  const [aiReport, setAiReport] = useState<AiBalanceAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Game Version & Release Panel state
  const [currentVersion, setCurrentVersion] = useState<GameVersionConfig | null>(null);
  const [versionLoading, setVersionLoading] = useState<boolean>(true);
  const [versionNotice, setVersionNotice] = useState<string | null>(null);
  const [latestVersionInput, setLatestVersionInput] = useState<string>('');
  const [minSupportedInput, setMinSupportedInput] = useState<string>('');
  const [downloadUrlInput, setDownloadUrlInput] = useState<string>('');
  const [patchNotesInput, setPatchNotesInput] = useState<string>('');
  const [publishingVersion, setPublishingVersion] = useState<boolean>(false);
  const [publishFeedback, setPublishFeedback] = useState<{
    status: 'success' | 'error' | 'warning';
    title: string;
    detail: string;
  } | null>(null);

  const applyTelemetryResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchBalanceTelemetry>>) => {
      if (result.backendConnected && result.data) {
        setTelemetry(result.data);
        setTelemetryNotice(null);
      } else {
        setTelemetry(null);
        setTelemetryNotice(
          result.statusCode === 404
            ? 'Endpoint GET /api/analytics/balance is not yet available on the connected backend (HTTP 404). Once Backend Phase 2 is deployed, telemetry metrics will populate here automatically.'
            : result.error || 'Could not reach GET /api/analytics/balance.'
        );
      }
      setTelemetryLoading(false);
    },
    []
  );

  const applyGameVersionResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchGameVersion>>) => {
      if (result.backendConnected && result.data) {
        setCurrentVersion(result.data);
        setVersionNotice(null);
        setLatestVersionInput(result.data.latestVersion || '');
        setMinSupportedInput(result.data.minSupportedVersion || '');
        setDownloadUrlInput(result.data.downloadUrl || '');
        setPatchNotesInput(result.data.patchNotes || '');
      } else {
        setCurrentVersion(null);
        setVersionNotice(
          result.statusCode === 404
            ? 'Endpoint GET /api/system/version is not yet available on the connected backend (HTTP 404). You can still prepare release metadata once Backend Phase 2 is deployed.'
            : result.error || 'Could not load current game version from GET /api/system/version.'
        );
      }
      setVersionLoading(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetchBalanceTelemetry({
      patchVersion: patchFilter,
      mode: modeFilter,
    }).then((result) => {
      if (!cancelled) {
        applyTelemetryResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patchFilter, modeFilter, applyTelemetryResult]);

  useEffect(() => {
    let cancelled = false;
    fetchGameVersion().then((result) => {
      if (!cancelled) {
        applyGameVersionResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyGameVersionResult]);

  const handleRefreshAll = async () => {
    setTelemetryLoading(true);
    setVersionLoading(true);
    const [telemetryRes, versionRes] = await Promise.all([
      fetchBalanceTelemetry({ patchVersion: patchFilter, mode: modeFilter }),
      fetchGameVersion(),
    ]);
    applyTelemetryResult(telemetryRes);
    applyGameVersionResult(versionRes);
  };

  const handleJumpToCms = useCallback(
    (entityType: BalanceEntityType, searchName: string) => {
      const tab = entityTypeToCmsTab(entityType);
      const params = new URLSearchParams();
      params.set('tab', tab);
      if (searchName.trim()) {
        params.set('search', searchName.trim());
      }
      navigate(`/content?${params.toString()}`);
    },
    [navigate]
  );

  const handleAnalyzeWithAi = async () => {
    setAiLoading(true);
    setAiError(null);
    const result = await requestAiBalanceSuggestions({
      patchVersion: patchFilter,
      mode: modeFilter,
      focusEntityType: aiFocus,
    });
    if (result.backendConnected && result.data) {
      setAiReport(result.data);
    } else {
      setAiError(
        result.statusCode === 404
          ? 'Endpoint POST /api/analytics/ai-suggest is not yet available on the connected backend (HTTP 404). Deploy Backend Phase 2 to enable AI Balance Advisor.'
          : result.error || 'AI Balance Advisor request failed.'
      );
    }
    setAiLoading(false);
  };

  const handlePublishVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBalance) return;

    const latestVersion = latestVersionInput.trim();
    const minSupportedVersion = minSupportedInput.trim();
    const downloadUrl = downloadUrlInput.trim();
    const patchNotes = patchNotesInput.trim();

    if (!latestVersion || !minSupportedVersion) {
      setPublishFeedback({
        status: 'warning',
        title: 'Missing required version fields',
        detail: 'Both LatestVersion and MinSupportedVersion are required before publishing.',
      });
      return;
    }

    if (downloadUrl && !isValidHttpUrl(downloadUrl)) {
      setPublishFeedback({
        status: 'warning',
        title: 'Invalid Download URL',
        detail: 'DownloadUrl must be a valid http:// or https:// URL.',
      });
      return;
    }

    setPublishingVersion(true);
    setPublishFeedback(null);

    const payload = {
      latestVersion,
      minSupportedVersion,
      downloadUrl,
      patchNotes,
    };

    const beforeState = currentVersion
      ? {
          latestVersion: currentVersion.latestVersion,
          minSupportedVersion: currentVersion.minSupportedVersion,
          downloadUrl: currentVersion.downloadUrl,
          patchNotes: currentVersion.patchNotes,
        }
      : undefined;

    const result = await updateGameVersion(payload);

    if (result.backendConnected && result.data) {
      setCurrentVersion(result.data);
      setVersionNotice(null);
      setPublishFeedback({
        status: 'success',
        title: `Published Game Version ${latestVersion}`,
        detail: `MinSupportedVersion set to ${minSupportedVersion}. Clients below minimum version will be prompted to update.`,
      });
      recordAuditEvent({
        action: 'GAME_VERSION_PUBLISHED',
        category: 'SERVER',
        severity: 'CRITICAL',
        targetType: 'GameVersion',
        targetId: latestVersion,
        targetLabel: `v${latestVersion} (min v${minSupportedVersion})`,
        rationale: patchNotes || 'Game version release published via Balance Analytics & Releases.',
        beforeState,
        afterState: payload,
        status: 'SUCCESS',
      });
    } else {
      const errorMsg =
        result.statusCode === 404
          ? 'Endpoint PUT /api/admin/game-version is not yet deployed on the backend (HTTP 404).'
          : result.error || 'Failed to publish game version.';
      setPublishFeedback({
        status: 'error',
        title: 'Version publish failed',
        detail: errorMsg,
      });
      recordAuditEvent({
        action: 'GAME_VERSION_PUBLISHED',
        category: 'SERVER',
        severity: 'CRITICAL',
        targetType: 'GameVersion',
        targetId: latestVersion,
        targetLabel: `v${latestVersion} (min v${minSupportedVersion})`,
        rationale: patchNotes || 'Attempted game version release.',
        beforeState,
        afterState: payload,
        status: 'FAILED',
        errorMessage: errorMsg,
      });
    }

    setPublishingVersion(false);
  };

  const patchOptions = useMemo<SelectorOptionData[]>(() => {
    const set = new Set<string>();
    if (telemetry?.availablePatchVersions) {
      telemetry.availablePatchVersions.forEach((v) => set.add(v));
    }
    if (currentVersion?.latestVersion) {
      set.add(currentVersion.latestVersion);
    }
    if (patchFilter !== 'ALL') {
      set.add(patchFilter);
    }
    return [
      { value: 'ALL', label: 'All Patches' },
      ...Array.from(set).map((v) => ({ value: v, label: `Patch ${v}` })),
    ];
  }, [telemetry, currentVersion, patchFilter]);

  const metricsByTab = useMemo(
    () => ({
      unit: telemetry?.units ?? [],
      weapon: telemetry?.weapons ?? [],
      trinket: telemetry?.trinkets ?? [],
      skill: telemetry?.skills ?? [],
    }),
    [telemetry]
  );

  const imbalancedCounts = useMemo(
    () => ({
      unit: metricsByTab.unit.filter(isOutOfBalance).length,
      weapon: metricsByTab.weapon.filter(isOutOfBalance).length,
      trinket: metricsByTab.trinket.filter(isOutOfBalance).length,
      skill: metricsByTab.skill.filter(isOutOfBalance).length,
    }),
    [metricsByTab]
  );

  const totalImbalanced =
    imbalancedCounts.unit +
    imbalancedCounts.weapon +
    imbalancedCounts.trinket +
    imbalancedCounts.skill;

  const filteredMetrics = useMemo<TelemetryRow[]>(() => {
    const source = metricsByTab[entityTab] ?? [];
    const q = searchQuery.trim().toLowerCase();
    return source
      .filter((item) => {
        if (thresholdFilter === 'IMBALANCED' && !isOutOfBalance(item)) {
          return false;
        }
        if (q) {
          return (
            item.name.toLowerCase().includes(q) ||
            item.entityId.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.winRate - a.winRate)
      .map((item) => ({
        ...item,
        _rowKey: `${item.entityType}-${item.entityId}`,
      }));
  }, [metricsByTab, entityTab, thresholdFilter, searchQuery]);

  const telemetryColumns = useMemo<TableColumn<TelemetryRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Entity',
        width: proportional(1.8, { minWidth: 190 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="semibold">
              {row.name}
            </Text>
            <Text type="code" size="sm" color="secondary">
              ID: {row.entityId}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'winRate',
        header: 'Winrate',
        width: proportional(1.4, { minWidth: 165 }),
        renderCell: (row) => {
          const badge = getWinrateBadge(row);
          const highlighted = isOutOfBalance(row);
          const winRateClass =
            row.pickCount > 0 && row.winRate > WINRATE_HIGH_THRESHOLD
              ? 'text-red-500'
              : row.pickCount > 0 && row.winRate < WINRATE_LOW_THRESHOLD
                ? 'text-amber-500'
                : undefined;
          return (
            <HStack gap={2} vAlign="center" wrap="wrap">
              <span className={winRateClass}>
                <Text size="sm" weight="semibold" hasTabularNumbers>
                  {row.winRate.toFixed(1)}%
                </Text>
              </span>
              <Badge
                label={badge.label}
                variant={badge.variant}
                icon={
                  highlighted ? (
                    <Icon
                      icon={
                        row.winRate > WINRATE_HIGH_THRESHOLD ? TrendingUp : TrendingDown
                      }
                    />
                  ) : undefined
                }
              />
            </HStack>
          );
        },
      },
      {
        key: 'pickRate',
        header: 'Pickrate / Picks',
        width: proportional(1.2, { minWidth: 165 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="medium" hasTabularNumbers>
              {row.pickRate.toFixed(1)}%
            </Text>
            <Text type="code" size="sm" color="secondary" hasTabularNumbers>
              {row.pickCount} picks · {row.winCount}W
            </Text>
          </VStack>
        ),
      },
      {
        key: 'avgDamage',
        header: 'Avg Damage',
        width: proportional(1.1, { minWidth: 150 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" weight="medium" hasTabularNumbers>
              {row.avgDamage.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </Text>
            {typeof row.avgHealing === 'number' && row.avgHealing > 0 && (
              <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                Heal: {row.avgHealing.toFixed(1)}
              </Text>
            )}
          </VStack>
        ),
      },
      {
        key: 'impact',
        header: 'Survival / Kills',
        width: proportional(1.1, { minWidth: 165 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text size="sm" color="secondary" hasTabularNumbers>
              {typeof row.survivalRate === 'number'
                ? `${row.survivalRate.toFixed(1)}% alive`
                : '—'}
            </Text>
            {typeof row.avgKills === 'number' && (
              <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                {row.avgKills.toFixed(2)} avg kills
              </Text>
            )}
          </VStack>
        ),
      },
      {
        key: 'actions',
        header: 'CMS',
        width: pixel(130),
        renderCell: (row) =>
          canManageContent ? (
            <Button
              variant="secondary"
              size="sm"
              label="Edit Stat"
              icon={<Icon icon={ArrowUpRight} />}
              onClick={() => handleJumpToCms(row.entityType, row.name)}
            />
          ) : (
            <Text size="sm" color="secondary">
              Read-only
            </Text>
          ),
      },
    ],
    [canManageContent, handleJumpToCms]
  );

  return (
    <ConsolePage
      badge="FLOW 5 · LIVEOPS BALANCE"
      badgeVariant="purple"
      meta={
        <HStack gap={2} vAlign="center">
          <StatusDot
            variant={telemetry ? 'success' : 'warning'}
            label={telemetry ? 'Telemetry connected' : 'Awaiting backend telemetry'}
          />
          <Text type="code" size="sm" color="secondary">
            {telemetry
              ? `Updated ${formatTimestamp(telemetry.generatedAt)}`
              : 'Endpoints: /analytics/balance · /analytics/ai-suggest · /admin/game-version'}
          </Text>
        </HStack>
      }
      title="Balance Analytics & Releases"
      subtitle="Inspect match telemetry across Units, Weapons, Trinkets & Skills, consult the AI Balance Advisor for DB hotfixes vs Unity rebuilds, and publish new Game Versions."
      actions={
        <HStack gap={2} vAlign="center" wrap="wrap">
          {canManageContent && (
            <Button
              variant="secondary"
              size="sm"
              label="Content CMS"
              icon={<Icon icon={Database} />}
              onClick={() => navigate('/content')}
            />
          )}
          <Button
            variant="primary"
            size="sm"
            label="Refresh Data"
            icon={<Icon icon={RefreshCw} />}
            isLoading={telemetryLoading || versionLoading}
            onClick={() => void handleRefreshAll()}
          />
        </HStack>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabList
            aria-label="Balance analytics sections"
            value={activeSection}
            onChange={(val) => setActiveSection(val as BalanceSectionTab)}
          >
            <Tab
              value="telemetry"
              label="Match Telemetry Matrix"
              icon={<Icon icon={Scale} />}
              endContent={
                totalImbalanced > 0 ? (
                  <Badge label={String(totalImbalanced)} variant="error" />
                ) : undefined
              }
              panelId="balance-section-telemetry"
            />
            <Tab
              value="ai"
              label="AI Balance Advisor"
              icon={<Icon icon={Bot} />}
              endContent={
                aiReport && aiReport.suggestions.length > 0 ? (
                  <Badge label={`${aiReport.suggestions.length} Tips`} variant="purple" />
                ) : undefined
              }
              panelId="balance-section-ai"
            />
            <Tab
              value="version"
              label="Game Version & Release Panel"
              icon={<Icon icon={Rocket} />}
              endContent={
                currentVersion?.latestVersion ? (
                  <Badge label={`v${currentVersion.latestVersion}`} variant="yellow" />
                ) : undefined
              }
              panelId="balance-section-version"
            />
          </TabList>
        </div>
      }
    >
      <VStack gap={5}>
        {/* Top KPI Summary Strip */}
        <Grid columns={{ minWidth: 220 }} gap={3}>
          <Card padding={4}>
            <VStack gap={1.5}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text size="xsm" color="secondary" weight="medium">
                  MATCHES SAMPLED
                </Text>
                <Icon icon={Swords} size="sm" />
              </HStack>
              <Heading level={3}>
                {telemetry ? telemetry.totalMatches.toLocaleString() : '—'}
              </Heading>
              <Text size="sm" color="secondary">
                Patch: {patchFilter === 'ALL' ? 'All' : patchFilter} · Mode: {modeFilter}
              </Text>
            </VStack>
          </Card>

          <Card padding={4}>
            <VStack gap={1.5}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text size="xsm" color="secondary" weight="medium">
                  IMBALANCE ALERTS
                </Text>
                <Icon icon={AlertTriangle} size="sm" />
              </HStack>
              <HStack gap={2} vAlign="center">
                <Heading level={3}>
                  {telemetry ? totalImbalanced : '—'}
                </Heading>
                {telemetry && totalImbalanced > 0 && (
                  <Badge label="ACTION NEEDED" variant="error" />
                )}
              </HStack>
              <Text size="sm" color="secondary">
                Threshold: Winrate &gt; {WINRATE_HIGH_THRESHOLD}% or &lt; {WINRATE_LOW_THRESHOLD}%
              </Text>
            </VStack>
          </Card>

          <Card padding={4}>
            <VStack gap={1.5}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text size="xsm" color="secondary" weight="medium">
                  ACTIVE GAME VERSION
                </Text>
                <Icon icon={PackageCheck} size="sm" />
              </HStack>
              <Heading level={3}>
                {currentVersion?.latestVersion ? `v${currentVersion.latestVersion}` : '—'}
              </Heading>
              <Text size="sm" color="secondary" hasTabularNumbers>
                Min supported:{' '}
                {currentVersion?.minSupportedVersion
                  ? `v${currentVersion.minSupportedVersion}`
                  : 'Not configured'}
              </Text>
            </VStack>
          </Card>

          <Card padding={4}>
            <VStack gap={1.5}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text size="xsm" color="secondary" weight="medium">
                  AI ADVISOR REPORT
                </Text>
                <Icon icon={Bot} size="sm" />
              </HStack>
              <Heading level={3}>
                {aiReport ? `${aiReport.suggestions.length} Tips` : 'Ready'}
              </Heading>
              <Text size="sm" color="secondary">
                {aiReport
                  ? `Generated ${formatTimestamp(aiReport.generatedAt)}`
                  : 'Open AI Balance Advisor tab'}
              </Text>
            </VStack>
          </Card>
        </Grid>

        {/* TAB 1: MATCH TELEMETRY MATRIX */}
        {activeSection === 'telemetry' && (
          <div id="balance-section-telemetry">
            <Card padding={5}>
              <VStack gap={4}>
                <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                  <VStack gap={1}>
                    <HStack gap={2} vAlign="center">
                      <Icon icon={Scale} size="sm" />
                      <Heading level={4}>Match Telemetry Matrix</Heading>
                      <Badge label="GET /api/analytics/balance" variant="neutral" />
                    </HStack>
                    <Text size="xsm" color="secondary">
                      Aggregated winrate, pickrate, and average combat output per Unit, Weapon, Trinket &amp; Skill.
                      Entries above {WINRATE_HIGH_THRESHOLD}% or below {WINRATE_LOW_THRESHOLD}% winrate are highlighted.
                    </Text>
                  </VStack>

                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Selector
                      label="Patch Version"
                      isLabelHidden
                      startIcon={Filter}
                      options={patchOptions}
                      value={patchFilter}
                      onChange={(val) => {
                        setTelemetryLoading(true);
                        setPatchFilter(String(val));
                      }}
                      variant="secondary"
                      size="sm"
                      width={155}
                    />
                    <Selector
                      label="Match Mode"
                      isLabelHidden
                      startIcon={Swords}
                      options={MODE_OPTIONS}
                      value={modeFilter}
                      onChange={(val) => {
                        setTelemetryLoading(true);
                        setModeFilter(val as BalanceModeFilter);
                      }}
                      variant="secondary"
                      size="sm"
                      width={155}
                    />
                  </HStack>
                </HStack>

                {telemetryNotice && (
                  <Banner
                    status="info"
                    title="Telemetry Endpoint Status"
                    description={telemetryNotice}
                  />
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabList
                    aria-label="Telemetry entity category"
                    value={entityTab}
                    onChange={(val) => setEntityTab(val as BalanceEntityType)}
                  >
                    <Tab
                      value="unit"
                      label={`Units (${metricsByTab.unit.length})`}
                      icon={<Icon icon={Shield} />}
                      endContent={
                        imbalancedCounts.unit > 0 ? (
                          <Badge label={String(imbalancedCounts.unit)} variant="error" />
                        ) : undefined
                      }
                      panelId="telemetry-panel-unit"
                    />
                    <Tab
                      value="weapon"
                      label={`Weapons (${metricsByTab.weapon.length})`}
                      icon={<Icon icon={Swords} />}
                      endContent={
                        imbalancedCounts.weapon > 0 ? (
                          <Badge label={String(imbalancedCounts.weapon)} variant="error" />
                        ) : undefined
                      }
                      panelId="telemetry-panel-weapon"
                    />
                    <Tab
                      value="trinket"
                      label={`Trinkets (${metricsByTab.trinket.length})`}
                      icon={<Icon icon={Sparkles} />}
                      endContent={
                        imbalancedCounts.trinket > 0 ? (
                          <Badge label={String(imbalancedCounts.trinket)} variant="error" />
                        ) : undefined
                      }
                      panelId="telemetry-panel-trinket"
                    />
                    <Tab
                      value="skill"
                      label={`Skills (${metricsByTab.skill.length})`}
                      icon={<Icon icon={Flame} />}
                      endContent={
                        imbalancedCounts.skill > 0 ? (
                          <Badge label={String(imbalancedCounts.skill)} variant="error" />
                        ) : undefined
                      }
                      panelId="telemetry-panel-skill"
                    />
                  </TabList>

                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <SegmentedControl
                      label="Balance threshold filter"
                      value={thresholdFilter}
                      onChange={(val) => setThresholdFilter(val as BalanceThresholdFilter)}
                      size="sm"
                    >
                      <SegmentedControlItem value="ALL" label="All" />
                      <SegmentedControlItem
                        value="IMBALANCED"
                        label={`Outliers (${imbalancedCounts[entityTab]})`}
                      />
                    </SegmentedControl>

                    <TextInput
                      label="Search entity"
                      isLabelHidden
                      size="sm"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      startIcon={Search}
                      placeholder="Filter by name or ID..."
                      hasClear
                      width={220}
                    />
                  </HStack>
                </div>

                {filteredMetrics.length === 0 ? (
                  <EmptyState
                    icon={<Icon icon={Scale} size="lg" color="secondary" />}
                    title={
                      telemetryLoading
                        ? 'Loading match telemetry...'
                        : telemetryNotice
                          ? 'Awaiting Backend Telemetry Data'
                          : thresholdFilter === 'IMBALANCED'
                            ? 'No out-of-balance outliers in this category'
                            : 'No telemetry records match current filters'
                    }
                    description={
                      telemetryLoading
                        ? 'Fetching aggregated combat stats from /api/analytics/balance.'
                        : telemetryNotice
                          ? 'No mock figures are fabricated here. Connect Backend Phase 2 (/api/analytics/balance) to inspect live match metrics.'
                          : 'Try switching Patch Version, Match Mode, or clearing your search filter.'
                    }
                  />
                ) : (
                  <div className="pk-scrollable-panel pk-sticky-table rounded-lg border border-[var(--color-border-subtle)]">
                    <Table
                      data={filteredMetrics}
                      columns={telemetryColumns}
                      idKey="_rowKey"
                      density="balanced"
                      dividers="rows"
                      hasHover
                    />
                  </div>
                )}
              </VStack>
            </Card>
          </div>
        )}

        {/* TAB 2: AI BALANCE ADVISOR */}
        {activeSection === 'ai' && (
          <div key="balance-section-ai" id="balance-section-ai" className="pk-tab-panel">
            <Card padding={5} className="pk-gold-frame">
              <VStack gap={4}>
                <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                  <VStack gap={1}>
                    <HStack gap={2} vAlign="center">
                      <Icon icon={Bot} size="sm" />
                      <Heading level={4}>AI Balance Advisor</Heading>
                      <Badge label="POST /api/analytics/ai-suggest" variant="purple" />
                    </HStack>
                    <Text size="xsm" color="secondary">
                      Send current match telemetry to AI for stat tuning suggestions. DB-only tweaks jump
                      straight into Content CMS without rebuilding Unity.
                    </Text>
                  </VStack>

                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Selector
                      label="Patch Version"
                      isLabelHidden
                      startIcon={Filter}
                      options={patchOptions}
                      value={patchFilter}
                      onChange={(val) => {
                        setTelemetryLoading(true);
                        setPatchFilter(String(val));
                      }}
                      variant="secondary"
                      size="sm"
                      width={155}
                    />
                    <Selector
                      label="Match Mode"
                      isLabelHidden
                      startIcon={Swords}
                      options={MODE_OPTIONS}
                      value={modeFilter}
                      onChange={(val) => {
                        setTelemetryLoading(true);
                        setModeFilter(val as BalanceModeFilter);
                      }}
                      variant="secondary"
                      size="sm"
                      width={155}
                    />
                    <Selector
                      label="AI analysis focus"
                      isLabelHidden
                      startIcon={Filter}
                      options={AI_FOCUS_OPTIONS}
                      value={aiFocus}
                      onChange={(val) => setAiFocus(val as BalanceEntityType | 'all')}
                      variant="secondary"
                      size="sm"
                      width={165}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      label={aiLoading ? 'Analyzing Telemetry...' : 'Analyze with AI'}
                      icon={<Icon icon={Sparkles} />}
                      isLoading={aiLoading}
                      onClick={() => void handleAnalyzeWithAi()}
                    />
                  </HStack>
                </HStack>

                {aiError && (
                  <Banner
                    status="warning"
                    title="AI Balance Advisor Unavailable"
                    description={aiError}
                  />
                )}

                {aiReport ? (
                  <VStack gap={3}>
                    <Banner
                      status="info"
                      title={
                        aiReport.model
                          ? `AI Summary (${aiReport.model})`
                          : 'AI Balance Summary'
                      }
                      description={aiReport.summary}
                    />

                    {aiReport.suggestions.length === 0 ? (
                      <EmptyState
                        title="Meta looks balanced"
                        description="The AI evaluator did not flag any urgent nerfs or buffs for the selected patch and mode."
                      />
                    ) : (
                      <VStack gap={3}>
                        {aiReport.suggestions.map((item) => {
                          const isRebuild = item.changeType === 'REBUILD_REQUIRED';
                          return (
                            <Card key={item.id} padding={3}>
                              <VStack gap={2}>
                                <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                                  <HStack gap={2} vAlign="center" wrap="wrap">
                                    <Text size="sm" weight="semibold">
                                      {item.entityName}
                                    </Text>
                                    <Badge
                                      label={item.entityType.toUpperCase()}
                                      variant="neutral"
                                    />
                                    <Badge
                                      label={item.action}
                                      variant={getActionBadgeVariant(item.action)}
                                    />
                                    <Badge
                                      label={item.priority}
                                      variant={getPriorityBadgeVariant(item.priority)}
                                    />
                                  </HStack>

                                  <Badge
                                    label={isRebuild ? 'REBUILD REQUIRED' : 'DB ONLY (CMS)'}
                                    variant={isRebuild ? 'purple' : 'cyan'}
                                    icon={<Icon icon={isRebuild ? Wrench : Database} />}
                                  />
                                </HStack>

                                {(item.currentWinRate !== undefined ||
                                  item.currentPickRate !== undefined) && (
                                  <HStack gap={3} vAlign="center">
                                    {item.currentWinRate !== undefined && (
                                      <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                                        Winrate: {item.currentWinRate.toFixed(1)}%
                                      </Text>
                                    )}
                                    {item.currentPickRate !== undefined && (
                                      <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                                        Pickrate: {item.currentPickRate.toFixed(1)}%
                                      </Text>
                                    )}
                                  </HStack>
                                )}

                                <Text size="xsm" color="secondary">
                                  {item.rationale}
                                </Text>

                                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
                                  <Text size="xsm" weight="medium">
                                    Suggested Adjustment: {item.suggestedChanges}
                                  </Text>
                                </div>

                                <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                                  {isRebuild ? (
                                    <Text size="sm" color="secondary">
                                      Requires Unity client / Headless Server rebuild, then publish a new version in Game Version &amp; Release Panel.
                                    </Text>
                                  ) : (
                                    <Text size="sm" color="secondary">
                                      No client rebuild needed — hotfix directly in Content CMS.
                                    </Text>
                                  )}

                                  <HStack gap={2} vAlign="center">
                                    {isRebuild && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        label="Open Release Panel"
                                        icon={<Icon icon={Rocket} />}
                                        onClick={() => setActiveSection('version')}
                                      />
                                    )}
                                    {canManageContent && (
                                      <Button
                                        variant={isRebuild ? 'ghost' : 'secondary'}
                                        size="sm"
                                        label="Edit in Content CMS"
                                        icon={<Icon icon={ArrowUpRight} />}
                                        onClick={() =>
                                          handleJumpToCms(item.entityType, item.entityName)
                                        }
                                      />
                                    )}
                                  </HStack>
                                </HStack>
                              </VStack>
                            </Card>
                          );
                        })}
                      </VStack>
                    )}
                  </VStack>
                ) : (
                  <EmptyState
                    icon={<Icon icon={Bot} size="lg" color="secondary" />}
                    title="No AI analysis run yet"
                    description='Click "Analyze with AI" to evaluate winrate/pickrate outliers and generate actionable DB or Unity balance recommendations.'
                  />
                )}
              </VStack>
            </Card>
          </div>
        )}

        {/* TAB 3: GAME VERSION & RELEASE PANEL */}
        {activeSection === 'version' && (
          <div id="balance-section-version">
            <Card padding={5}>
              <form onSubmit={(e) => void handlePublishVersion(e)}>
                <VStack gap={4}>
                  <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center">
                        <Icon icon={Rocket} size="sm" />
                        <Heading level={4}>Game Version &amp; Release Panel</Heading>
                        <Badge label="PUT /api/admin/game-version" variant="yellow" />
                      </HStack>
                      <Text size="xsm" color="secondary">
                        After rebuilding the Unity client and deploying the new Headless Server to VPS,
                        publish the updated version metadata here so outdated clients prompt players to update.
                      </Text>
                    </VStack>
                  </HStack>

                  {versionNotice && (
                    <Banner
                      status="info"
                      title="Version Config Endpoint Status"
                      description={versionNotice}
                    />
                  )}

                  {!canManageBalance && (
                    <Banner
                      status="warning"
                      title="Read-Only Access"
                      description="Your role has balance.view access only. Publishing a new game version requires the balance.manage permission."
                    />
                  )}

                  {publishFeedback && (
                    <Banner
                      status={publishFeedback.status}
                      title={publishFeedback.title}
                      description={publishFeedback.detail}
                    />
                  )}

                  {currentVersion && (
                    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                        <HStack gap={2} vAlign="center">
                          <Icon icon={CheckCircle2} size="sm" />
                          <Text size="xsm" weight="semibold" hasTabularNumbers>
                            Live: v{currentVersion.latestVersion || '—'} · Min: v
                            {currentVersion.minSupportedVersion || '—'}
                          </Text>
                        </HStack>
                        <Text type="code" size="sm" color="secondary">
                          Updated: {formatTimestamp(currentVersion.updatedAt)}
                        </Text>
                      </HStack>
                      {currentVersion.downloadUrl && (
                        <div className="mt-1.5">
                          <a
                            href={currentVersion.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100"
                          >
                            <span>{currentVersion.downloadUrl}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <Divider />

                  <Grid columns={{ minWidth: 240 }} gap={3}>
                    <TextInput
                      label="Latest Version"
                      value={latestVersionInput}
                      onChange={setLatestVersionInput}
                      placeholder="e.g. 0.05 or 1.1.0"
                      isDisabled={!canManageBalance || publishingVersion}
                      width="100%"
                    />
                    <TextInput
                      label="Min Supported Version"
                      value={minSupportedInput}
                      onChange={setMinSupportedInput}
                      placeholder="e.g. 0.04 or 1.0.0"
                      isDisabled={!canManageBalance || publishingVersion}
                      width="100%"
                    />
                  </Grid>

                  <TextInput
                    label="Download URL"
                    value={downloadUrlInput}
                    onChange={setDownloadUrlInput}
                    placeholder="https://downloads.pactkeeper.gg/builds/pactkeeper-0.05.zip"
                    isDisabled={!canManageBalance || publishingVersion}
                    width="100%"
                  />

                  <TextArea
                    label="Patch Notes"
                    value={patchNotesInput}
                    onChange={setPatchNotesInput}
                    placeholder="Summarize balance changes, bug fixes, and breaking client updates..."
                    rows={5}
                    isDisabled={!canManageBalance || publishingVersion}
                    width="100%"
                  />

                  <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                    <Text size="sm" color="secondary">
                      Recorded in Security Audit Log as GAME_VERSION_PUBLISHED (CRITICAL).
                    </Text>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      label={publishingVersion ? 'Publishing...' : 'Publish Game Version'}
                      icon={<Icon icon={Rocket} />}
                      isLoading={publishingVersion}
                      isDisabled={!canManageBalance}
                    />
                  </HStack>
                </VStack>
              </form>
            </Card>
          </div>
        )}
      </VStack>
    </ConsolePage>
  );
};
