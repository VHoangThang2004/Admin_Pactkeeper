import axios from 'axios';
import { adminClient } from '../api/adminClient';
import type {
  AiBalanceAction,
  AiBalanceAnalysisResponse,
  AiBalanceChangeType,
  AiBalancePriority,
  AiBalanceSuggestion,
  BalanceEntityType,
  BalanceTelemetryMetric,
  BalanceTelemetryResponse,
  GameVersionConfig,
  UpdateGameVersionPayload,
} from '../types';

export interface ServiceResult<T> {
  data: T | null;
  backendConnected: boolean;
  statusCode?: number;
  error?: string;
}

export interface BalanceTelemetryQuery {
  patchVersion?: string;
  mode?: string;
}

export interface AiBalanceSuggestRequest {
  patchVersion?: string;
  mode?: string;
  focusEntityType?: BalanceEntityType | 'all';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(obj: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return fallback;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizePercent(raw: number | undefined, numerator?: number, denominator?: number): number {
  if (
    typeof numerator === 'number' &&
    typeof denominator === 'number' &&
    denominator > 0 &&
    raw === undefined
  ) {
    return Number(((numerator / denominator) * 100).toFixed(2));
  }
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  if (raw > 0 && raw <= 1) {
    return Number((raw * 100).toFixed(2));
  }
  return Number(raw.toFixed(2));
}

function normalizeEntityType(raw: unknown, fallback: BalanceEntityType): BalanceEntityType {
  if (typeof raw !== 'string') return fallback;
  const lower = raw.trim().toLowerCase();
  if (lower.includes('unit') || lower.includes('hero') || lower.includes('character')) return 'unit';
  if (lower.includes('weapon')) return 'weapon';
  if (lower.includes('trinket')) return 'trinket';
  if (lower.includes('skill')) return 'skill';
  return fallback;
}

function normalizeMetric(
  rawItem: unknown,
  fallbackType: BalanceEntityType,
  totalMatches: number
): BalanceTelemetryMetric {
  const item = asRecord(rawItem);
  const entityType = normalizeEntityType(
    item.entityType ?? item.EntityType ?? item.type ?? item.Type,
    fallbackType
  );
  const entityId = pickString(item, ['entityId', 'EntityId', 'id', 'Id', 'uId', 'UId', 'skillId', 'SkillId'], 'unknown');
  const name = pickString(item, ['name', 'Name', 'entityName', 'EntityName', 'displayName', 'DisplayName'], entityId);
  const pickCount = pickNumber(item, ['pickCount', 'PickCount', 'picks', 'Picks', 'usageCount', 'UsageCount']) ?? 0;
  const winCount = pickNumber(item, ['winCount', 'WinCount', 'wins', 'Wins']) ?? 0;
  const sampleMatches =
    pickNumber(item, ['sampleMatches', 'SampleMatches', 'matchCount', 'MatchCount']) ??
    totalMatches;

  const rawWinRate = pickNumber(item, ['winRate', 'WinRate', 'winRatePercent', 'WinRatePercent']);
  const rawPickRate = pickNumber(item, ['pickRate', 'PickRate', 'pickRatePercent', 'PickRatePercent']);
  const rawSurvivalRate = pickNumber(item, ['survivalRate', 'SurvivalRate', 'survivalRatePercent', 'SurvivalRatePercent']);

  return {
    entityType,
    entityId,
    name,
    pickCount,
    pickRate: normalizePercent(rawPickRate, pickCount, sampleMatches > 0 ? sampleMatches : totalMatches),
    winCount,
    winRate: normalizePercent(rawWinRate, winCount, pickCount),
    avgDamage: Number(
      (pickNumber(item, ['avgDamage', 'AvgDamage', 'averageDamage', 'AverageDamage', 'avgDamageDealt', 'AvgDamageDealt']) ?? 0).toFixed(1)
    ),
    avgDamageTaken: pickNumber(item, ['avgDamageTaken', 'AvgDamageTaken', 'averageDamageTaken']),
    avgHealing: pickNumber(item, ['avgHealing', 'AvgHealing', 'avgHealingDone', 'AvgHealingDone']),
    survivalRate:
      rawSurvivalRate !== undefined ? normalizePercent(rawSurvivalRate) : undefined,
    avgKills: pickNumber(item, ['avgKills', 'AvgKills', 'averageKills']),
    sampleMatches,
  };
}

function normalizeTelemetryResponse(raw: unknown, query: BalanceTelemetryQuery): BalanceTelemetryResponse {
  const root = asRecord(raw);
  const totalMatches =
    pickNumber(root, ['totalMatches', 'TotalMatches', 'matchCount', 'MatchCount', 'sampleSize', 'SampleSize']) ?? 0;

  const rawUnits = (root.units ?? root.Units) as unknown[] | undefined;
  const rawWeapons = (root.weapons ?? root.Weapons) as unknown[] | undefined;
  const rawTrinkets = (root.trinkets ?? root.Trinkets) as unknown[] | undefined;
  const rawSkills = (root.skills ?? root.Skills) as unknown[] | undefined;
  const rawFlat = (root.metrics ?? root.Metrics ?? root.items ?? root.Items) as unknown[] | undefined;

  let units: BalanceTelemetryMetric[] = Array.isArray(rawUnits)
    ? rawUnits.map((item) => normalizeMetric(item, 'unit', totalMatches))
    : [];
  let weapons: BalanceTelemetryMetric[] = Array.isArray(rawWeapons)
    ? rawWeapons.map((item) => normalizeMetric(item, 'weapon', totalMatches))
    : [];
  let trinkets: BalanceTelemetryMetric[] = Array.isArray(rawTrinkets)
    ? rawTrinkets.map((item) => normalizeMetric(item, 'trinket', totalMatches))
    : [];
  let skills: BalanceTelemetryMetric[] = Array.isArray(rawSkills)
    ? rawSkills.map((item) => normalizeMetric(item, 'skill', totalMatches))
    : [];

  if (Array.isArray(rawFlat) && units.length + weapons.length + trinkets.length + skills.length === 0) {
    const normalized = rawFlat.map((item) => normalizeMetric(item, 'unit', totalMatches));
    units = normalized.filter((m) => m.entityType === 'unit');
    weapons = normalized.filter((m) => m.entityType === 'weapon');
    trinkets = normalized.filter((m) => m.entityType === 'trinket');
    skills = normalized.filter((m) => m.entityType === 'skill');
  }

  const rawPatches = (root.availablePatchVersions ?? root.AvailablePatchVersions ?? root.patches ?? root.Patches) as unknown;
  const availablePatchVersions = Array.isArray(rawPatches)
    ? rawPatches.map((p) => String(p).trim()).filter(Boolean)
    : [];

  const patchVersion = pickString(
    root,
    ['patchVersion', 'PatchVersion', 'version', 'Version'],
    query.patchVersion || 'ALL'
  );
  if (patchVersion && patchVersion !== 'ALL' && !availablePatchVersions.includes(patchVersion)) {
    availablePatchVersions.unshift(patchVersion);
  }

  return {
    patchVersion,
    availablePatchVersions,
    mode: pickString(root, ['mode', 'Mode'], query.mode || 'ALL'),
    totalMatches,
    generatedAt: pickString(root, ['generatedAt', 'GeneratedAt', 'timestamp', 'Timestamp'], new Date().toISOString()),
    units,
    weapons,
    trinkets,
    skills,
  };
}

function normalizeAiAction(raw: unknown): AiBalanceAction {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper.includes('NERF') || upper.includes('REDUCE') || upper.includes('DECREASE')) return 'NERF';
  if (upper.includes('BUFF') || upper.includes('INCREASE') || upper.includes('BOOST')) return 'BUFF';
  if (upper.includes('MONITOR') || upper.includes('WATCH') || upper.includes('HOLD')) return 'MONITOR';
  return 'ADJUST';
}

function normalizeAiChangeType(raw: unknown): AiBalanceChangeType {
  const upper = String(raw || '').trim().toUpperCase();
  if (
    upper.includes('REBUILD') ||
    upper.includes('CODE') ||
    upper.includes('UNITY') ||
    upper.includes('CLIENT') ||
    upper.includes('MECHANIC')
  ) {
    return 'REBUILD_REQUIRED';
  }
  return 'DB_ONLY';
}

function normalizeAiPriority(raw: unknown): AiBalancePriority {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'HIGH' || upper === 'CRITICAL' || upper === 'P0' || upper === 'P1') return 'HIGH';
  if (upper === 'LOW' || upper === 'P3') return 'LOW';
  return 'MEDIUM';
}

