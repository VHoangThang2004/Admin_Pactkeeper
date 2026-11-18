import type {
  ClassDefinition,
  GachaBannerItem,
  TrinketDefinition,
  UnitDefinition,
  WeaponDefinition,
} from '../types';

export const POOL_TOTAL_BASIS_POINTS = 10000;

export interface GachaPoolCatalogs {
  units: UnitDefinition[];
  weapons: WeaponDefinition[];
  trinkets: TrinketDefinition[];
  classes: ClassDefinition[];
}

export interface PoolValidationSummary {
  totalWeight: number;
  totalRatePct: number;
  isRateBalanced: boolean;
  itemErrors: Map<number, string>;
  duplicateGroups: Map<string, number[]>;
  duplicateIndices: Set<number>;
  issueIndices: Set<number>;
  firstErrorMessage: string | null;
}

export function weightToRatePct(weight: number): number {
  return Math.max(0, Number(weight) || 0) / 100;
}

export function ratePctToWeight(pct: number): number {
  return Math.max(1, Math.round((Number(pct) || 0) * 100));
}

export function allocateBasisPoints(rawWeights: number[], targetBp: number): number[] {
  if (rawWeights.length === 0) return [];

  const sanitized = rawWeights.map((w) => Math.max(0.0001, Number(w) || 0));
  const sum = sanitized.reduce((acc, w) => acc + w, 0);

  if (targetBp <= rawWeights.length) {
    return rawWeights.map(() => 1);
  }

  // Reserve 1 bp (0.01%) per entry so no entry drops to 0 weight
  const distributable = targetBp - rawWeights.length;
  const exactExtras = sanitized.map((w) => (w / sum) * distributable);
  const floors = exactExtras.map((v) => Math.floor(v));
  let remainder = distributable - floors.reduce((acc, v) => acc + v, 0);

  const rankedIndices = exactExtras
    .map((v, idx) => ({ idx, frac: v - floors[idx] }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);

  for (let i = 0; i < rankedIndices.length && remainder > 0; i++) {
    floors[rankedIndices[i].idx] += 1;
    remainder -= 1;
  }

  return floors.map((v) => v + 1);
}

export function normalizePoolItemsToBasisPoints(
  items: GachaBannerItem[],
  targetBp: number = POOL_TOTAL_BASIS_POINTS,
): GachaBannerItem[] {
  if (items.length === 0) return [];
  const currentTotal = items.reduce((sum, it) => sum + Math.max(0, Math.round(it.weight)), 0);
  if (currentTotal === targetBp && items.every((it) => it.weight >= 1)) {
    return items.map((it) => ({
      ...it,
      weight: Math.round(it.weight),
      reward: { ...it.reward },
    }));
  }

  const allocated = allocateBasisPoints(
    items.map((it) => Math.max(1, Number(it.weight) || 1)),
    targetBp,
  );
  return items.map((it, idx) => ({
    ...it,
    weight: allocated[idx],
    reward: { ...it.reward },
  }));
}

export function balanceFillersToTargetPool(
  items: GachaBannerItem[],
  targetBp: number = POOL_TOTAL_BASIS_POINTS,
): { items: GachaBannerItem[]; ok: boolean; error?: string } {
  if (items.length === 0) {
    return { items, ok: false, error: 'Reward pool is empty.' };
  }

  const currentTotal = items.reduce((sum, it) => sum + Math.max(1, Math.round(it.weight)), 0);
  const diff = targetBp - currentTotal;
  if (diff === 0) {
    return { items, ok: true };
  }

  let fillerIndices = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => !it.isFeatured && it.rewardTier === 1)
    .map(({ idx }) => idx);

  if (fillerIndices.length === 0) {
    fillerIndices = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => !it.isFeatured && it.rewardTier === 2)
      .map(({ idx }) => idx);
  }

  if (fillerIndices.length === 0) {
    return {
      items,
      ok: false,
      error: 'No non-featured Tier 1 or Tier 2 filler entries available. Use "Normalize All → 100%" instead.',
    };
  }

  const fillerTotal = fillerIndices.reduce(
    (sum, idx) => sum + Math.max(1, Math.round(items[idx].weight)),
    0,
  );
  const targetFillerTotal = fillerTotal + diff;

  if (targetFillerTotal < fillerIndices.length) {
    return {
      items,
      ok: false,
      error:
        'Common filler items cannot absorb this reduction without dropping below 0.01%. Use "Normalize All → 100%" instead.',
    };
  }

  const allocatedFillers = allocateBasisPoints(
    fillerIndices.map((idx) => Math.max(1, Math.round(items[idx].weight))),
    targetFillerTotal,
  );

  const next = items.map((it) => ({ ...it, reward: { ...it.reward } }));
  fillerIndices.forEach((poolIdx, i) => {
    next[poolIdx].weight = allocatedFillers[i];
  });

  return { items: next, ok: true };
}

