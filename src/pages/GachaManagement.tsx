import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  BarChart3,
  Calendar,
  Clock,
  Copy,
  Edit2,
  Eye,
  Gem,
  Image as ImageIcon,
  Inbox,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
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
import { IconButton } from '@astryxdesign/core/IconButton';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { GachaPoolEditor } from '../components/GachaPoolEditor';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  analyzePoolItems,
  normalizePoolItemsToBasisPoints,
  summarizePoolByTier,
} from '../utils/gachaPoolValidation';
import type {
  ClassDefinition,
  GachaBanner,
  GachaBannerItem,
  GachaBannerStats,
  GachaPullOption,
  GachaPullType,
  GachaRewardType,
  TrinketDefinition,
  UnitDefinition,
  WeaponDefinition,
} from '../types';

type BannerFilterStatus = 'ALL' | 'LIVE' | 'UPCOMING' | 'EXPIRED' | 'INACTIVE';
type BannerSortOrder = 'LIVE_FIRST' | 'ENDING_SOON' | 'NEWEST_START' | 'COST_ASC';
type DialogMode = 'create' | 'edit' | 'rerun' | null;
type ModalTab = 'general' | 'pool';

interface DefinitionCatalogs {
  units: UnitDefinition[];
  weapons: WeaponDefinition[];
  trinkets: TrinketDefinition[];
  classes: ClassDefinition[];
  unitNamesByUid: Map<number, string>;
  weaponNamesById: Map<number, string>;
  trinketNamesById: Map<number, string>;
  classNamesById: Map<number, string>;
}

interface RawBannerItem {
  reward?: {
    type?: unknown;
    rewardType?: unknown;
    definitionId?: unknown;
    classId?: unknown;
    amount?: unknown;
  };
  weight?: unknown;
  isFeatured?: unknown;
  rewardTier?: unknown;
}

interface RawPullOption {
  pullType?: unknown;
  price?: unknown;
}

interface RawBannerRecord {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  bannerImageUrl?: string | null;
  startDate?: string | null;
  expiryDate?: string | null;
  pityThreshold?: number | null;
  isActive?: boolean;
  createdAt?: string;
  items?: RawBannerItem[];
  pullOptions?: RawPullOption[];
}

interface PendingSensitiveBannerOp {
  title: string;
  description: string;
  targetLabel: string;
  targetSummary: string;
  severity: 'HIGH' | 'CRITICAL';
  actionLabel: string;
  requireKeyword?: string;
  execute: (rationale: string) => Promise<void>;
}

const GACHA_SORT_OPTIONS: { value: BannerSortOrder; label: string }[] = [
  { value: 'LIVE_FIRST', label: 'Sort: Live & Active First' },
  { value: 'ENDING_SOON', label: 'Sort: Ending Soonest' },
  { value: 'NEWEST_START', label: 'Sort: Newest Start Date' },
  { value: 'COST_ASC', label: 'Sort: Pull Cost (Low–High)' },
];

const DEFAULT_SINGLE_COST = 160;
const DEFAULT_FIVE_COST = 780;
const DEFAULT_TEN_COST = 1500;
const DEFAULT_PITY_THRESHOLD = 90;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function toLocalDatetimeInput(dateInput: Date | string | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatScheduleDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

interface BannerDraftSnapshotInput {
  title: string;
  desc: string;
  imageUrl: string;
  permanent: boolean;
  startDate: string;
  endDate: string;
  enableSingle: boolean;
  singleCost: number;
  enableFive: boolean;
  fiveCost: number;
  enableTen: boolean;
  tenCost: number;
  enablePity: boolean;
  pity: number;
  items: GachaBannerItem[];
}

function serializeBannerDraft(draft: BannerDraftSnapshotInput): string {
  return JSON.stringify({
    title: draft.title.trim(),
    desc: draft.desc.trim(),
    imageUrl: draft.imageUrl.trim(),
    permanent: draft.permanent,
    startDate: draft.permanent ? '' : draft.startDate,
    endDate: draft.permanent ? '' : draft.endDate,
    enableSingle: draft.enableSingle,
    singleCost: Number(draft.singleCost) || 0,
    enableFive: draft.enableFive,
    fiveCost: Number(draft.fiveCost) || 0,
    enableTen: draft.enableTen,
    tenCost: Number(draft.tenCost) || 0,
    enablePity: draft.enablePity,
    pity: Number(draft.pity) || 0,
    items: draft.items.map((it) => ({
      type: it.reward.type,
      defId: Number(it.reward.definitionId) || 0,
      classId: Number(it.reward.classId) || 0,
      amount: Number(it.reward.amount) || 1,
      weight: Number(it.weight) || 0,
      isFeatured: Boolean(it.isFeatured),
      rewardTier: it.rewardTier,
    })),
  });
}

function normalizePullType(raw: unknown): GachaPullType {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'ten' || lower === '10' || lower === '2') return 'Ten';
    if (lower === 'five' || lower === '5') return 'Five';
    return 'Single';
  }
  const num = Number(raw);
  if (num === 10 || num === 2) return 'Ten';
  if (num === 5 || num === 1) return 'Five';
  return 'Single';
}

function normalizeRewardType(raw: unknown): GachaRewardType {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'unit' || lower === 'hero') return 'Unit';
    if (lower === 'weapon') return 'Weapon';
    if (lower === 'trinket') return 'Trinket';
    if (lower === 'gems' || lower === 'gem') return 'Gems';
  }
  const num = Number(raw);
  if (num === 1) return 'Weapon';
  if (num === 2) return 'Trinket';
  if (num === 3) return 'Gems';
  return 'Unit';
}

function mapRawBannerItems(rawItems: RawBannerItem[] | undefined): GachaBannerItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => {
    const rawReward = item?.reward || {};
    const type = normalizeRewardType(rawReward.type ?? rawReward.rewardType);
    const tierNum = Number(item?.rewardTier);
    const rewardTier: 1 | 2 | 3 =
      tierNum === 3 ? 3 : tierNum === 2 ? 2 : 1;

    return {
      reward: {
        type,
        definitionId: Number(rawReward.definitionId ?? 0) || 0,
        classId: Number(rawReward.classId ?? 0) || 0,
        amount: Math.max(1, Number(rawReward.amount ?? 1) || 1),
      },
      weight: Math.max(1, Number(item?.weight ?? 1) || 1),
      isFeatured: Boolean(item?.isFeatured),
      rewardTier,
    };
  });
}

function mapRawPullOptions(rawOptions: RawPullOption[] | undefined): GachaPullOption[] {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    return [{ pullType: 'Single', price: DEFAULT_SINGLE_COST }];
  }

  const seen = new Set<GachaPullType>();
  const result: GachaPullOption[] = [];
  rawOptions.forEach((opt) => {
    const pullType = normalizePullType(opt?.pullType);
    if (seen.has(pullType)) return;
    seen.add(pullType);
    result.push({
      pullType,
      price: Math.max(1, Number(opt?.price ?? DEFAULT_SINGLE_COST) || DEFAULT_SINGLE_COST),
    });
  });

  return result.length > 0 ? result : [{ pullType: 'Single', price: DEFAULT_SINGLE_COST }];
}

