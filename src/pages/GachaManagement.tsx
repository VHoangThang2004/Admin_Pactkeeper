import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownUp,
  Calendar,
  Clock,
  Copy,
  Eye,
  Gem,
  Image as ImageIcon,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { Icon } from '@astryxdesign/core/Icon';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { recordAuditEvent } from '../services/adminSecurityService';
import type { GachaBanner, GachaBannerItem, GachaPullOption } from '../types';

interface ResolvedDefinition {
  name: string;
  kind: 'Hero' | 'Weapon';
}

type BannerFilterStatus = 'ALL' | 'LIVE' | 'UPCOMING' | 'EXPIRED' | 'INACTIVE';
type BannerSortOrder = 'LIVE_FIRST' | 'ENDING_SOON' | 'NEWEST_START' | 'COST_ASC';

const GACHA_SORT_OPTIONS: { value: BannerSortOrder; label: string }[] = [
  { value: 'LIVE_FIRST', label: 'Sort: Live & Active First' },
  { value: 'ENDING_SOON', label: 'Sort: Ending Soonest' },
  { value: 'NEWEST_START', label: 'Sort: Newest Start Date' },
  { value: 'COST_ASC', label: 'Sort: Pull Cost (Low–High)' },
];

interface RawUnitDef {
  id?: string;
  uId?: string | number;
  unitName?: string;
  name?: string;
}

interface RawWeaponDef {
  id?: string;
  weaponId?: string | number;
  name?: string;
}

interface RawBannerRecord {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  bannerImageUrl?: string;
  startDate?: string;
  expiryDate?: string;
  pityThreshold?: number;
  isActive?: boolean;
  items?: GachaBannerItem[];
  pullOptions?: GachaPullOption[];
}