export function applyRateUpToggleToPool(
  items: GachaBannerItem[],
  targetIndex: number,
  nextFeatured: boolean,
): { items: GachaBannerItem[]; note: string | null } {
  if (targetIndex < 0 || targetIndex >= items.length) {
    return { items, note: null };
  }

  const next = items.map((it) => ({ ...it, reward: { ...it.reward } }));
  const targetTier = next[targetIndex].rewardTier;
  const previousWeight = Math.max(1, Math.round(next[targetIndex].weight));
  next[targetIndex].isFeatured = nextFeatured;

  const sameTierIndices = next
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.rewardTier === targetTier)
    .map(({ idx }) => idx);

  if (sameTierIndices.length <= 1) {
    return { items: next, note: null };
  }

  const tierTotalBp = sameTierIndices.reduce(
    (sum, idx) => sum + Math.max(1, Math.round(next[idx].weight)),
    0,
  );

  const featuredIndices = sameTierIndices.filter((idx) => next[idx].isFeatured);
  const nonFeaturedIndices = sameTierIndices.filter((idx) => !next[idx].isFeatured);

  if (nextFeatured) {
    if (nonFeaturedIndices.length === 0) {
      const equalized = allocateBasisPoints(
        featuredIndices.map(() => 1),
        tierTotalBp,
      );
      featuredIndices.forEach((poolIdx, i) => {
        next[poolIdx].weight = equalized[i];
      });
      return {
        items: next,
        note: `All Tier ${targetTier} entries are now Rate-Up — split Tier ${targetTier} (${(tierTotalBp / 100).toFixed(2)}%) evenly among them.`,
      };
    }

    const maxNonFeaturedWeight = Math.max(
      ...nonFeaturedIndices.map((idx) => Math.max(1, Math.round(next[idx].weight))),
    );

    if (previousWeight > maxNonFeaturedWeight * 1.15) {
      return { items: next, note: null };
    }

    const fCount = featuredIndices.length;
    const nfCount = nonFeaturedIndices.length;
    const featuredShareRatio = Math.max(0.5, (2 * fCount) / (2 * fCount + nfCount));
    const minFeatured = fCount;
    const maxFeatured = Math.max(minFeatured, tierTotalBp - nfCount);
    const featuredTotalBp = Math.max(
      minFeatured,
      Math.min(maxFeatured, Math.round(tierTotalBp * featuredShareRatio)),
    );
    const nonFeaturedTotalBp = Math.max(nfCount, tierTotalBp - featuredTotalBp);

    const allocFeatured = allocateBasisPoints(
      featuredIndices.map(() => 1),
      featuredTotalBp,
    );
    const allocNonFeatured = allocateBasisPoints(
      nonFeaturedIndices.map((idx) => Math.max(1, Math.round(next[idx].weight))),
      nonFeaturedTotalBp,
    );

    featuredIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = allocFeatured[i];
    });
    nonFeaturedIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = allocNonFeatured[i];
    });

    const featuredRateLabel = `${(featuredTotalBp / 100).toFixed(2)}%`;
    const tierRateLabel = `${(tierTotalBp / 100).toFixed(2)}%`;
    return {
      items: next,
      note: `Auto-adjusted Tier ${targetTier} (${tierRateLabel}): Rate-Up entries now take ${featuredRateLabel} (${Math.round(featuredShareRatio * 100)}% of Tier ${targetTier}) while keeping pool total unchanged.`,
    };
  }

  // Unchecking Rate-Up
  if (featuredIndices.length > 0 && nonFeaturedIndices.length > 0) {
    const fCount = featuredIndices.length;
    const nfCount = nonFeaturedIndices.length;
    const featuredShareRatio = Math.max(0.5, (2 * fCount) / (2 * fCount + nfCount));
    const minFeatured = fCount;
    const maxFeatured = Math.max(minFeatured, tierTotalBp - nfCount);
    const featuredTotalBp = Math.max(
      minFeatured,
      Math.min(maxFeatured, Math.round(tierTotalBp * featuredShareRatio)),
    );
    const nonFeaturedTotalBp = Math.max(nfCount, tierTotalBp - featuredTotalBp);

    const allocFeatured = allocateBasisPoints(
      featuredIndices.map((idx) => Math.max(1, Math.round(next[idx].weight))),
      featuredTotalBp,
    );
    const allocNonFeatured = allocateBasisPoints(
      nonFeaturedIndices.map(() => 1),
      nonFeaturedTotalBp,
    );

    featuredIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = allocFeatured[i];
    });
    nonFeaturedIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = allocNonFeatured[i];
    });
    return {
      items: next,
      note: `Updated Tier ${targetTier} Rate-Up share after unchecking entry #${targetIndex + 1}.`,
    };
  }

  const otherWeights = sameTierIndices
    .filter((idx) => idx !== targetIndex)
    .map((idx) => Math.max(1, Math.round(next[idx].weight)));
  const minOther = Math.min(...otherWeights);
  if (featuredIndices.length === 0 && previousWeight > minOther * 1.15) {
    const equalized = allocateBasisPoints(
      sameTierIndices.map(() => 1),
      tierTotalBp,
    );
    sameTierIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = equalized[i];
    });
    return {
      items: next,
      note: `Restored equal drop rates across Tier ${targetTier} (${(tierTotalBp / 100).toFixed(2)}%).`,
    };
  }

  return { items: next, note: null };
}

