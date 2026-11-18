import React, { useMemo, useState } from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { IconButton } from '@astryxdesign/core/IconButton';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import {
  AlertTriangle,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Gem,
  Layers,
  Percent,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sword,
  Trash2,
  X,
} from 'lucide-react';
import type { GachaBannerItem, GachaRewardType } from '../types';
import {
  analyzePoolItems,
  applyGroupRateToPool,
  applyRateUpToggleToPool,
  balanceFillersToTargetPool,
  getGroupTargetIndices,
  getPoolItemIdentityKey,
  getTrinketNumericId,
  getUnitNumericId,
  getWeaponNumericId,
  normalizePoolItemsToBasisPoints,
  ratePctToWeight,
  summarizePoolByTier,
  weightToRatePct,
  type GachaPoolCatalogs,
  type GroupRateApplyMode,
  type GroupRateTarget,
} from '../utils/gachaPoolValidation';

export interface GachaPoolEditorProps extends GachaPoolCatalogs {
  items: GachaBannerItem[];
  onChange: (nextItems: GachaBannerItem[]) => void;
  catalogWarning?: string | null;
}

type PoolTypeFilter = 'ALL' | GachaRewardType | 'ISSUES';
type PoolTierFilter = 'ALL' | 'FEATURED' | 3 | 2 | 1;
type PoolSortPreset = '' | 'TIER_DESC' | 'RATE_ASC' | 'RATE_DESC' | 'TYPE';

interface PoolEntryRef {
  item: GachaBannerItem;
  idx: number;
}

interface PoolGroupMeta {
  key: 'FEATURED' | 3 | 2 | 1;
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  headerClass: string;
}

const POOL_GROUP_DEFINITIONS: PoolGroupMeta[] = [
  {
    key: 'FEATURED',
    title: '★ Rate-Up (Featured)',
    subtitle: 'Highlighted banner targets • 50/50 Hard Pity guarantee',
    badgeLabel: 'RATE-UP',
    badgeVariant: 'warning',
    headerClass: 'border-l-4 border-l-amber-400 bg-amber-400/10',
  },
  {
    key: 3,
    title: 'Tier 3 (T3) • Rare Pool',
    subtitle: 'Standard high-rarity Heroes / top-tier rewards',
    badgeLabel: 'T3',
    badgeVariant: 'purple',
    headerClass: 'border-l-4 border-l-violet-500 bg-violet-500/10',
  },
  {
    key: 2,
    title: 'Tier 2 (T2) • Stat Equipment',
    subtitle: 'Uncommon Weapons & Trinkets with stat bonuses',
    badgeLabel: 'T2',
    badgeVariant: 'cyan',
    headerClass: 'border-l-4 border-l-cyan-500 bg-cyan-500/10',
  },
  {
    key: 1,
    title: 'Tier 1 (T1) • Base & Fillers',
    subtitle: 'Common no-stat equipment & Gem rewards',
    badgeLabel: 'T1',
    badgeVariant: 'neutral',
    headerClass: 'border-l-4 border-l-slate-500 bg-slate-500/10',
  },
];

const REWARD_TYPE_OPTIONS: SelectorOptionData[] = [
  { value: 'Unit', label: 'Hero Unit' },
  { value: 'Weapon', label: 'Weapon' },
  { value: 'Trinket', label: 'Trinket' },
  { value: 'Gems', label: 'Gems' },
];

const TIER_OPTIONS: SelectorOptionData[] = [
  { value: '3', label: 'T3 • Rare' },
  { value: '2', label: 'T2 • Equip' },
  { value: '1', label: 'T1 • Base' },
];

const POOL_SORT_OPTIONS: SelectorOptionData[] = [
  { value: 'TIER_DESC', label: 'Sort: Featured & Tier ↓' },
  { value: 'RATE_ASC', label: 'Sort: Rarest (Rate ↑)' },
  { value: 'RATE_DESC', label: 'Sort: Common (Rate ↓)' },
  { value: 'TYPE', label: 'Sort: Reward Type' },
];

const GROUP_RATE_MODE_OPTIONS: SelectorOptionData[] = [
  { value: 'PER_ITEM', label: 'Per Item (% each)' },
  { value: 'GROUP_TOTAL_EQUAL', label: 'Group Total (Equal Split)' },
  { value: 'GROUP_TOTAL_SCALE', label: 'Group Total (Keep Ratios)' },
];

function getRewardTypeMeta(type: GachaRewardType): {
  label: string;
  badgeVariant: BadgeVariant;
} {
  if (type === 'Unit') return { label: 'Hero', badgeVariant: 'purple' };
  if (type === 'Weapon') return { label: 'Weapon', badgeVariant: 'cyan' };
  if (type === 'Trinket') return { label: 'Trinket', badgeVariant: 'info' };
  return { label: 'Gems', badgeVariant: 'neutral' };
}

function getTierBadgeMeta(tier: number): {
  label: string;
  variant: BadgeVariant;
  borderClass: string;
} {
  if (tier === 3) {
    return { label: 'T3', variant: 'purple', borderClass: 'border-l-violet-500' };
  }
  if (tier === 2) {
    return { label: 'T2', variant: 'cyan', borderClass: 'border-l-cyan-500' };
  }
  return { label: 'T1', variant: 'neutral', borderClass: 'border-l-slate-500' };
}