const DEFAULT_PULL_COST = 160;
const DEFAULT_PITY_THRESHOLD = 90;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function toLocalDatetimeInput(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getBannerScheduleMeta(banner: GachaBanner, referenceTime: number) {
  const startMs = new Date(banner.startTime).getTime();
  const endMs = new Date(banner.endTime).getTime();
  const hasValidRange = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;

  let status: Exclude<BannerFilterStatus, 'ALL'> = 'LIVE';
  if (!banner.isActive) {
    status = 'INACTIVE';
  } else if (hasValidRange && referenceTime < startMs) {
    status = 'UPCOMING';
  } else if (hasValidRange && referenceTime > endMs) {
    status = 'EXPIRED';
  }

  let progressPct = 100;
  if (hasValidRange) {
    if (referenceTime <= startMs) progressPct = 0;
    else if (referenceTime >= endMs) progressPct = 100;
    else progressPct = Math.round(((referenceTime - startMs) / (endMs - startMs)) * 100);
  }

  let scheduleSummary = 'Schedule window active';
  if (status === 'INACTIVE') {
    scheduleSummary = 'Deactivated by Counsel';
  } else if (status === 'UPCOMING' && hasValidRange) {
    const hoursLeft = Math.max(1, Math.ceil((startMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary =
      hoursLeft >= 24 ? `Starts in ${Math.ceil(hoursLeft / 24)}d` : `Starts in ${hoursLeft}h`;
  } else if (status === 'EXPIRED') {
    scheduleSummary = 'Window ended';
  } else if (hasValidRange) {
    const hoursLeft = Math.max(1, Math.ceil((endMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary =
      hoursLeft >= 24 ? `${Math.ceil(hoursLeft / 24)}d remaining` : `${hoursLeft}h remaining`;
  }

  return { status, progressPct, scheduleSummary };
}

function buildDefinitionLookup(
  units: RawUnitDef[],
  weapons: RawWeaponDef[],
): Map<string, ResolvedDefinition> {
  const map = new Map<string, ResolvedDefinition>();

  units.forEach((u) => {
    const name = (u.unitName || u.name || '').trim();
    if (!name) return;
    if (u.id) map.set(String(u.id), { name, kind: 'Hero' });
    if (u.uId !== undefined && u.uId !== null) map.set(String(u.uId), { name, kind: 'Hero' });
  });

  weapons.forEach((w) => {
    const name = (w.name || '').trim();
    if (!name) return;
    if (w.id) map.set(String(w.id), { name, kind: 'Weapon' });
    if (w.weaponId !== undefined && w.weaponId !== null) {
      map.set(String(w.weaponId), { name, kind: 'Weapon' });
    }
  });

  return map;
}

async function loadGachaWorkspace() {
  const [bannerRes, unitRes, weaponRes] = await Promise.allSettled([
    adminClient.get('/gachabanner'),
    adminClient.get('/UnitDefinition'),
    adminClient.get('/WeaponDefinition'),
  ]);

  const units: RawUnitDef[] =
    unitRes.status === 'fulfilled' && Array.isArray(unitRes.value.data) ? unitRes.value.data : [];
  const weapons: RawWeaponDef[] =
    weaponRes.status === 'fulfilled' && Array.isArray(weaponRes.value.data)
      ? weaponRes.value.data
      : [];
  const lookup = buildDefinitionLookup(units, weapons);

  const rawBanners: RawBannerRecord[] =
    bannerRes.status === 'fulfilled' && Array.isArray(bannerRes.value.data)
      ? bannerRes.value.data
      : [];
  const mapped: GachaBanner[] = rawBanners.map((b) => {
    const items: GachaBannerItem[] = Array.isArray(b.items) ? b.items : [];
    const pullOptions: GachaPullOption[] = Array.isArray(b.pullOptions) ? b.pullOptions : [];
    const singleOption = pullOptions.find((opt) => Number(opt.pullType) === 1) || pullOptions[0];

    const featuredUnits: string[] = [];
    const featuredWeapons: string[] = [];

    items.forEach((item) => {
      if (!item?.isFeatured || !item.reward?.definitionId) return;
      const defId = String(item.reward.definitionId);
      const rewardType = String(item.reward.rewardType || '').toLowerCase();
      const resolved = lookup.get(defId);

      if (rewardType.includes('weapon') || resolved?.kind === 'Weapon') {
        featuredWeapons.push(defId);
      } else {
        featuredUnits.push(defId);
      }
    });

    return {
      id: String(b.id),
      title: b.name || b.title || 'Untitled Banner',
      description: b.description || '',
      bannerImageUrl: b.bannerImageUrl || '',
      startTime: b.startDate || new Date().toISOString(),
      endTime: b.expiryDate || new Date().toISOString(),
      costPerPull: singleOption?.price || DEFAULT_PULL_COST,
      pullOptions,
      pityThreshold:
        Number(b.pityThreshold) > 0 ? Number(b.pityThreshold) : DEFAULT_PITY_THRESHOLD,
      currencyType: 'Gems',
      featuredUnitIds: featuredUnits,
      featuredWeaponIds: featuredWeapons,
      items,
      isActive: b.isActive ?? true,
    };
  });

  return { banners: mapped, definitionLookup: lookup };
}

function getScheduleBadgeVariant(
  status: Exclude<BannerFilterStatus, 'ALL'>,
): BadgeVariant {
  if (status === 'LIVE') return 'success';
  if (status === 'UPCOMING') return 'info';
  if (status === 'EXPIRED') return 'warning';
  return 'neutral';
}

function getScheduleProgressVariant(
  status: Exclude<BannerFilterStatus, 'ALL'>,
): 'accent' | 'success' | 'warning' | 'neutral' {
  if (status === 'LIVE') return 'success';
  if (status === 'EXPIRED') return 'warning';
  if (status === 'INACTIVE') return 'neutral';
  return 'accent';
}

const DATETIME_INPUT_CLASS =
  'w-full rounded-[var(--radius-sm,8px)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input,var(--color-surface-card))] px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors';

/**
 * GachaManagement — Hero Summon Banners, Pool Audits, Rerun Cloning, and BR-06 Pity Rules.
 */
export const GachaManagement: React.FC = () => {
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [definitionLookup, setDefinitionLookup] = useState<Map<string, ResolvedDefinition>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Search, Status Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BannerFilterStatus>('ALL');
  const [sortBy, setSortBy] = useState<BannerSortOrder>('LIVE_FIRST');

  // Inline Banner Notification
  const [notice, setNotice] = useState<{ text: string; status: 'success' | 'error' } | null>(
    null,
  );

  // Banner Pool Detail Modal
  const [inspectingBanner, setInspectingBanner] = useState<GachaBanner | null>(null);

  // Banner creation modal state
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newStartDate, setNewStartDate] = useState(() => toLocalDatetimeInput(new Date()));
  const [newEndDate, setNewEndDate] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + FOURTEEN_DAYS_MS)),
  );
  const [newCost, setNewCost] = useState(DEFAULT_PULL_COST);
  const [enableTenPull, setEnableTenPull] = useState(false);
  const [newTenCost, setNewTenCost] = useState(DEFAULT_PULL_COST * 10);
  const [newPity, setNewPity] = useState(DEFAULT_PITY_THRESHOLD);
  const [clonedItems, setClonedItems] = useState<GachaBannerItem[]>([]);

  const showNotice = (text: string, status: 'success' | 'error' = 'success') => {
    setNotice({ text, status });
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const workspace = await loadGachaWorkspace();
      setBanners(workspace.banners);
      setDefinitionLookup(workspace.definitionLookup);
      setNowMs(Date.now());
    } catch {
      setBanners([]);
      showNotice('Unable to fetch gacha banners from backend.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadGachaWorkspace()
      .then((workspace) => {
        if (!active) return;
        setBanners(workspace.banners);
        setDefinitionLookup(workspace.definitionLookup);
        setNowMs(Date.now());
      })
      .catch(() => {
        if (active) setBanners([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveDefinitionLabel = (defId?: string, fallbackName?: string): string => {
    if (!defId) return fallbackName || 'Unknown Item';
    const resolved = definitionLookup.get(String(defId));
    if (resolved) return `${resolved.name} (${resolved.kind})`;
    if (fallbackName) return fallbackName;
    return `#${String(defId).slice(-6).toUpperCase()}`;
  };

  const openCreateModal = (template?: GachaBanner) => {
    setModalError(null);
    if (template) {
      const tenOpt = template.pullOptions?.find((o) => Number(o.pullType) === 10);
      setNewTitle(`${template.title} (Rerun)`);
      setNewDesc(template.description);
      setNewImageUrl(template.bannerImageUrl || '');
      setNewCost(template.costPerPull || DEFAULT_PULL_COST);
      setEnableTenPull(Boolean(tenOpt));
      setNewTenCost(tenOpt?.price || (template.costPerPull || DEFAULT_PULL_COST) * 10);
      setNewPity(template.pityThreshold || DEFAULT_PITY_THRESHOLD);
      setClonedItems(template.items || []);
    } else {
      setNewTitle('');
      setNewDesc('');
      setNewImageUrl('');
      setNewCost(DEFAULT_PULL_COST);
      setEnableTenPull(false);
      setNewTenCost(DEFAULT_PULL_COST * 10);
      setNewPity(DEFAULT_PITY_THRESHOLD);
      setClonedItems([]);
    }
    const now = new Date();
    setNewStartDate(toLocalDatetimeInput(now));
    setNewEndDate(toLocalDatetimeInput(new Date(now.getTime() + FOURTEEN_DAYS_MS)));
    setIsCreating(true);
  };

  const handleCreateBanner = async () => {
    if (!newTitle.trim()) {
      setModalError('Banner title is required.');
      return;
    }
    if (newCost <= 0) {
      setModalError('Single pull cost must be greater than 0 Gems.');
      return;
    }
    if (enableTenPull && newTenCost <= 0) {
      setModalError('10-Pull bundle cost must be greater than 0 Gems.');
      return;
    }
    if (newPity < 1) {
      setModalError('Hard pity threshold must be at least 1 pull.');
      return;
    }

    const startDateObj = new Date(newStartDate);
    const endDateObj = new Date(newEndDate);
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      setModalError('Valid start and expiry date/time values are required.');
      return;
    }
    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setModalError('Expiry date must be later than start date.');
      return;
    }

    setCreating(true);
    setModalError(null);
    try {
      const pullOptions: GachaPullOption[] = [{ pullType: 1, price: Number(newCost) }];
      if (enableTenPull) {
        pullOptions.push({ pullType: 10, price: Number(newTenCost) });
      }

      const payload: Record<string, unknown> = {
        name: newTitle.trim(),
        description: newDesc.trim(),
        items: clonedItems,
        pullOptions,
        startDate: startDateObj.toISOString(),
        expiryDate: endDateObj.toISOString(),
        pityThreshold: Number(newPity),
      };

      if (newImageUrl.trim()) {
        payload.bannerImageUrl = newImageUrl.trim();
      }

      await adminClient.post('/gachabanner', payload);
      void recordAuditEvent({
        action: 'GACHA_BANNER_CREATED',
        category: 'GACHA',
        severity: 'HIGH',
        targetType: 'GachaBanner',
        targetLabel: newTitle.trim(),
        afterState: {
          startDate: payload.startDate,
          expiryDate: payload.expiryDate,
          pityThreshold: payload.pityThreshold,
        },
      });
      await fetchBanners();
      setIsCreating(false);
      showNotice(`Created summon banner "${newTitle.trim()}".`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setModalError(msg || 'Failed to create banner on backend.');
    } finally {
      setCreating(false);
    }
  };

  const toggleBannerActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      const endpoint = currentActive
        ? `/gachabanner/${id}/deactivate`
        : `/gachabanner/${id}/activate`;
      await adminClient.patch(endpoint);
      void recordAuditEvent({
        action: currentActive ? 'GACHA_BANNER_DEACTIVATED' : 'GACHA_BANNER_ACTIVATED',
        category: 'GACHA',
        severity: 'HIGH',
        targetType: 'GachaBanner',
        targetId: id,
        beforeState: { isActive: currentActive },
        afterState: { isActive: !currentActive },
      });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentActive } : b)),
      );
      showNotice(`Banner ${!currentActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      showNotice(msg || 'Failed to toggle banner status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { ALL: banners.length, LIVE: 0, UPCOMING: 0, EXPIRED: 0, INACTIVE: 0 };
    banners.forEach((b) => {
      const { status } = getBannerScheduleMeta(b, nowMs);
      counts[status]++;
    });
    return counts;
  }, [banners, nowMs]);

  const filteredBanners = useMemo(() => {
    const filtered = banners.filter((banner) => {
      const { status } = getBannerScheduleMeta(banner, nowMs);
      if (statusFilter !== 'ALL' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = banner.title.toLowerCase().includes(q);
        const descMatch = banner.description.toLowerCase().includes(q);
        const idMatch = banner.id.toLowerCase().includes(q);
        const featuredMatch = [
          ...banner.featuredUnitIds,
          ...banner.featuredWeaponIds,
        ].some((defId) => {
          const resolved = definitionLookup.get(defId);
          return defId.toLowerCase().includes(q) || (resolved?.name || '').toLowerCase().includes(q);
        });
        if (!titleMatch && !descMatch && !idMatch && !featuredMatch) {
          return false;
        }
      }

      return true;
    });

    const statusRank = (b: GachaBanner) => {
      const { status } = getBannerScheduleMeta(b, nowMs);
      if (status === 'LIVE') return 0;
      if (status === 'UPCOMING') return 1;
      if (status === 'EXPIRED') return 2;
      return 3;
    };

    return [...filtered].sort((a, b) => {
      if (sortBy === 'ENDING_SOON') {
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      }
      if (sortBy === 'NEWEST_START') {
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      }
      if (sortBy === 'COST_ASC') {
        return (a.costPerPull || 0) - (b.costPerPull || 0);
      }
      return (
        statusRank(a) - statusRank(b) ||
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    });
  }, [banners, statusFilter, searchQuery, sortBy, nowMs, definitionLookup]);

  return (
    <ConsolePage
      badge="GACHA RECRUITMENT • BR-06"
      badgeVariant="purple"
      icon={<Icon icon={Sparkles} size="lg" color="accent" />}
      meta={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <StatusDot
            variant="success"
            label="Active live summon pools"
            isPulsing={statusCounts.LIVE > 0}
          />
          <Badge label={`${statusCounts.LIVE} Live`} variant="success" />
          <Badge label={`${statusCounts.UPCOMING} Upcoming`} variant="info" />
          <Badge label={`${statusCounts.EXPIRED} Expired`} variant="warning" />
          <Badge label={`${statusCounts.INACTIVE} Inactive`} variant="neutral" />
          <Text type="code" size="xsm" color="secondary">
            90-Pull Hard Pity Rules • {banners.length} Total Pools
          </Text>
        </HStack>
      }
      title="SUMMON BANNERS & WISH ROTATIONS"
      subtitle="Configure hero invocations, summon windows, pull pricing, pity thresholds, and inspect rate-up pools from MongoDB."
      actions={
        <HStack gap={2} vAlign="center">
          <Button
            label="Sync Banners"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            isLoading={loading}
            onClick={() => void fetchBanners()}
          />
          <Button
            label="New Banner"
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => openCreateModal()}
          />
        </HStack>
      }
      banner={
        notice ? (
          <Banner
            status={notice.status}
            title={notice.status === 'error' ? 'Gacha Operation Error' : 'Gacha Registry Updated'}
            description={notice.text}
            isDismissable
            onDismiss={() => setNotice(null)}
          />
        ) : undefined
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <SegmentedControl
            label="Filter banners by status"
            size="sm"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as BannerFilterStatus)}
          >
            <SegmentedControlItem value="ALL" label={`All (${statusCounts.ALL})`} />
            <SegmentedControlItem value="LIVE" label={`Live (${statusCounts.LIVE})`} />
            <SegmentedControlItem value="UPCOMING" label={`Upcoming (${statusCounts.UPCOMING})`} />
            <SegmentedControlItem value="EXPIRED" label={`Expired (${statusCounts.EXPIRED})`} />
            <SegmentedControlItem value="INACTIVE" label={`Inactive (${statusCounts.INACTIVE})`} />
          </SegmentedControl>

          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="w-[215px]">
              <Selector
                label="Sort banners"
                isLabelHidden
                size="sm"
                startIcon={ArrowDownUp}
                options={GACHA_SORT_OPTIONS}
                value={sortBy}
                onChange={(val) => {
                  if (val) setSortBy(val as BannerSortOrder);
                }}
              />
            </div>

            <div className="min-w-[220px] flex-1 max-w-xs">
              <TextInput
                label="Search banners"
                isLabelHidden
                size="sm"
                placeholder="Search banner title, hero, or ID..."
                value={searchQuery}
                onChange={setSearchQuery}
                hasClear
                startIcon={<Search size={14} />}
              />
            </div>
          </div>
        </div>
      }
    >
      {/* Banners Grid */}
      {filteredBanners.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            icon={<Inbox size={28} />}
            title={
              banners.length === 0
                ? 'No Gacha Summon Banners Active'
                : 'No Summon Banners Match Filter'
            }
            description={
              banners.length === 0
                ? 'Create a new limited or standard summoning pool to let travelers pull for heroes and weapons.'
                : 'Adjust the status filter or clear your search query to inspect other banner rotations.'
            }
            actions={
              banners.length === 0 ? (
                <Button
                  label="Create First Banner"
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => openCreateModal()}
                />
              ) : (
                <Button
                  label="Reset Filters"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                />
              )
            }
          />
        </Card>
      ) : (
        <Grid columns={{ minWidth: 340, max: 2 }} gap={4}>
          {filteredBanners.map((banner) => {
            const schedule = getBannerScheduleMeta(banner, nowMs);
            const featuredIds = [...banner.featuredUnitIds, ...banner.featuredWeaponIds];
            const tenPullOption = banner.pullOptions?.find((opt) => Number(opt.pullType) === 10);
            const hasValidImg = Boolean(banner.bannerImageUrl) && !failedImages[banner.id];

            const badgeLabel =
              schedule.status === 'LIVE'
                ? 'ACTIVE INVOCATION'
                : schedule.status === 'UPCOMING'
                  ? 'SCHEDULED UPCOMING'
                  : schedule.status === 'EXPIRED'
                    ? 'WINDOW EXPIRED'
                    : 'INACTIVE';

            return (
              <Card key={banner.id} padding={0} className="overflow-hidden flex flex-col">
                {/* Compact Banner Artwork Scrim Area */}
                <div className="h-28 relative bg-slate-950 overflow-hidden border-b border-[var(--color-border-subtle)]">
                  {hasValidImg ? (
                    <img
                      src={banner.bannerImageUrl}
                      alt={banner.title}
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [banner.id]: true }))
                      }
                      className="w-full h-full object-cover opacity-80 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-end pr-6 bg-gradient-to-br from-slate-950 via-[#0c1222] to-indigo-950 text-amber-400/25">
                      <Star className="w-12 h-12" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#070a14]/95 via-[#070a14]/45 to-transparent"
                    aria-hidden="true"
                  />

                  <div className="absolute top-2.5 right-3">
                    <Badge
                      label={badgeLabel}
                      variant={getScheduleBadgeVariant(schedule.status)}
                    />
                  </div>

                  <div className="absolute bottom-2.5 left-4 right-4 text-white">
                    <HStack gap={1.5} vAlign="center" className="text-amber-300 mb-0.5">
                      <Sparkles size={12} />
                      <Text type="code" size="xsm" weight="bold" color="inherit">
                        {banner.items && banner.items.length > 0
                          ? `${banner.items.length} POOL ENTRIES`
                          : 'LIMITED EVENT WARP'}
                      </Text>
                    </HStack>
                    <Heading level={3} maxLines={1} color="inherit" className="font-cinzel text-white">
                      {banner.title}
                    </Heading>
                  </div>
                </div>

                {/* Compact Banner Details Body */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <VStack gap={2}>
                    <Text type="supporting" size="sm" maxLines={1}>
                      {banner.description ||
                        'No promotional description provided for this banner rotation.'}
                    </Text>

                    {/* 3-Column Metrics Strip */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[var(--radius-md,10px)] bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]">
                      <HStack gap={1.5} vAlign="center">
                        <Icon icon={Gem} size="sm" color="info" />
                        <VStack gap={0}>
                          <Text type="label" size="2xs" color="secondary">
                            PULL COST
                          </Text>
                          <Text weight="bold" size="sm" hasTabularNumbers>
                            {banner.costPerPull}
                            {tenPullOption ? ` / ${tenPullOption.price}` : ' Gems'}
                          </Text>
                        </VStack>
                      </HStack>

                      <HStack gap={1.5} vAlign="center">
                        <Icon icon={Star} size="sm" color="accent" />
                        <VStack gap={0}>
                          <Text type="label" size="2xs" color="secondary">
                            FEATURED
                          </Text>
                          <Text weight="bold" size="sm" hasTabularNumbers>
                            {featuredIds.length} Rate-Up
                          </Text>
                        </VStack>
                      </HStack>

                      <HStack gap={1.5} vAlign="center">
                        <Icon icon={Clock} size="sm" color="secondary" />
                        <VStack gap={0}>
                          <Text type="label" size="2xs" color="secondary">
                            HARD PITY
                          </Text>
                          <Text weight="bold" size="sm" hasTabularNumbers>
                            {banner.pityThreshold ?? 90} Pulls
                          </Text>
                        </VStack>
                      </HStack>
                    </div>

                    {/* Featured Roster Pills */}
                    {featuredIds.length > 0 && (
                      <HStack gap={1.5} wrap="wrap">
                        {featuredIds.slice(0, 4).map((defId) => (
                          <Badge
                            key={defId}
                            label={`★ ${resolveDefinitionLabel(defId)}`}
                            variant="yellow"
                          />
                        ))}
                        {featuredIds.length > 4 && (
                          <Badge label={`+${featuredIds.length - 4} more`} variant="neutral" />
                        )}
                      </HStack>
                    )}

                    {/* Schedule & Progress Timeline */}
                    <VStack gap={1}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <HStack gap={1.5} vAlign="center">
                          <Icon icon={Calendar} size="xsm" color="accent" />
                          <Text type="code" size="xsm" color="secondary">
                            {new Date(banner.startTime).toLocaleDateString()} –{' '}
                            {new Date(banner.endTime).toLocaleDateString()}
                          </Text>
                        </HStack>
                        <Text type="code" size="xsm" weight="semibold">
                          {schedule.scheduleSummary}
                        </Text>
                      </HStack>
                      <ProgressBar
                        label={`Banner progress for ${banner.title}`}
                        isLabelHidden
                        value={schedule.progressPct}
                        max={100}
                        variant={getScheduleProgressVariant(schedule.status)}
                      />
                    </VStack>
                  </VStack>

                  {/* Footer Actions */}
                  <div className="pt-2.5 border-t border-[var(--color-border-subtle)]">
                    <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                      <Text type="code" size="xsm" color="secondary">
                        Ref: #{banner.id.slice(-6).toUpperCase()}
                      </Text>

                      <HStack gap={2} vAlign="center">
                        <Button
                          label="Pool"
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={14} />}
                          onClick={() => setInspectingBanner(banner)}
                        />
                        <Button
                          label="Rerun"
                          variant="secondary"
                          size="sm"
                          icon={<Copy size={14} />}
                          onClick={() => openCreateModal(banner)}
                        />
                        <Button
                          label={banner.isActive ? 'Deactivate' : 'Activate'}
                          variant={banner.isActive ? 'destructive' : 'primary'}
                          size="sm"
                          isLoading={togglingId === banner.id}
                          onClick={() =>
                            void toggleBannerActive(banner.id, Boolean(banner.isActive))
                          }
                        />
                      </HStack>
                    </HStack>
                  </div>
                </div>
              </Card>
            );
          })}
        </Grid>
      )}

      {/* Modal: Inspect Banner Pool & Metadata */}
      <Dialog
        isOpen={Boolean(inspectingBanner)}
        onOpenChange={(open) => {
          if (!open) setInspectingBanner(null);
        }}
        purpose="info"
        width={680}
        maxHeight="88vh"
      >
        {inspectingBanner && (
          <VStack gap={4}>
            <DialogHeader
              title={inspectingBanner.title}
              subtitle="Banner pool entries, pull bundle tiers, and schedule audit."
              endContent={
                <Badge
                  label={getBannerScheduleMeta(inspectingBanner, nowMs).status}
                  variant={getScheduleBadgeVariant(
                    getBannerScheduleMeta(inspectingBanner, nowMs).status,
                  )}
                />
              }
              onOpenChange={() => setInspectingBanner(null)}
            />

            <Grid columns={{ minWidth: 140, max: 4 }} gap={3}>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Status
                  </Text>
                  <Text weight="bold" size="sm">
                    {getBannerScheduleMeta(inspectingBanner, nowMs).status}
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Hard Pity
                  </Text>
                  <Text weight="bold" size="sm" hasTabularNumbers>
                    {inspectingBanner.pityThreshold ?? 90} Pulls
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Start Date
                  </Text>
                  <Text type="code" size="xsm">
                    {new Date(inspectingBanner.startTime).toLocaleDateString()}
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Expiry Date
                  </Text>
                  <Text type="code" size="xsm">
                    {new Date(inspectingBanner.endTime).toLocaleDateString()}
                  </Text>
                </VStack>
              </Card>
            </Grid>

            <Card padding={3} variant="muted">
              <VStack gap={2}>
                <Text type="label" size="sm" weight="semibold">
                  Configured Pull Options
                </Text>
                <HStack gap={2} wrap="wrap">
                  {(inspectingBanner.pullOptions && inspectingBanner.pullOptions.length > 0
                    ? inspectingBanner.pullOptions
                    : [{ pullType: 1, price: inspectingBanner.costPerPull }]
                  ).map((opt, i) => (
                    <Badge
                      key={`${opt.pullType}-${i}`}
                      label={`${opt.pullType}x Pull: ${opt.price} Gems`}
                      variant="cyan"
                    />
                  ))}
                </HStack>
              </VStack>
            </Card>

            <Card padding={3} variant="muted">
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
                  <Text type="label" size="sm" weight="semibold">
                    Banner Reward Pool ({inspectingBanner.items?.length || 0} Entries)
                  </Text>
                  <Text type="code" size="xsm" color="secondary">
                    ID: {inspectingBanner.id}
                  </Text>
                </HStack>

                {!inspectingBanner.items || inspectingBanner.items.length === 0 ? (
                  <Text type="supporting" size="sm">
                    No explicit pool items attached to this banner record in MongoDB.
                  </Text>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
                    {inspectingBanner.items.map((item, idx) => {
                      const defId = item.reward?.definitionId;
                      return (
                        <div
                          key={`${defId || 'item'}-${idx}`}
                          className="py-2 flex items-center justify-between gap-2"
                        >
                          <HStack gap={2} vAlign="center" className="min-w-0">
                            <Badge
                              label={item.isFeatured ? 'RATE-UP' : 'POOL'}
                              variant={item.isFeatured ? 'warning' : 'neutral'}
                            />
                            <Text size="sm" weight="medium" maxLines={1}>
                              {resolveDefinitionLabel(defId, item.reward?.name)}
                            </Text>
                          </HStack>
                          <HStack gap={2} vAlign="center">
                            {item.rarity && (
                              <Text type="code" size="xsm" color="secondary">
                                {item.rarity}
                              </Text>
                            )}
                            {item.dropRate !== undefined && (
                              <Text type="code" size="xsm" weight="semibold">
                                {item.dropRate}%
                              </Text>
                            )}
                            {item.weight !== undefined && (
                              <Text type="code" size="xsm" color="secondary">
                                Weight: {item.weight}
                              </Text>
                            )}
                          </HStack>
                        </div>
                      );
                    })}
                  </div>
                )}
              </VStack>
            </Card>

            <HStack justify="end" gap={2}>
              <StackItem size="static">
                <Button
                  label="Duplicate as Rerun"
                  variant="secondary"
                  size="md"
                  icon={<Copy size={14} />}
                  onClick={() => {
                    const banner = inspectingBanner;
                    setInspectingBanner(null);
                    openCreateModal(banner);
                  }}
                />
              </StackItem>
              <StackItem size="static">
                <Button
                  label="Close"
                  variant="primary"
                  size="md"
                  onClick={() => setInspectingBanner(null)}
                />
              </StackItem>
            </HStack>
          </VStack>
        )}
      </Dialog>

      {/* Modal: Create Summon Banner */}
      <Dialog
        isOpen={isCreating}
        onOpenChange={(open) => {
          if (!creating) setIsCreating(open);
        }}
        purpose="form"
        width={560}
        maxHeight="90vh"
      >
        <VStack gap={4}>
          <DialogHeader
            title="Create Summon Banner"
            subtitle="Configure banner schedule, pricing, and hard pity parameters (BR-06)."
            startContent={<Icon icon={Sparkles} size="md" color="accent" />}
            onOpenChange={(open) => {
              if (!creating) setIsCreating(open);
            }}
          />

          {modalError && <Banner status="error" title="Validation Error" description={modalError} />}

          {clonedItems.length > 0 && (
            <Banner
              status="info"
              title="Template Pool Loaded"
              description={`Carrying over ${clonedItems.length} pool entries from the duplicated banner.`}
              endContent={
                <Button
                  label="Clear Pool"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClonedItems([])}
                />
              }
            />
          )}

          <VStack gap={3}>
            <TextInput
              label="Banner Title"
              isRequired
              placeholder="e.g. Celestial Oath: Blade of Judgment"
              value={newTitle}
              onChange={setNewTitle}
            />

            <TextArea
              label="Description / Rate-Up Details"
              placeholder="Describe rate-up details, featured heroes, and mechanics..."
              value={newDesc}
              onChange={setNewDesc}
              rows={2}
            />

            <TextInput
              label="Banner Artwork URL"
              isOptional
              type="url"
              placeholder="https://..."
              value={newImageUrl}
              onChange={setNewImageUrl}
              startIcon={<ImageIcon size={14} />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <Text type="label" size="xsm" weight="medium">
                  Start Date &amp; Time *
                </Text>
                <input
                  type="datetime-local"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className={DATETIME_INPUT_CLASS}
                />
              </label>

              <label className="block space-y-1">
                <Text type="label" size="xsm" weight="medium">
                  Expiry Date &amp; Time *
                </Text>
                <input
                  type="datetime-local"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className={DATETIME_INPUT_CLASS}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput
                label="Cost Per Pull (Gems)"
                value={newCost}
                onChange={setNewCost}
                min={1}
                isIntegerOnly
                hasNumberSteppers
                isWheelEnabled={false}
                units="Gems"
              />
              <NumberInput
                label="Hard Pity Threshold (Pulls)"
                value={newPity}
                onChange={setNewPity}
                min={1}
                isIntegerOnly
                hasNumberSteppers
                isWheelEnabled={false}
                units="Pulls"
              />
            </div>

            <Card padding={3} variant="muted">
              <VStack gap={3}>
                <CheckboxInput
                  label="Include 10x Multi-Pull Option"
                  description="Adds a discounted or bundled 10-invocation pull tier to pullOptions."
                  value={enableTenPull}
                  onChange={(checked) => setEnableTenPull(checked)}
                />
                {enableTenPull && (
                  <NumberInput
                    label="10-Pull Bundle Price (Gems)"
                    value={newTenCost}
                    onChange={setNewTenCost}
                    min={1}
                    isIntegerOnly
                    hasNumberSteppers
                    isWheelEnabled={false}
                    units="Gems"
                  />
                )}
              </VStack>
            </Card>
          </VStack>

          <HStack justify="end" gap={2}>
            <StackItem size="static">
              <Button
                label="Cancel"
                variant="secondary"
                size="md"
                isDisabled={creating}
                onClick={() => setIsCreating(false)}
              />
            </StackItem>
            <StackItem size="static">
              <Button
                label="Create Banner"
                variant="primary"
                size="md"
                isLoading={creating}
                onClick={() => void handleCreateBanner()}
              />
            </StackItem>
          </HStack>
        </VStack>
      </Dialog>
    </ConsolePage>
  );
};