export function getUnitNumericId(u: UnitDefinition): number {
  return Number(u.uId ?? 0);
}

export function getWeaponNumericId(w: WeaponDefinition): number {
  return Number(w.weaponId ?? 0);
}

export function getTrinketNumericId(t: TrinketDefinition): number {
  return Number(t.trinketId ?? 0);
}

export function getPoolItemIdentityKey(item: GachaBannerItem): string {
  const rType = item.reward.type;
  if (rType === 'Gems') {
    return `Gems:${Math.round(Number(item.reward.amount) || 0)}`;
  }
  if (rType === 'Unit') {
    return `Unit:${Number(item.reward.definitionId) || 0}:${Number(item.reward.classId) || 0}`;
  }
  return `${rType}:${Number(item.reward.definitionId) || 0}`;
}

export function analyzePoolItems(
  items: GachaBannerItem[],
  catalogs: GachaPoolCatalogs,
): PoolValidationSummary {
  const itemErrors = new Map<number, string>();
  const duplicateGroups = new Map<string, number[]>();
  const duplicateIndices = new Set<number>();
  const issueIndices = new Set<number>();

  let totalWeight = 0;

  const unitMap = new Map<number, UnitDefinition>();
  catalogs.units.forEach((u) => {
    const uid = getUnitNumericId(u);
    if (uid > 0) unitMap.set(uid, u);
  });

  const weaponIds = new Set<number>();
  catalogs.weapons.forEach((w) => {
    const wid = getWeaponNumericId(w);
    if (wid > 0) weaponIds.add(wid);
  });

  const trinketIds = new Set<number>();
  catalogs.trinkets.forEach((t) => {
    const tid = getTrinketNumericId(t);
    if (tid > 0) trinketIds.add(tid);
  });

  const classIds = new Set<number>();
  catalogs.classes.forEach((c) => {
    const cid = Number(c.classId ?? 0);
    if (cid > 0) classIds.add(cid);
  });

  items.forEach((item, idx) => {
    const entryNum = idx + 1;
    let err: string | null = null;
    totalWeight += Math.max(0, Math.round(Number(item.weight) || 0));

    if (!Number.isFinite(item.weight) || item.weight <= 0) {
      err = `Pool entry #${entryNum} must have Drop Rate of at least 0.01%.`;
    } else if (item.reward.type === 'Gems') {
      if (!Number.isFinite(item.reward.amount) || item.reward.amount <= 0) {
        err = `Pool entry #${entryNum} (Gems) must have Amount greater than 0.`;
      }
    } else if (!Number.isFinite(item.reward.definitionId) || item.reward.definitionId <= 0) {
      err = `Pool entry #${entryNum} requires a valid catalog item.`;
    } else if (item.reward.type === 'Unit') {
      const unitDef = unitMap.get(item.reward.definitionId);
      if (unitMap.size > 0 && !unitDef) {
        err = `Pool entry #${entryNum}: Unit #${item.reward.definitionId} is missing from UnitDefinitions.`;
      } else if (!Number.isFinite(item.reward.classId) || item.reward.classId <= 0) {
        err = `Pool entry #${entryNum}: Unit must specify a valid Class.`;
      } else if (classIds.size > 0 && !classIds.has(item.reward.classId)) {
        err = `Pool entry #${entryNum}: Class #${item.reward.classId} is missing from ClassDefinitions.`;
      } else if (
        unitDef &&
        Array.isArray(unitDef.classIds) &&
        unitDef.classIds.length > 0 &&
        !unitDef.classIds.some((cid) => Number(cid) === item.reward.classId)
      ) {
        err = `Pool entry #${entryNum}: Class #${item.reward.classId} is not allowed for ${unitDef.unitName || unitDef.name || `Unit #${item.reward.definitionId}`}.`;
      }
    } else if (item.reward.type === 'Weapon') {
      if (weaponIds.size > 0 && !weaponIds.has(item.reward.definitionId)) {
        err = `Pool entry #${entryNum}: Weapon #${item.reward.definitionId} is missing from WeaponDefinitions.`;
      }
    } else if (item.reward.type === 'Trinket') {
      if (trinketIds.size > 0 && !trinketIds.has(item.reward.definitionId)) {
        err = `Pool entry #${entryNum}: Trinket #${item.reward.definitionId} is missing from TrinketDefinitions.`;
      }
    }

    if (err) {
      itemErrors.set(idx, err);
      issueIndices.add(idx);
    }

    const key = getPoolItemIdentityKey(item);
    const group = duplicateGroups.get(key) || [];
    group.push(idx);
    duplicateGroups.set(key, group);
  });

  let duplicateMessage: string | null = null;
  duplicateGroups.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((idx) => {
        duplicateIndices.add(idx);
        issueIndices.add(idx);
      });
      if (!duplicateMessage) {
        const labels = indices.map((i) => `#${i + 1}`).join(', ');
        duplicateMessage = `Duplicate reward entries found at positions ${labels}. Merge their rates instead of repeating identical rewards.`;
      }
    }
  });

  const firstItemError =
    itemErrors.size > 0 ? (Array.from(itemErrors.values())[0] ?? null) : null;
  const totalRatePct = totalWeight / 100;
  const isRateBalanced = items.length === 0 || totalWeight === POOL_TOTAL_BASIS_POINTS;

  return {
    totalWeight,
    totalRatePct,
    isRateBalanced,
    itemErrors,
    duplicateGroups,
    duplicateIndices,
    issueIndices,
    firstErrorMessage: firstItemError || duplicateMessage,
  };
}

