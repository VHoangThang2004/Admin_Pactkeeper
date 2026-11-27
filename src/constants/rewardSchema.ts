import type { BadgeVariant } from '@astryxdesign/core/Badge';
import type { RewardConditionDto, RewardConditionOp, RewardRuleDto } from '../types';

export type RewardFactValueType = 'boolean' | 'number' | 'string';

export interface RewardFactFieldSchema {
  key: string;
  label: string;
  accumulateLabel?: string;
  unitLabel?: string;
  valueType: RewardFactValueType;
  canAccumulate?: boolean;
  description: string;
  example: string;
  presetValues?: Array<{ value: string; label: string }>;
}

export interface RewardActionPreset {
  id: string;
  label: string;
  description: string;
  actionType: string;
  facts: Record<string, string | number | boolean>;
}

export interface RewardActionSchema {
  actionType: string;
  label: string;
  shortLabel: string;
  badgeVariant: BadgeVariant;
  sourceLabel: string;
  description: string;
  facts: RewardFactFieldSchema[];
}

export const ALL_CONDITION_OPS: Array<{
  value: RewardConditionOp;
  label: string;
  phrase: string;
}> = [
  { value: '==', label: 'is', phrase: 'is' },
  { value: '!=', label: 'is not', phrase: 'is not' },
  { value: '>=', label: 'at least (≥)', phrase: 'at least' },
  { value: '>', label: 'more than (>)', phrase: 'more than' },
  { value: '<=', label: 'at most (≤)', phrase: 'at most' },
  { value: '<', label: 'less than (<)', phrase: 'less than' },
];

export const EQUALITY_CONDITION_OPS: Array<{
  value: RewardConditionOp;
  label: string;
  phrase: string;
}> = [
  { value: '==', label: 'is', phrase: 'is' },
  { value: '!=', label: 'is not', phrase: 'is not' },
];

