import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Copy,
  Edit2,
  FlaskConical,
  Gem,
  Layers,
  Play,
  Plus,
  Power,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { KpiSummaryStrip, type KpiStatItem } from '../components/ui/KpiSummaryStrip';
import {
  ALL_CONDITION_OPS,
  REWARD_ACTION_SCHEMAS,
  SIMULATOR_PRESETS,
  formatConditionHuman,
  formatFactValueHuman,
  formatProgressGoalHuman,
  formatRuleSummaryHuman,
  getActionDisplayLabel,
  getActionSchema,
  getAllowedOpsForField,
  getFactFieldSchema,
} from '../constants/rewardSchema';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  createRewardRule,
  extractRewardApiError,
  fetchRewardRuleStats,
  fetchRewardRules,
  setRewardRuleActive,
  simulateRewardEvaluation,
  updateRewardRule,
} from '../services/rewardRuleService';
import type {
  AdminPermissionKey,
  ChapterConfig,
  ClassDefinition,
  CounselRole,
  GachaRewardType,
  RewardConditionDto,
  RewardItemDto,
  RewardRuleDto,
  RewardRuleStatsDto,
  TrinketDefinition,
  UnitDefinition,
  UpsertRewardRulePayload,
  WeaponDefinition,
} from '../types';
import { hasPermission } from '../utils/permissions';

interface RewardManagementProps {
  role: CounselRole | string;
  permissions: AdminPermissionKey[];
}

type RewardTab = 'rules' | 'simulator';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type RewardTypeFilter = 'ALL' | GachaRewardType;
type DialogMode = 'create' | 'edit' | 'clone' | null;

interface CatalogMaps {
  units: UnitDefinition[];
  weapons: WeaponDefinition[];
  trinkets: TrinketDefinition[];
  classes: ClassDefinition[];
  chapters: ChapterConfig[];
  unitByUid: Map<number, UnitDefinition>;
  weaponById: Map<number, WeaponDefinition>;
  trinketById: Map<number, TrinketDefinition>;
  classById: Map<number, ClassDefinition>;
  chapterNameById: Map<number, string>;
}

interface PendingToggleOp {
  rule: RewardRuleDto;
  nextActive: boolean;
}

const REWARD_TYPE_OPTIONS: SelectorOptionData[] = [
  { value: 'Gems', label: 'Gems (Currency)' },
  { value: 'Unit', label: 'Hero Unit' },
  { value: 'Weapon', label: 'Weapon' },
  { value: 'Trinket', label: 'Trinket' },
];

const REWARD_TYPE_FILTER_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Rewards' },
  { value: 'Gems', label: 'Gems Only' },
  { value: 'Unit', label: 'Hero Units' },
  { value: 'Weapon', label: 'Weapons' },
  { value: 'Trinket', label: 'Trinkets' },
];

const CUSTOM_FIELD_SENTINEL = '__custom__';

function getActionBadgeVariant(actionType: string): BadgeVariant {
  return getActionSchema(actionType)?.badgeVariant ?? 'neutral';
}

function getRewardBadgeVariant(type: GachaRewardType): BadgeVariant {
  switch (type) {
    case 'Unit':
      return 'yellow';
    case 'Weapon':
      return 'blue';
    case 'Trinket':
      return 'purple';
    default:
      return 'cyan';
  }
}

function formatRewardLabel(reward: RewardItemDto, catalogs: CatalogMaps): string {
  if (reward.type === 'Gems') {
    return `${reward.amount.toLocaleString()} Gems`;
  }
  if (reward.type === 'Unit') {
    const unit = catalogs.unitByUid.get(reward.definitionId);
    const cls = catalogs.classById.get(reward.classId);
    const unitName = unit?.unitName || unit?.name || `Hero #${reward.definitionId}`;
    const className = cls?.name || cls?.className || `Class #${reward.classId}`;
    return `${unitName} (${className})`;
  }
  if (reward.type === 'Weapon') {
    const weapon = catalogs.weaponById.get(reward.definitionId);
    return weapon?.name ? weapon.name : `Weapon #${reward.definitionId}`;
  }
  const trinket = catalogs.trinketById.get(reward.definitionId);
  return trinket?.name ? trinket.name : `Trinket #${reward.definitionId}`;
}

function buildDefaultSimFacts(actionType: string): Record<string, string> {
  const preset = SIMULATOR_PRESETS.find((p) => p.actionType === actionType);
  if (preset) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.facts)) {
      out[k] = String(v);
    }
    return out;
  }
  const schema = getActionSchema(actionType);
  const out: Record<string, string> = {};
  schema?.facts.forEach((f) => {
    out[f.key] = f.example;
  });
  return out;
}