export interface PoolTierBucketStats {
  count: number;
  weight: number;
  targetPctLabel: string;
  effectivePctLabel: string;
  widthPct: number;
}

export interface PoolTierBreakdown {
  totalWeight: number;
  totalRatePctLabel: string;
  deltaPct: number;
  featured: PoolTierBucketStats;
  tier3All: PoolTierBucketStats;
  tier3Standard: PoolTierBucketStats;
  tier2All: PoolTierBucketStats;
  tier2Standard: PoolTierBucketStats;
  tier1All: PoolTierBucketStats;
  tier1Standard: PoolTierBucketStats;
  typeCounts: Record<'Unit' | 'Weapon' | 'Trinket' | 'Gems', number>;
  lowTierFeaturedCount: number;
}

export function summarizePoolByTier(items: GachaBannerItem[]): PoolTierBreakdown {
  let totalWeight = 0;
  let lowTierFeaturedCount = 0;
  const typeCounts = { Unit: 0, Weapon: 0, Trinket: 0, Gems: 0 };

  const acc = {
    featured: { count: 0, weight: 0 },
    tier3All: { count: 0, weight: 0 },
    tier3Standard: { count: 0, weight: 0 },
    tier2All: { count: 0, weight: 0 },
    tier2Standard: { count: 0, weight: 0 },
    tier1All: { count: 0, weight: 0 },
    tier1Standard: { count: 0, weight: 0 },
  };

  items.forEach((item) => {
    const w = Math.max(0, Math.round(Number(item.weight) || 0));
    totalWeight += w;
    typeCounts[item.reward.type] = (typeCounts[item.reward.type] || 0) + 1;

    const tier = item.rewardTier === 3 ? 3 : item.rewardTier === 2 ? 2 : 1;
    if (tier === 3) {
      acc.tier3All.count++;
      acc.tier3All.weight += w;
      if (!item.isFeatured) {
        acc.tier3Standard.count++;
        acc.tier3Standard.weight += w;
      }
    } else if (tier === 2) {
      acc.tier2All.count++;
      acc.tier2All.weight += w;
      if (!item.isFeatured) {
        acc.tier2Standard.count++;
        acc.tier2Standard.weight += w;
      }
    } else {
      acc.tier1All.count++;
      acc.tier1All.weight += w;
      if (!item.isFeatured) {
        acc.tier1Standard.count++;
        acc.tier1Standard.weight += w;
      }
    }

    if (item.isFeatured) {
      acc.featured.count++;
      acc.featured.weight += w;
      if (item.reward.type === 'Gems' || tier === 1) {
        lowTierFeaturedCount++;
      }
    }
  });

  const makeStats = (bucket: { count: number; weight: number }): PoolTierBucketStats => {
    const widthPct = totalWeight > 0 ? (bucket.weight / totalWeight) * 100 : 0;
    return {
      count: bucket.count,
      weight: bucket.weight,
      targetPctLabel: weightToRatePct(bucket.weight).toFixed(2),
      effectivePctLabel: widthPct.toFixed(2),
      widthPct,
    };
  };

  return {
    totalWeight,
    totalRatePctLabel: (totalWeight / 100).toFixed(2),
    deltaPct: (totalWeight - POOL_TOTAL_BASIS_POINTS) / 100,
    featured: makeStats(acc.featured),
    tier3All: makeStats(acc.tier3All),
    tier3Standard: makeStats(acc.tier3Standard),
    tier2All: makeStats(acc.tier2All),
    tier2Standard: makeStats(acc.tier2Standard),
    tier1All: makeStats(acc.tier1All),
    tier1Standard: makeStats(acc.tier1Standard),
    typeCounts,
    lowTierFeaturedCount,
  };
}