function normalizeAiSuggestion(rawItem: unknown, index: number): AiBalanceSuggestion {
  const item = asRecord(rawItem);
  const entityType = normalizeEntityType(
    item.entityType ?? item.EntityType ?? item.category ?? item.Category,
    'unit'
  );
  const entityName = pickString(
    item,
    ['entityName', 'EntityName', 'targetName', 'TargetName', 'name', 'Name', 'entityId', 'EntityId'],
    `Recommendation #${index + 1}`
  );
  const entityId = pickString(item, ['entityId', 'EntityId', 'targetId', 'TargetId', 'id', 'Id']) || undefined;
  const rawChanges = item.suggestedChanges ?? item.SuggestedChanges ?? item.recommendation ?? item.Recommendation ?? item.change ?? item.Change;
  let suggestedChanges = '';
  if (typeof rawChanges === 'string') {
    suggestedChanges = rawChanges.trim();
  } else if (rawChanges && typeof rawChanges === 'object') {
    suggestedChanges = Object.entries(rawChanges as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
  }

  const rawWinRate = pickNumber(item, ['currentWinRate', 'CurrentWinRate', 'winRate', 'WinRate']);
  const rawPickRate = pickNumber(item, ['currentPickRate', 'CurrentPickRate', 'pickRate', 'PickRate']);

  return {
    id: pickString(item, ['id', 'Id'], `ai-suggestion-${index + 1}`),
    entityType,
    entityId,
    entityName,
    action: normalizeAiAction(item.action ?? item.Action ?? item.direction ?? item.Direction),
    changeType: normalizeAiChangeType(
      item.changeType ?? item.ChangeType ?? item.requiresRebuild ?? item.RequiresRebuild
    ),
    priority: normalizeAiPriority(item.priority ?? item.Priority ?? item.severity ?? item.Severity),
    currentWinRate: rawWinRate !== undefined ? normalizePercent(rawWinRate) : undefined,
    currentPickRate: rawPickRate !== undefined ? normalizePercent(rawPickRate) : undefined,
    rationale: pickString(
      item,
      ['rationale', 'Rationale', 'reason', 'Reason', 'analysis', 'Analysis', 'explanation', 'Explanation'],
      'Flagged by AI balance evaluator based on current telemetry distribution.'
    ),
    suggestedChanges: suggestedChanges || 'Review base stat parameters in Content CMS.',
  };
}

function normalizeAiResponse(raw: unknown, req: AiBalanceSuggestRequest): AiBalanceAnalysisResponse {
  const root = asRecord(raw);
  const rawList = (root.suggestions ?? root.Suggestions ?? root.recommendations ?? root.Recommendations ?? root.items ?? root.Items) as unknown;
  const suggestions = Array.isArray(rawList)
    ? rawList.map((item, idx) => normalizeAiSuggestion(item, idx))
    : [];

  return {
    reportId: pickString(root, ['reportId', 'ReportId', 'id', 'Id']) || undefined,
    model: pickString(root, ['model', 'Model', 'provider', 'Provider']) || undefined,
    generatedAt: pickString(root, ['generatedAt', 'GeneratedAt', 'createdAt', 'CreatedAt'], new Date().toISOString()),
    patchVersion: pickString(root, ['patchVersion', 'PatchVersion'], req.patchVersion || 'ALL'),
    mode: pickString(root, ['mode', 'Mode'], req.mode || 'ALL'),
    summary: pickString(
      root,
      ['summary', 'Summary', 'overview', 'Overview', 'message', 'Message'],
      suggestions.length > 0
        ? `Generated ${suggestions.length} balance recommendation(s) from match telemetry.`
        : 'AI analysis completed with no immediate balance anomalies.'
    ),
    suggestions,
  };
}

function normalizeGameVersion(raw: unknown): GameVersionConfig {
  const root = asRecord(raw);
  return {
    latestVersion: pickString(root, ['latestVersion', 'LatestVersion', 'version', 'Version']),
    minSupportedVersion: pickString(root, ['minSupportedVersion', 'MinSupportedVersion', 'minVersion', 'MinVersion']),
    downloadUrl: pickString(root, ['downloadUrl', 'DownloadUrl', 'updateUrl', 'UpdateUrl']),
    patchNotes: pickString(root, ['patchNotes', 'PatchNotes', 'releaseNotes', 'ReleaseNotes']),
    updatedAt: pickString(root, ['updatedAt', 'UpdatedAt', 'lastUpdatedAt', 'LastUpdatedAt']) || undefined,
    updatedBy: pickString(root, ['updatedBy', 'UpdatedBy']) || undefined,
  };
}

function extractAxiosError(err: unknown, fallbackMessage: string): { statusCode?: number; message: string } {
  if (axios.isAxiosError(err)) {
    const statusCode = err.response?.status;
    const responseData = err.response?.data as Record<string, unknown> | string | undefined;
    if (typeof responseData === 'string' && responseData.trim()) {
      return { statusCode, message: responseData.trim() };
    }
    if (responseData && typeof responseData === 'object') {
      const msg = pickString(responseData, ['message', 'Message', 'error', 'Error', 'title', 'Title']);
      if (msg) return { statusCode, message: msg };
    }
    return { statusCode, message: err.message || fallbackMessage };
  }
  return { message: err instanceof Error ? err.message : fallbackMessage };
}

export async function fetchBalanceTelemetry(
  query: BalanceTelemetryQuery
): Promise<ServiceResult<BalanceTelemetryResponse>> {
  try {
    const params: Record<string, string> = {};
    if (query.patchVersion && query.patchVersion !== 'ALL') {
      params.patchVersion = query.patchVersion;
    }
    if (query.mode && query.mode !== 'ALL') {
      params.mode = query.mode;
    }

    const res = await adminClient.get('/analytics/balance', { params });
    return {
      data: normalizeTelemetryResponse(res.data, query),
      backendConnected: true,
      statusCode: res.status,
    };
  } catch (err) {
    const parsed = extractAxiosError(err, 'Unable to load balance telemetry.');
    return {
      data: null,
      backendConnected: false,
      statusCode: parsed.statusCode,
      error: parsed.message,
    };
  }
}

export async function requestAiBalanceSuggestions(
  payload: AiBalanceSuggestRequest
): Promise<ServiceResult<AiBalanceAnalysisResponse>> {
  try {
    const body: Record<string, string> = {};
    if (payload.patchVersion && payload.patchVersion !== 'ALL') {
      body.patchVersion = payload.patchVersion;
    }
    if (payload.mode && payload.mode !== 'ALL') {
      body.mode = payload.mode;
    }
    if (payload.focusEntityType && payload.focusEntityType !== 'all') {
      body.entityType = payload.focusEntityType;
    }

    const res = await adminClient.post('/analytics/ai-suggest', body);
    return {
      data: normalizeAiResponse(res.data, payload),
      backendConnected: true,
      statusCode: res.status,
    };
  } catch (err) {
    const parsed = extractAxiosError(err, 'Unable to run AI Balance Advisor.');
    return {
      data: null,
      backendConnected: false,
      statusCode: parsed.statusCode,
      error: parsed.message,
    };
  }
}

export async function fetchGameVersion(): Promise<ServiceResult<GameVersionConfig>> {
  try {
    const res = await adminClient.get('/system/version');
    return {
      data: normalizeGameVersion(res.data),
      backendConnected: true,
      statusCode: res.status,
    };
  } catch (err) {
    const parsed = extractAxiosError(err, 'Unable to load current game version.');
    return {
      data: null,
      backendConnected: false,
      statusCode: parsed.statusCode,
      error: parsed.message,
    };
  }
}

export async function updateGameVersion(
  payload: UpdateGameVersionPayload
): Promise<ServiceResult<GameVersionConfig>> {
  try {
    const res = await adminClient.put('/admin/game-version', payload);
    const normalized =
      res.data && typeof res.data === 'object'
        ? normalizeGameVersion(res.data)
        : {
            ...payload,
            updatedAt: new Date().toISOString(),
          };
    return {
      data: normalized,
      backendConnected: true,
      statusCode: res.status,
    };
  } catch (err) {
    const parsed = extractAxiosError(err, 'Failed to publish game version.');
    return {
      data: null,
      backendConnected: false,
      statusCode: parsed.statusCode,
      error: parsed.message,
    };
  }
}
