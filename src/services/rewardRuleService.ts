import axios from 'axios';
import { adminClient } from '../api/adminClient';
import type {
  GachaRewardType,
  PlayerActionLogDto,
  RewardConditionDto,
  RewardItemDto,
  RewardRuleDto,
  RewardRuleStatsDto,
  UpsertRewardRulePayload,
} from '../types';

export interface RewardRuleCollectionResult {
  items: RewardRuleDto[];
  includesInactive: boolean;
  notice?: string;
}

export interface SimulatedConditionTrace {
  condition: RewardConditionDto;
  actualValue: unknown;
  hasField: boolean;
  passed: boolean;
  reason: string;
}

export interface SimulatedRuleEvaluation {
  rule: RewardRuleDto;
  actionTypeMatched: boolean;
  isActive: boolean;
  matched: boolean;
  conditionTraces: SimulatedConditionTrace[];
  delta: number;
  targetCount: number;
  projectedCount: number;
  wouldComplete: boolean;
  skipReason?: string;
}

function normalizeRewardType(raw: unknown): GachaRewardType {
  if (typeof raw === 'number') {
    if (raw === 0) return 'Unit';
    if (raw === 1) return 'Weapon';
    if (raw === 2) return 'Trinket';
    return 'Gems';
  }
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'unit') return 'Unit';
  if (s === 'weapon') return 'Weapon';
  if (s === 'trinket') return 'Trinket';
  return 'Gems';
}

function normalizeReward(raw: Record<string, unknown> | undefined | null): RewardItemDto {
  const type = normalizeRewardType(raw?.type ?? raw?.Type);
  const definitionId = Number(raw?.definitionId ?? raw?.DefinitionId ?? 0) || 0;
  const classId = Number(raw?.classId ?? raw?.ClassId ?? 0) || 0;
  const amount = Math.max(1, Number(raw?.amount ?? raw?.Amount ?? 1) || 1);
  return {
    type,
    definitionId: type === 'Gems' ? 0 : definitionId,
    classId: type === 'Unit' ? classId : 0,
    amount: type === 'Gems' ? amount : 1,
  };
}

function normalizeCondition(raw: Record<string, unknown>): RewardConditionDto {
  return {
    field: String(raw.field ?? raw.Field ?? '').trim(),
    op: String(raw.op ?? raw.Op ?? '==').trim(),
    value: String(raw.value ?? raw.Value ?? ''),
  };
}

export function normalizeRewardRule(raw: Record<string, unknown>): RewardRuleDto {
  const rawConditions = Array.isArray(raw.conditions ?? raw.Conditions)
    ? ((raw.conditions ?? raw.Conditions) as Array<Record<string, unknown>>)
    : [];
  const rawAcc = raw.accumulateField ?? raw.AccumulateField;
  const accumulateField =
    typeof rawAcc === 'string' && rawAcc.trim().length > 0 ? rawAcc.trim() : null;

  return {
    id: String(raw.id ?? raw.Id ?? ''),
    actionType: String(raw.actionType ?? raw.ActionType ?? ''),
    conditions: rawConditions.map(normalizeCondition),
    accumulateField,
    targetCount: Math.max(1, Number(raw.targetCount ?? raw.TargetCount ?? 1) || 1),
    reward: normalizeReward((raw.reward ?? raw.Reward) as Record<string, unknown> | undefined),
    isActive: Boolean(raw.isActive ?? raw.IsActive ?? true),
    title: String(raw.title ?? raw.Title ?? '').trim(),
    description: String(raw.description ?? raw.Description ?? '').trim(),
  };
}

export function extractRewardApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; title?: string }
      | string
      | undefined;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object') {
      return data.message || data.error || data.title || err.message || fallback;
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Fetches all reward rules (including inactive) for Admins via GET /api/rewardrule.
 * Automatically falls back to GET /api/rewardrule/active for non-Admin roles (e.g. Moderator).
 */