export type GroupRateTarget = 'FEATURED' | 'T3_STD' | 'T3_ALL' | 'T2' | 'T1';
export type GroupRateApplyMode = 'PER_ITEM' | 'GROUP_TOTAL_EQUAL' | 'GROUP_TOTAL_SCALE';

export function getGroupTargetIndices(
  items: GachaBannerItem[],
  target: GroupRateTarget,
): number[] {
  const indices: number[] = [];
  items.forEach((item, idx) => {
    if (target === 'FEATURED') {
      if (item.isFeatured) indices.push(idx);
    } else if (target === 'T3_ALL') {
      if (item.rewardTier === 3) indices.push(idx);
    } else if (target === 'T3_STD') {
      if (!item.isFeatured && item.rewardTier === 3) indices.push(idx);
    } else if (target === 'T2') {
      if (!item.isFeatured && item.rewardTier === 2) indices.push(idx);
    } else if (target === 'T1') {
      if (!item.isFeatured && item.rewardTier === 1) indices.push(idx);
    }
  });
  return indices;
}

export function applyGroupRateToPool(
  items: GachaBannerItem[],
  target: GroupRateTarget,
  mode: GroupRateApplyMode,
  inputPct: number,
  autoBalanceT1: boolean = false,
): { items: GachaBannerItem[]; ok: boolean; note: string } {
  const targetIndices = getGroupTargetIndices(items, target);
  if (targetIndices.length === 0) {
    return {
      items,
      ok: false,
      note: 'No entries exist in the selected group.',
    };
  }

  if (!Number.isFinite(inputPct) || inputPct < 0.01 || inputPct > 100) {
    return {
      items,
      ok: false,
      note: 'Enter a valid percentage between 0.01% and 100.00%.',
    };
  }

  const groupLabels: Record<GroupRateTarget, string> = {
    FEATURED: '★ Rate-Up',
    T3_STD: 'Tier 3 (T3)',
    T3_ALL: 'All Tier 3',
    T2: 'Tier 2 (T2)',
    T1: 'Tier 1 (T1)',
  };

  const count = targetIndices.length;
  let next = items.map((it) => ({ ...it, reward: { ...it.reward } }));
  let actionSummary = '';

  if (mode === 'PER_ITEM') {
    const perItemBp = ratePctToWeight(inputPct);
    const totalGroupPct = ((perItemBp * count) / 100).toFixed(2);
    if (perItemBp * count > POOL_TOTAL_BASIS_POINTS && autoBalanceT1) {
      return {
        items,
        ok: false,
        note: `${count} items × ${weightToRatePct(perItemBp).toFixed(2)}% = ${totalGroupPct}% exceeds 100.00%. Lower the per-item rate first.`,
      };
    }
    targetIndices.forEach((poolIdx) => {
      next[poolIdx].weight = perItemBp;
    });
    actionSummary = `Set all ${count} entries in ${groupLabels[target]} to ${weightToRatePct(perItemBp).toFixed(2)}% each (${totalGroupPct}% group total).`;
  } else {
    const totalTargetBp = ratePctToWeight(inputPct);
    if (totalTargetBp < count) {
      return {
        items,
        ok: false,
        note: `Group total for ${count} items must be at least ${(count * 0.01).toFixed(2)}% (0.01% min per item).`,
      };
    }

    const allocated =
      mode === 'GROUP_TOTAL_EQUAL'
        ? allocateBasisPoints(
            targetIndices.map(() => 1),
            totalTargetBp,
          )
        : allocateBasisPoints(
            targetIndices.map((poolIdx) => Math.max(1, Math.round(next[poolIdx].weight))),
            totalTargetBp,
          );

    targetIndices.forEach((poolIdx, i) => {
      next[poolIdx].weight = allocated[i];
    });

    actionSummary =
      mode === 'GROUP_TOTAL_EQUAL'
        ? `Split ${weightToRatePct(totalTargetBp).toFixed(2)}% evenly across ${count} entries in ${groupLabels[target]}.`
        : `Scaled ${groupLabels[target]} (${count} entries) to ${weightToRatePct(totalTargetBp).toFixed(2)}% total while keeping internal item ratios.`;
  }

  if (autoBalanceT1 && target !== 'T1') {
    const balanced = balanceFillersToTargetPool(next);
    if (balanced.ok) {
      next = balanced.items;
      actionSummary += ' Common fillers adjusted to keep pool total at 100.00%.';
    } else {
      actionSummary += ` (${balanced.error || 'Use Balance Fillers or Normalize All to reach 100.00%.'})`;
    }
  }

  return { items: next, ok: true, note: actionSummary };
}