export const GachaPoolEditor: React.FC<GachaPoolEditorProps> = ({
  items,
  onChange,
  units,
  weapons,
  trinkets,
  classes,
  catalogWarning,
}) => {
  const [poolSearch, setPoolSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PoolTypeFilter>('ALL');
  const [tierFilter, setTierFilter] = useState<PoolTierFilter>('ALL');
  const [sortPreset, setSortPreset] = useState<PoolSortPreset>('');
  const [groupByTier, setGroupByTier] = useState<boolean>(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const [poolStatusNote, setPoolStatusNote] = useState<string | null>(null);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkInlineSection, setBulkInlineSection] = useState<'FEATURED' | 3 | 2 | 1 | null>(
    null,
  );
  const [bulkTarget, setBulkTarget] = useState<GroupRateTarget>('T3_STD');
  const [bulkMode, setBulkMode] = useState<GroupRateApplyMode>('PER_ITEM');
  const [bulkPct, setBulkPct] = useState<number>(1);

  const unitMap = useMemo(() => {
    const map = new Map<number, (typeof units)[number]>();
    units.forEach((u) => {
      const uid = getUnitNumericId(u);
      if (uid > 0) map.set(uid, u);
    });
    return map;
  }, [units]);

  const weaponMap = useMemo(() => {
    const map = new Map<number, (typeof weapons)[number]>();
    weapons.forEach((w) => {
      const wid = getWeaponNumericId(w);
      if (wid > 0) map.set(wid, w);
    });
    return map;
  }, [weapons]);

  const trinketMap = useMemo(() => {
    const map = new Map<number, (typeof trinkets)[number]>();
    trinkets.forEach((t) => {
      const tid = getTrinketNumericId(t);
      if (tid > 0) map.set(tid, t);
    });
    return map;
  }, [trinkets]);

  const classMap = useMemo(() => {
    const map = new Map<number, (typeof classes)[number]>();
    classes.forEach((c) => {
      const cid = Number(c.classId ?? 0);
      if (cid > 0) map.set(cid, c);
    });
    return map;
  }, [classes]);

  const unitOptions = useMemo<SelectorOptionData[]>(() => {
    return Array.from(unitMap.entries()).map(([uid, u]) => ({
      value: String(uid),
      label: `#${uid} ${u.unitName || u.name || `Unit ${uid}`}`,
    }));
  }, [unitMap]);

  const weaponOptions = useMemo<SelectorOptionData[]>(() => {
    return Array.from(weaponMap.entries()).map(([wid, w]) => ({
      value: String(wid),
      label: `#${wid} ${w.name || `Weapon ${wid}`}`,
    }));
  }, [weaponMap]);

  const trinketOptions = useMemo<SelectorOptionData[]>(() => {
    return Array.from(trinketMap.entries()).map(([tid, t]) => ({
      value: String(tid),
      label: `#${tid} ${t.name || `Trinket ${tid}`}`,
    }));
  }, [trinketMap]);

  const allClassOptions = useMemo<SelectorOptionData[]>(() => {
    return Array.from(classMap.entries()).map(([cid, c]) => ({
      value: String(cid),
      label: `#${cid} ${c.name || c.className || `Class ${cid}`}`,
    }));
  }, [classMap]);

  const getClassOptionsForUnit = (
    unitDefId: number,
    currentClassId: number,
  ): SelectorOptionData[] => {
    const unit = unitMap.get(unitDefId);
    const allowedIds = Array.isArray(unit?.classIds) ? unit.classIds : [];
    const baseOptions =
      allowedIds.length > 0
        ? allowedIds.map((cid) => {
            const matched = classMap.get(Number(cid));
            return {
              value: String(cid),
              label: matched
                ? `#${cid} ${matched.name || matched.className || `Class ${cid}`}`
                : `Class #${cid}`,
            };
          })
        : allClassOptions;

    if (
      currentClassId > 0 &&
      !baseOptions.some((opt) => Number(opt.value) === currentClassId)
    ) {
      const matched = classMap.get(currentClassId);
      return [
        {
          value: String(currentClassId),
          label: matched
            ? `#${currentClassId} ${matched.name || matched.className} (Invalid for unit)`
            : `#${currentClassId} (Invalid Class)`,
        },
        ...baseOptions,
      ];
    }

    return baseOptions;
  };

  const resolveDisplayParts = (
    item: GachaBannerItem,
  ): { title: string; subtitle: string } => {
    const { type, definitionId, classId, amount } = item.reward;
    if (type === 'Gems') {
      return {
        title: `${amount.toLocaleString()} Gems`,
        subtitle: 'Currency filler',
      };
    }
    if (type === 'Unit') {
      const u = unitMap.get(definitionId);
      const c = classMap.get(classId);
      const unitLabel = u?.unitName || u?.name || `Unit #${definitionId}`;
      const classLabel =
        classId > 0 ? c?.name || c?.className || `Class #${classId}` : 'No Class';
      return {
        title: unitLabel,
        subtitle: `#${definitionId} • Class: ${classLabel}`,
      };
    }
    if (type === 'Weapon') {
      const w = weaponMap.get(definitionId);
      return {
        title: w?.name || `Weapon #${definitionId}`,
        subtitle: `Weapon #${definitionId}`,
      };
    }
    const t = trinketMap.get(definitionId);
    return {
      title: t?.name || `Trinket #${definitionId}`,
      subtitle: `Trinket #${definitionId}`,
    };
  };

  const validation = useMemo(
    () => analyzePoolItems(items, { units, weapons, trinkets, classes }),
    [items, units, weapons, trinkets, classes],
  );

  const poolSummary = useMemo(() => summarizePoolByTier(items), [items]);

  const visibleEntries = useMemo<PoolEntryRef[]>(() => {
    const getSearchableText = (item: GachaBannerItem): string => {
      const { type, definitionId, classId, amount } = item.reward;
      if (type === 'Gems') {
        return `gems ${amount} t1 tier 1`;
      }
      if (type === 'Unit') {
        const u = unitMap.get(definitionId);
        const c = classMap.get(classId);
        return `unit hero #${definitionId} ${u?.unitName || u?.name || ''} class #${classId} ${c?.name || c?.className || ''} t${item.rewardTier}`.toLowerCase();
      }
      if (type === 'Weapon') {
        const w = weaponMap.get(definitionId);
        return `weapon #${definitionId} ${w?.name || ''} t${item.rewardTier}`.toLowerCase();
      }
      const t = trinketMap.get(definitionId);
      return `trinket #${definitionId} ${t?.name || ''} t${item.rewardTier}`.toLowerCase();
    };

    const q = poolSearch.trim().toLowerCase();
    return items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item, idx }) => {
        if (tierFilter === 'FEATURED' && !item.isFeatured) return false;
        if (typeof tierFilter === 'number' && item.rewardTier !== tierFilter) return false;

        if (typeFilter === 'ISSUES' && !validation.issueIndices.has(idx)) return false;
        if (
          typeFilter !== 'ALL' &&
          typeFilter !== 'ISSUES' &&
          item.reward.type !== typeFilter
        ) {
          return false;
        }
        if (q) {
          const idxStr = `#${idx + 1}`;
          if (!idxStr.includes(q) && !getSearchableText(item).includes(q)) {
            return false;
          }
        }
        return true;
      });
  }, [
    items,
    tierFilter,
    typeFilter,
    poolSearch,
    validation.issueIndices,
    unitMap,
    weaponMap,
    trinketMap,
    classMap,
  ]);

  const groupedSections = useMemo(() => {
    return POOL_GROUP_DEFINITIONS.map((groupMeta) => {
      const entries = visibleEntries.filter(({ item }) => {
        if (groupMeta.key === 'FEATURED') return item.isFeatured;
        return !item.isFeatured && item.rewardTier === groupMeta.key;
      });
      const groupWeight = entries.reduce(
        (sum, { item }) => sum + Math.max(0, Math.round(Number(item.weight) || 0)),
        0,
      );
      return {
        meta: groupMeta,
        entries,
        rateLabel: weightToRatePct(groupWeight).toFixed(2),
      };
    }).filter((section) => section.entries.length > 0);
  }, [visibleEntries]);

  const createDefaultEntry = (type: GachaRewardType): GachaBannerItem => {
    if (type === 'Unit') {
      const firstUnit = units.find((u) => getUnitNumericId(u) > 0);
      const defId = firstUnit ? getUnitNumericId(firstUnit) : 1;
      const defaultClass =
        Array.isArray(firstUnit?.classIds) && firstUnit.classIds.length > 0
          ? Number(firstUnit.classIds[0])
          : Number(classes[0]?.classId ?? 1);
      return {
        reward: { type: 'Unit', definitionId: defId, classId: defaultClass, amount: 1 },
        weight: 200, // 2.00%
        isFeatured: true,
        rewardTier: 3,
      };
    }

    if (type === 'Weapon') {
      const firstWeapon = weapons.find((w) => getWeaponNumericId(w) > 0);
      return {
        reward: {
          type: 'Weapon',
          definitionId: firstWeapon ? getWeaponNumericId(firstWeapon) : 1,
          classId: 0,
          amount: 1,
        },
        weight: 500, // 5.00%
        isFeatured: false,
        rewardTier: 2,
      };
    }

    if (type === 'Trinket') {
      const firstTrinket = trinkets.find((t) => getTrinketNumericId(t) > 0);
      return {
        reward: {
          type: 'Trinket',
          definitionId: firstTrinket ? getTrinketNumericId(firstTrinket) : 1,
          classId: 0,
          amount: 1,
        },
        weight: 500, // 5.00%
        isFeatured: false,
        rewardTier: 2,
      };
    }

    return {
      reward: { type: 'Gems', definitionId: 0, classId: 0, amount: 50 },
      weight: 2500, // 25.00%
      isFeatured: false,
      rewardTier: 1,
    };
  };

  const toggleRowExpanded = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleTierFilter = (target: PoolTierFilter) => {
    setTierFilter((prev) => (prev === target ? 'ALL' : target));
  };

  const addEntry = (type: GachaRewardType) => {
    setPoolSearch('');
    setTypeFilter('ALL');
    setTierFilter('ALL');
    setPoolStatusNote(null);
    setExpandedRows(new Set([0]));
    onChange([createDefaultEntry(type), ...items]);
  };

  const duplicateEntry = (index: number) => {
    const source = items[index];
    const clone: GachaBannerItem = {
      ...source,
      reward: { ...source.reward },
    };
    const next = [...items];
    next.splice(index + 1, 0, clone);
    setPoolStatusNote(null);
    setExpandedRows(new Set([index + 1]));
    onChange(next);
  };

  const removeEntry = (index: number) => {
    setPoolStatusNote(null);
    setExpandedRows(new Set());
    onChange(items.filter((_, idx) => idx !== index));
  };

  const updateEntry = (index: number, patch: Partial<GachaBannerItem>) => {
    onChange(items.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const handleToggleRateUp = (index: number, nextFeatured: boolean) => {
    const res = applyRateUpToggleToPool(items, index, nextFeatured);
    setPoolStatusNote(res.note);
    onChange(res.items);
  };

  const handleBalanceFillers = () => {
    const res = balanceFillersToTargetPool(items);
    if (!res.ok) {
      setPoolStatusNote(res.error || 'Could not auto-balance common fillers.');
      return;
    }
    setPoolStatusNote('Adjusted common filler entries so total pool rate equals 100.00%.');
    onChange(res.items);
  };

  const handleNormalizeAll = () => {
    setPoolStatusNote('Normalized all entries proportionally so total pool rate equals 100.00%.');
    onChange(normalizePoolItemsToBasisPoints(items));
  };

  const changeEntryType = (index: number, nextType: GachaRewardType) => {
    const fresh = createDefaultEntry(nextType);
    const current = items[index];
    onChange(
      items.map((entry, idx) =>
        idx === index
          ? {
              ...fresh,
              weight: current.weight > 0 ? current.weight : fresh.weight,
            }
          : entry,
      ),
    );
  };

  const handleSortPool = (preset: PoolSortPreset) => {
    setSortPreset(preset);
    if (!preset) return;

    const typeRank = (t: GachaRewardType) =>
      t === 'Unit' ? 0 : t === 'Weapon' ? 1 : t === 'Trinket' ? 2 : 3;

    const sorted = [...items].sort((a, b) => {
      if (preset === 'TIER_DESC') {
        return (
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.rewardTier - a.rewardTier ||
          a.weight - b.weight
        );
      }
      if (preset === 'RATE_ASC') {
        return a.weight - b.weight || b.rewardTier - a.rewardTier;
      }
      if (preset === 'RATE_DESC') {
        return b.weight - a.weight || a.rewardTier - b.rewardTier;
      }
      return (
        typeRank(a.reward.type) - typeRank(b.reward.type) ||
        b.rewardTier - a.rewardTier ||
        a.weight - b.weight
      );
    });
    setExpandedRows(new Set());
    onChange(sorted);
  };

  const renderEntryRow = ({ item, idx }: PoolEntryRef) => {
    const rType = item.reward.type;
    const typeMeta = getRewardTypeMeta(rType);
    const tierMeta = getTierBadgeMeta(item.rewardTier);
    const display = resolveDisplayParts(item);
    const targetRate = weightToRatePct(item.weight);

    const baseDefOptions =
      rType === 'Unit' ? unitOptions : rType === 'Weapon' ? weaponOptions : trinketOptions;

    const defExists = baseDefOptions.some(
      (opt) => Number(opt.value) === item.reward.definitionId,
    );
    const defOptions =
      rType !== 'Gems' && item.reward.definitionId > 0 && !defExists
        ? [
            {
              value: String(item.reward.definitionId),
              label: `#${item.reward.definitionId} (Missing from catalog)`,
            },
            ...baseDefOptions,
          ]
        : baseDefOptions;

    const unitClassOptions =
      rType === 'Unit'
        ? getClassOptionsForUnit(item.reward.definitionId, item.reward.classId)
        : [];

    const rowError = validation.itemErrors.get(idx);
    const isDuplicate = validation.duplicateIndices.has(idx);
    const hasError = Boolean(rowError) || isDuplicate;
    const isExpanded = expandedRows.has(idx) || Boolean(rowError);
    const dupKey = getPoolItemIdentityKey(item);
    const dupPeers = (validation.duplicateGroups.get(dupKey) || [])
      .filter((peerIdx) => peerIdx !== idx)
      .map((peerIdx) => `#${peerIdx + 1}`);

    const rowAccentClass = hasError
      ? 'border-l-4 border-l-rose-500 bg-rose-500/5'
      : item.isFeatured
        ? 'border-l-4 border-l-amber-400 bg-amber-400/5'
        : `border-l-4 ${tierMeta.borderClass} hover:bg-[var(--color-surface-subtle)]/50`;

    return (
      <div
        key={`pool-item-${idx}`}
        className={`${rowAccentClass} px-3 py-2.5 space-y-2.5 transition-colors`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          {/* Column 1: #Index + Tier + Type + Item Name + Change Toggle */}
          <div className="sm:col-span-5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Text
                  type="code"
                  size="xsm"
                  color="secondary"
                  hasTabularNumbers
                  className="w-7 shrink-0"
                >
                  #{idx + 1}
                </Text>
                <Badge label={tierMeta.label} variant={tierMeta.variant} />
                <Badge label={typeMeta.label} variant={typeMeta.badgeVariant} />
                {item.isFeatured && (
                  <Star
                    size={13}
                    className="text-amber-400 fill-amber-400 shrink-0"
                    aria-label="Rate-Up item"
                  />
                )}
                <div className="min-w-0 pl-0.5">
                  <Text
                    size="sm"
                    weight="semibold"
                    maxLines={1}
                    className={item.isFeatured ? 'text-amber-200' : undefined}
                  >
                    {display.title}
                  </Text>
                  <Text type="supporting" size="2xs" maxLines={1}>
                    {display.subtitle}
                  </Text>
                </div>
              </div>

              <IconButton
                label={
                  isExpanded
                    ? `Collapse item picker #${idx + 1}`
                    : `Change item or class #${idx + 1}`
                }
                tooltip={isExpanded ? 'Hide item selector' : 'Change item / type'}
                variant={isExpanded ? 'secondary' : 'ghost'}
                size="sm"
                icon={
                  isExpanded ? (
                    <ChevronUp size={13} />
                  ) : (
                    <HStack gap={0.5} vAlign="center">
                      <Edit3 size={12} />
                      <ChevronDown size={12} />
                    </HStack>
                  )
                }
                onClick={() => toggleRowExpanded(idx)}
              />
            </div>
          </div>

          {/* Column 2: Tier */}
          <div className="sm:col-span-2">
            <Selector
              label={`Tier for entry #${idx + 1}`}
              isLabelHidden
              size="sm"
              options={TIER_OPTIONS}
              value={String(item.rewardTier)}
              onChange={(val) => {
                if (!val) return;
                updateEntry(idx, {
                  rewardTier: (Number(val) === 3 ? 3 : Number(val) === 2 ? 2 : 1) as
                    | 1
                    | 2
                    | 3,
                });
              }}
            />
          </div>

          {/* Column 3: Rate-Up */}
          <div className="sm:col-span-2">
            <CheckboxInput
              label="Rate-Up"
              value={Boolean(item.isFeatured)}
              onChange={(checked) => handleToggleRateUp(idx, checked)}
            />
          </div>

          {/* Column 4: Direct % Input */}
          <div className="sm:col-span-2">
            <NumberInput
              label={`Drop rate percentage for entry #${idx + 1}`}
              isLabelHidden
              size="sm"
              units="%"
              value={targetRate}
              onChange={(val) =>
                updateEntry(idx, {
                  weight: Number.isFinite(val) ? ratePctToWeight(val) : 1,
                })
              }
              formatValue={(val) => val.toFixed(2)}
              min={0.01}
              max={100}
              step={0.1}
              hasNumberSteppers
              isWheelEnabled={false}
            />
          </div>

          {/* Column 5: Duplicate & Remove */}
          <div className="sm:col-span-1 flex items-center justify-end gap-1">
            <IconButton
              label={`Duplicate entry #${idx + 1}`}
              tooltip="Duplicate"
              variant="ghost"
              size="sm"
              icon={<Copy size={13} />}
              onClick={() => duplicateEntry(idx)}
            />
            <IconButton
              label={`Remove entry #${idx + 1}`}
              tooltip="Remove"
              variant="ghost"
              size="sm"
              icon={<Trash2 size={13} />}
              onClick={() => removeEntry(idx)}
            />
          </div>
        </div>

        {(isDuplicate || rowError) && (
          <div className="sm:pl-9 flex flex-wrap items-center gap-2">
            {isDuplicate && (
              <Badge label={`Duplicate with ${dupPeers.join(', ')}`} variant="error" />
            )}
            {rowError && (
              <HStack gap={1} vAlign="center" className="text-rose-400">
                <AlertTriangle size={12} />
                <Text type="supporting" size="xsm" color="inherit">
                  {rowError}
                </Text>
              </HStack>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="sm:ml-9 rounded-[var(--radius-sm,8px)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <Selector
                  label="Reward Type"
                  size="sm"
                  options={REWARD_TYPE_OPTIONS}
                  value={rType}
                  onChange={(val) => {
                    if (val) changeEntryType(idx, val as GachaRewardType);
                  }}
                />
              </div>

              {rType === 'Gems' ? (
                <div className="sm:col-span-5">
                  <NumberInput
                    label="Gems Amount"
                    size="sm"
                    units="Gems"
                    value={item.reward.amount}
                    onChange={(val) =>
                      updateEntry(idx, {
                        reward: {
                          ...item.reward,
                          definitionId: 0,
                          classId: 0,
                          amount: Number.isFinite(val)
                            ? Math.max(1, Math.round(val))
                            : 1,
                        },
                      })
                    }
                    min={1}
                    isIntegerOnly
                    hasNumberSteppers
                    isWheelEnabled={false}
                  />
                </div>
              ) : (
                <div className={rType === 'Unit' ? 'sm:col-span-5' : 'sm:col-span-9'}>
                  <Selector
                    label="Catalog Item"
                    size="sm"
                    placeholder="Select item..."
                    options={defOptions}
                    value={
                      item.reward.definitionId > 0 ? String(item.reward.definitionId) : ''
                    }
                    onChange={(val) => {
                      if (!val) return;
                      const nextDefId = Number(val);
                      let nextClassId = 0;
                      if (rType === 'Unit') {
                        const allowed = getClassOptionsForUnit(nextDefId, 0);
                        nextClassId = Number(allowed[0]?.value ?? 1);
                      }
                      updateEntry(idx, {
                        reward: {
                          ...item.reward,
                          definitionId: nextDefId,
                          classId: nextClassId,
                          amount: 1,
                        },
                      });
                    }}
                  />
                </div>
              )}

              {rType === 'Unit' && (
                <div className="sm:col-span-4">
                  <Selector
                    label="Unlocked Class"
                    size="sm"
                    placeholder="Select class..."
                    options={unitClassOptions}
                    value={item.reward.classId > 0 ? String(item.reward.classId) : ''}
                    onChange={(val) => {
                      if (!val) return;
                      updateEntry(idx, {
                        reward: { ...item.reward, classId: Number(val) },
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const rateDeltaLabel =
    poolSummary.deltaPct > 0
      ? `+${poolSummary.deltaPct.toFixed(2)}% over`
      : `${poolSummary.deltaPct.toFixed(2)}% under`;

  const computeSuggestedBulkPct = (
    target: GroupRateTarget,
    mode: GroupRateApplyMode,
  ): number => {
    const indices = getGroupTargetIndices(items, target);
    if (indices.length === 0) return mode === 'PER_ITEM' ? 1 : 5;
    const totalBp = indices.reduce(
      (sum, idx) => sum + Math.max(1, Math.round(items[idx].weight)),
      0,
    );
    if (mode === 'PER_ITEM') {
      return Math.max(0.01, Number((totalBp / indices.length / 100).toFixed(2)));
    }
    return Math.max(0.01, Number((totalBp / 100).toFixed(2)));
  };

  const openGroupRateEditor = (
    target: GroupRateTarget,
    inlineKey: 'FEATURED' | 3 | 2 | 1 | null,
  ) => {
    if (bulkPanelOpen && bulkInlineSection === inlineKey) {
      setBulkPanelOpen(false);
      return;
    }
    const indices = getGroupTargetIndices(items, target);
    const resolvedTarget: GroupRateTarget =
      indices.length > 0
        ? target
        : poolSummary.featured.count > 0
          ? 'FEATURED'
          : poolSummary.tier3Standard.count > 0
            ? 'T3_STD'
            : poolSummary.tier2Standard.count > 0
              ? 'T2'
              : 'T1';
    const nextMode: GroupRateApplyMode = resolvedTarget === 'T1' ? 'GROUP_TOTAL_SCALE' : bulkMode;
    setBulkTarget(resolvedTarget);
    setBulkMode(nextMode);
    setBulkPct(computeSuggestedBulkPct(resolvedTarget, nextMode));
    setBulkInlineSection(inlineKey);
    setBulkPanelOpen(true);
  };

  const handleApplyBulkGroupRate = (autoBalanceT1: boolean) => {
    const res = applyGroupRateToPool(items, bulkTarget, bulkMode, bulkPct, autoBalanceT1);
    setPoolStatusNote(res.note);
    if (res.ok) {
      onChange(res.items);
    }
  };

  const bulkTargetOptions = useMemo<SelectorOptionData[]>(() => {
    const opts: SelectorOptionData[] = [];
    if (poolSummary.featured.count > 0) {
      opts.push({
        value: 'FEATURED',
        label: `★ Rate-Up (${poolSummary.featured.count})`,
      });
    }
    if (poolSummary.tier3Standard.count > 0) {
      opts.push({
        value: 'T3_STD',
        label:
          poolSummary.tier3All.count !== poolSummary.tier3Standard.count
            ? `T3 Standard (${poolSummary.tier3Standard.count})`
            : `Tier 3 • T3 (${poolSummary.tier3Standard.count})`,
      });
    }
    if (poolSummary.tier3All.count > poolSummary.tier3Standard.count) {
      opts.push({
        value: 'T3_ALL',
        label: `All Tier 3 incl. Rate-Up (${poolSummary.tier3All.count})`,
      });
    }
    if (poolSummary.tier2Standard.count > 0) {
      opts.push({
        value: 'T2',
        label: `Tier 2 • T2 (${poolSummary.tier2Standard.count})`,
      });
    }
    if (poolSummary.tier1Standard.count > 0) {
      opts.push({
        value: 'T1',
        label: `Tier 1 • T1 (${poolSummary.tier1Standard.count})`,
      });
    }
    return opts;
  }, [poolSummary]);

  const bulkTargetIndices = useMemo(
    () => getGroupTargetIndices(items, bulkTarget),
    [items, bulkTarget],
  );

  const bulkPreviewText = useMemo(() => {
    const count = bulkTargetIndices.length;
    if (count === 0) return 'No entries in selected group.';
    const inputBp = ratePctToWeight(bulkPct);
    const currentGroupBp = bulkTargetIndices.reduce(
      (sum, idx) => sum + Math.max(1, Math.round(items[idx].weight)),
      0,
    );
    const nextGroupBp = bulkMode === 'PER_ITEM' ? inputBp * count : inputBp;
    const projectedPoolBp = poolSummary.totalWeight - currentGroupBp + nextGroupBp;

    if (bulkMode === 'PER_ITEM') {
      return `Applies ${weightToRatePct(inputBp).toFixed(2)}% to all ${count} items → Group total: ${weightToRatePct(nextGroupBp).toFixed(2)}% • Pool total: ${weightToRatePct(projectedPoolBp).toFixed(2)}%`;
    }
    const avgEach = weightToRatePct(nextGroupBp / count).toFixed(2);
    if (bulkMode === 'GROUP_TOTAL_EQUAL') {
      return `Splits ${weightToRatePct(nextGroupBp).toFixed(2)}% evenly across ${count} items (~${avgEach}% each) • Pool total: ${weightToRatePct(projectedPoolBp).toFixed(2)}%`;
    }
    return `Scales ${count} items to ${weightToRatePct(nextGroupBp).toFixed(2)}% total while keeping ratios • Pool total: ${weightToRatePct(projectedPoolBp).toFixed(2)}%`;
  }, [bulkTargetIndices, bulkPct, bulkMode, items, poolSummary.totalWeight]);

  const renderGroupRatePanel = () => (
    <div className="rounded-[var(--radius-sm,8px)] border border-[var(--color-accent-primary)]/40 bg-[var(--color-surface-card)] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <HStack gap={1.5} vAlign="center">
          <SlidersHorizontal size={14} />
          <Text type="label" size="xsm" weight="bold">
            Batch Edit Group Drop Rate
          </Text>
        </HStack>
        <IconButton
          label="Close group rate editor"
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          onClick={() => setBulkPanelOpen(false)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div className="sm:col-span-4">
          <Selector
            label="Target Group"
            size="sm"
            options={bulkTargetOptions}
            value={bulkTarget}
            onChange={(val) => {
              if (!val) return;
              const nextTarget = val as GroupRateTarget;
              setBulkTarget(nextTarget);
              setBulkPct(computeSuggestedBulkPct(nextTarget, bulkMode));
            }}
          />
        </div>

        <div className="sm:col-span-4">
          <Selector
            label="Apply Rule"
            size="sm"
            options={GROUP_RATE_MODE_OPTIONS}
            value={bulkMode}
            onChange={(val) => {
              if (!val) return;
              const nextMode = val as GroupRateApplyMode;
              setBulkMode(nextMode);
              setBulkPct(computeSuggestedBulkPct(bulkTarget, nextMode));
            }}
          />
        </div>

        <div className="sm:col-span-4">
          <NumberInput
            label={bulkMode === 'PER_ITEM' ? 'Rate Per Item (%)' : 'Group Total (%)'}
            size="sm"
            units="%"
            value={bulkPct}
            onChange={(val) => {
              if (Number.isFinite(val)) setBulkPct(val);
            }}
            formatValue={(val) => val.toFixed(2)}
            min={0.01}
            max={100}
            step={0.1}
            hasNumberSteppers
            isWheelEnabled={false}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Text type="supporting" size="xsm">
          {bulkPreviewText}
        </Text>
        <HStack gap={1.5} wrap="wrap">
          <Button
            label="Apply to Group"
            variant={bulkTarget === 'T1' || poolSummary.tier1Standard.count === 0 ? 'primary' : 'secondary'}
            size="sm"
            isDisabled={bulkTargetIndices.length === 0}
            onClick={() => handleApplyBulkGroupRate(false)}
          />
          {bulkTarget !== 'T1' && poolSummary.tier1Standard.count > 0 && (
            <Button
              label="Apply & Balance T1 → 100%"
              variant="primary"
              size="sm"
              isDisabled={bulkTargetIndices.length === 0}
              onClick={() => handleApplyBulkGroupRate(true)}
            />
          )}
        </HStack>
      </div>
    </div>
  );

  return (
    <VStack gap={3}>
      {/* Pool Overview: Total Rate + Interactive 4-Tier Breakdown & Legend + Quick-Add */}
      <div className="rounded-[var(--radius-md,10px)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
              Total: {poolSummary.totalRatePctLabel}%
            </Text>
            <Badge
              label={validation.isRateBalanced ? '100% Balanced' : rateDeltaLabel}
              variant={validation.isRateBalanced ? 'success' : 'warning'}
            />
            {items.length > 0 && (
              <Button
                label="Set Group Rates"
                variant={bulkPanelOpen && bulkInlineSection === null ? 'primary' : 'secondary'}
                size="sm"
                icon={<SlidersHorizontal size={13} />}
                onClick={() => openGroupRateEditor('T3_STD', null)}
              />
            )}
            {tierFilter !== 'ALL' && (
              <Button
                label="Show All Tiers"
                variant="ghost"
                size="sm"
                onClick={() => setTierFilter('ALL')}
              />
            )}
          </HStack>

          <HStack gap={1.5} wrap="wrap">
            <Button
              label="+ Hero"
              variant="secondary"
              size="sm"
              icon={<Sparkles size={13} />}
              onClick={() => addEntry('Unit')}
            />
            <Button
              label="+ Weapon"
              variant="secondary"
              size="sm"
              icon={<Sword size={13} />}
              onClick={() => addEntry('Weapon')}
            />
            <Button
              label="+ Trinket"
              variant="secondary"
              size="sm"
              icon={<Shield size={13} />}
              onClick={() => addEntry('Trinket')}
            />
            <Button
              label="+ Gems"
              variant="secondary"
              size="sm"
              icon={<Gem size={13} />}
              onClick={() => addEntry('Gems')}
            />
          </HStack>
        </div>

        {/* 4 Interactive Clickable Tier / Rate-Up Summary Cards (Legend + Instant Filter) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            aria-pressed={tierFilter === 'FEATURED'}
            onClick={() => toggleTierFilter('FEATURED')}
            className={`text-left rounded-[var(--radius-sm,8px)] border px-2.5 py-2 transition-all ${
              tierFilter === 'FEATURED'
                ? 'border-amber-400 bg-amber-400/15 ring-1 ring-amber-400/60'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/70 hover:border-amber-400/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <HStack gap={1} vAlign="center">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <Text type="label" size="2xs" weight="bold">
                  ★ Rate-Up
                </Text>
              </HStack>
              <Text type="code" size="2xs" color="secondary">
                {poolSummary.featured.count} items
              </Text>
            </div>
            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
              {poolSummary.featured.targetPctLabel}%
            </Text>
            <Text type="supporting" size="2xs" maxLines={1}>
              Featured &amp; Hard Pity 50/50
            </Text>
          </button>

          <button
            type="button"
            aria-pressed={tierFilter === 3}
            onClick={() => toggleTierFilter(3)}
            className={`text-left rounded-[var(--radius-sm,8px)] border px-2.5 py-2 transition-all ${
              tierFilter === 3
                ? 'border-violet-400 bg-violet-500/15 ring-1 ring-violet-400/60'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/70 hover:border-violet-400/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <HStack gap={1} vAlign="center">
                <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                <Text type="label" size="2xs" weight="bold">
                  Tier 3 (T3)
                </Text>
              </HStack>
              <Text type="code" size="2xs" color="secondary">
                {poolSummary.tier3All.count} items
              </Text>
            </div>
            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
              {poolSummary.tier3All.targetPctLabel}%
            </Text>
            <Text type="supporting" size="2xs" maxLines={1}>
              {poolSummary.tier3All.count !== poolSummary.tier3Standard.count
                ? `Non-featured: ${poolSummary.tier3Standard.targetPctLabel}%`
                : 'Rare Heroes / Top tier'}
            </Text>
          </button>

          <button
            type="button"
            aria-pressed={tierFilter === 2}
            onClick={() => toggleTierFilter(2)}
            className={`text-left rounded-[var(--radius-sm,8px)] border px-2.5 py-2 transition-all ${
              tierFilter === 2
                ? 'border-cyan-400 bg-cyan-500/15 ring-1 ring-cyan-400/60'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/70 hover:border-cyan-400/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <HStack gap={1} vAlign="center">
                <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                <Text type="label" size="2xs" weight="bold">
                  Tier 2 (T2)
                </Text>
              </HStack>
              <Text type="code" size="2xs" color="secondary">
                {poolSummary.tier2All.count} items
              </Text>
            </div>
            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
              {poolSummary.tier2All.targetPctLabel}%
            </Text>
            <Text type="supporting" size="2xs" maxLines={1}>
              Stat Weapons &amp; Trinkets
            </Text>
          </button>

          <button
            type="button"
            aria-pressed={tierFilter === 1}
            onClick={() => toggleTierFilter(1)}
            className={`text-left rounded-[var(--radius-sm,8px)] border px-2.5 py-2 transition-all ${
              tierFilter === 1
                ? 'border-slate-400 bg-slate-500/20 ring-1 ring-slate-400/60'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/70 hover:border-slate-400/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <HStack gap={1} vAlign="center">
                <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
                <Text type="label" size="2xs" weight="bold">
                  Tier 1 (T1)
                </Text>
              </HStack>
              <Text type="code" size="2xs" color="secondary">
                {poolSummary.tier1All.count} items
              </Text>
            </div>
            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
              {poolSummary.tier1All.targetPctLabel}%
            </Text>
            <Text type="supporting" size="2xs" maxLines={1}>
              Base Equipment &amp; Gems
            </Text>
          </button>
        </div>

        {/* 4-Segment Mutually Exclusive Drop Distribution Bar */}
        {poolSummary.totalWeight > 0 && (
          <div
            className="h-1.5 w-full rounded-full overflow-hidden flex bg-black/30"
            aria-label="Rate-Up and Tier drop rate distribution bar"
          >
            {poolSummary.featured.widthPct > 0 && (
              <div
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${poolSummary.featured.widthPct}%` }}
                title={`Rate-Up (Featured): ${poolSummary.featured.targetPctLabel}%`}
              />
            )}
            {poolSummary.tier3Standard.widthPct > 0 && (
              <div
                className="bg-violet-500 h-full transition-all"
                style={{ width: `${poolSummary.tier3Standard.widthPct}%` }}
                title={`Tier 3 Standard: ${poolSummary.tier3Standard.targetPctLabel}%`}
              />
            )}
            {poolSummary.tier2Standard.widthPct > 0 && (
              <div
                className="bg-cyan-500 h-full transition-all"
                style={{ width: `${poolSummary.tier2Standard.widthPct}%` }}
                title={`Tier 2 Standard: ${poolSummary.tier2Standard.targetPctLabel}%`}
              />
            )}
            {poolSummary.tier1Standard.widthPct > 0 && (
              <div
                className="bg-slate-500/80 h-full transition-all"
                style={{ width: `${poolSummary.tier1Standard.widthPct}%` }}
                title={`Tier 1 Standard: ${poolSummary.tier1Standard.targetPctLabel}%`}
              />
            )}
          </div>
        )}

        {bulkPanelOpen && bulkInlineSection === null && renderGroupRatePanel()}
      </div>

      {/* Contextual Alerts */}
      {catalogWarning && (
        <Banner
          status="warning"
          title="Definition Catalogs Incomplete"
          description={catalogWarning}
        />
      )}

      {poolStatusNote && (
        <Banner
          status="info"
          title="Drop Rate Adjusted"
          description={poolStatusNote}
          isDismissable
          onDismiss={() => setPoolStatusNote(null)}
        />
      )}

      {items.length > 0 && !validation.isRateBalanced && (
        <Banner
          status="warning"
          title={`Total Drop Rate Is ${poolSummary.totalRatePctLabel}% (${rateDeltaLabel})`}
          description="Rebalance common fillers or normalize all entries so the banner totals 100.00% before saving."
          endContent={
            <HStack gap={1.5} wrap="wrap">
              <Button
                label="Balance Fillers → 100%"
                variant="secondary"
                size="sm"
                icon={<Percent size={13} />}
                onClick={handleBalanceFillers}
              />
              <Button
                label="Normalize All → 100%"
                variant="primary"
                size="sm"
                onClick={handleNormalizeAll}
              />
            </HStack>
          }
        />
      )}

      {validation.firstErrorMessage && (
        <Banner
          status="error"
          title={`Pool Validation Issue (${validation.issueIndices.size} ${validation.issueIndices.size === 1 ? 'Entry' : 'Entries'})`}
          description={validation.firstErrorMessage}
        />
      )}

      {poolSummary.lowTierFeaturedCount > 0 && (
        <Banner
          status="warning"
          title="Low-Tier / Gems Item Marked Rate-Up"
          description={`${poolSummary.lowTierFeaturedCount} Tier 1 or Gems entry is marked Rate-Up. Hard Pity targets Featured items, so verify this is intentional.`}
        />
      )}

      {/* Filter by Reward Type, Search, Sort & Grouped/Flat Toggle */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            label="Filter pool entries by reward type"
            size="sm"
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as PoolTypeFilter)}
          >
            <SegmentedControlItem value="ALL" label={`All (${items.length})`} />
            <SegmentedControlItem value="Unit" label={`Hero (${poolSummary.typeCounts.Unit})`} />
            <SegmentedControlItem
              value="Weapon"
              label={`Weapon (${poolSummary.typeCounts.Weapon})`}
            />
            <SegmentedControlItem
              value="Trinket"
              label={`Trinket (${poolSummary.typeCounts.Trinket})`}
            />
            <SegmentedControlItem value="Gems" label={`Gems (${poolSummary.typeCounts.Gems})`} />
            {validation.issueIndices.size > 0 && (
              <SegmentedControlItem
                value="ISSUES"
                label={`Issues (${validation.issueIndices.size})`}
              />
            )}
          </SegmentedControl>

          <HStack gap={1.5} vAlign="center" wrap="wrap">
            <div className="w-[180px]">
              <TextInput
                label="Filter pool entries"
                isLabelHidden
                size="sm"
                placeholder="Search item or #ID..."
                value={poolSearch}
                onChange={setPoolSearch}
                hasClear
                startIcon={<Search size={13} />}
              />
            </div>

            <div className="w-[175px]">
              <Selector
                label="Sort pool items"
                isLabelHidden
                size="sm"
                placeholder="Sort order..."
                startIcon={ArrowDownUp}
                options={POOL_SORT_OPTIONS}
                value={sortPreset}
                onChange={(val) => handleSortPool((val || '') as PoolSortPreset)}
              />
            </div>

            <Button
              label={groupByTier ? 'Grouped' : 'Flat'}
              variant={groupByTier ? 'secondary' : 'ghost'}
              size="sm"
              icon={<Layers size={13} />}
              onClick={() => setGroupByTier((prev) => !prev)}
            />
          </HStack>
        </div>
      )}

      {/* Table / Grouped Pool List */}
      {items.length === 0 ? (
        <Banner
          status="warning"
          title="Reward Pool Empty"
          description="Banners without pool items cannot be activated or pulled by players. Use the + buttons above to add items."
          endContent={
            <Button
              label="Add Hero"
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => addEntry('Unit')}
            />
          }
        />
      ) : visibleEntries.length === 0 ? (
        <Card padding={4} variant="muted">
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <Text type="supporting" size="sm">
              No reward entries match the current tier or type filter.
            </Text>
            <Button
              label="Clear Pool Filters"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPoolSearch('');
                setTypeFilter('ALL');
                setTierFilter('ALL');
              }}
            />
          </HStack>
        </Card>
      ) : (
        <div className="rounded-[var(--radius-md,10px)] border border-[var(--color-border-subtle)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-subtle)]">
            <div className="sm:col-span-5">
              <Text type="label" size="2xs" color="secondary">
                REWARD ITEM (TIER • TYPE • NAME)
              </Text>
            </div>
            <div className="sm:col-span-2">
              <Text type="label" size="2xs" color="secondary">
                TIER
              </Text>
            </div>
            <div className="sm:col-span-2">
              <Text type="label" size="2xs" color="secondary">
                RATE-UP
              </Text>
            </div>
            <div className="sm:col-span-2">
              <Text type="label" size="2xs" color="secondary">
                DROP RATE (%)
              </Text>
            </div>
            <div className="sm:col-span-1 text-right">
              <Text type="label" size="2xs" color="secondary">
                ACTIONS
              </Text>
            </div>
          </div>

          {groupByTier
            ? groupedSections.map((section) => {
                const sectionTarget: GroupRateTarget =
                  section.meta.key === 'FEATURED'
                    ? 'FEATURED'
                    : section.meta.key === 3
                      ? 'T3_STD'
                      : section.meta.key === 2
                        ? 'T2'
                        : 'T1';
                const isInlineOpen =
                  bulkPanelOpen && bulkInlineSection === section.meta.key;

                return (
                  <React.Fragment key={section.meta.key}>
                    <div
                      className={`${section.meta.headerClass} px-3 py-1.5 flex flex-wrap items-center justify-between gap-2`}
                    >
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Badge
                          label={section.meta.badgeLabel}
                          variant={section.meta.badgeVariant}
                        />
                        <Text type="label" size="xsm" weight="bold">
                          {section.meta.title}
                        </Text>
                        <Text type="supporting" size="2xs">
                          {section.meta.subtitle}
                        </Text>
                      </HStack>
                      <HStack gap={2} vAlign="center">
                        <Text type="code" size="xsm" weight="semibold" hasTabularNumbers>
                          {section.entries.length} entries • {section.rateLabel}%
                        </Text>
                        <Button
                          label="Set Group %"
                          variant={isInlineOpen ? 'secondary' : 'ghost'}
                          size="sm"
                          icon={<SlidersHorizontal size={12} />}
                          onClick={() =>
                            openGroupRateEditor(sectionTarget, section.meta.key)
                          }
                        />
                      </HStack>
                    </div>
                    {isInlineOpen && (
                      <div className="p-2.5 bg-[var(--color-surface-subtle)]/60">
                        {renderGroupRatePanel()}
                      </div>
                    )}
                    {section.entries.map(renderEntryRow)}
                  </React.Fragment>
                );
              })
            : visibleEntries.map(renderEntryRow)}
        </div>
      )}
    </VStack>
  );
};