export async function fetchRewardRules(preferAll = true): Promise<RewardRuleCollectionResult> {
  if (preferAll) {
    try {
      const res = await adminClient.get('/rewardrule');
      const rows = Array.isArray(res.data) ? (res.data as Array<Record<string, unknown>>) : [];
      return {
        items: rows.map(normalizeRewardRule),
        includesInactive: true,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
        const activeRes = await adminClient.get('/rewardrule/active');
        const rows = Array.isArray(activeRes.data)
          ? (activeRes.data as Array<Record<string, unknown>>)
          : [];
        return {
          items: rows.map(normalizeRewardRule),
          includesInactive: false,
          notice: 'Showing active quests only (viewing paused quests requires Administrator role).',
        };
      }
      throw err;
    }
  }

  const activeRes = await adminClient.get('/rewardrule/active');
  const rows = Array.isArray(activeRes.data)
    ? (activeRes.data as Array<Record<string, unknown>>)
    : [];
  return {
    items: rows.map(normalizeRewardRule),
    includesInactive: false,
  };
}

export async function createRewardRule(payload: UpsertRewardRulePayload): Promise<RewardRuleDto> {
  const res = await adminClient.post('/rewardrule', payload);
  return normalizeRewardRule((res.data || {}) as Record<string, unknown>);
}

export async function updateRewardRule(
  id: string,
  payload: UpsertRewardRulePayload
): Promise<void> {
  await adminClient.put(`/rewardrule/${encodeURIComponent(id)}`, payload);
}

export async function setRewardRuleActive(id: string, active: boolean): Promise<void> {
  const action = active ? 'activate' : 'deactivate';
  await adminClient.patch(`/rewardrule/${encodeURIComponent(id)}/${action}`);
}

/**
 * Fetches per-quest progress and claim funnel statistics via GET /api/rewardrule/stats.
 * Gracefully returns null if the backend server does not expose this endpoint yet.
 */
export async function fetchRewardRuleStats(): Promise<RewardRuleStatsDto[] | null> {
  try {
    const res = await adminClient.get('/rewardrule/stats');
    if (!Array.isArray(res.data)) return [];
    return (res.data as Array<Record<string, unknown>>).map((raw) => ({
      ruleId: String(raw.ruleId ?? raw.RuleId ?? ''),
      totalPlayers: Number(raw.totalPlayers ?? raw.TotalPlayers ?? 0) || 0,
      inProgressCount: Number(raw.inProgressCount ?? raw.InProgressCount ?? 0) || 0,
      completedCount: Number(raw.completedCount ?? raw.CompletedCount ?? 0) || 0,
      readyToClaimCount: Number(raw.readyToClaimCount ?? raw.ReadyToClaimCount ?? 0) || 0,
      claimedCount: Number(raw.claimedCount ?? raw.ClaimedCount ?? 0) || 0,
    }));
  } catch (err) {
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 403)
    ) {
      return null;
    }
    return null;
  }
}

/**
 * Fetches recent logged player activities via GET /api/player/{playerId}/actions.
 * Gracefully returns null if the endpoint is unavailable on the current backend.
 */
export async function fetchPlayerActions(
  playerId: string,
  limit = 25,
  actionType?: string
): Promise<PlayerActionLogDto[] | null> {
  try {
    const params: Record<string, string | number> = { limit };
    if (actionType && actionType !== 'ALL') {
      params.actionType = actionType;
    }
    const res = await adminClient.get(
      `/player/${encodeURIComponent(playerId)}/actions`,
      { params }
    );
    if (!Array.isArray(res.data)) return [];
    return (res.data as Array<Record<string, unknown>>).map((raw) => ({
      id: String(raw.id ?? raw.Id ?? ''),
      playerId: String(raw.playerId ?? raw.PlayerId ?? playerId),
      actionType: String(raw.actionType ?? raw.ActionType ?? ''),
      referenceId: String(raw.referenceId ?? raw.ReferenceId ?? ''),
      facts:
        raw.facts && typeof raw.facts === 'object'
          ? (raw.facts as Record<string, unknown>)
          : raw.Facts && typeof raw.Facts === 'object'
            ? (raw.Facts as Record<string, unknown>)
            : {},
      timestamp: String(raw.timestamp ?? raw.Timestamp ?? ''),
    }));
  } catch (err) {
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 403)
    ) {
      return null;
    }
    return null;
  }
}

/**
 * Evaluates a single quest requirement against an activity payload.
 */