export const REWARD_ACTION_SCHEMAS: RewardActionSchema[] = [
  {
    actionType: 'MatchResult',
    label: 'PvP / Ranked Match',
    shortLabel: 'PvP / Ranked',
    badgeVariant: 'blue',
    sourceLabel: 'PvP & Ranked Arena',
    description:
      'Triggered for each player when a PvP or Ranked match finishes.',
    facts: [
      {
        key: 'won',
        label: 'Match Outcome',
        valueType: 'boolean',
        description: 'Whether the player won or lost the match.',
        example: 'true',
        presetValues: [
          { value: 'true', label: 'Victory' },
          { value: 'false', label: 'Defeat' },
        ],
      },
      {
        key: 'unitsAlive',
        label: 'Surviving Heroes',
        accumulateLabel: 'Total Surviving Heroes',
        unitLabel: 'surviving heroes',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of allied heroes still alive at the end of the battle.',
        example: '3',
      },
      {
        key: 'totalUnits',
        label: 'Team Size',
        accumulateLabel: 'Total Heroes Fielded',
        unitLabel: 'heroes fielded',
        valueType: 'number',
        canAccumulate: true,
        description: 'Total allied heroes brought into the match.',
        example: '4',
      },
      {
        key: 'unitsDefeated',
        label: 'Enemies Defeated',
        accumulateLabel: 'Total Enemies Defeated',
        unitLabel: 'enemies defeated',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of opponent heroes defeated in the match.',
        example: '4',
      },
      {
        key: 'durationSeconds',
        label: 'Match Duration (sec)',
        accumulateLabel: 'Total Battle Time (sec)',
        unitLabel: 'seconds',
        valueType: 'number',
        canAccumulate: true,
        description: 'Length of the match in seconds.',
        example: '240',
      },
      {
        key: 'instants',
        label: 'Battle Turns',
        accumulateLabel: 'Total Battle Turns',
        unitLabel: 'turns',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of turns elapsed before the battle ended.',
        example: '18',
      },
    ],
  },
  {
    actionType: 'StoryProgress',
    label: 'Story Chapter Clear',
    shortLabel: 'Story Campaign',
    badgeVariant: 'purple',
    sourceLabel: 'Story Campaign',
    description:
      'Triggered when a player finishes a Story Mode chapter.',
    facts: [
      {
        key: 'chapterId',
        label: 'Chapter',
        valueType: 'number',
        description: 'Which story chapter the player completed.',
        example: '0',
      },
      {
        key: 'sceneId',
        label: 'Scene Number',
        valueType: 'number',
        description: 'Final scene number cleared in that chapter.',
        example: '3',
      },
      {
        key: 'isChapterComplete',
        label: 'Chapter Cleared',
        valueType: 'boolean',
        description: 'Confirms the entire chapter was completed.',
        example: 'true',
        presetValues: [
          { value: 'true', label: 'Yes (Completed)' },
          { value: 'false', label: 'No' },
        ],
      },
    ],
  },
  {
    actionType: 'GachaPull',
    label: 'Gacha Summon',
    shortLabel: 'Gacha Summon',
    badgeVariant: 'yellow',
    sourceLabel: 'Gacha System',
    description:
      'Triggered whenever a player performs a Single, 5x, or 10x summon on a banner.',
    facts: [
      {
        key: 'bannerId',
        label: 'Specific Banner ID',
        valueType: 'string',
        description: 'Limit the quest to a single Gacha Banner.',
        example: 'standard-banner',
      },
      {
        key: 'pullCount',
        label: 'Pulls in Session',
        accumulateLabel: 'Total Summon Pulls',
        unitLabel: 'pulls',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of summons performed (1, 5, or 10).',
        example: '10',
      },
      {
        key: 'rarestTier',
        label: 'Highest Rarity Rolled',
        valueType: 'string',
        description: 'Highest reward tier received in that summon batch.',
        example: '3',
        presetValues: [
          { value: '3', label: 'Tier 3 (Hero)' },
          { value: '2', label: 'Tier 2 (Equipment)' },
          { value: '1', label: 'Tier 1 (Common / Gems)' },
        ],
      },
    ],
  },
  {
    actionType: 'Purchase',
    label: 'Top-Up Purchase',
    shortLabel: 'Top-Up Store',
    badgeVariant: 'success',
    sourceLabel: 'PayOS Top-Up Store',
    description:
      'Triggered when a player completes a verified Top-Up crystal purchase.',
    facts: [
      {
        key: 'packId',
        label: 'Top-Up Pack ID',
        valueType: 'string',
        description: 'Limit the quest to a specific crystal pack.',
        example: 'pack-crystal-1000',
      },
      {
        key: 'gemsAmount',
        label: 'Gems Purchased',
        accumulateLabel: 'Total Gems Purchased',
        unitLabel: 'Gems',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of Gems received from the Top-Up order.',
        example: '1000',
      },
    ],
  },
  {
    actionType: 'ShopPurchase',
    label: 'In-Game Shop Purchase',
    shortLabel: 'In-Game Shop',
    badgeVariant: 'cyan',
    sourceLabel: 'In-Game Gem Shop',
    description:
      'Triggered when a player buys an item using Gems in the in-game shop.',
    facts: [
      {
        key: 'shopId',
        label: 'Shop ID',
        valueType: 'string',
        description: 'Which in-game shop the purchase came from.',
        example: 'standard-shop',
      },
      {
        key: 'shopItemId',
        label: 'Shop Item ID',
        valueType: 'string',
        description: 'Specific shop listing purchased.',
        example: 'item-01',
      },
      {
        key: 'quantity',
        label: 'Items Bought',
        accumulateLabel: 'Total Items Bought',
        unitLabel: 'items',
        valueType: 'number',
        canAccumulate: true,
        description: 'Number of items bought in that transaction.',
        example: '1',
      },
      {
        key: 'gemsSpent',
        label: 'Gems Spent',
        accumulateLabel: 'Total Gems Spent',
        unitLabel: 'Gems spent',
        valueType: 'number',
        canAccumulate: true,
        description: 'Total Gems paid for the purchase.',
        example: '300',
      },
    ],
  },
];

export const REWARD_ACTION_MAP = new Map<string, RewardActionSchema>(
  REWARD_ACTION_SCHEMAS.map((s) => [s.actionType, s])
);

export function getActionSchema(actionType: string): RewardActionSchema | undefined {
  return REWARD_ACTION_MAP.get(actionType);
}

export function getActionDisplayLabel(actionType: string, short = false): string {
  const schema = REWARD_ACTION_MAP.get(actionType);
  if (!schema) return actionType || 'Activity';
  return short ? schema.shortLabel : schema.label;
}

export function getFactFieldSchema(
  actionType: string,
  fieldKey: string
): RewardFactFieldSchema | undefined {
  const schema = REWARD_ACTION_MAP.get(actionType);
  if (!schema) return undefined;
  return schema.facts.find((f) => f.key.toLowerCase() === fieldKey.trim().toLowerCase());
}

export function getAllowedOpsForField(
  actionType: string,
  fieldKey: string
): Array<{ value: RewardConditionOp; label: string; phrase: string }> {
  const field = getFactFieldSchema(actionType, fieldKey);
  if (!field) return ALL_CONDITION_OPS;
  return field.valueType === 'number' ? ALL_CONDITION_OPS : EQUALITY_CONDITION_OPS;
}