function getBannerScheduleMeta(banner: GachaBanner, referenceTime: number) {
  if (banner.isPermanent || (!banner.startTime && !banner.endTime)) {
    const status: Exclude<BannerFilterStatus, 'ALL'> = banner.isActive ? 'LIVE' : 'INACTIVE';
    return {
      status,
      progressPct: banner.isActive ? 100 : 0,
      scheduleSummary: banner.isActive ? 'Permanent Pool • No Expiry' : 'Deactivated by Counsel',
    };
  }

  const startMs = banner.startTime ? new Date(banner.startTime).getTime() : Number.NaN;
  const endMs = banner.endTime ? new Date(banner.endTime).getTime() : Number.NaN;
  const hasStart = !Number.isNaN(startMs);
  const hasEnd = !Number.isNaN(endMs);
  const hasValidRange = hasStart && hasEnd && endMs > startMs;

  let status: Exclude<BannerFilterStatus, 'ALL'> = 'LIVE';
  if (!banner.isActive) {
    status = 'INACTIVE';
  } else if (hasStart && referenceTime < startMs) {
    status = 'UPCOMING';
  } else if (hasEnd && referenceTime > endMs) {
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
  } else if (status === 'UPCOMING' && hasStart) {
    const hoursLeft = Math.max(1, Math.ceil((startMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary =
      hoursLeft >= 24 ? `Starts in ${Math.ceil(hoursLeft / 24)}d` : `Starts in ${hoursLeft}h`;
  } else if (status === 'EXPIRED') {
    scheduleSummary = 'Window ended';
  } else if (hasEnd) {
    const hoursLeft = Math.max(1, Math.ceil((endMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary =
      hoursLeft >= 24 ? `${Math.ceil(hoursLeft / 24)}d remaining` : `${hoursLeft}h remaining`;
  }

  return { status, progressPct, scheduleSummary };
}

function resolveItemLabel(
  item: GachaBannerItem,
  catalogs: DefinitionCatalogs,
): string {
  const { type, definitionId, classId, amount } = item.reward;
  if (type === 'Gems') {
    return `${amount.toLocaleString()} Gems`;
  }
  if (type === 'Unit') {
    const name = catalogs.unitNamesByUid.get(definitionId) || `Unit #${definitionId}`;
    const cls = classId > 0 ? catalogs.classNamesById.get(classId) : undefined;
    return cls ? `${name} (${cls})` : `${name} (Hero)`;
  }
  if (type === 'Weapon') {
    const name = catalogs.weaponNamesById.get(definitionId) || `Weapon #${definitionId}`;
    return `${name} (Weapon)`;
  }
  const name = catalogs.trinketNamesById.get(definitionId) || `Trinket #${definitionId}`;
  return `${name} (Trinket)`;
}

function resolveShortItemName(
  item: GachaBannerItem,
  catalogs: DefinitionCatalogs,
): string {
  const { type, definitionId, amount } = item.reward;
  if (type === 'Gems') return `${amount.toLocaleString()} Gems`;
  if (type === 'Unit') return catalogs.unitNamesByUid.get(definitionId) || `Unit #${definitionId}`;
  if (type === 'Weapon') return catalogs.weaponNamesById.get(definitionId) || `Weapon #${definitionId}`;
  return catalogs.trinketNamesById.get(definitionId) || `Trinket #${definitionId}`;
}

function formatPullTypeBadge(option: GachaPullOption): string {
  const mult = option.pullType === 'Ten' ? '10x' : option.pullType === 'Five' ? '5x' : '1x';
  return `${mult}: ${option.price.toLocaleString()} Gems`;
}

function extractApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

async function loadGachaWorkspace(): Promise<{
  banners: GachaBanner[];
  catalogs: DefinitionCatalogs;
  failedSources: string[];
}> {
  const [bannerRes, unitRes, weaponRes, trinketRes, classRes] = await Promise.allSettled([
    adminClient.get('/gachabanner'),
    adminClient.get('/UnitDefinition'),
    adminClient.get('/WeaponDefinition'),
    adminClient.get('/TrinketDefinition'),
    adminClient.get('/ClassDefinition'),
  ]);

  const failedSources: string[] = [];
  if (bannerRes.status === 'rejected') failedSources.push('gacha banners');
  if (unitRes.status === 'rejected') failedSources.push('units');
  if (weaponRes.status === 'rejected') failedSources.push('weapons');
  if (trinketRes.status === 'rejected') failedSources.push('trinkets');
  if (classRes.status === 'rejected') failedSources.push('classes');

  const units: UnitDefinition[] =
    unitRes.status === 'fulfilled' && Array.isArray(unitRes.value.data) ? unitRes.value.data : [];
  const weapons: WeaponDefinition[] =
    weaponRes.status === 'fulfilled' && Array.isArray(weaponRes.value.data)
      ? weaponRes.value.data
      : [];
  const trinkets: TrinketDefinition[] =
    trinketRes.status === 'fulfilled' && Array.isArray(trinketRes.value.data)
      ? trinketRes.value.data
      : [];
  const classes: ClassDefinition[] =
    classRes.status === 'fulfilled' && Array.isArray(classRes.value.data)
      ? classRes.value.data
      : [];

  const unitNamesByUid = new Map<number, string>();
  units.forEach((u) => {
    const uid = Number(u.uId ?? 0);
    const label = (u.unitName || u.name || '').trim();
    if (uid > 0 && label) unitNamesByUid.set(uid, label);
  });

  const weaponNamesById = new Map<number, string>();
  weapons.forEach((w) => {
    const wid = Number(w.weaponId ?? 0);
    const label = (w.name || '').trim();
    if (wid > 0 && label) weaponNamesById.set(wid, label);
  });

  const trinketNamesById = new Map<number, string>();
  trinkets.forEach((t) => {
    const tid = Number(t.trinketId ?? 0);
    const label = (t.name || '').trim();
    if (tid > 0 && label) trinketNamesById.set(tid, label);
  });

  const classNamesById = new Map<number, string>();
  classes.forEach((c) => {
    const cid = Number(c.classId ?? 0);
    const label = (c.name || c.className || '').trim();
    if (cid > 0 && label) classNamesById.set(cid, label);
  });

  const catalogs: DefinitionCatalogs = {
    units,
    weapons,
    trinkets,
    classes,
    unitNamesByUid,
    weaponNamesById,
    trinketNamesById,
    classNamesById,
  };

  const rawBanners: RawBannerRecord[] =
    bannerRes.status === 'fulfilled' && Array.isArray(bannerRes.value.data)
      ? bannerRes.value.data
      : [];

  const mapped: GachaBanner[] = rawBanners.map((b) => {
    const items = mapRawBannerItems(b.items);
    const pullOptions = mapRawPullOptions(b.pullOptions);
    const singleOption =
      pullOptions.find((opt) => opt.pullType === 'Single') || pullOptions[0];

    const featuredUnits: number[] = [];
    const featuredWeapons: number[] = [];
    items.forEach((item) => {
      if (!item.isFeatured || item.reward.definitionId <= 0) return;
      if (item.reward.type === 'Unit') featuredUnits.push(item.reward.definitionId);
      else if (item.reward.type === 'Weapon') featuredWeapons.push(item.reward.definitionId);
    });

    const startTime = b.startDate ?? null;
    const endTime = b.expiryDate ?? null;
    const isPermanent = startTime === null && endTime === null;

    return {
      id: String(b.id || ''),
      title: b.name || b.title || 'Untitled Banner',
      description: b.description || '',
      bannerImageUrl: b.bannerImageUrl || undefined,
      startTime,
      endTime,
      isPermanent,
      costPerPull: singleOption?.price || DEFAULT_SINGLE_COST,
      pullOptions,
      pityThreshold:
        typeof b.pityThreshold === 'number' && b.pityThreshold > 0 ? b.pityThreshold : null,
      currencyType: 'Gems',
      featuredUnitIds: featuredUnits,
      featuredWeaponIds: featuredWeapons,
      items,
      isActive: Boolean(b.isActive),
      createdAt: b.createdAt,
    };
  });

  return { banners: mapped, catalogs, failedSources };
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

const EMPTY_CATALOGS: DefinitionCatalogs = {
  units: [],
  weapons: [],
  trinkets: [],
  classes: [],
  unitNamesByUid: new Map(),
  weaponNamesById: new Map(),
  trinketNamesById: new Map(),
  classNamesById: new Map(),
};

const DATETIME_INPUT_CLASS =
  'w-full rounded-[var(--radius-sm,8px)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input,var(--color-surface-card))] px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors';

/**
 * GachaManagement — Hero Summon Banners, Interactive Pool Builder, Full CRUD, Pity Rules & Pull Stats.
 */
export const GachaManagement: React.FC = () => {
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [catalogs, setCatalogs] = useState<DefinitionCatalogs>(EMPTY_CATALOGS);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [catalogFailedSources, setCatalogFailedSources] = useState<string[]>([]);

  // Search, Status Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BannerFilterStatus>('ALL');
  const [sortBy, setSortBy] = useState<BannerSortOrder>('LIVE_FIRST');

  // Inline Banner Notification
  const [notice, setNotice] = useState<{ text: string; status: 'success' | 'error' } | null>(
    null,
  );

  // Inspect Pool & Telemetry Modal
  const [inspectingBanner, setInspectingBanner] = useState<GachaBanner | null>(null);
  const [inspectStats, setInspectStats] = useState<GachaBannerStats | null>(null);
  const [inspectStatsLoading, setInspectStatsLoading] = useState(false);

  // Sensitive Governance Confirmation Modal (Live edits / deactivations / deletes)
  const [pendingSensitiveOp, setPendingSensitiveOp] =
    useState<PendingSensitiveBannerOp | null>(null);

  // Create / Edit / Rerun Form Modal State
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('general');
  const [editingBanner, setEditingBanner] = useState<GachaBanner | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [initialDraftSnapshot, setInitialDraftSnapshot] = useState('');
  const [previewFailedUrl, setPreviewFailedUrl] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formPermanent, setFormPermanent] = useState(false);
  const [formStartDate, setFormStartDate] = useState(() => toLocalDatetimeInput(new Date()));
  const [formEndDate, setFormEndDate] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + FOURTEEN_DAYS_MS)),
  );
  const [enableSinglePull, setEnableSinglePull] = useState(true);
  const [formSingleCost, setFormSingleCost] = useState(DEFAULT_SINGLE_COST);
  const [enableFivePull, setEnableFivePull] = useState(false);
  const [formFiveCost, setFormFiveCost] = useState(DEFAULT_FIVE_COST);
  const [enableTenPull, setEnableTenPull] = useState(true);
  const [formTenCost, setFormTenCost] = useState(DEFAULT_TEN_COST);
  const [enablePity, setEnablePity] = useState(true);
  const [formPity, setFormPity] = useState(DEFAULT_PITY_THRESHOLD);
  const [formItems, setFormItems] = useState<GachaBannerItem[]>([]);

  const showNotice = (text: string, status: 'success' | 'error' = 'success') => {
    setNotice({ text, status });
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const workspace = await loadGachaWorkspace();
      setBanners(workspace.banners);
      setCatalogs(workspace.catalogs);
      setCatalogFailedSources(
        workspace.failedSources.filter((src) => src !== 'gacha banners'),
      );
      setNowMs(Date.now());
      if (workspace.failedSources.length > 0) {
        showNotice(
          `Partial load warning: could not fetch ${workspace.failedSources.join(', ')}.`,
          'error',
        );
      }
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
        setCatalogs(workspace.catalogs);
        setCatalogFailedSources(
          workspace.failedSources.filter((src) => src !== 'gacha banners'),
        );
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

  const openInspectModal = (banner: GachaBanner) => {
    setInspectingBanner(banner);
    setInspectStats(null);
    setInspectStatsLoading(true);
    adminClient
      .get<GachaBannerStats>(`/gachabanner/${banner.id}/stats`)
      .then((res) => {
        setInspectStats(res.data);
      })
      .catch(() => {
        setInspectStats(null);
      })
      .finally(() => {
        setInspectStatsLoading(false);
      });
  };

  const closeFormModalImmediately = () => {
    setConfirmDiscardOpen(false);
    setDialogMode(null);
    setEditingBanner(null);
  };

  const openFormModal = (
    mode: Exclude<DialogMode, null>,
    banner?: GachaBanner,
    initialTab: ModalTab = 'general',
  ) => {
    setModalError(null);
    setConfirmDiscardOpen(false);
    setPreviewFailedUrl(null);
    setDialogMode(mode);
    setModalTab(initialTab);
    setEditingBanner(mode === 'edit' && banner ? banner : null);

    if (banner) {
      const singleOpt = banner.pullOptions.find((o) => o.pullType === 'Single');
      const fiveOpt = banner.pullOptions.find((o) => o.pullType === 'Five');
      const tenOpt = banner.pullOptions.find((o) => o.pullType === 'Ten');

      const nextTitle = mode === 'rerun' ? `${banner.title} (Rerun)` : banner.title;
      const nextDesc = banner.description;
      const nextImageUrl = banner.bannerImageUrl || '';
      const nextEnableSingle = Boolean(singleOpt) || (!fiveOpt && !tenOpt);
      const nextSingleCost = singleOpt?.price ?? DEFAULT_SINGLE_COST;
      const nextEnableFive = Boolean(fiveOpt);
      const nextFiveCost = fiveOpt?.price ?? DEFAULT_FIVE_COST;
      const nextEnableTen = Boolean(tenOpt);
      const nextTenCost = tenOpt?.price ?? DEFAULT_TEN_COST;

      const hasPity = typeof banner.pityThreshold === 'number' && banner.pityThreshold > 0;
      const nextEnablePity = hasPity;
      const nextPity = banner.pityThreshold || DEFAULT_PITY_THRESHOLD;
      const nextItems = normalizePoolItemsToBasisPoints(banner.items);

      let nextPermanent = false;
      let nextStartDate = '';
      let nextEndDate = '';
      if (mode === 'edit') {
        nextPermanent = banner.isPermanent;
        nextStartDate = toLocalDatetimeInput(banner.startTime);
        nextEndDate = toLocalDatetimeInput(banner.endTime);
      } else {
        // Rerun starts a fresh 14-day window by default
        const now = new Date();
        nextPermanent = false;
        nextStartDate = toLocalDatetimeInput(now);
        nextEndDate = toLocalDatetimeInput(new Date(now.getTime() + FOURTEEN_DAYS_MS));
      }

      setFormTitle(nextTitle);
      setFormDesc(nextDesc);
      setFormImageUrl(nextImageUrl);
      setEnableSinglePull(nextEnableSingle);
      setFormSingleCost(nextSingleCost);
      setEnableFivePull(nextEnableFive);
      setFormFiveCost(nextFiveCost);
      setEnableTenPull(nextEnableTen);
      setFormTenCost(nextTenCost);
      setEnablePity(nextEnablePity);
      setFormPity(nextPity);
      setFormItems(nextItems);
      setFormPermanent(nextPermanent);
      setFormStartDate(nextStartDate);
      setFormEndDate(nextEndDate);
      setInitialDraftSnapshot(
        serializeBannerDraft({
          title: nextTitle,
          desc: nextDesc,
          imageUrl: nextImageUrl,
          permanent: nextPermanent,
          startDate: nextStartDate,
          endDate: nextEndDate,
          enableSingle: nextEnableSingle,
          singleCost: nextSingleCost,
          enableFive: nextEnableFive,
          fiveCost: nextFiveCost,
          enableTen: nextEnableTen,
          tenCost: nextTenCost,
          enablePity: nextEnablePity,
          pity: nextPity,
          items: nextItems,
        }),
      );
    } else {
      const now = new Date();
      const nextStartDate = toLocalDatetimeInput(now);
      const nextEndDate = toLocalDatetimeInput(new Date(now.getTime() + FOURTEEN_DAYS_MS));

      setFormTitle('');
      setFormDesc('');
      setFormImageUrl('');
      setFormPermanent(false);
      setFormStartDate(nextStartDate);
      setFormEndDate(nextEndDate);
      setEnableSinglePull(true);
      setFormSingleCost(DEFAULT_SINGLE_COST);
      setEnableFivePull(false);
      setFormFiveCost(DEFAULT_FIVE_COST);
      setEnableTenPull(true);
      setFormTenCost(DEFAULT_TEN_COST);
      setEnablePity(true);
      setFormPity(DEFAULT_PITY_THRESHOLD);
      setFormItems([]);
      setInitialDraftSnapshot(
        serializeBannerDraft({
          title: '',
          desc: '',
          imageUrl: '',
          permanent: false,
          startDate: nextStartDate,
          endDate: nextEndDate,
          enableSingle: true,
          singleCost: DEFAULT_SINGLE_COST,
          enableFive: false,
          fiveCost: DEFAULT_FIVE_COST,
          enableTen: true,
          tenCost: DEFAULT_TEN_COST,
          enablePity: true,
          pity: DEFAULT_PITY_THRESHOLD,
          items: [],
        }),
      );
    }
  };

  const currentDraftSnapshot = useMemo(() => {
    if (dialogMode === null) return '';
    return serializeBannerDraft({
      title: formTitle,
      desc: formDesc,
      imageUrl: formImageUrl,
      permanent: formPermanent,
      startDate: formStartDate,
      endDate: formEndDate,
      enableSingle: enableSinglePull,
      singleCost: formSingleCost,
      enableFive: enableFivePull,
      fiveCost: formFiveCost,
      enableTen: enableTenPull,
      tenCost: formTenCost,
      enablePity,
      pity: formPity,
      items: formItems,
    });
  }, [
    dialogMode,
    formTitle,
    formDesc,
    formImageUrl,
    formPermanent,
    formStartDate,
    formEndDate,
    enableSinglePull,
    formSingleCost,
    enableFivePull,
    formFiveCost,
    enableTenPull,
    formTenCost,
    enablePity,
    formPity,
    formItems,
  ]);

  const isFormDirty = dialogMode !== null && currentDraftSnapshot !== initialDraftSnapshot;

  const formPoolStats = useMemo(
    () => analyzePoolItems(formItems, catalogs),
    [formItems, catalogs],
  );

  const requestCloseFormModal = () => {
    if (saving) return;
    if (isFormDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    closeFormModalImmediately();
  };

  const buildValidatedPayload = (): {
    payload?: Record<string, unknown>;
    error?: string;
    errorTab?: ModalTab;
  } => {
    if (!formTitle.trim()) {
      return { error: 'Banner title is required.', errorTab: 'general' };
    }

    const trimmedImageUrl = formImageUrl.trim();
    if (trimmedImageUrl && !isValidHttpUrl(trimmedImageUrl)) {
      return {
        error: 'Banner Artwork URL must be a valid http:// or https:// URL.',
        errorTab: 'general',
      };
    }

    const pullOptions: GachaPullOption[] = [];
    if (enableSinglePull) {
      if (formSingleCost <= 0) {
        return { error: 'Single pull price must exceed 0 Gems.', errorTab: 'general' };
      }
      pullOptions.push({ pullType: 'Single', price: Number(formSingleCost) });
    }
    if (enableFivePull) {
      if (formFiveCost <= 0) {
        return { error: '5-Pull bundle price must exceed 0 Gems.', errorTab: 'general' };
      }
      pullOptions.push({ pullType: 'Five', price: Number(formFiveCost) });
    }
    if (enableTenPull) {
      if (formTenCost <= 0) {
        return { error: '10-Pull bundle price must exceed 0 Gems.', errorTab: 'general' };
      }
      pullOptions.push({ pullType: 'Ten', price: Number(formTenCost) });
    }
    if (pullOptions.length === 0) {
      return {
        error: 'Select at least one pull option (1x, 5x, or 10x).',
        errorTab: 'general',
      };
    }

    if (enablePity && formPity < 1) {
      return {
        error: 'Hard pity threshold must be at least 1 pull.',
        errorTab: 'general',
      };
    }

    let startIso: string | null = null;
    let endIso: string | null = null;
    if (!formPermanent) {
      const rawStart = formStartDate.trim();
      const rawEnd = formEndDate.trim();
      if (!rawStart && !rawEnd) {
        return {
          error:
            'Set a Start Date, an Expiry Date, or enable Permanent Rotation (No Start / Expiry Window).',
          errorTab: 'general',
        };
      }

      const startDateObj = rawStart ? new Date(rawStart) : null;
      const endDateObj = rawEnd ? new Date(rawEnd) : null;
      if (startDateObj && Number.isNaN(startDateObj.getTime())) {
        return { error: 'Start Date & Time is invalid.', errorTab: 'general' };
      }
      if (endDateObj && Number.isNaN(endDateObj.getTime())) {
        return { error: 'Expiry Date & Time is invalid.', errorTab: 'general' };
      }
      if (startDateObj && endDateObj && endDateObj.getTime() <= startDateObj.getTime()) {
        return { error: 'Expiry date must be later than start date.', errorTab: 'general' };
      }
      startIso = startDateObj ? startDateObj.toISOString() : null;
      endIso = endDateObj ? endDateObj.toISOString() : null;
    }

    if (formItems.length === 0) {
      return {
        error: 'Add at least one reward entry in the Reward Pool before saving.',
        errorTab: 'pool',
      };
    }

    const poolSummary = analyzePoolItems(formItems, catalogs);
    if (poolSummary.firstErrorMessage) {
      return { error: poolSummary.firstErrorMessage, errorTab: 'pool' };
    }
    if (!poolSummary.isRateBalanced) {
      return {
        error: `Total drop rate is ${poolSummary.totalRatePct.toFixed(2)}% (must equal 100.00%). Click "Balance Fillers → 100%" or "Normalize All → 100%" in the Reward Pool.`,
        errorTab: 'pool',
      };
    }

    const normalizedItems = formItems.map((it) => ({
      ...it,
      weight: Math.round(Number(it.weight)),
      reward: {
        type: it.reward.type,
        definitionId: it.reward.type === 'Gems' ? 0 : Math.round(Number(it.reward.definitionId)),
        classId: it.reward.type === 'Unit' ? Math.round(Number(it.reward.classId)) : 0,
        amount: it.reward.type === 'Gems' ? Math.round(Number(it.reward.amount)) : 1,
      },
    }));

    const payload: Record<string, unknown> = {
      name: formTitle.trim(),
      description: formDesc.trim(),
      bannerImageUrl: trimmedImageUrl || null,
      items: normalizedItems,
      pullOptions,
      startDate: startIso,
      expiryDate: endIso,
      pityThreshold: enablePity ? Number(formPity) : null,
    };

    return { payload };
  };

  const commitSaveBanner = async (
    payload: Record<string, unknown>,
    rationale?: string,
  ) => {
    setSaving(true);
    setModalError(null);
    try {
      if (dialogMode === 'edit' && editingBanner) {
        const beforeTotalWeight = editingBanner.items.reduce(
          (sum, it) => sum + Math.max(0, it.weight),
          0,
        );
        const afterTotalWeight = formItems.reduce(
          (sum, it) => sum + Math.max(0, it.weight),
          0,
        );
        await adminClient.put(`/gachabanner/${editingBanner.id}`, payload);
        void recordAuditEvent({
          action: 'GACHA_BANNER_UPDATED',
          category: 'GACHA',
          severity: editingBanner.isActive ? 'CRITICAL' : 'HIGH',
          targetType: 'GachaBanner',
          targetId: editingBanner.id,
          targetLabel: String(payload.name),
          rationale,
          beforeState: {
            name: editingBanner.title,
            bannerImageUrl: editingBanner.bannerImageUrl || null,
            isPermanent: editingBanner.isPermanent,
            startDate: editingBanner.startTime,
            expiryDate: editingBanner.endTime,
            itemCount: editingBanner.items.length,
            featuredCount: editingBanner.items.filter((i) => i.isFeatured).length,
            totalWeight: beforeTotalWeight,
            pityThreshold: editingBanner.pityThreshold,
            pullOptions: editingBanner.pullOptions,
          },
          afterState: {
            name: payload.name,
            bannerImageUrl: payload.bannerImageUrl,
            isPermanent: payload.startDate === null && payload.expiryDate === null,
            startDate: payload.startDate,
            expiryDate: payload.expiryDate,
            itemCount: formItems.length,
            featuredCount: formItems.filter((i) => i.isFeatured).length,
            totalWeight: afterTotalWeight,
            pityThreshold: payload.pityThreshold,
            pullOptions: payload.pullOptions,
          },
        });
        setFailedImages((prev) => {
          if (!prev[editingBanner.id]) return prev;
          const next = { ...prev };
          delete next[editingBanner.id];
          return next;
        });
        await fetchBanners();
        closeFormModalImmediately();
        showNotice(`Updated summon banner "${String(payload.name)}".`);
      } else {
        await adminClient.post('/gachabanner', payload);
        void recordAuditEvent({
          action: 'GACHA_BANNER_CREATED',
          category: 'GACHA',
          severity: 'HIGH',
          targetType: 'GachaBanner',
          targetLabel: String(payload.name),
          afterState: {
            startDate: payload.startDate,
            expiryDate: payload.expiryDate,
            pityThreshold: payload.pityThreshold,
            itemCount: formItems.length,
          },
        });
        await fetchBanners();
        closeFormModalImmediately();
        showNotice(`Created summon banner "${String(payload.name)}". Activate it when ready to go live.`);
      }
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Failed to save banner on backend.');
      setModalError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async () => {
    const { payload, error, errorTab } = buildValidatedPayload();
    if (error || !payload) {
      if (errorTab) setModalTab(errorTab);
      setModalError(error || 'Invalid banner configuration.');
      return;
    }

    if (dialogMode === 'edit' && editingBanner?.isActive) {
      setPendingSensitiveOp({
        title: `Update Live Banner "${editingBanner.title}"`,
        description:
          'This banner is currently active for players. Modifying pull pricing, schedule, or drop weights takes effect immediately.',
        targetLabel: 'Live Gacha Banner',
        targetSummary: `${editingBanner.title} (#${editingBanner.id.slice(-6).toUpperCase()})`,
        severity: 'HIGH',
        actionLabel: 'Save Live Changes',
        execute: async (rationale) => {
          await commitSaveBanner(payload, rationale);
          setPendingSensitiveOp(null);
        },
      });
      return;
    }

    await commitSaveBanner(payload).catch(() => {});
  };

  const executeToggleBannerActive = async (
    banner: GachaBanner,
    nextActive: boolean,
    rationale?: string,
  ) => {
    setTogglingId(banner.id);
    try {
      const endpoint = nextActive
        ? `/gachabanner/${banner.id}/activate`
        : `/gachabanner/${banner.id}/deactivate`;
      await adminClient.patch(endpoint);
      void recordAuditEvent({
        action: nextActive ? 'GACHA_BANNER_ACTIVATED' : 'GACHA_BANNER_DEACTIVATED',
        category: 'GACHA',
        severity: 'HIGH',
        targetType: 'GachaBanner',
        targetId: banner.id,
        targetLabel: banner.title,
        rationale,
        beforeState: { isActive: banner.isActive },
        afterState: { isActive: nextActive },
      });
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, isActive: nextActive } : b)),
      );
      if (inspectingBanner?.id === banner.id) {
        setInspectingBanner({ ...inspectingBanner, isActive: nextActive });
      }
      showNotice(
        `Banner "${banner.title}" ${nextActive ? 'activated' : 'deactivated'} successfully.`,
      );
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Failed to toggle banner status.');
      showNotice(msg, 'error');
      throw new Error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleRequest = (banner: GachaBanner) => {
    const nextActive = !banner.isActive;
    if (!nextActive) {
      setPendingSensitiveOp({
        title: `Deactivate Banner "${banner.title}"`,
        description:
          'Deactivating hides this banner from players and blocks any further summon pulls until reactivated.',
        targetLabel: 'Active Banner',
        targetSummary: banner.title,
        severity: 'HIGH',
        actionLabel: 'Deactivate Banner',
        execute: async (rationale) => {
          await executeToggleBannerActive(banner, false, rationale);
          setPendingSensitiveOp(null);
        },
      });
      return;
    }

    void executeToggleBannerActive(banner, true).catch(() => {});
  };

  const handleDeleteRequest = (banner: GachaBanner) => {
    setPendingSensitiveOp({
      title: `Delete Banner "${banner.title}"`,
      description:
        'Permanently deletes this banner from MongoDB. Banners that already have player pull history in GachaResults are protected and cannot be deleted.',
      targetLabel: 'Target Banner',
      targetSummary: `${banner.title} (#${banner.id.slice(-6).toUpperCase()})`,
      severity: 'CRITICAL',
      actionLabel: 'Delete Banner',
      requireKeyword: 'DELETE',
      execute: async (rationale) => {
        await adminClient.delete(`/gachabanner/${banner.id}`);
        void recordAuditEvent({
          action: 'GACHA_BANNER_DELETED',
          category: 'GACHA',
          severity: 'CRITICAL',
          targetType: 'GachaBanner',
          targetId: banner.id,
          targetLabel: banner.title,
          rationale,
          beforeState: {
            isActive: banner.isActive,
            itemCount: banner.items.length,
          },
        });
        setBanners((prev) => prev.filter((b) => b.id !== banner.id));
        if (inspectingBanner?.id === banner.id) {
          setInspectingBanner(null);
        }
        setPendingSensitiveOp(null);
        showNotice(`Deleted unused banner "${banner.title}".`);
      },
    });
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
        const itemMatch = banner.items.some((item) =>
          resolveItemLabel(item, catalogs).toLowerCase().includes(q),
        );
        if (!titleMatch && !descMatch && !idMatch && !itemMatch) {
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
        const endA = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
        const endB = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
        return endA - endB;
      }
      if (sortBy === 'NEWEST_START') {
        const startA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const startB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return startB - startA;
      }
      if (sortBy === 'COST_ASC') {
        return (a.costPerPull || 0) - (b.costPerPull || 0);
      }
      const startA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const startB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return statusRank(a) - statusRank(b) || startB - startA;
    });
  }, [banners, statusFilter, searchQuery, sortBy, nowMs, catalogs]);

  const inspectedPoolTotalWeight = useMemo(() => {
    if (!inspectingBanner) return 0;
    return inspectingBanner.items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  }, [inspectingBanner]);

  const inspectedPoolBreakdown = useMemo(() => {
    if (!inspectingBanner) return null;
    return summarizePoolByTier(inspectingBanner.items);
  }, [inspectingBanner]);

  const inspectedPoolSorted = useMemo(() => {
    if (!inspectingBanner) return [];
    return [...inspectingBanner.items].sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        b.rewardTier - a.rewardTier ||
        a.weight - b.weight,
    );
  }, [inspectingBanner]);

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
            Pity &amp; Pool Builder • {banners.length} Total Pools
          </Text>
        </HStack>
      }
      title="SUMMON BANNERS & WISH ROTATIONS"
      subtitle="Configure hero invocations, reward pools, drop weights, pull pricing, pity thresholds, and live telemetry."
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
            onClick={() => openFormModal('create')}
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
                placeholder="Search banner title, reward, or ID..."
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
                ? 'Create a new limited or permanent summoning pool to let travelers pull for heroes and equipment.'
                : 'Adjust the status filter or clear your search query to inspect other banner rotations.'
            }
            actions={
              banners.length === 0 ? (
                <Button
                  label="Create First Banner"
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => openFormModal('create')}
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
            const featuredItems = banner.items.filter((i) => i.isFeatured);
            const hasValidImg = Boolean(banner.bannerImageUrl) && !failedImages[banner.id];

            const badgeLabel =
              schedule.status === 'LIVE'
                ? banner.isPermanent
                  ? 'PERMANENT LIVE'
                  : 'ACTIVE INVOCATION'
                : schedule.status === 'UPCOMING'
                  ? 'SCHEDULED UPCOMING'
                  : schedule.status === 'EXPIRED'
                    ? 'WINDOW EXPIRED'
                    : 'INACTIVE';

            const singlePrice = banner.pullOptions.find((o) => o.pullType === 'Single')?.price;
            const tenPrice = banner.pullOptions.find((o) => o.pullType === 'Ten')?.price;
            const priceText =
              singlePrice && tenPrice
                ? `${singlePrice} / ${tenPrice}`
                : `${banner.costPerPull} Gems`;

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
                        {banner.items.length > 0
                          ? `${banner.items.length} POOL ENTRIES`
                          : 'EMPTY POOL'}
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
                            {priceText}
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
                            {featuredItems.length} Rate-Up
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
                            {banner.pityThreshold ? `${banner.pityThreshold} Pulls` : 'Disabled'}
                          </Text>
                        </VStack>
                      </HStack>
                    </div>

                    {/* Featured Roster Pills */}
                    {featuredItems.length > 0 && (
                      <HStack gap={1.5} wrap="wrap">
                        {featuredItems.slice(0, 4).map((item, idx) => (
                          <Badge
                            key={`${item.reward.type}-${item.reward.definitionId}-${idx}`}
                            label={`★ ${resolveShortItemName(item, catalogs)}`}
                            variant="yellow"
                          />
                        ))}
                        {featuredItems.length > 4 && (
                          <Badge label={`+${featuredItems.length - 4} more`} variant="neutral" />
                        )}
                      </HStack>
                    )}

                    {/* Schedule & Progress Timeline */}
                    <VStack gap={1}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <HStack gap={1.5} vAlign="center">
                          <Icon icon={Calendar} size="xsm" color="accent" />
                          <Text type="code" size="xsm" color="secondary">
                            {banner.isPermanent
                              ? 'Permanent Rotation'
                              : `${banner.startTime ? formatScheduleDateTime(banner.startTime) : 'Immediate'} – ${banner.endTime ? formatScheduleDateTime(banner.endTime) : 'No Expiry'}`}
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

                      <HStack gap={1.5} vAlign="center" wrap="wrap">
                        <Button
                          label="Pool"
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={14} />}
                          onClick={() => openInspectModal(banner)}
                        />
                        <Button
                          label="Edit"
                          variant="secondary"
                          size="sm"
                          icon={<Edit2 size={14} />}
                          onClick={() => openFormModal('edit', banner)}
                        />
                        <Button
                          label="Rerun"
                          variant="secondary"
                          size="sm"
                          icon={<Copy size={14} />}
                          onClick={() => openFormModal('rerun', banner)}
                        />
                        <Button
                          label={banner.isActive ? 'Deactivate' : 'Activate'}
                          variant={banner.isActive ? 'destructive' : 'primary'}
                          size="sm"
                          isLoading={togglingId === banner.id}
                          onClick={() => handleToggleRequest(banner)}
                        />
                        {!banner.isActive && (
                          <IconButton
                            label={`Delete unused banner ${banner.title}`}
                            tooltip="Delete unused banner"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={Trash2} color="error" />}
                            onClick={() => handleDeleteRequest(banner)}
                          />
                        )}
                      </HStack>
                    </HStack>
                  </div>
                </div>
              </Card>
            );
          })}
        </Grid>
      )}

      {/* Modal: Inspect Banner Pool, Drop Rates & Pull Telemetry */}
      <Dialog
        isOpen={Boolean(inspectingBanner)}
        onOpenChange={(open) => {
          if (!open) setInspectingBanner(null);
        }}
        purpose="info"
        width={740}
        maxHeight="90vh"
      >
        {inspectingBanner && (
          <div className="flex flex-col flex-initial min-h-0 overflow-hidden gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={inspectingBanner.title}
                subtitle="Banner reward pool, exact drop rates, pricing tiers, and live pull telemetry."
                endContent={
                  <Badge
                    label={
                      inspectingBanner.isPermanent && inspectingBanner.isActive
                        ? 'PERMANENT'
                        : getBannerScheduleMeta(inspectingBanner, nowMs).status
                    }
                    variant={getScheduleBadgeVariant(
                      getBannerScheduleMeta(inspectingBanner, nowMs).status,
                    )}
                  />
                }
                onOpenChange={() => setInspectingBanner(null)}
              />
            </div>

            <div className="flex-initial min-h-0 overflow-y-auto max-h-[calc(90dvh-180px)] pr-1">
              <VStack gap={4}>
                <Grid columns={{ minWidth: 140, max: 4 }} gap={3}>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Status
                  </Text>
                  <Text weight="bold" size="sm">
                    {inspectingBanner.isPermanent && inspectingBanner.isActive
                      ? 'PERMANENT LIVE'
                      : getBannerScheduleMeta(inspectingBanner, nowMs).status}
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Hard Pity
                  </Text>
                  <Text weight="bold" size="sm" hasTabularNumbers>
                    {inspectingBanner.pityThreshold
                      ? `${inspectingBanner.pityThreshold} Pulls`
                      : 'Disabled'}
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Start Date
                  </Text>
                  <Text type="code" size="xsm">
                    {inspectingBanner.isPermanent
                      ? 'Permanent'
                      : inspectingBanner.startTime
                        ? formatScheduleDateTime(inspectingBanner.startTime)
                        : 'Immediate'}
                  </Text>
                </VStack>
              </Card>
              <Card padding={3} variant="muted">
                <VStack gap={0.5}>
                  <Text type="label" size="xsm" color="secondary">
                    Expiry Date
                  </Text>
                  <Text type="code" size="xsm">
                    {inspectingBanner.endTime
                      ? formatScheduleDateTime(inspectingBanner.endTime)
                      : 'No Expiry'}
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
                  {inspectingBanner.pullOptions.map((opt, i) => (
                    <Badge
                      key={`${opt.pullType}-${i}`}
                      label={formatPullTypeBadge(opt)}
                      variant="cyan"
                    />
                  ))}
                </HStack>
              </VStack>
            </Card>

            {/* Telemetry Stats from GachaResults */}
            <Card padding={3} variant="muted">
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
                  <HStack gap={1.5} vAlign="center">
                    <BarChart3 size={15} />
                    <Text type="label" size="sm" weight="semibold">
                      Player Pull Telemetry (GachaResults)
                    </Text>
                  </HStack>
                  {inspectStatsLoading && (
                    <Text type="code" size="xsm" color="secondary">
                      Loading...
                    </Text>
                  )}
                </HStack>

                {inspectStats && inspectStats.bannerId === inspectingBanner.id ? (
                  <Grid columns={{ minWidth: 130, max: 4 }} gap={2}>
                    <Card padding={3}>
                      <VStack gap={0}>
                        <Text type="label" size="2xs" color="secondary">
                          TOTAL DRAWS
                        </Text>
                        <Text weight="bold" size="lg" type="code" hasTabularNumbers>
                          {inspectStats.totalDraws.toLocaleString()}
                        </Text>
                      </VStack>
                    </Card>
                    <Card padding={3}>
                      <VStack gap={0}>
                        <Text type="label" size="2xs" color="secondary">
                          GEMS SPENT
                        </Text>
                        <Text weight="bold" size="lg" type="code" hasTabularNumbers>
                          {inspectStats.totalGemsSpent.toLocaleString()}
                        </Text>
                      </VStack>
                    </Card>
                    <Card padding={3}>
                      <VStack gap={0}>
                        <Text type="label" size="2xs" color="secondary">
                          UNIQUE PLAYERS
                        </Text>
                        <Text weight="bold" size="lg" type="code" hasTabularNumbers>
                          {inspectStats.uniquePlayers.toLocaleString()}
                        </Text>
                      </VStack>
                    </Card>
                    <Card padding={3}>
                      <VStack gap={0}>
                        <Text type="label" size="2xs" color="secondary">
                          DUPLICATE COMP
                        </Text>
                        <Text weight="bold" size="lg" type="code" hasTabularNumbers>
                          {inspectStats.duplicateDraws} ({inspectStats.compensationGemsAwarded}g)
                        </Text>
                      </VStack>
                    </Card>
                  </Grid>
                ) : (
                  <Text type="supporting" size="xsm">
                    {inspectStatsLoading
                      ? 'Querying GachaResults analytics...'
                      : 'No pull telemetry returned (or banner has not been pulled yet).'}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card padding={3} variant="muted">
              <VStack gap={2}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text type="label" size="sm" weight="semibold">
                    Banner Reward Pool ({inspectingBanner.items.length} Entries)
                  </Text>
                  <Text type="code" size="xsm" color="secondary">
                    ID: {inspectingBanner.id}
                  </Text>
                </HStack>

                {inspectedPoolBreakdown && inspectingBanner.items.length > 0 && (
                  <VStack gap={1.5}>
                    <HStack gap={1.5} wrap="wrap">
                      <Badge
                        label={`★ Rate-Up: ${inspectedPoolBreakdown.featured.effectivePctLabel}% (${inspectedPoolBreakdown.featured.count})`}
                        variant="warning"
                      />
                      <Badge
                        label={`T3 Rare: ${inspectedPoolBreakdown.tier3All.effectivePctLabel}% (${inspectedPoolBreakdown.tier3All.count})`}
                        variant="purple"
                      />
                      <Badge
                        label={`T2 Equip: ${inspectedPoolBreakdown.tier2All.effectivePctLabel}% (${inspectedPoolBreakdown.tier2All.count})`}
                        variant="cyan"
                      />
                      <Badge
                        label={`T1 Base: ${inspectedPoolBreakdown.tier1All.effectivePctLabel}% (${inspectedPoolBreakdown.tier1All.count})`}
                        variant="neutral"
                      />
                    </HStack>
                    {inspectedPoolBreakdown.totalWeight > 0 && (
                      <div
                        className="h-1.5 w-full rounded-full overflow-hidden flex bg-black/30"
                        aria-label="Inspect tier distribution bar"
                      >
                        {inspectedPoolBreakdown.featured.widthPct > 0 && (
                          <div
                            className="bg-amber-400 h-full"
                            style={{ width: `${inspectedPoolBreakdown.featured.widthPct}%` }}
                          />
                        )}
                        {inspectedPoolBreakdown.tier3Standard.widthPct > 0 && (
                          <div
                            className="bg-violet-500 h-full"
                            style={{ width: `${inspectedPoolBreakdown.tier3Standard.widthPct}%` }}
                          />
                        )}
                        {inspectedPoolBreakdown.tier2Standard.widthPct > 0 && (
                          <div
                            className="bg-cyan-500 h-full"
                            style={{ width: `${inspectedPoolBreakdown.tier2Standard.widthPct}%` }}
                          />
                        )}
                        {inspectedPoolBreakdown.tier1Standard.widthPct > 0 && (
                          <div
                            className="bg-slate-500/80 h-full"
                            style={{ width: `${inspectedPoolBreakdown.tier1Standard.widthPct}%` }}
                          />
                        )}
                      </div>
                    )}
                  </VStack>
                )}

                {inspectedPoolSorted.length === 0 ? (
                  <Text type="supporting" size="sm">
                    No reward pool entries attached to this banner in MongoDB.
                  </Text>
                ) : (
                  <div className="divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-sm,8px)] border border-[var(--color-border-subtle)] overflow-hidden">
                    {inspectedPoolSorted.map((item, idx) => {
                      const dropPct =
                        inspectedPoolTotalWeight > 0
                          ? ((item.weight / inspectedPoolTotalWeight) * 100).toFixed(2)
                          : '0.00';
                      const tierVariant: BadgeVariant =
                        item.rewardTier === 3
                          ? 'purple'
                          : item.rewardTier === 2
                            ? 'cyan'
                            : 'neutral';
                      const borderClass = item.isFeatured
                        ? 'border-l-4 border-l-amber-400 bg-amber-400/5'
                        : item.rewardTier === 3
                          ? 'border-l-4 border-l-violet-500'
                          : item.rewardTier === 2
                            ? 'border-l-4 border-l-cyan-500'
                            : 'border-l-4 border-l-slate-500';

                      return (
                        <div
                          key={`${item.reward.type}-${item.reward.definitionId}-${idx}`}
                          className={`${borderClass} px-3 py-2 flex items-center justify-between gap-2`}
                        >
                          <HStack gap={1.5} vAlign="center" className="min-w-0">
                            <Badge label={`T${item.rewardTier}`} variant={tierVariant} />
                            {item.isFeatured && <Badge label="★ RATE-UP" variant="warning" />}
                            <Text size="sm" weight="medium" maxLines={1}>
                              {resolveItemLabel(item, catalogs)}
                            </Text>
                          </HStack>
                          <HStack gap={2} vAlign="center">
                            <Text type="code" size="xsm" weight="semibold" hasTabularNumbers>
                              {dropPct}%
                            </Text>
                          </HStack>
                        </div>
                      );
                    })}
                  </div>
                )}
              </VStack>
            </Card>
              </VStack>
            </div>

            <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <StackItem size="static">
                  <Button
                    label="Edit Settings"
                    variant="secondary"
                    size="md"
                    icon={<Edit2 size={14} />}
                    onClick={() => {
                      const banner = inspectingBanner;
                      setInspectingBanner(null);
                      openFormModal('edit', banner, 'general');
                    }}
                  />
                </StackItem>
                <StackItem size="static">
                  <Button
                    label="Edit Pool & Rates"
                    variant="secondary"
                    size="md"
                    icon={<Layers size={14} />}
                    onClick={() => {
                      const banner = inspectingBanner;
                      setInspectingBanner(null);
                      openFormModal('edit', banner, 'pool');
                    }}
                  />
                </StackItem>
                <StackItem size="static">
                  <Button
                    label="Duplicate as Rerun"
                    variant="secondary"
                    size="md"
                    icon={<Copy size={14} />}
                    onClick={() => {
                      const banner = inspectingBanner;
                      setInspectingBanner(null);
                      openFormModal('rerun', banner);
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
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal: Create / Edit / Rerun Summon Banner + Pool Builder */}
      <Dialog
        isOpen={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) requestCloseFormModal();
        }}
        purpose="form"
        width={1020}
        maxHeight="92vh"
      >
        <div className="flex flex-col flex-initial min-h-0 overflow-hidden gap-3">
          <div className="shrink-0 space-y-2.5">
            <DialogHeader
              title={
                dialogMode === 'edit'
                  ? `Edit Banner: ${editingBanner?.title || ''}`
                  : dialogMode === 'rerun'
                    ? 'Duplicate Banner as Rerun'
                    : 'Create Summon Banner'
              }
              subtitle="Switch cleanly between banner settings and the full-height reward pool & drop rate editor."
              startContent={<Icon icon={Sparkles} size="md" color="accent" />}
              onOpenChange={(open) => {
                if (!open) requestCloseFormModal();
              }}
            />

            <TabList
              value={modalTab}
              onChange={(val) => setModalTab(val as ModalTab)}
              role="tablist"
              hasDivider
            >
              <Tab
                value="general"
                panelId="gacha-panel-general"
                label="Settings, Schedule & Pricing"
                icon={<Calendar className="w-4 h-4" />}
              />
              <Tab
                value="pool"
                panelId="gacha-panel-pool"
                label="Reward Pool & Drop Rates"
                icon={<Layers className="w-4 h-4" />}
                endContent={
                  <Badge
                    label={
                      formPoolStats.issueIndices.size > 0
                        ? `${formItems.length} (!)`
                        : !formPoolStats.isRateBalanced && formItems.length > 0
                          ? `${formItems.length} • ${formPoolStats.totalRatePct.toFixed(0)}%`
                          : formItems.length
                    }
                    variant={
                      formPoolStats.issueIndices.size > 0
                        ? 'error'
                        : !formPoolStats.isRateBalanced && formItems.length > 0
                          ? 'warning'
                          : formItems.length > 0
                            ? 'success'
                            : 'neutral'
                    }
                  />
                }
              />
            </TabList>

            {confirmDiscardOpen && (
              <Banner
                status="warning"
                title="Unsaved Changes"
                description="You have unsaved edits on this banner. Closing now will discard them."
                endContent={
                  <HStack gap={2}>
                    <Button
                      label="Keep Editing"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDiscardOpen(false)}
                    />
                    <Button
                      label="Discard & Close"
                      variant="destructive"
                      size="sm"
                      onClick={closeFormModalImmediately}
                    />
                  </HStack>
                }
              />
            )}

            {modalError && <Banner status="error" title="Validation Error" description={modalError} />}
          </div>

          <div className="flex-initial min-h-0 overflow-y-auto max-h-[calc(92dvh-265px)] pr-1">
            {modalTab === 'general' ? (
              <div id="gacha-panel-general" role="tabpanel" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput
                    label="Banner Title"
                    isRequired
                    placeholder="e.g. Celestial Oath: Blade of Judgment"
                    value={formTitle}
                    onChange={setFormTitle}
                  />

                  <TextInput
                    label="Banner Artwork URL"
                    isOptional
                    type="url"
                    placeholder="https://..."
                    value={formImageUrl}
                    onChange={setFormImageUrl}
                    startIcon={<ImageIcon size={14} />}
                  />
                </div>

                {formImageUrl.trim() && (
                  <Card padding={2} variant="muted">
                    {!isValidHttpUrl(formImageUrl) ? (
                      <Text type="supporting" size="xsm">
                        Invalid Artwork URL: address must start with http:// or https://.
                      </Text>
                    ) : previewFailedUrl === formImageUrl.trim() ? (
                      <Text type="supporting" size="xsm">
                        Artwork preview failed to load — verify the image URL is reachable.
                      </Text>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-28 shrink-0 rounded overflow-hidden border border-[var(--color-border-subtle)] bg-slate-950">
                          <img
                            src={formImageUrl.trim()}
                            alt="Banner artwork preview"
                            onError={() => setPreviewFailedUrl(formImageUrl.trim())}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <VStack gap={0}>
                          <Text type="label" size="xsm" weight="semibold">
                            Artwork Preview Loaded
                          </Text>
                          <Text type="code" size="2xs" color="secondary" maxLines={1}>
                            {formImageUrl.trim()}
                          </Text>
                        </VStack>
                      </div>
                    )}
                  </Card>
                )}

                <TextArea
                  label="Description / Rate-Up Details"
                  placeholder="Describe rate-up details, featured heroes, and mechanics..."
                  value={formDesc}
                  onChange={setFormDesc}
                  rows={2}
                />

                {/* Schedule & Pity Configuration */}
                <Card padding={3} variant="muted">
                  <VStack gap={3}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CheckboxInput
                        label="Permanent Rotation (No Start / Expiry Window)"
                        description="Enable for evergreen banners such as Standard Summon."
                        value={formPermanent}
                        onChange={(checked) => setFormPermanent(checked)}
                      />
                      <CheckboxInput
                        label="Enforce Hard Pity Guarantee (BR-06)"
                        description="Guarantees a Tier 3 / Featured pull every N pulls."
                        value={enablePity}
                        onChange={(checked) => setEnablePity(checked)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                      {!formPermanent && (
                        <>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Text type="label" size="xsm" weight="medium">
                                Start Date &amp; Time (Local)
                              </Text>
                              {formStartDate && (
                                <Button
                                  label="Clear"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFormStartDate('')}
                                />
                              )}
                            </div>
                            <input
                              type="datetime-local"
                              aria-label="Start Date and Time"
                              value={formStartDate}
                              onChange={(e) => setFormStartDate(e.target.value)}
                              className={DATETIME_INPUT_CLASS}
                            />
                            <Text type="supporting" size="2xs">
                              Leave blank to start immediately
                            </Text>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Text type="label" size="xsm" weight="medium">
                                Expiry Date &amp; Time (Local)
                              </Text>
                              {formEndDate && (
                                <Button
                                  label="Clear"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFormEndDate('')}
                                />
                              )}
                            </div>
                            <input
                              type="datetime-local"
                              aria-label="Expiry Date and Time"
                              value={formEndDate}
                              onChange={(e) => setFormEndDate(e.target.value)}
                              className={DATETIME_INPUT_CLASS}
                            />
                            <Text type="supporting" size="2xs">
                              Leave blank for no end date
                            </Text>
                          </div>
                        </>
                      )}

                      {enablePity && (
                        <NumberInput
                          label="Hard Pity Threshold (Pulls)"
                          value={formPity}
                          onChange={setFormPity}
                          min={1}
                          isIntegerOnly
                          hasNumberSteppers
                          isWheelEnabled={false}
                          units="Pulls"
                        />
                      )}
                    </div>

                    {!formPermanent &&
                      formEndDate.trim() !== '' &&
                      !Number.isNaN(new Date(formEndDate).getTime()) &&
                      new Date(formEndDate).getTime() <= nowMs && (
                        <Banner
                          status="warning"
                          title="Expiry Window Is In The Past"
                          description="Players cannot pull from a banner after its Expiry Date passes. Extend the expiry window or switch to Permanent Rotation before activating."
                        />
                      )}

                    {enablePity &&
                      formItems.length > 0 &&
                      formItems.filter((item) => item.isFeatured).length === 0 && (
                        <Text type="supporting" size="xsm">
                          Pity note: No Rate-Up (Featured) entries are marked — Hard Pity will draw from Tier 3 (or highest-tier) entries without a 50/50 featured lock.
                        </Text>
                      )}

                    {dialogMode === 'edit' &&
                      editingBanner?.isActive &&
                      (enablePity !== Boolean(editingBanner.pityThreshold) ||
                        (enablePity && Number(formPity) !== editingBanner.pityThreshold)) && (
                        <Text type="supporting" size="xsm">
                          Live pity note: Updating Hard Pity takes effect immediately against players&apos; accumulated PullsSinceRare counters on this banner.
                        </Text>
                      )}
                  </VStack>
                </Card>

                {/* Pull Pricing Options (Single, Five, Ten) */}
                <Card padding={3} variant="muted">
                  <VStack gap={2}>
                    <Text type="label" size="sm" weight="semibold">
                      Pull Pricing Options
                    </Text>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Card padding={3}>
                        <VStack gap={2}>
                          <CheckboxInput
                            label="1x Single Pull"
                            value={enableSinglePull}
                            onChange={(checked) => setEnableSinglePull(checked)}
                          />
                          {enableSinglePull && (
                            <NumberInput
                              label="Single Price"
                              size="sm"
                              value={formSingleCost}
                              onChange={setFormSingleCost}
                              min={1}
                              isIntegerOnly
                              hasNumberSteppers
                              isWheelEnabled={false}
                              units="Gems"
                            />
                          )}
                        </VStack>
                      </Card>

                      <Card padding={3}>
                        <VStack gap={2}>
                          <CheckboxInput
                            label="5x Five Pull"
                            value={enableFivePull}
                            onChange={(checked) => setEnableFivePull(checked)}
                          />
                          {enableFivePull && (
                            <NumberInput
                              label="5-Pull Price"
                              size="sm"
                              value={formFiveCost}
                              onChange={setFormFiveCost}
                              min={1}
                              isIntegerOnly
                              hasNumberSteppers
                              isWheelEnabled={false}
                              units="Gems"
                            />
                          )}
                        </VStack>
                      </Card>

                      <Card padding={3}>
                        <VStack gap={2}>
                          <CheckboxInput
                            label="10x Ten Pull"
                            value={enableTenPull}
                            onChange={(checked) => setEnableTenPull(checked)}
                          />
                          {enableTenPull && (
                            <NumberInput
                              label="10-Pull Price"
                              size="sm"
                              value={formTenCost}
                              onChange={setFormTenCost}
                              min={1}
                              isIntegerOnly
                              hasNumberSteppers
                              isWheelEnabled={false}
                              units="Gems"
                            />
                          )}
                        </VStack>
                      </Card>
                    </div>
                  </VStack>
                </Card>
              </div>
            ) : (
              <div id="gacha-panel-pool" role="tabpanel">
                <GachaPoolEditor
                  items={formItems}
                  onChange={setFormItems}
                  units={catalogs.units}
                  weapons={catalogs.weapons}
                  trinkets={catalogs.trinkets}
                  classes={catalogs.classes}
                  catalogWarning={
                    catalogFailedSources.length > 0
                      ? `Could not load ${catalogFailedSources.join(', ')}. Items referencing unloaded catalogs may fail validation.`
                      : null
                  }
                />
              </div>
            )}
          </div>

          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge
                  label={
                    formItems.length === 0
                      ? 'Pool Empty'
                      : `Pool: ${formItems.length} items • ${formPoolStats.totalRatePct.toFixed(2)}%`
                  }
                  variant={
                    formItems.length === 0 || !formPoolStats.isRateBalanced
                      ? 'warning'
                      : formPoolStats.issueIndices.size > 0
                        ? 'error'
                        : 'success'
                  }
                />
                <Button
                  label={
                    modalTab === 'general'
                      ? 'Configure Pool & Rates →'
                      : '← Back to Settings'
                  }
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setModalTab((prev) => (prev === 'general' ? 'pool' : 'general'))
                  }
                />
              </HStack>

              <HStack justify="end" gap={2}>
                <StackItem size="static">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    size="md"
                    isDisabled={saving}
                    onClick={requestCloseFormModal}
                  />
                </StackItem>
                <StackItem size="static">
                  <Button
                    label={dialogMode === 'edit' ? 'Save Banner Changes' : 'Create Banner'}
                    variant="primary"
                    size="md"
                    isLoading={saving}
                    onClick={() => void handleFormSubmit()}
                  />
                </StackItem>
              </HStack>
            </HStack>
          </div>
        </div>
      </Dialog>

      {/* Sensitive Action Confirmation Modal */}
      <SensitiveActionModal
        isOpen={pendingSensitiveOp !== null}
        title={pendingSensitiveOp?.title || ''}
        description={pendingSensitiveOp?.description || ''}
        targetLabel={pendingSensitiveOp?.targetLabel}
        targetSummary={pendingSensitiveOp?.targetSummary}
        severity={pendingSensitiveOp?.severity || 'HIGH'}
        actionLabel={pendingSensitiveOp?.actionLabel}
        requireKeyword={pendingSensitiveOp?.requireKeyword}
        onCancel={() => setPendingSensitiveOp(null)}
        onConfirm={async (rationale) => {
          if (pendingSensitiveOp) {
            await pendingSensitiveOp.execute(rationale);
          }
        }}
      />
    </ConsolePage>
  );
};