export const RewardManagement: React.FC<RewardManagementProps> = ({ role, permissions }) => {
  const canManage = hasPermission(role, 'rewards.manage', permissions);

  const [activeTab, setActiveTab] = useState<RewardTab>('rules');
  const [rules, setRules] = useState<RewardRuleDto[]>([]);
  const [ruleStats, setRuleStats] = useState<RewardRuleStatsDto[] | null>(null);
  const [includesInactive, setIncludesInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    status: 'success' | 'error' | 'warning' | 'info';
    title: string;
    text: string;
  } | null>(null);

  // Catalog definitions for resolving item & chapter names
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [weapons, setWeapons] = useState<WeaponDefinition[]>([]);
  const [trinkets, setTrinkets] = useState<TrinketDefinition[]>([]);
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [chapters, setChapters] = useState<ChapterConfig[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [rewardTypeFilter, setRewardTypeFilter] = useState<RewardTypeFilter>('ALL');

  // Create / Edit / Clone Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formActionType, setFormActionType] = useState<string>('MatchResult');
  const [formConditions, setFormConditions] = useState<RewardConditionDto[]>([]);
  const [formProgressMode, setFormProgressMode] = useState<'count' | 'accumulate'>('count');
  const [formAccumulateField, setFormAccumulateField] = useState<string>('');
  const [formTargetCount, setFormTargetCount] = useState<number>(1);
  const [formRewardType, setFormRewardType] = useState<GachaRewardType>('Gems');
  const [formRewardDefId, setFormRewardDefId] = useState<number>(0);
  const [formRewardClassId, setFormRewardClassId] = useState<number>(0);
  const [formRewardAmount, setFormRewardAmount] = useState<number>(500);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sensitive action modal for Activate / Pause
  const [pendingToggle, setPendingToggle] = useState<PendingToggleOp | null>(null);

  // Rule Tester state
  const [simActionType, setSimActionType] = useState<string>('MatchResult');
  const [simFactInputs, setSimFactInputs] = useState<Record<string, string>>(() =>
    buildDefaultSimFacts('MatchResult')
  );
  const [simActivePresetId, setSimActivePresetId] = useState<string>('pvp-flawless-win');

  const catalogs = useMemo<CatalogMaps>(
    () => ({
      units,
      weapons,
      trinkets,
      classes,
      chapters,
      unitByUid: new Map(units.map((u) => [u.uId, u])),
      weaponById: new Map(weapons.map((w) => [w.weaponId, w])),
      trinketById: new Map(trinkets.map((t) => [t.trinketId, t])),
      classById: new Map(classes.map((c) => [c.classId, c])),
      chapterNameById: new Map(chapters.map((ch) => [ch.chapterId, ch.title])),
    }),
    [units, weapons, trinkets, classes, chapters]
  );

  const fetchAllPayload = useCallback(async () => {
    const [rulesResult, statsResult, uRes, wRes, tRes, cRes, chRes] = await Promise.allSettled([
      fetchRewardRules(canManage),
      fetchRewardRuleStats(),
      adminClient.get('/UnitDefinition'),
      adminClient.get('/WeaponDefinition'),
      adminClient.get('/TrinketDefinition'),
      adminClient.get('/ClassDefinition'),
      adminClient.get('/ChapterConfig'),
    ]);
    return { rulesResult, statsResult, uRes, wRes, tRes, cRes, chRes };
  }, [canManage]);

  const applyFetchedPayload = useCallback(
    (payload: Awaited<ReturnType<typeof fetchAllPayload>>, isManualRefresh: boolean) => {
      const { rulesResult, statsResult, uRes, wRes, tRes, cRes, chRes } = payload;
      if (rulesResult.status === 'fulfilled') {
        setRules(rulesResult.value.items);
        setIncludesInactive(rulesResult.value.includesInactive);
        if (rulesResult.value.notice) {
          setNotice({
            status: 'info',
            title: 'View-Only Mode',
            text: rulesResult.value.notice,
          });
        } else if (isManualRefresh) {
          setNotice({
            status: 'success',
            title: 'Up to Date',
            text: `Loaded ${rulesResult.value.items.length} quest & reward rules.`,
          });
        }
      } else {
        setNotice({
          status: 'error',
          title: 'Could Not Load Quests',
          text: extractRewardApiError(rulesResult.reason, 'Failed to load quest and reward rules.'),
        });
      }

      if (statsResult.status === 'fulfilled') {
        setRuleStats(statsResult.value);
      }

      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) {
        setUnits(uRes.value.data as UnitDefinition[]);
      }
      if (wRes.status === 'fulfilled' && Array.isArray(wRes.value.data)) {
        setWeapons(wRes.value.data as WeaponDefinition[]);
      }
      if (tRes.status === 'fulfilled' && Array.isArray(tRes.value.data)) {
        setTrinkets(tRes.value.data as TrinketDefinition[]);
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value.data)) {
        setClasses(cRes.value.data as ClassDefinition[]);
      }
      if (chRes.status === 'fulfilled' && Array.isArray(chRes.value.data)) {
        setChapters(
          [...(chRes.value.data as ChapterConfig[])].sort((a, b) => a.chapterId - b.chapterId)
        );
      }
    },
    []
  );

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const payload = await fetchAllPayload();
        applyFetchedPayload(payload, isManualRefresh);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchAllPayload, applyFetchedPayload]
  );

  useEffect(() => {
    let active = true;
    void fetchAllPayload().then((payload) => {
      if (!active) return;
      applyFetchedPayload(payload, false);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchAllPayload, applyFetchedPayload]);

  const availableActionTypes = useMemo(() => {
    const set = new Set<string>(REWARD_ACTION_SCHEMAS.map((s) => s.actionType));
    rules.forEach((r) => {
      if (r.actionType) set.add(r.actionType);
    });
    return Array.from(set);
  }, [rules]);

  const actionFilterOptions = useMemo<SelectorOptionData[]>(() => {
    const counts = new Map<string, number>();
    rules.forEach((r) => counts.set(r.actionType, (counts.get(r.actionType) ?? 0) + 1));
    return [
      { value: 'ALL', label: `All Activities (${rules.length})` },
      ...availableActionTypes.map((at) => ({
        value: at,
        label: `${getActionDisplayLabel(at)} (${counts.get(at) ?? 0})`,
      })),
    ];
  }, [availableActionTypes, rules]);

  const formActionOptions = useMemo<SelectorOptionData[]>(
    () =>
      availableActionTypes.map((at) => ({
        value: at,
        label: getActionDisplayLabel(at),
      })),
    [availableActionTypes]
  );

  const chapterSelectOptions = useMemo<SelectorOptionData[]>(() => {
    if (chapters.length > 0) {
      return chapters.map((ch) => ({
        value: String(ch.chapterId),
        label: `Chapter ${ch.chapterId}: ${ch.title || 'Untitled'}`,
      }));
    }
    return [0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: `Chapter ${n}` }));
  }, [chapters]);

  const statusCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const r of rules) {
      if (r.isActive) active += 1;
      else inactive += 1;
    }
    return { ALL: rules.length, ACTIVE: active, INACTIVE: inactive };
  }, [rules]);

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rules
      .filter((rule) => {
        if (statusFilter === 'ACTIVE' && !rule.isActive) return false;
        if (statusFilter === 'INACTIVE' && rule.isActive) return false;
        if (actionFilter !== 'ALL' && rule.actionType !== actionFilter) return false;
        if (rewardTypeFilter !== 'ALL' && rule.reward.type !== rewardTypeFilter) return false;
        if (!q) return true;

        const rewardLabel = formatRewardLabel(rule.reward, catalogs).toLowerCase();
        const activityLabel = getActionDisplayLabel(rule.actionType).toLowerCase();
        const condText = rule.conditions
          .map((c) => formatConditionHuman(rule.actionType, c, catalogs.chapterNameById))
          .join(' ')
          .toLowerCase();
        return (
          rule.title.toLowerCase().includes(q) ||
          rule.description.toLowerCase().includes(q) ||
          activityLabel.includes(q) ||
          rule.actionType.toLowerCase().includes(q) ||
          rewardLabel.includes(q) ||
          condText.includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.actionType.localeCompare(b.actionType) || a.title.localeCompare(b.title);
      });
  }, [rules, statusFilter, actionFilter, rewardTypeFilter, searchQuery, catalogs]);

  const statsByRuleId = useMemo(
    () => new Map((ruleStats ?? []).map((s) => [s.ruleId, s])),
    [ruleStats]
  );

  const kpiItems = useMemo<KpiStatItem[]>(() => {
    const matchRules = rules.filter((r) => r.actionType === 'MatchResult').length;
    const storyRules = rules.filter((r) => r.actionType === 'StoryProgress').length;
    const itemRules = rules.filter((r) => r.reward.type !== 'Gems').length;
    const gemRules = rules.filter((r) => r.reward.type === 'Gems').length;
    const totalClaimed = (ruleStats ?? []).reduce((sum, s) => sum + s.claimedCount, 0);
    const totalReady = (ruleStats ?? []).reduce((sum, s) => sum + s.readyToClaimCount, 0);

    return [
      {
        id: 'total-rules',
        label: 'Total Quests',
        value: rules.length,
        helper: `${statusCounts.ACTIVE} active · ${statusCounts.INACTIVE} paused`,
        icon: <Icon icon={Award} size="sm" />,
        badge: {
          label: includesInactive ? 'Live' : 'Active Only',
          variant: includesInactive ? 'success' : 'info',
        },
        highlight: true,
      },
      {
        id: 'match-story',
        label: 'Battle & Story',
        value: `${matchRules} / ${storyRules}`,
        helper: `${matchRules} PvP/Ranked · ${storyRules} Story chapters`,
        icon: <Icon icon={Sword} size="sm" />,
        badge: { label: 'Gameplay', variant: 'blue' },
      },
      {
        id: 'economy-rules',
        label: 'Gacha & Shop',
        value: rules.filter((r) =>
          ['GachaPull', 'Purchase', 'ShopPurchase'].includes(r.actionType)
        ).length,
        helper: 'Summons, Top-Ups & Gem Shop',
        icon: <Icon icon={Sparkles} size="sm" />,
        badge: { label: 'Economy', variant: 'yellow' },
      },
      {
        id: 'reward-mix',
        label: ruleStats ? 'Rewards Claimed' : 'Reward Mix',
        value: ruleStats ? totalClaimed.toLocaleString() : `${gemRules} / ${itemRules}`,
        helper: ruleStats
          ? `${totalReady.toLocaleString()} ready to claim · ${gemRules} Gem / ${itemRules} Item quests`
          : `${gemRules} Gem packs · ${itemRules} Heroes & Gear`,
        icon: <Icon icon={Gem} size="sm" />,
        badge: { label: 'On Claim', variant: 'purple' },
      },
    ];
  }, [rules, ruleStats, statusCounts, includesInactive]);

  // Modal helpers
  const currentFormSchema = useMemo(() => getActionSchema(formActionType), [formActionType]);

  const accumulateFieldOptions = useMemo<SelectorOptionData[]>(() => {
    const numericFacts = (currentFormSchema?.facts ?? []).filter((f) => f.canAccumulate);
    const opts: SelectorOptionData[] = numericFacts.map((f) => ({
      value: f.key,
      label: f.accumulateLabel || f.label,
    }));
    if (formAccumulateField && !opts.some((o) => o.value === formAccumulateField)) {
      opts.push({ value: formAccumulateField, label: formAccumulateField });
    }
    return opts;
  }, [currentFormSchema, formAccumulateField]);

  const unitSelectOptions = useMemo<SelectorOptionData[]>(
    () =>
      units.map((u) => ({
        value: String(u.uId),
        label: `${u.unitName || u.name || 'Unnamed Hero'} (#${u.uId})`,
      })),
    [units]
  );

  const selectedUnitDef = useMemo(
    () => catalogs.unitByUid.get(formRewardDefId),
    [catalogs.unitByUid, formRewardDefId]
  );

  const unitClassOptions = useMemo<SelectorOptionData[]>(() => {
    const allowedClassIds = selectedUnitDef?.classIds ?? [];
    if (allowedClassIds.length > 0) {
      return allowedClassIds.map((cid) => {
        const cls = catalogs.classById.get(cid);
        return {
          value: String(cid),
          label: cls ? cls.name || cls.className || `Class #${cid}` : `Class #${cid}`,
        };
      });
    }
    return classes.map((c) => ({
      value: String(c.classId),
      label: c.name || c.className || `Class #${c.classId}`,
    }));
  }, [selectedUnitDef, catalogs.classById, classes]);

  const weaponSelectOptions = useMemo<SelectorOptionData[]>(
    () =>
      weapons.map((w) => ({
        value: String(w.weaponId),
        label: `${w.name} (#${w.weaponId})`,
      })),
    [weapons]
  );

  const trinketSelectOptions = useMemo<SelectorOptionData[]>(
    () =>
      trinkets.map((t) => ({
        value: String(t.trinketId),
        label: `${t.name} (#${t.trinketId})`,
      })),
    [trinkets]
  );

  const liveFormRewardLabel = useMemo(
    () =>
      formatRewardLabel(
        {
          type: formRewardType,
          definitionId: formRewardType === 'Gems' ? 0 : formRewardDefId,
          classId: formRewardType === 'Unit' ? formRewardClassId : 0,
          amount: formRewardType === 'Gems' ? Math.max(1, formRewardAmount) : 1,
        },
        catalogs
      ),
    [formRewardType, formRewardDefId, formRewardClassId, formRewardAmount, catalogs]
  );

  const liveFormSummary = useMemo(
    () =>
      formatRuleSummaryHuman(
        {
          actionType: formActionType,
          conditions: formConditions.filter((c) => c.field.trim() && c.value.trim()),
          accumulateField:
            formProgressMode === 'accumulate' ? formAccumulateField.trim() || null : null,
          targetCount: Math.max(1, formTargetCount || 1),
        },
        liveFormRewardLabel,
        catalogs.chapterNameById
      ),
    [
      formActionType,
      formConditions,
      formProgressMode,
      formAccumulateField,
      formTargetCount,
      liveFormRewardLabel,
      catalogs.chapterNameById,
    ]
  );

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingRuleId(null);
    setFormTitle('');
    setFormDescription('');
    setFormActionType('MatchResult');
    setFormConditions([{ field: 'won', op: '==', value: 'true' }]);
    setFormProgressMode('count');
    setFormAccumulateField('');
    setFormTargetCount(3);
    setFormRewardType('Gems');
    setFormRewardDefId(0);
    setFormRewardClassId(0);
    setFormRewardAmount(500);
    setFormError(null);
  };

  const openEditOrCloneDialog = (rule: RewardRuleDto, mode: 'edit' | 'clone') => {
    setDialogMode(mode);
    setEditingRuleId(mode === 'edit' ? rule.id : null);
    setFormTitle(mode === 'clone' ? `${rule.title || getActionDisplayLabel(rule.actionType)} (Copy)` : rule.title);
    setFormDescription(rule.description);
    setFormActionType(rule.actionType || 'MatchResult');
    setFormConditions(rule.conditions.map((c) => ({ ...c })));
    if (rule.accumulateField) {
      setFormProgressMode('accumulate');
      setFormAccumulateField(rule.accumulateField);
    } else {
      setFormProgressMode('count');
      setFormAccumulateField('');
    }
    setFormTargetCount(Math.max(1, rule.targetCount));
    setFormRewardType(rule.reward.type);
    setFormRewardDefId(rule.reward.definitionId);
    setFormRewardClassId(rule.reward.classId);
    setFormRewardAmount(Math.max(1, rule.reward.amount));
    setFormError(null);
  };

  const handleActionTypeChange = (nextActionType: string) => {
    setFormActionType(nextActionType);
    const schema = getActionSchema(nextActionType);
    if (formProgressMode === 'accumulate') {
      const firstAcc = schema?.facts.find((f) => f.canAccumulate)?.key ?? '';
      setFormAccumulateField(firstAcc);
      if (!firstAcc) setFormProgressMode('count');
    }
    setFormError(null);
  };

  const handleRewardTypeChange = (nextType: GachaRewardType) => {
    setFormRewardType(nextType);
    if (nextType === 'Gems') {
      setFormRewardDefId(0);
      setFormRewardClassId(0);
      setFormRewardAmount((prev) => Math.max(50, prev || 500));
    } else if (nextType === 'Unit') {
      const firstUnit = units[0];
      const uid = firstUnit?.uId ?? 1;
      const cid = firstUnit?.classIds?.[0] ?? classes[0]?.classId ?? 1;
      setFormRewardDefId(uid);
      setFormRewardClassId(cid);
      setFormRewardAmount(1);
    } else if (nextType === 'Weapon') {
      setFormRewardDefId(weapons[0]?.weaponId ?? 1);
      setFormRewardClassId(0);
      setFormRewardAmount(1);
    } else {
      setFormRewardDefId(trinkets[0]?.trinketId ?? 1);
      setFormRewardClassId(0);
      setFormRewardAmount(1);
    }
  };

  const handleUnitSelectionChange = (nextUid: number) => {
    setFormRewardDefId(nextUid);
    const unit = catalogs.unitByUid.get(nextUid);
    if (unit && unit.classIds.length > 0 && !unit.classIds.includes(formRewardClassId)) {
      setFormRewardClassId(unit.classIds[0]);
    }
  };

  const addConditionRow = () => {
    const schema = getActionSchema(formActionType);
    const unused = schema?.facts.find((f) => !formConditions.some((c) => c.field === f.key));
    const fallback = unused ?? schema?.facts[0];
    setFormConditions((prev) => [
      ...prev,
      {
        field: fallback?.key ?? '',
        op: '==',
        value: fallback?.example ?? '',
      },
    ]);
  };

  const updateConditionRow = (idx: number, patch: Partial<RewardConditionDto>) => {
    setFormConditions((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        if (patch.field !== undefined) {
          const allowed = getAllowedOpsForField(formActionType, patch.field);
          if (!allowed.some((o) => o.value === next.op)) {
            next.op = allowed[0]?.value ?? '==';
          }
          const factSchema = getFactFieldSchema(formActionType, patch.field);
          if (factSchema && patch.value === undefined) {
            next.value = factSchema.example;
          }
        }
        return next;
      })
    );
  };

  const removeConditionRow = (idx: number) => {
    setFormConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateAndBuildPayload = (): UpsertRewardRulePayload | null => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      setFormError('Please enter a Quest Title.');
      return null;
    }
    if (!formActionType.trim()) {
      setFormError('Please select a Player Activity.');
      return null;
    }
    if (!Number.isInteger(formTargetCount) || formTargetCount < 1) {
      setFormError('Target Goal must be a whole number of at least 1.');
      return null;
    }

    for (let i = 0; i < formConditions.length; i += 1) {
      const cond = formConditions[i];
      const field = cond.field.trim();
      const val = cond.value.trim();
      const fieldSchema = getFactFieldSchema(formActionType, field);
      const displayField = fieldSchema?.label || field || `Requirement #${i + 1}`;
      if (!field) {
        setFormError(`Requirement #${i + 1}: Please pick a criteria field.`);
        return null;
      }
      if (!val) {
        setFormError(`Requirement #${i + 1}: Please enter a value for "${displayField}".`);
        return null;
      }
      if (fieldSchema) {
        const allowedOps = getAllowedOpsForField(formActionType, field);
        if (!allowedOps.some((o) => o.value === cond.op)) {
          setFormError(
            `Requirement #${i + 1}: Selected comparison is not valid for "${displayField}".`
          );
          return null;
        }
        if (fieldSchema.valueType === 'boolean' && val !== 'true' && val !== 'false') {
          setFormError(`Requirement #${i + 1}: Please choose a valid option for "${displayField}".`);
          return null;
        }
        if (fieldSchema.valueType === 'number' && !Number.isFinite(Number(val))) {
          setFormError(`Requirement #${i + 1}: "${displayField}" must be a number.`);
          return null;
        }
      }
    }

    const accField =
      formProgressMode === 'accumulate' ? formAccumulateField.trim() || null : null;
    if (formProgressMode === 'accumulate' && !accField) {
      setFormError('Please choose a metric to track, or switch to counting completions.');
      return null;
    }

    if (formRewardType === 'Gems' && (!Number.isInteger(formRewardAmount) || formRewardAmount < 1)) {
      setFormError('Gem reward amount must be at least 1.');
      return null;
    }
    if (formRewardType !== 'Gems' && (!Number.isInteger(formRewardDefId) || formRewardDefId < 1)) {
      setFormError(`Please select a ${formRewardType === 'Unit' ? 'Hero' : formRewardType}.`);
      return null;
    }
    if (formRewardType === 'Unit') {
      if (!Number.isInteger(formRewardClassId) || formRewardClassId < 1) {
        setFormError('Please select a Starting Class for the Hero reward.');
        return null;
      }
      if (
        selectedUnitDef &&
        selectedUnitDef.classIds.length > 0 &&
        !selectedUnitDef.classIds.includes(formRewardClassId)
      ) {
        setFormError(`The selected Starting Class is not available for ${selectedUnitDef.unitName}.`);
        return null;
      }
    }

    return {
      title: trimmedTitle,
      description: formDescription.trim(),
      actionType: formActionType.trim(),
      conditions: formConditions.map((c) => ({
        field: c.field.trim(),
        op: c.op.trim(),
        value: c.value.trim(),
      })),
      accumulateField: accField,
      targetCount: formTargetCount,
      reward: {
        type: formRewardType,
        definitionId: formRewardType === 'Gems' ? 0 : formRewardDefId,
        classId: formRewardType === 'Unit' ? formRewardClassId : 0,
        amount: formRewardType === 'Gems' ? formRewardAmount : 1,
      },
    };
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setFormError(null);
    const payload = validateAndBuildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (dialogMode === 'edit' && editingRuleId) {
        const before = rules.find((r) => r.id === editingRuleId);
        await updateRewardRule(editingRuleId, payload);
        void recordAuditEvent({
          action: 'UPDATE_REWARD_RULE',
          category: 'REWARD',
          severity: 'HIGH',
          targetType: 'RewardRule',
          targetId: editingRuleId,
          targetLabel: payload.title,
          beforeState: before
            ? {
                title: before.title,
                actionType: before.actionType,
                targetCount: before.targetCount,
                reward: before.reward,
              }
            : undefined,
          afterState: {
            title: payload.title,
            actionType: payload.actionType,
            targetCount: payload.targetCount,
            accumulateField: payload.accumulateField,
            reward: payload.reward,
          },
          status: 'SUCCESS',
        });
        setNotice({
          status: 'success',
          title: 'Quest Updated',
          text: `"${payload.title}" has been saved and is live for players.`,
        });
      } else {
        const created = await createRewardRule(payload);
        void recordAuditEvent({
          action: 'CREATE_REWARD_RULE',
          category: 'REWARD',
          severity: 'HIGH',
          targetType: 'RewardRule',
          targetId: created.id,
          targetLabel: payload.title,
          afterState: {
            title: payload.title,
            actionType: payload.actionType,
            targetCount: payload.targetCount,
            accumulateField: payload.accumulateField,
            reward: payload.reward,
          },
          status: 'SUCCESS',
        });
        setNotice({
          status: 'success',
          title: 'Quest Created',
          text: `"${payload.title}" is now active in the live quest catalog.`,
        });
      }

      setDialogMode(null);
      await loadData(false);
    } catch (err) {
      setFormError(extractRewardApiError(err, 'Failed to save quest rule.'));
    } finally {
      setSubmitting(false);
    }
  };

  const executeToggleActive = async (rationale: string) => {
    if (!pendingToggle) return;
    const { rule, nextActive } = pendingToggle;
    await setRewardRuleActive(rule.id, nextActive);
    void recordAuditEvent({
      action: nextActive ? 'ACTIVATE_REWARD_RULE' : 'DEACTIVATE_REWARD_RULE',
      category: 'REWARD',
      severity: 'HIGH',
      targetType: 'RewardRule',
      targetId: rule.id,
      targetLabel: rule.title || rule.id,
      rationale,
      beforeState: { isActive: rule.isActive },
      afterState: { isActive: nextActive },
      status: 'SUCCESS',
    });
    setPendingToggle(null);
    setNotice({
      status: 'success',
      title: nextActive ? 'Quest Activated' : 'Quest Paused',
      text: `"${rule.title || rule.id}" is now ${nextActive ? 'Active' : 'Paused'}.`,
    });
    await loadData(false);
  };

  // Rule Tester helpers
  const simSchema = useMemo(() => getActionSchema(simActionType), [simActionType]);

  const applySimulatorPreset = (presetId: string) => {
    const preset = SIMULATOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSimActivePresetId(preset.id);
    setSimActionType(preset.actionType);
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.facts)) {
      mapped[k] = String(v);
    }
    setSimFactInputs(mapped);
  };

  const handleSimActionTypeChange = (nextActionType: string) => {
    setSimActionType(nextActionType);
    setSimActivePresetId('');
    setSimFactInputs(buildDefaultSimFacts(nextActionType));
  };

  const parsedSimFacts = useMemo<Record<string, unknown>>(() => {
    const result: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(simFactInputs)) {
      const trimmed = rawVal.trim();
      if (!trimmed) continue;
      const fieldMeta = getFactFieldSchema(simActionType, key);
      if (fieldMeta?.valueType === 'boolean') {
        result[key] = trimmed.toLowerCase() === 'true';
      } else if (fieldMeta?.valueType === 'number') {
        const n = Number(trimmed);
        result[key] = Number.isFinite(n) ? n : trimmed;
      } else if (fieldMeta?.valueType === 'string') {
        result[key] = trimmed;
      } else {
        if (trimmed === 'true' || trimmed === 'false') {
          result[key] = trimmed === 'true';
        } else if (!Number.isNaN(Number(trimmed))) {
          result[key] = Number(trimmed);
        } else {
          result[key] = trimmed;
        }
      }
    }
    return result;
  }, [simFactInputs, simActionType]);

  const simulationResults = useMemo(
    () => simulateRewardEvaluation(rules, simActionType, parsedSimFacts),
    [rules, simActionType, parsedSimFacts]
  );

  const simMatchedCount = useMemo(
    () => simulationResults.filter((r) => r.matched).length,
    [simulationResults]
  );

  const simCompletedCount = useMemo(
    () => simulationResults.filter((r) => r.matched && r.wouldComplete).length,
    [simulationResults]
  );

  const hasAccumulateOptions = accumulateFieldOptions.length > 0;

  return (
    <ConsolePage
      icon={<Icon icon={Award} size="sm" />}
      title="Quests & Rewards"
      actions={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button
            variant="secondary"
            size="sm"
            label={refreshing ? 'Refreshing...' : 'Refresh'}
            icon={<Icon icon={RefreshCw} />}
            isLoading={refreshing}
            onClick={() => void loadData(true)}
          />
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              label="New Quest"
              icon={<Icon icon={Plus} />}
              onClick={openCreateDialog}
            />
          )}
        </HStack>
      }
      toolbar={
        <TabList
          value={activeTab}
          onChange={(val) => setActiveTab(val as RewardTab)}
          role="tablist"
        >
          <Tab
            value="rules"
            label="Quest Catalog"
            endContent={<Badge label={String(rules.length)} variant="neutral" />}
          />
          <Tab
            value="simulator"
            label="Rule Tester"
            endContent={
              <Badge
                label={`${simMatchedCount} Matched`}
                variant={simMatchedCount > 0 ? 'success' : 'info'}
              />
            }
          />
        </TabList>
      }
      banner={
        notice ? (
          <Banner
            status={notice.status}
            title={notice.title}
            description={notice.text}
            collapsible={false}
          />
        ) : undefined
      }
    >
      <VStack gap={4}>
        <KpiSummaryStrip items={kpiItems} maxColumns={4} />

        {activeTab === 'rules' && (
          <VStack gap={3}>
            {/* Filter bar */}
            <Card padding={3}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  label="Filter quests by status"
                  size="sm"
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as StatusFilter)}
                >
                  <SegmentedControlItem value="ALL" label={`All (${statusCounts.ALL})`} />
                  <SegmentedControlItem value="ACTIVE" label={`Active (${statusCounts.ACTIVE})`} />
                  <SegmentedControlItem
                    value="INACTIVE"
                    label={`Paused (${statusCounts.INACTIVE})`}
                  />
                </SegmentedControl>

                <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                  <div className="w-[215px]">
                    <Selector
                      label="Activity Type"
                      options={actionFilterOptions}
                      value={actionFilter}
                      onChange={(val) => setActionFilter(String(val || 'ALL'))}
                      width="100%"
                    />
                  </div>
                  <div className="w-[175px]">
                    <Selector
                      label="Reward Type"
                      options={REWARD_TYPE_FILTER_OPTIONS}
                      value={rewardTypeFilter}
                      onChange={(val) =>
                        setRewardTypeFilter(String(val || 'ALL') as RewardTypeFilter)
                      }
                      width="100%"
                    />
                  </div>
                  <div className="w-full sm:w-[230px]">
                    <TextInput
                      label="Search Quests"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Quest name, activity, reward..."
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Quest Cards */}
            {loading ? (
              <Card padding={6}>
                <Text type="supporting" size="sm" color="secondary">
                  Loading quests and reward rules...
                </Text>
              </Card>
            ) : filteredRules.length === 0 ? (
              <Card padding={6}>
                <EmptyState
                  icon={<Icon icon={Award} />}
                  title="No matching quests found"
                  description={
                    rules.length === 0
                      ? 'No quest rules have been configured yet.'
                      : 'Try clearing your activity, reward, or search filters.'
                  }
                  actions={
                    canManage ? (
                      <Button
                        variant="primary"
                        size="sm"
                        label="Create Quest"
                        icon={<Icon icon={Plus} />}
                        onClick={openCreateDialog}
                      />
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredRules.map((rule) => {
                  const rewardLabel = formatRewardLabel(rule.reward, catalogs);
                  const actionSchema = getActionSchema(rule.actionType);
                  const activityShort = getActionDisplayLabel(rule.actionType, true);
                  const goalLabel = formatProgressGoalHuman(
                    rule.actionType,
                    rule.targetCount,
                    rule.accumulateField
                  );

                  return (
                    <Card
                      key={rule.id}
                      padding={4}
                      className={
                        rule.isActive ? 'pk-interactive-card' : 'pk-interactive-card opacity-75'
                      }
                    >
                      <VStack gap={3}>
                        {/* Header row */}
                        <HStack justify="between" vAlign="start" gap={2} wrap="wrap">
                          <VStack gap={1} className="min-w-0 flex-1">
                            <HStack gap={2} vAlign="center" wrap="wrap">
                              <StatusDot
                                variant={rule.isActive ? 'success' : 'neutral'}
                                label={rule.isActive ? 'Active quest' : 'Paused quest'}
                              />
                              <Heading level={5} weight="bold" className="truncate">
                                {rule.title || `${activityShort} Quest`}
                              </Heading>
                              <Badge
                                label={activityShort}
                                variant={getActionBadgeVariant(rule.actionType)}
                              />
                              <Badge
                                label={rule.isActive ? 'Active' : 'Paused'}
                                variant={rule.isActive ? 'success' : 'neutral'}
                              />
                            </HStack>
                            {rule.description && (
                              <Text type="supporting" size="sm" color="secondary">
                                {rule.description}
                              </Text>
                            )}
                          </VStack>

                          {canManage && (
                            <HStack gap={1} vAlign="center" className="shrink-0">
                              <IconButton
                                icon={<Edit2 className="w-4 h-4" />}
                                label={`Edit ${rule.title}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditOrCloneDialog(rule, 'edit')}
                              />
                              <IconButton
                                icon={<Copy className="w-4 h-4" />}
                                label={`Duplicate ${rule.title}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditOrCloneDialog(rule, 'clone')}
                              />
                              <IconButton
                                icon={<Power className="w-4 h-4" />}
                                label={
                                  rule.isActive ? `Pause ${rule.title}` : `Activate ${rule.title}`
                                }
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPendingToggle({ rule, nextActive: !rule.isActive })
                                }
                              />
                            </HStack>
                          )}
                        </HStack>

                        {/* Requirements + Goal & Reward */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5">
                            <VStack gap={1.5}>
                              <Text type="label" size="xsm" color="secondary">
                                REQUIREMENTS
                              </Text>
                              {rule.conditions.length === 0 ? (
                                <Text type="supporting" size="xsm" color="secondary">
                                  Every {getActionDisplayLabel(rule.actionType)} counts
                                </Text>
                              ) : (
                                <HStack gap={1.5} wrap="wrap">
                                  {rule.conditions.map((cond, idx) => (
                                    <Badge
                                      key={`${rule.id}-cond-${idx}`}
                                      variant="neutral"
                                      label={formatConditionHuman(
                                        rule.actionType,
                                        cond,
                                        catalogs.chapterNameById
                                      )}
                                    />
                                  ))}
                                </HStack>
                              )}
                            </VStack>
                          </div>

                          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5">
                            <VStack gap={1.5}>
                              <Text type="label" size="xsm" color="secondary">
                                GOAL &amp; REWARD
                              </Text>
                              <HStack gap={1.5} wrap="wrap" vAlign="center">
                                <Badge variant="info" label={goalLabel} />
                                <Badge
                                  variant={getRewardBadgeVariant(rule.reward.type)}
                                  label={rewardLabel}
                                />
                              </HStack>
                            </VStack>
                          </div>
                        </div>

                        {/* Player Completion Funnel (when backend stats available) */}
                        {(() => {
                          const stat = statsByRuleId.get(rule.id);
                          if (!stat) return null;
                          const completionPct =
                            stat.totalPlayers > 0
                              ? Math.round((stat.completedCount / stat.totalPlayers) * 100)
                              : 0;
                          return (
                            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2.5 py-2">
                              <VStack gap={1.5}>
                                <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                                  <Text type="label" size="xsm" color="secondary">
                                    PLAYER PROGRESS ({stat.totalPlayers.toLocaleString()} players)
                                  </Text>
                                  <HStack gap={1} wrap="wrap">
                                    <Badge
                                      variant="info"
                                      label={`${stat.inProgressCount} In Progress`}
                                    />
                                    <Badge
                                      variant="yellow"
                                      label={`${stat.readyToClaimCount} Ready`}
                                    />
                                    <Badge
                                      variant="success"
                                      label={`${stat.claimedCount} Claimed`}
                                    />
                                  </HStack>
                                </HStack>
                                <ProgressBar
                                  label={`Completion rate for ${rule.title}`}
                                  isLabelHidden
                                  value={completionPct}
                                  max={100}
                                  variant={completionPct >= 75 ? 'success' : 'accent'}
                                />
                              </VStack>
                            </div>
                          );
                        })()}

                        {/* Footer */}
                        <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                          <Text type="supporting" size="xsm" color="secondary">
                            {actionSchema ? actionSchema.sourceLabel : rule.actionType} · Ref #
                            {rule.id.slice(-6).toUpperCase()}
                          </Text>
                          <Button
                            variant="ghost"
                            size="sm"
                            label="Test Rule"
                            icon={<Icon icon={FlaskConical} />}
                            onClick={() => {
                              handleSimActionTypeChange(rule.actionType);
                              setActiveTab('simulator');
                            }}
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  );
                })}
              </div>
            )}
          </VStack>
        )}

        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left panel: Sample Player Action */}
            <div className="xl:col-span-5">
              <Card padding={4}>
                <VStack gap={3}>
                  <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                    <HStack gap={2} vAlign="center">
                      <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
                      <Heading level={5} weight="bold">
                        Test a Player Scenario
                      </Heading>
                    </HStack>
                    <Badge label="Safe Preview" variant="cyan" />
                  </HStack>

                  <Text type="supporting" size="sm" color="secondary">
                    Choose a sample scenario or adjust the details below to preview which live
                    quests will gain progress. Nothing is saved to player accounts.
                  </Text>

                  {/* Quick Scenario Presets */}
                  <VStack gap={1.5}>
                    <Text type="label" size="xsm" color="secondary">
                      QUICK SCENARIOS
                    </Text>
                    <div className="flex flex-wrap gap-1.5">
                      {SIMULATOR_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          size="sm"
                          variant={simActivePresetId === preset.id ? 'primary' : 'secondary'}
                          label={preset.label}
                          onClick={() => applySimulatorPreset(preset.id)}
                        />
                      ))}
                    </div>
                  </VStack>

                  <Selector
                    label="Player Activity"
                    options={formActionOptions}
                    value={simActionType}
                    onChange={(val) => handleSimActionTypeChange(String(val || 'MatchResult'))}
                    width="100%"
                  />

                  {/* Friendly scenario inputs */}
                  <VStack gap={2}>
                    <Text type="label" size="xsm" color="secondary">
                      EVENT DETAILS
                    </Text>
                    {simSchema ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {simSchema.facts.map((fact) => {
                          const currentVal = simFactInputs[fact.key] ?? '';
                          if (simActionType === 'StoryProgress' && fact.key === 'chapterId') {
                            return (
                              <Selector
                                key={fact.key}
                                label={fact.label}
                                options={chapterSelectOptions}
                                value={currentVal || '0'}
                                onChange={(val) => {
                                  setSimActivePresetId('');
                                  setSimFactInputs((prev) => ({
                                    ...prev,
                                    [fact.key]: String(val ?? '0'),
                                  }));
                                }}
                                width="100%"
                              />
                            );
                          }
                          if (fact.presetValues && fact.presetValues.length > 0) {
                            return (
                              <Selector
                                key={fact.key}
                                label={fact.label}
                                options={fact.presetValues}
                                value={currentVal || fact.example}
                                onChange={(val) => {
                                  setSimActivePresetId('');
                                  setSimFactInputs((prev) => ({
                                    ...prev,
                                    [fact.key]: String(val ?? ''),
                                  }));
                                }}
                                width="100%"
                              />
                            );
                          }
                          return (
                            <TextInput
                              key={fact.key}
                              label={fact.label}
                              value={currentVal}
                              onChange={(val) => {
                                setSimActivePresetId('');
                                setSimFactInputs((prev) => ({ ...prev, [fact.key]: val }));
                              }}
                              placeholder={fact.example}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <Text type="supporting" size="sm" color="secondary">
                        No predefined fields for this activity type.
                      </Text>
                    )}
                  </VStack>
                </VStack>
              </Card>
            </div>

            {/* Right panel: Preview Results */}
            <div className="xl:col-span-7">
              <Card padding={4}>
                <VStack gap={3}>
                  <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                    <HStack gap={2} vAlign="center">
                      <Play className="w-4 h-4 text-[var(--color-accent)]" />
                      <Heading level={5} weight="bold">
                        Matching Quests ({getActionDisplayLabel(simActionType)})
                      </Heading>
                    </HStack>
                    <HStack gap={1.5} wrap="wrap">
                      <Badge
                        label={`${simMatchedCount} Matched`}
                        variant={simMatchedCount > 0 ? 'success' : 'neutral'}
                      />
                      <Badge
                        label={`${simCompletedCount} Ready to Claim`}
                        variant={simCompletedCount > 0 ? 'yellow' : 'neutral'}
                      />
                    </HStack>
                  </HStack>

                  {simulationResults.length === 0 ? (
                    <EmptyState
                      icon={<Icon icon={Layers} />}
                      title={`No quests linked to ${getActionDisplayLabel(simActionType)}`}
                      description="Create a quest for this activity or select another scenario on the left."
                    />
                  ) : (
                    <VStack gap={2}>
                      {simulationResults.map((res) => {
                        const rewardLabel = formatRewardLabel(res.rule.reward, catalogs);
                        const pct = Math.min(
                          100,
                          Math.round((res.projectedCount / res.targetCount) * 100)
                        );
                        const accSchema = res.rule.accumulateField
                          ? getFactFieldSchema(res.rule.actionType, res.rule.accumulateField)
                          : undefined;

                        return (
                          <div
                            key={res.rule.id}
                            className={`rounded-lg border p-3 ${
                              res.matched
                                ? 'border-[color-mix(in_srgb,var(--color-icon-success)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-icon-success)_6%,var(--color-background-card))]'
                                : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]'
                            }`}
                          >
                            <VStack gap={2}>
                              <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                                <HStack gap={2} vAlign="center">
                                  {res.matched ? (
                                    <CheckCircle2 className="w-4 h-4 text-[var(--color-icon-success)] shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-[var(--color-icon-secondary)] shrink-0" />
                                  )}
                                  <Text size="sm" weight="bold">
                                    {res.rule.title || res.rule.id}
                                  </Text>
                                  {!res.isActive && <Badge label="Paused" variant="neutral" />}
                                </HStack>

                                <HStack gap={1.5} wrap="wrap">
                                  {res.matched ? (
                                    <>
                                      <Badge
                                        variant="info"
                                        label={`+${res.delta.toLocaleString()} (${res.projectedCount.toLocaleString()} / ${res.targetCount.toLocaleString()})`}
                                      />
                                      <Badge
                                        variant={res.wouldComplete ? 'yellow' : 'success'}
                                        label={
                                          res.wouldComplete ? 'Ready to Claim' : 'Progress Added'
                                        }
                                      />
                                    </>
                                  ) : (
                                    <Badge
                                      label={res.skipReason || 'Not Matched'}
                                      variant="neutral"
                                    />
                                  )}
                                </HStack>
                              </HStack>

                              {/* Human-readable requirement checks */}
                              {res.conditionTraces.length > 0 ? (
                                <HStack gap={1.5} wrap="wrap">
                                  {res.conditionTraces.map((trace, i) => {
                                    const condText = formatConditionHuman(
                                      res.rule.actionType,
                                      trace.condition,
                                      catalogs.chapterNameById
                                    );
                                    const actualFormatted = trace.hasField
                                      ? formatFactValueHuman(
                                          res.rule.actionType,
                                          trace.condition.field,
                                          trace.actualValue,
                                          catalogs.chapterNameById
                                        )
                                      : 'missing';
                                    return (
                                      <Badge
                                        key={`${res.rule.id}-trace-${i}`}
                                        variant={trace.passed ? 'success' : 'error'}
                                        label={
                                          trace.passed
                                            ? `✓ ${condText}`
                                            : `✗ ${condText} (actual: ${actualFormatted})`
                                        }
                                      />
                                    );
                                  })}
                                </HStack>
                              ) : (
                                <Text type="supporting" size="xsm" color="secondary">
                                  No extra requirements — counts every{' '}
                                  {getActionDisplayLabel(res.rule.actionType)}.
                                </Text>
                              )}

                              {res.matched && (
                                <VStack gap={1}>
                                  <ProgressBar
                                    label={`Preview progress for ${res.rule.title}`}
                                    isLabelHidden
                                    value={pct}
                                    max={100}
                                    variant={res.wouldComplete ? 'success' : 'accent'}
                                  />
                                  <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                                    <Text type="supporting" size="xsm" color="secondary">
                                      Reward on claim: <strong>{rewardLabel}</strong>
                                    </Text>
                                    <Text type="supporting" size="xsm" color="secondary">
                                      {accSchema
                                        ? `Tracks: ${accSchema.accumulateLabel || accSchema.label}`
                                        : 'Tracks: Number of completions'}
                                    </Text>
                                  </HStack>
                                </VStack>
                              )}
                            </VStack>
                          </div>
                        );
                      })}
                    </VStack>
                  )}
                </VStack>
              </Card>
            </div>
          </div>
        )}
      </VStack>

      {/* Create / Edit / Duplicate Quest Modal */}
      <Dialog
        isOpen={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialogMode(null);
        }}
        purpose="form"
        width={660}
        maxHeight="90dvh"
      >
        <form onSubmit={handleSaveRule} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title={
                dialogMode === 'edit'
                  ? 'Edit Quest Rule'
                  : dialogMode === 'clone'
                    ? 'Duplicate Quest Rule'
                    : 'Create New Quest'
              }
              subtitle="Set how players earn progress and what reward they can claim"
              startContent={<Award className="w-5 h-5 text-[var(--color-accent)]" />}
              onOpenChange={(open) => {
                if (!open && !submitting) setDialogMode(null);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {formError && (
                <Banner
                  status="error"
                  title="Please Check Your Settings"
                  description={formError}
                  collapsible={false}
                />
              )}

              {/* Live Plain-English Rule Preview */}
              <Card variant="muted" padding={3}>
                <VStack gap={1}>
                  <Text type="label" size="xsm" color="secondary">
                    QUEST SUMMARY PREVIEW
                  </Text>
                  <Text size="sm" weight="medium">
                    {liveFormSummary}
                  </Text>
                </VStack>
              </Card>

              {/* Step 1: Basics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput
                  label="Quest Title"
                  value={formTitle}
                  onChange={setFormTitle}
                  placeholder="e.g. Flawless Vanguard"
                  isRequired
                />
                <Selector
                  label="Player Activity"
                  options={formActionOptions}
                  value={formActionType}
                  onChange={(val) => handleActionTypeChange(String(val || 'MatchResult'))}
                  width="100%"
                />
              </div>

              <TextArea
                label="Quest Description (Shown to Players)"
                value={formDescription}
                onChange={setFormDescription}
                rows={2}
                placeholder="e.g. Win 1 PvP or Ranked match with at least 3 heroes still alive."
              />

              {/* Step 2: Requirements */}
              <Card variant="muted" padding={3}>
                <VStack gap={2}>
                  <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                    <VStack gap={0}>
                      <Text type="label" size="xsm" color="secondary">
                        REQUIREMENTS (OPTIONAL)
                      </Text>
                      <Text type="supporting" size="xsm" color="secondary">
                        Only count progress when all requirements below are met. Leave empty to
                        count every {getActionDisplayLabel(formActionType)}.
                      </Text>
                    </VStack>
                    <Button
                      variant="secondary"
                      size="sm"
                      label="Add Requirement"
                      icon={<Icon icon={Plus} />}
                      onClick={addConditionRow}
                    />
                  </HStack>

                  {formConditions.length === 0 ? (
                    <Text type="supporting" size="xsm" color="secondary">
                      No extra requirements — every {getActionDisplayLabel(formActionType)} counts.
                    </Text>
                  ) : (
                    <VStack gap={2}>
                      {formConditions.map((cond, idx) => {
                        const knownFields = currentFormSchema?.facts ?? [];
                        const isKnownField = knownFields.some((f) => f.key === cond.field);
                        const fieldSelectOptions: SelectorOptionData[] = [
                          ...knownFields.map((f) => ({
                            value: f.key,
                            label: f.label,
                          })),
                          ...(!isKnownField && cond.field
                            ? [{ value: CUSTOM_FIELD_SENTINEL, label: `Custom (${cond.field})` }]
                            : [{ value: CUSTOM_FIELD_SENTINEL, label: 'Other custom criteria...' }]),
                        ];
                        const fieldMeta = getFactFieldSchema(formActionType, cond.field);
                        const opOptions = getAllowedOpsForField(formActionType, cond.field).map(
                          (o) => ({ value: o.value, label: o.label })
                        );
                        const isChapterField =
                          formActionType === 'StoryProgress' && cond.field === 'chapterId';

                        return (
                          <div
                            key={`cond-row-${idx}`}
                            className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-background-card)] p-2.5"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                              <div className="sm:col-span-4">
                                <Selector
                                  label="Criteria"
                                  options={fieldSelectOptions}
                                  value={isKnownField ? cond.field : CUSTOM_FIELD_SENTINEL}
                                  onChange={(val) => {
                                    const next = String(val || '');
                                    if (next === CUSTOM_FIELD_SENTINEL) {
                                      updateConditionRow(idx, { field: '' });
                                    } else {
                                      updateConditionRow(idx, { field: next });
                                    }
                                  }}
                                  width="100%"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <Selector
                                  label="Condition"
                                  options={opOptions.length > 0 ? opOptions : ALL_CONDITION_OPS}
                                  value={cond.op}
                                  onChange={(val) =>
                                    updateConditionRow(idx, { op: String(val || '==') })
                                  }
                                  width="100%"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                {isChapterField ? (
                                  <Selector
                                    label="Target Chapter"
                                    options={chapterSelectOptions}
                                    value={cond.value || '0'}
                                    onChange={(val) =>
                                      updateConditionRow(idx, { value: String(val ?? '0') })
                                    }
                                    width="100%"
                                  />
                                ) : fieldMeta?.presetValues ? (
                                  <Selector
                                    label="Value"
                                    options={fieldMeta.presetValues}
                                    value={cond.value}
                                    onChange={(val) =>
                                      updateConditionRow(idx, { value: String(val ?? '') })
                                    }
                                    width="100%"
                                  />
                                ) : (
                                  <TextInput
                                    label="Value"
                                    value={cond.value}
                                    onChange={(val) => updateConditionRow(idx, { value: val })}
                                    placeholder={fieldMeta?.example || 'Enter value'}
                                  />
                                )}
                              </div>

                              <div className="sm:col-span-1 flex justify-end">
                                <IconButton
                                  icon={<Trash2 className="w-4 h-4" />}
                                  label={`Remove requirement ${idx + 1}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeConditionRow(idx)}
                                />
                              </div>
                            </div>

                            {!isKnownField && (
                              <div className="mt-2">
                                <TextInput
                                  label="Custom Criteria Name"
                                  value={cond.field}
                                  onChange={(val) => updateConditionRow(idx, { field: val })}
                                  placeholder="Enter exact criteria key"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </VStack>
                  )}
                </VStack>
              </Card>

              {/* Step 3: Completion Goal */}
              <Card variant="muted" padding={3}>
                <VStack gap={2}>
                  <Text type="label" size="xsm" color="secondary">
                    COMPLETION GOAL
                  </Text>

                  {hasAccumulateOptions && (
                    <SegmentedControl
                      label="How progress is counted"
                      size="sm"
                      value={formProgressMode}
                      onChange={(val) => {
                        const nextMode = val as 'count' | 'accumulate';
                        setFormProgressMode(nextMode);
                        if (nextMode === 'accumulate' && !formAccumulateField) {
                          const firstAcc =
                            currentFormSchema?.facts.find((f) => f.canAccumulate)?.key ?? '';
                          setFormAccumulateField(firstAcc);
                        }
                      }}
                    >
                      <SegmentedControlItem value="count" label="Count Times Completed" />
                      <SegmentedControlItem value="accumulate" label="Track Total Amount" />
                    </SegmentedControl>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formProgressMode === 'accumulate' && hasAccumulateOptions ? (
                      <Selector
                        label="Metric to Track"
                        options={accumulateFieldOptions}
                        value={formAccumulateField}
                        onChange={(val) => setFormAccumulateField(String(val || ''))}
                        width="100%"
                      />
                    ) : (
                      <div className="rounded-md border border-[var(--color-border-subtle)] px-3 py-2 flex items-center">
                        <Text type="supporting" size="sm" color="secondary">
                          Adds <strong>+1</strong> each time the player completes this activity.
                        </Text>
                      </div>
                    )}

                    <NumberInput
                      label="Target Goal"
                      value={formTargetCount}
                      onChange={setFormTargetCount}
                      min={1}
                      isIntegerOnly
                    />
                  </div>
                </VStack>
              </Card>

              {/* Step 4: Reward */}
              <Card variant="muted" padding={3}>
                <VStack gap={2}>
                  <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                    <Text type="label" size="xsm" color="secondary">
                      REWARD ON CLAIM
                    </Text>
                    <Badge
                      label={
                        formRewardType === 'Gems'
                          ? 'Direct Gem Credit'
                          : 'Duplicate -> Compensation Gems'
                      }
                      variant={formRewardType === 'Gems' ? 'cyan' : 'yellow'}
                    />
                  </HStack>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Selector
                      label="Reward Type"
                      options={REWARD_TYPE_OPTIONS}
                      value={formRewardType}
                      onChange={(val) =>
                        handleRewardTypeChange(String(val || 'Gems') as GachaRewardType)
                      }
                      width="100%"
                    />

                    {formRewardType === 'Gems' && (
                      <NumberInput
                        label="Gems Amount"
                        value={formRewardAmount}
                        onChange={setFormRewardAmount}
                        min={1}
                        isIntegerOnly
                      />
                    )}

                    {formRewardType === 'Unit' && (
                      <Selector
                        label="Hero Unit"
                        options={unitSelectOptions}
                        value={String(formRewardDefId)}
                        onChange={(val) => handleUnitSelectionChange(Number(val) || 1)}
                        width="100%"
                      />
                    )}

                    {formRewardType === 'Weapon' && (
                      <Selector
                        label="Weapon"
                        options={weaponSelectOptions}
                        value={String(formRewardDefId)}
                        onChange={(val) => setFormRewardDefId(Number(val) || 1)}
                        width="100%"
                      />
                    )}

                    {formRewardType === 'Trinket' && (
                      <Selector
                        label="Trinket"
                        options={trinketSelectOptions}
                        value={String(formRewardDefId)}
                        onChange={(val) => setFormRewardDefId(Number(val) || 1)}
                        width="100%"
                      />
                    )}
                  </div>

                  {formRewardType === 'Unit' && (
                    <Selector
                      label="Starting Class"
                      options={unitClassOptions}
                      value={String(formRewardClassId)}
                      onChange={(val) => setFormRewardClassId(Number(val) || 1)}
                      width="100%"
                    />
                  )}

                  {formRewardType !== 'Gems' && (
                    <HStack gap={2} vAlign="center">
                      <Shield className="w-4 h-4 text-[var(--color-icon-warning)] shrink-0" />
                      <Text type="supporting" size="xsm" color="secondary">
                        If a player already owns this{' '}
                        {formRewardType === 'Unit' ? 'hero' : formRewardType.toLowerCase()} when
                        claiming, they will automatically receive Gems as compensation.
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </Card>
            </VStack>
          </div>

          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} justify="end" wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                onClick={() => setDialogMode(null)}
                isDisabled={submitting}
              />
              <Button
                type="submit"
                variant="primary"
                label={
                  submitting
                    ? 'Saving...'
                    : dialogMode === 'edit'
                      ? 'Save Changes'
                      : 'Create & Publish Quest'
                }
                isLoading={submitting}
              />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* Activate / Pause Confirmation Modal */}
      <SensitiveActionModal
        isOpen={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        onConfirm={executeToggleActive}
        title={pendingToggle?.nextActive ? 'Activate Quest' : 'Pause Quest'}
        description={
          pendingToggle?.nextActive
            ? 'Activating this quest makes it immediately visible to players and eligible to track progress.'
            : 'Pausing stops new progress on this quest. Players who already completed it can still claim their reward.'
        }
        targetLabel="Quest"
        targetSummary={
          pendingToggle
            ? `${pendingToggle.rule.title || pendingToggle.rule.id} (${getActionDisplayLabel(pendingToggle.rule.actionType, true)})`
            : undefined
        }
        severity="HIGH"
        actionLabel={pendingToggle?.nextActive ? 'Activate Quest' : 'Pause Quest'}
      />
    </ConsolePage>
  );
};

export default RewardManagement;