export function formatFactValueHuman(
  actionType: string,
  fieldKey: string,
  value: unknown,
  chapterNameById?: Map<number, string>
): string {
  const strVal = String(value ?? '');
  const field = getFactFieldSchema(actionType, fieldKey);
  if (field?.presetValues) {
    const matched = field.presetValues.find((p) => p.value.toLowerCase() === strVal.toLowerCase());
    if (matched) return matched.label;
  }
  if (actionType === 'StoryProgress' && fieldKey.toLowerCase() === 'chapterid') {
    const num = Number(strVal);
    if (Number.isFinite(num)) {
      const chName = chapterNameById?.get(num);
      return chName ? `Chapter ${num} (${chName})` : `Chapter ${num}`;
    }
  }
  return strVal;
}

export function formatConditionHuman(
  actionType: string,
  condition: RewardConditionDto,
  chapterNameById?: Map<number, string>
): string {
  const field = getFactFieldSchema(actionType, condition.field);
  const fieldLabel = field?.label || condition.field;
  const opMeta = ALL_CONDITION_OPS.find((o) => o.value === condition.op);
  const opPhrase = opMeta?.phrase || condition.op;
  const valueLabel = formatFactValueHuman(
    actionType,
    condition.field,
    condition.value,
    chapterNameById
  );
  return `${fieldLabel} ${opPhrase} ${valueLabel}`;
}

export function formatProgressGoalHuman(
  actionType: string,
  targetCount: number,
  accumulateField: string | null
): string {
  const target = Math.max(1, targetCount);
  if (accumulateField) {
    const field = getFactFieldSchema(actionType, accumulateField);
    const unit = field?.unitLabel || field?.label || accumulateField;
    return `Reach ${target.toLocaleString()} ${unit}`;
  }
  return target === 1 ? 'Complete 1 time' : `Complete ${target.toLocaleString()} times`;
}

export function formatRuleSummaryHuman(
  rule: Pick<RewardRuleDto, 'actionType' | 'conditions' | 'accumulateField' | 'targetCount'>,
  rewardLabel: string,
  chapterNameById?: Map<number, string>
): string {
  const activity = getActionDisplayLabel(rule.actionType);
  const goal = formatProgressGoalHuman(
    rule.actionType,
    rule.targetCount,
    rule.accumulateField
  ).toLowerCase();
  const condPart =
    rule.conditions.length > 0
      ? ` where ${rule.conditions
          .map((c) => formatConditionHuman(rule.actionType, c, chapterNameById))
          .join(' and ')}`
      : '';
  return `Players earn ${rewardLabel} after they ${goal} in ${activity}${condPart}.`;
}

export const SIMULATOR_PRESETS: RewardActionPreset[] = [
  {
    id: 'pvp-flawless-win',
    label: 'PvP Win (3 Heroes Alive)',
    description: 'Player wins a PvP/Ranked match with 3 allied heroes surviving.',
    actionType: 'MatchResult',
    facts: {
      won: true,
      unitsAlive: 3,
      totalUnits: 4,
      unitsDefeated: 4,
      durationSeconds: 210,
      instants: 16,
    },
  },
  {
    id: 'pvp-narrow-win',
    label: 'PvP Win (1 Hero Alive)',
    description: 'Standard victory that does not meet flawless survival requirements.',
    actionType: 'MatchResult',
    facts: {
      won: true,
      unitsAlive: 1,
      totalUnits: 4,
      unitsDefeated: 4,
      durationSeconds: 340,
      instants: 29,
    },
  },
  {
    id: 'pvp-defeat',
    label: 'PvP Defeat',
    description: 'Verifies that victory-only quests do not gain progress on losses.',
    actionType: 'MatchResult',
    facts: {
      won: false,
      unitsAlive: 0,
      totalUnits: 4,
      unitsDefeated: 2,
      durationSeconds: 185,
      instants: 14,
    },
  },
  {
    id: 'story-ch1',
    label: 'Clear Story Chapter 1',
    description: 'Simulates completing the final scene of Story Chapter 1.',
    actionType: 'StoryProgress',
    facts: {
      chapterId: 1,
      sceneId: 4,
      isChapterComplete: true,
    },
  },
  {
    id: 'gacha-10x-t3',
    label: 'Gacha 10x (Tier 3 Hero)',
    description: 'Tests both pull-count quests and Tier 3 Hero summon milestones.',
    actionType: 'GachaPull',
    facts: {
      bannerId: 'standard-banner',
      pullCount: 10,
      rarestTier: '3',
    },
  },
  {
    id: 'payos-topup-1000',
    label: 'Top-Up 1,000 Gems',
    description: 'Tests cumulative Top-Up spending milestones.',
    actionType: 'Purchase',
    facts: {
      packId: 'crystal-pack-1000',
      gemsAmount: 1000,
    },
  },
  {
    id: 'shop-purchase-300',
    label: 'Gem Shop Spend (300 Gems)',
    description: 'Simulates buying 2 items for 300 Gems in the in-game shop.',
    actionType: 'ShopPurchase',
    facts: {
      shopId: 'main-shop',
      shopItemId: 'weapon-crate',
      quantity: 2,
      gemsSpent: 300,
    },
  },
];