export function evaluateSingleCondition(
  condition: RewardConditionDto,
  facts: Record<string, unknown>
): SimulatedConditionTrace {
  const hasField = Object.prototype.hasOwnProperty.call(facts, condition.field);
  const actual = hasField ? facts[condition.field] : undefined;

  if (!hasField || actual === null || actual === undefined) {
    return {
      condition,
      actualValue: undefined,
      hasField: false,
      passed: false,
      reason: 'not provided',
    };
  }

  if (typeof actual === 'boolean') {
    const normalizedExpected = condition.value.trim().toLowerCase();
    if (normalizedExpected !== 'true' && normalizedExpected !== 'false') {
      return {
        condition,
        actualValue: actual,
        hasField: true,
        passed: false,
        reason: 'expected Yes/No value',
      };
    }
    const expectedBool = normalizedExpected === 'true';
    if (condition.op !== '==' && condition.op !== '!=') {
      return {
        condition,
        actualValue: actual,
        hasField: true,
        passed: false,
        reason: 'invalid comparison for Yes/No field',
      };
    }
    const passed = condition.op === '==' ? actual === expectedBool : actual !== expectedBool;
    return {
      condition,
      actualValue: actual,
      hasField: true,
      passed,
      reason: passed ? 'matched' : `got ${actual ? 'Yes' : 'No'}`,
    };
  }

  if (typeof actual === 'string') {
    if (condition.op !== '==' && condition.op !== '!=') {
      return {
        condition,
        actualValue: actual,
        hasField: true,
        passed: false,
        reason: 'text fields only support "is" or "is not"',
      };
    }
    const passed = condition.op === '==' ? actual === condition.value : actual !== condition.value;
    return {
      condition,
      actualValue: actual,
      hasField: true,
      passed,
      reason: passed ? 'matched' : `got "${actual}"`,
    };
  }

  const expectedNum = Number(condition.value);
  const actualNum = Number(actual);
  if (!Number.isFinite(expectedNum) || !Number.isFinite(actualNum)) {
    return {
      condition,
      actualValue: actual,
      hasField: true,
      passed: false,
      reason: `invalid number (${String(actual)})`,
    };
  }

  let passed = false;
  switch (condition.op) {
    case '==':
      passed = actualNum === expectedNum;
      break;
    case '!=':
      passed = actualNum !== expectedNum;
      break;
    case '>':
      passed = actualNum > expectedNum;
      break;
    case '>=':
      passed = actualNum >= expectedNum;
      break;
    case '<':
      passed = actualNum < expectedNum;
      break;
    case '<=':
      passed = actualNum <= expectedNum;
      break;
    default:
      return {
        condition,
        actualValue: actual,
        hasField: true,
        passed: false,
        reason: 'unsupported comparison',
      };
  }

  return {
    condition,
    actualValue: actual,
    hasField: true,
    passed,
    reason: passed ? 'matched' : `got ${actualNum}`,
  };
}

/**
 * Simulates quest evaluation across all rules for a given activity & sample event.
 */
export function simulateRewardEvaluation(
  rules: RewardRuleDto[],
  actionType: string,
  facts: Record<string, unknown>,
  startingCounts: Record<string, number> = {}
): SimulatedRuleEvaluation[] {
  return rules
    .filter((r) => r.actionType === actionType)
    .map((rule) => {
      const targetCount = Math.max(1, rule.targetCount);
      const conditionTraces = rule.conditions.map((c) => evaluateSingleCondition(c, facts));

      if (!rule.isActive) {
        return {
          rule,
          actionTypeMatched: true,
          isActive: false,
          matched: false,
          conditionTraces,
          delta: 0,
          targetCount,
          projectedCount: startingCounts[rule.id] ?? 0,
          wouldComplete: false,
          skipReason: 'Quest is paused',
        };
      }

      const allPassed = conditionTraces.every((t) => t.passed);
      if (!allPassed) {
        return {
          rule,
          actionTypeMatched: true,
          isActive: true,
          matched: false,
          conditionTraces,
          delta: 0,
          targetCount,
          projectedCount: startingCounts[rule.id] ?? 0,
          wouldComplete: false,
          skipReason: 'Requirements not met',
        };
      }

      let delta = 1;
      if (rule.accumulateField) {
        const raw = facts[rule.accumulateField];
        const parsed = Number(raw);
        if (raw !== undefined && raw !== null && Number.isFinite(parsed)) {
          delta = Math.trunc(parsed);
        } else {
          delta = 0;
        }
      }

      const current = startingCounts[rule.id] ?? 0;
      const projectedCount = Math.min(current + delta, targetCount);

      return {
        rule,
        actionTypeMatched: true,
        isActive: true,
        matched: true,
        conditionTraces,
        delta,
        targetCount,
        projectedCount,
        wouldComplete: projectedCount >= targetCount,
      };
    });
}
