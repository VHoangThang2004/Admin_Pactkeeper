import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Copy,
  Edit2,
  Gem,
  Package,
  Plus,
  Power,
  RefreshCw,
  Shield,
  Sparkles,
  Store,
  Trash2,
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
import { recordAuditEvent } from '../services/adminSecurityService';
import {
  computeShopLiveStatus,
  createShop,
  deleteShop,
  extractShopApiError,
  fetchAllShopsAdmin,
  formatShopScheduleSummary,
  formatTimeShort,
  normalizeTimeSpanString,
  setShopActive,
  updateShop,
  type ShopLiveStatus,
} from '../services/shopService';
import type {
  ClassDefinition,
  GachaRewardType,
  RewardItemDto,
  ShopDto,
  ShopItemDto,
  ShopResetPeriod,
  TrinketDefinition,
  UnitDefinition,
  UpsertShopPayload,
  WeaponDefinition,
} from '../types';

type StatusFilter = 'ALL' | 'OPEN' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED';
type ResetFilter = 'ALL' | ShopResetPeriod;
type DialogMode = 'create' | 'edit' | 'duplicate' | null;
type ModalTab = 'storefront' | 'items';
type StarterTemplateId = 'armory' | 'daily-deals' | 'event-shop';

interface CatalogMaps {
  units: UnitDefinition[];
  weapons: WeaponDefinition[];
  trinkets: TrinketDefinition[];
  classes: ClassDefinition[];
  unitByUid: Map<number, UnitDefinition>;
  weaponById: Map<number, WeaponDefinition>;
  trinketById: Map<number, TrinketDefinition>;
  classById: Map<number, ClassDefinition>;
}

interface PendingSensitiveShopOp {
  kind: 'toggle' | 'delete';
  shop: ShopDto;
  nextActive?: boolean;
}

const RESET_FILTER_OPTIONS: SelectorOptionData[] = [
  { value: 'ALL', label: 'All Reset Cycles' },
  { value: 'Lifetime', label: 'Lifetime (One-Time)' },
  { value: 'Daily', label: 'Daily (00:00 UTC)' },
  { value: 'Weekly', label: 'Weekly (Mon UTC)' },
];

const RESET_FORM_OPTIONS: SelectorOptionData[] = [
  { value: 'Lifetime', label: 'Lifetime — Never resets' },
  { value: 'Daily', label: 'Daily — Resets every 00:00 UTC' },
  { value: 'Weekly', label: 'Weekly — Resets every Monday 00:00 UTC' },
];

const ITEM_TYPE_OPTIONS: SelectorOptionData[] = [
  { value: 'Unit', label: 'Hero Unit' },
  { value: 'Weapon', label: 'Weapon' },
  { value: 'Trinket', label: 'Trinket' },
  { value: 'Gems', label: 'Gem Pack' },
];

const TIER_OPTIONS: SelectorOptionData[] = [
  { value: '3', label: 'Tier 3 (Hero)' },
  { value: '2', label: 'Tier 2 (Stat Gear)' },
  { value: '1', label: 'Tier 1 (Common / Gems)' },
];

function getStatusBadgeVariant(status: ShopLiveStatus): BadgeVariant {
  switch (status) {
    case 'OPEN':
      return 'success';
    case 'OUTSIDE_HOURS':
      return 'cyan';
    case 'SCHEDULED':
      return 'info';
    case 'EXPIRED':
      return 'warning';
    default:
      return 'neutral';
  }
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

function formatRewardName(reward: RewardItemDto, catalogs: CatalogMaps): string {
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

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const ShopManagement: React.FC = () => {
  const [shops, setShops] = useState<ShopDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    status: 'success' | 'error' | 'warning' | 'info';
    title: string;
    text: string;
  } | null>(null);

  // Catalog definitions from CMS
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [weapons, setWeapons] = useState<WeaponDefinition[]>([]);
  const [trinkets, setTrinkets] = useState<TrinketDefinition[]>([]);
  const [classes, setClasses] = useState<ClassDefinition[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [resetFilter, setResetFilter] = useState<ResetFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit / Duplicate Modal state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('storefront');
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formResetPeriod, setFormResetPeriod] = useState<ShopResetPeriod>('Lifetime');
  const [formDateMode, setFormDateMode] = useState<'permanent' | 'scheduled'>('permanent');
  const [formStartDate, setFormStartDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formHoursMode, setFormHoursMode] = useState<'allDay' | 'dailyWindow'>('allDay');
  const [formDailyStart, setFormDailyStart] = useState('18:00');
  const [formDailyEnd, setFormDailyEnd] = useState('22:00');
  const [formPublishMode, setFormPublishMode] = useState<'draft' | 'open'>('open');
  const [formItems, setFormItems] = useState<ShopItemDto[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Guarded Activate / Pause / Delete confirmation modal
  const [pendingSensitive, setPendingSensitive] = useState<PendingSensitiveShopOp | null>(null);

  const catalogs = useMemo<CatalogMaps>(
    () => ({
      units,
      weapons,
      trinkets,
      classes,
      unitByUid: new Map(units.map((u) => [u.uId, u])),
      weaponById: new Map(weapons.map((w) => [w.weaponId, w])),
      trinketById: new Map(trinkets.map((t) => [t.trinketId, t])),
      classById: new Map(classes.map((c) => [c.classId, c])),
    }),
    [units, weapons, trinkets, classes]
  );

  const fetchAllPayload = useCallback(async () => {
    const [shopsRes, uRes, wRes, tRes, cRes] = await Promise.allSettled([
      fetchAllShopsAdmin(),
      adminClient.get('/UnitDefinition'),
      adminClient.get('/WeaponDefinition'),
      adminClient.get('/TrinketDefinition'),
      adminClient.get('/ClassDefinition'),
    ]);
    return { shopsRes, uRes, wRes, tRes, cRes };
  }, []);

  const applyFetchedPayload = useCallback(
    (payload: Awaited<ReturnType<typeof fetchAllPayload>>, isManualRefresh: boolean) => {
      const { shopsRes, uRes, wRes, tRes, cRes } = payload;
      if (shopsRes.status === 'fulfilled') {
        setShops(shopsRes.value);
        if (isManualRefresh) {
          setNotice({
            status: 'success',
            title: 'Up to Date',
            text: `Loaded ${shopsRes.value.length} in-game shops.`,
          });
        }
      } else {
        setNotice({
          status: 'error',
          title: 'Could Not Load Shops',
          text: extractShopApiError(shopsRes.reason, 'Failed to fetch in-game shops from server.'),
        });
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

  // Compute live status per shop
  const shopStatuses = useMemo(() => {
    const now = new Date();
    const map = new Map<string, ReturnType<typeof computeShopLiveStatus>>();
    shops.forEach((s) => map.set(s.id, computeShopLiveStatus(s, now)));
    return map;
  }, [shops]);

  const statusCounts = useMemo(() => {
    let open = 0;
    let scheduled = 0;
    let paused = 0;
    let expired = 0;
    shops.forEach((s) => {
      const st = shopStatuses.get(s.id)?.status;
      if (st === 'OPEN' || st === 'OUTSIDE_HOURS') open += 1;
      else if (st === 'SCHEDULED') scheduled += 1;
      else if (st === 'EXPIRED') expired += 1;
      else paused += 1;
    });
    return { ALL: shops.length, OPEN: open, SCHEDULED: scheduled, PAUSED: paused, EXPIRED: expired };
  }, [shops, shopStatuses]);

  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shops
      .filter((shop) => {
        const st = shopStatuses.get(shop.id)?.status ?? 'PAUSED';
        if (statusFilter === 'OPEN' && st !== 'OPEN' && st !== 'OUTSIDE_HOURS') return false;
        if (statusFilter === 'SCHEDULED' && st !== 'SCHEDULED') return false;
        if (statusFilter === 'PAUSED' && st !== 'PAUSED') return false;
        if (statusFilter === 'EXPIRED' && st !== 'EXPIRED') return false;
        if (resetFilter !== 'ALL' && shop.resetPeriod !== resetFilter) return false;
        if (!q) return true;

        const itemNames = shop.items
          .map((item) => formatRewardName(item.reward, catalogs))
          .join(' ')
          .toLowerCase();
        return (
          shop.name.toLowerCase().includes(q) ||
          shop.description.toLowerCase().includes(q) ||
          itemNames.includes(q)
        );
      })
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }, [shops, shopStatuses, statusFilter, resetFilter, searchQuery, catalogs]);

  const kpiItems = useMemo<KpiStatItem[]>(() => {
    let openNow = 0;
    let eventScheduled = 0;
    let totalItems = 0;
    let heroListings = 0;

    shops.forEach((s) => {
      const st = shopStatuses.get(s.id)?.status;
      if (st === 'OPEN') openNow += 1;
      if (s.startDate || s.expiryDate || (s.dailyStartTime && s.dailyEndTime)) {
        eventScheduled += 1;
      }
      totalItems += s.items.length;
      heroListings += s.items.filter((i) => i.reward.type === 'Unit').length;
    });

    return [
      {
        id: 'total-shops',
        label: 'Total Shops',
        value: shops.length,
        helper: `${statusCounts.OPEN} active · ${statusCounts.PAUSED} paused`,
        icon: <Icon icon={Store} size="sm" />,
        badge: { label: 'Gem Store', variant: 'cyan' },
        highlight: true,
      },
      {
        id: 'open-now',
        label: 'Open Now',
        value: openNow,
        helper: 'Visible and purchasable in-game',
        icon: <Icon icon={Sparkles} size="sm" />,
        badge: { label: 'Live', variant: openNow > 0 ? 'success' : 'neutral' },
      },
      {
        id: 'scheduled-shops',
        label: 'Event & Timed',
        value: eventScheduled,
        helper: 'Campaign dates or daily UTC hours',
        icon: <Icon icon={Calendar} size="sm" />,
        badge: { label: 'Scheduled', variant: 'blue' },
      },
      {
        id: 'items-listed',
        label: 'Items Listed',
        value: totalItems,
        helper: `${heroListings} Hero offers · ${totalItems - heroListings} Gear & Gems`,
        icon: <Icon icon={Package} size="sm" />,
        badge: { label: 'Catalog', variant: 'purple' },
      },
    ];
  }, [shops, shopStatuses, statusCounts]);

  // Select options for item editor
  const unitOptions = useMemo<SelectorOptionData[]>(
    () =>
      units.map((u) => ({
        value: String(u.uId),
        label: `${u.unitName || u.name || 'Unnamed Hero'} (#${u.uId})`,
      })),
    [units]
  );

  const weaponOptions = useMemo<SelectorOptionData[]>(
    () =>
      weapons.map((w) => ({
        value: String(w.weaponId),
        label: `${w.name} (#${w.weaponId})`,
      })),
    [weapons]
  );

  const trinketOptions = useMemo<SelectorOptionData[]>(
    () =>
      trinkets.map((t) => ({
        value: String(t.trinketId),
        label: `${t.name} (#${t.trinketId})`,
      })),
    [trinkets]
  );

  const createDefaultItem = useCallback(
    (type: GachaRewardType): ShopItemDto => {
      if (type === 'Unit') {
        const u = units[0];
        return {
          id: '',
          reward: {
            type: 'Unit',
            definitionId: u?.uId ?? 1,
            classId: u?.classIds?.[0] ?? classes[0]?.classId ?? 1,
            amount: 1,
          },
          rewardTier: 3,
          price: 1200,
          purchaseLimit: 1,
        };
      }
      if (type === 'Weapon') {
        const w = weapons[0];
        return {
          id: '',
          reward: {
            type: 'Weapon',
            definitionId: w?.weaponId ?? 1,
            classId: 0,
            amount: 1,
          },
          rewardTier: 2,
          price: 400,
          purchaseLimit: 1,
        };
      }
      if (type === 'Trinket') {
        const t = trinkets[0];
        return {
          id: '',
          reward: {
            type: 'Trinket',
            definitionId: t?.trinketId ?? 1,
            classId: 0,
            amount: 1,
          },
          rewardTier: 2,
          price: 350,
          purchaseLimit: 1,
        };
      }
      return {
        id: '',
        reward: { type: 'Gems', definitionId: 0, classId: 0, amount: 100 },
        rewardTier: 1,
        price: 100,
        purchaseLimit: null,
      };
    },
    [units, weapons, trinkets, classes]
  );

  // Open Create Dialog (blank or from quick starter template)
  const openCreateDialog = (template?: StarterTemplateId) => {
    setDialogMode('create');
    setModalTab('storefront');
    setEditingShopId(null);
    setFormError(null);
    setFormPublishMode('open');
    const nextOrder = shops.length > 0 ? Math.max(...shops.map((s) => s.displayOrder)) + 1 : 1;
    setFormDisplayOrder(nextOrder);

    if (template === 'armory') {
      setFormName('Citadel Armory');
      setFormDescription('Permanent Gem storefront for core weapons and tactical trinkets.');
      setFormResetPeriod('Lifetime');
      setFormDateMode('permanent');
      setFormStartDate('');
      setFormExpiryDate('');
      setFormHoursMode('allDay');
      setFormDailyStart('18:00');
      setFormDailyEnd('22:00');
      setFormItems([createDefaultItem('Weapon'), createDefaultItem('Trinket')]);
      return;
    }

    if (template === 'daily-deals') {
      setFormName('Daily Supply Exchange');
      setFormDescription('Rotating daily deals whose purchase limits refresh at 00:00 UTC.');
      setFormResetPeriod('Daily');
      setFormDateMode('permanent');
      setFormStartDate('');
      setFormExpiryDate('');
      setFormHoursMode('allDay');
      setFormDailyStart('18:00');
      setFormDailyEnd('22:00');
      setFormItems([createDefaultItem('Weapon'), createDefaultItem('Trinket')]);
      return;
    }

    if (template === 'event-shop') {
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setFormName('Limited Event Shop');
      setFormDescription('7-day seasonal event storefront with exclusive Hero and gear offers.');
      setFormResetPeriod('Weekly');
      setFormDateMode('scheduled');
      setFormStartDate(toDateTimeLocalValue(now.toISOString()));
      setFormExpiryDate(toDateTimeLocalValue(end.toISOString()));
      setFormHoursMode('dailyWindow');
      setFormDailyStart('12:00');
      setFormDailyEnd('22:00');
      setFormItems([createDefaultItem('Unit'), createDefaultItem('Weapon')]);
      return;
    }

    setFormName('');
    setFormDescription('');
    setFormResetPeriod('Lifetime');
    setFormDateMode('permanent');
    setFormStartDate('');
    setFormExpiryDate('');
    setFormHoursMode('allDay');
    setFormDailyStart('18:00');
    setFormDailyEnd('22:00');
    setFormItems([createDefaultItem('Weapon')]);
  };

  const openEditOrDuplicateDialog = (shop: ShopDto, mode: 'edit' | 'duplicate') => {
    setDialogMode(mode);
    setModalTab('storefront');
    setEditingShopId(mode === 'edit' ? shop.id : null);
    setFormError(null);
    setFormName(mode === 'duplicate' ? `${shop.name} (Copy)` : shop.name);
    setFormDescription(shop.description);
    setFormDisplayOrder(mode === 'duplicate' ? shop.displayOrder + 1 : shop.displayOrder);
    setFormResetPeriod(shop.resetPeriod);

    const hasDates = Boolean(shop.startDate || shop.expiryDate);
    setFormDateMode(hasDates ? 'scheduled' : 'permanent');
    setFormStartDate(toDateTimeLocalValue(shop.startDate));
    setFormExpiryDate(toDateTimeLocalValue(shop.expiryDate));

    const hasDailyHours = Boolean(shop.dailyStartTime && shop.dailyEndTime);
    setFormHoursMode(hasDailyHours ? 'dailyWindow' : 'allDay');
    setFormDailyStart(formatTimeShort(shop.dailyStartTime) || '18:00');
    setFormDailyEnd(formatTimeShort(shop.dailyEndTime) || '22:00');
    setFormPublishMode('draft');

    // Preserve item.id on edit so player purchase quotas stay intact; reset to "" on duplicate.
    setFormItems(
      shop.items.map((item) => ({
        ...item,
        id: mode === 'edit' ? item.id : '',
        reward: { ...item.reward },
      }))
    );
  };

  // Item row mutations
  const addItemRow = (type: GachaRewardType) => {
    setFormItems((prev) => [...prev, createDefaultItem(type)]);
  };

  const updateItemRow = (idx: number, updater: (item: ShopItemDto) => ShopItemDto) => {
    setFormItems((prev) => prev.map((it, i) => (i === idx ? updater(it) : it)));
  };

  const changeItemType = (idx: number, nextType: GachaRewardType) => {
    updateItemRow(idx, (prev) => {
      const fresh = createDefaultItem(nextType);
      return {
        ...fresh,
        id: prev.id,
        price: prev.price,
        purchaseLimit: prev.purchaseLimit,
      };
    });
  };

  const duplicateItemRow = (idx: number) => {
    setFormItems((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const copy: ShopItemDto = {
        ...target,
        id: '',
        reward: { ...target.reward },
      };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  };

  const removeItemRow = (idx: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const liveSchedulePreview = useMemo(
    () =>
      formatShopScheduleSummary({
        startDate: formDateMode === 'scheduled' ? fromDateTimeLocalValue(formStartDate) : null,
        expiryDate: formDateMode === 'scheduled' ? fromDateTimeLocalValue(formExpiryDate) : null,
        dailyStartTime:
          formHoursMode === 'dailyWindow' ? normalizeTimeSpanString(formDailyStart) : null,
        dailyEndTime:
          formHoursMode === 'dailyWindow' ? normalizeTimeSpanString(formDailyEnd) : null,
        resetPeriod: formResetPeriod,
      }),
    [
      formDateMode,
      formStartDate,
      formExpiryDate,
      formHoursMode,
      formDailyStart,
      formDailyEnd,
      formResetPeriod,
    ]
  );

  const validateAndBuildPayload = (): UpsertShopPayload | null => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setModalTab('storefront');
      setFormError('Please enter a Shop Name.');
      return null;
    }

    let startIso: string | null = null;
    let expiryIso: string | null = null;
    if (formDateMode === 'scheduled') {
      startIso = fromDateTimeLocalValue(formStartDate);
      expiryIso = fromDateTimeLocalValue(formExpiryDate);
      if (!startIso && !expiryIso) {
        setModalTab('storefront');
        setFormError('Please set a Start Date, Expiry Date, or switch back to Permanent.');
        return null;
      }
      if (startIso && expiryIso && new Date(expiryIso).getTime() <= new Date(startIso).getTime()) {
        setModalTab('storefront');
        setFormError('Expiry Date must be later than Start Date.');
        return null;
      }
    }

    let dailyStart: string | null = null;
    let dailyEnd: string | null = null;
    if (formHoursMode === 'dailyWindow') {
      dailyStart = normalizeTimeSpanString(formDailyStart);
      dailyEnd = normalizeTimeSpanString(formDailyEnd);
      if (!dailyStart || !dailyEnd) {
        setModalTab('storefront');
        setFormError('Please enter both Daily Open and Close times (UTC).');
        return null;
      }
      if (dailyStart === dailyEnd) {
        setModalTab('storefront');
        setFormError('Daily Open and Close times cannot be identical (use Open 24h instead).');
        return null;
      }
    }

    if (formItems.length === 0) {
      setModalTab('items');
      setFormError('Add at least 1 item to list in this shop.');
      return null;
    }

    for (let i = 0; i < formItems.length; i += 1) {
      const item = formItems[i];
      if (!Number.isInteger(item.price) || item.price < 0) {
        setModalTab('items');
        setFormError(`Item #${i + 1}: Gem price must be 0 or greater.`);
        return null;
      }
      if (
        item.purchaseLimit !== null &&
        (!Number.isInteger(item.purchaseLimit) || item.purchaseLimit < 1)
      ) {
        setModalTab('items');
        setFormError(`Item #${i + 1}: Purchase limit must be at least 1 (or set Unlimited).`);
        return null;
      }
      if (item.reward.type === 'Gems' && (!Number.isInteger(item.reward.amount) || item.reward.amount < 1)) {
        setModalTab('items');
        setFormError(`Item #${i + 1}: Gem bundle amount must be at least 1.`);
        return null;
      }
      if (item.reward.type !== 'Gems' && (!Number.isInteger(item.reward.definitionId) || item.reward.definitionId < 1)) {
        setModalTab('items');
        setFormError(`Item #${i + 1}: Please select a valid ${item.reward.type}.`);
        return null;
      }
      if (item.reward.type === 'Unit') {
        const unit = catalogs.unitByUid.get(item.reward.definitionId);
        if (!Number.isInteger(item.reward.classId) || item.reward.classId < 1) {
          setModalTab('items');
          setFormError(`Item #${i + 1}: Hero offers require a Starting Class.`);
          return null;
        }
        if (unit && unit.classIds.length > 0 && !unit.classIds.includes(item.reward.classId)) {
          setModalTab('items');
          setFormError(
            `Item #${i + 1}: Selected Starting Class is not allowed for ${unit.unitName}.`
          );
          return null;
        }
      }
    }

    return {
      name: trimmedName,
      description: formDescription.trim(),
      displayOrder: Math.max(0, Math.trunc(formDisplayOrder || 0)),
      items: formItems.map((item) => ({
        id: item.id,
        reward: {
          type: item.reward.type,
          definitionId: item.reward.type === 'Gems' ? 0 : item.reward.definitionId,
          classId: item.reward.type === 'Unit' ? item.reward.classId : 0,
          amount: item.reward.type === 'Gems' ? Math.max(1, item.reward.amount) : 1,
        },
        rewardTier: item.rewardTier,
        price: Math.max(0, Math.trunc(item.price)),
        purchaseLimit: item.purchaseLimit === null ? null : Math.max(1, Math.trunc(item.purchaseLimit)),
      })),
      resetPeriod: formResetPeriod,
      startDate: startIso,
      expiryDate: expiryIso,
      dailyStartTime: dailyStart,
      dailyEndTime: dailyEnd,
    };
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = validateAndBuildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (dialogMode === 'edit' && editingShopId) {
        const before = shops.find((s) => s.id === editingShopId);
        await updateShop(editingShopId, payload);
        void recordAuditEvent({
          action: 'UPDATE_SHOP',
          category: 'SHOP',
          severity: 'HIGH',
          targetType: 'Shop',
          targetId: editingShopId,
          targetLabel: payload.name,
          beforeState: before
            ? {
                name: before.name,
                itemCount: before.items.length,
                resetPeriod: before.resetPeriod,
              }
            : undefined,
          afterState: {
            name: payload.name,
            itemCount: payload.items.length,
            resetPeriod: payload.resetPeriod,
            displayOrder: payload.displayOrder,
          },
          status: 'SUCCESS',
        });
        setNotice({
          status: 'success',
          title: 'Shop Updated',
          text: `"${payload.name}" was saved with ${payload.items.length} item(s).`,
        });
      } else {
        const created = await createShop(payload);
        let openedNow = false;
        if (formPublishMode === 'open' && created.id) {
          await setShopActive(created.id, true);
          openedNow = true;
        }
        void recordAuditEvent({
          action: 'CREATE_SHOP',
          category: 'SHOP',
          severity: 'HIGH',
          targetType: 'Shop',
          targetId: created.id,
          targetLabel: payload.name,
          afterState: {
            name: payload.name,
            itemCount: payload.items.length,
            resetPeriod: payload.resetPeriod,
            openedImmediately: openedNow,
          },
          status: 'SUCCESS',
        });
        setNotice({
          status: 'success',
          title: openedNow ? 'Shop Created & Opened' : 'Shop Created (Paused Draft)',
          text: openedNow
            ? `"${payload.name}" is now active according to its schedule.`
            : `"${payload.name}" was saved as Paused. Activate it whenever you are ready to go live.`,
        });
      }

      setDialogMode(null);
      await loadData(false);
    } catch (err) {
      setFormError(extractShopApiError(err, 'Failed to save shop configuration.'));
    } finally {
      setSubmitting(false);
    }
  };

  const executeSensitiveShopOp = async (rationale: string) => {
    if (!pendingSensitive) return;
    const { kind, shop, nextActive } = pendingSensitive;

    if (kind === 'delete') {
      await deleteShop(shop.id);
      void recordAuditEvent({
        action: 'DELETE_SHOP',
        category: 'SHOP',
        severity: 'CRITICAL',
        targetType: 'Shop',
        targetId: shop.id,
        targetLabel: shop.name,
        rationale,
        beforeState: { name: shop.name, itemCount: shop.items.length, isActive: shop.isActive },
        status: 'SUCCESS',
      });
      setPendingSensitive(null);
      setNotice({
        status: 'success',
        title: 'Shop Deleted',
        text: `"${shop.name}" was permanently removed.`,
      });
      await loadData(false);
      return;
    }

    const activeFlag = Boolean(nextActive);
    await setShopActive(shop.id, activeFlag);
    void recordAuditEvent({
      action: activeFlag ? 'ACTIVATE_SHOP' : 'PAUSE_SHOP',
      category: 'SHOP',
      severity: 'HIGH',
      targetType: 'Shop',
      targetId: shop.id,
      targetLabel: shop.name,
      rationale,
      beforeState: { isActive: shop.isActive },
      afterState: { isActive: activeFlag },
      status: 'SUCCESS',
    });
    setPendingSensitive(null);
    setNotice({
      status: 'success',
      title: activeFlag ? 'Shop Activated' : 'Shop Paused',
      text: `"${shop.name}" is now ${activeFlag ? 'Active' : 'Paused'}.`,
    });
    await loadData(false);
  };

  return (
    <ConsolePage
      icon={<Icon icon={Store} size="sm" />}
      title="In-Game Shops"
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
          <Button
            variant="primary"
            size="sm"
            label="New Shop"
            icon={<Icon icon={Plus} />}
            onClick={() => openCreateDialog()}
          />
        </HStack>
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

        {/* Filter Bar */}
        <Card padding={3}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Filter shops by status"
              size="sm"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as StatusFilter)}
            >
              <SegmentedControlItem value="ALL" label={`All (${statusCounts.ALL})`} />
              <SegmentedControlItem value="OPEN" label={`Active (${statusCounts.OPEN})`} />
              <SegmentedControlItem
                value="SCHEDULED"
                label={`Scheduled (${statusCounts.SCHEDULED})`}
              />
              <SegmentedControlItem value="PAUSED" label={`Paused (${statusCounts.PAUSED})`} />
              <SegmentedControlItem value="EXPIRED" label={`Expired (${statusCounts.EXPIRED})`} />
            </SegmentedControl>

            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
              <div className="w-[200px]">
                <Selector
                  label="Reset Cycle"
                  options={RESET_FILTER_OPTIONS}
                  value={resetFilter}
                  onChange={(val) => setResetFilter(String(val || 'ALL') as ResetFilter)}
                  width="100%"
                />
              </div>
              <div className="w-full sm:w-[240px]">
                <TextInput
                  label="Search Shops"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Shop name or item..."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Shops Grid / Empty State */}
        {loading ? (
          <Card padding={6}>
            <Text type="supporting" size="sm" color="secondary">
              Loading in-game shops...
            </Text>
          </Card>
        ) : filteredShops.length === 0 ? (
          <Card padding={6}>
            <VStack gap={4}>
              <EmptyState
                icon={<Icon icon={Store} />}
                title={shops.length === 0 ? 'No in-game shops configured yet' : 'No matching shops'}
                description={
                  shops.length === 0
                    ? 'Create your first Gem storefront from scratch or pick one of the starter templates below.'
                    : 'Adjust your status, reset cycle, or search filter to see other storefronts.'
                }
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    label="Create Custom Shop"
                    icon={<Icon icon={Plus} />}
                    onClick={() => openCreateDialog()}
                  />
                }
              />

              {shops.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center">
                        <Text size="sm" weight="bold">
                          Citadel Armory
                        </Text>
                        <Badge label="Permanent" variant="cyan" />
                      </HStack>
                      <Text type="supporting" size="xsm" color="secondary">
                        Always-open Gem shop with lifetime equipment offers.
                      </Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Use Template"
                        onClick={() => openCreateDialog('armory')}
                      />
                    </VStack>
                  </Card>

                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center">
                        <Text size="sm" weight="bold">
                          Daily Supply Exchange
                        </Text>
                        <Badge label="Daily Reset" variant="yellow" />
                      </HStack>
                      <Text type="supporting" size="xsm" color="secondary">
                        Everyday storefront with purchase caps refreshing at 00:00 UTC.
                      </Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Use Template"
                        onClick={() => openCreateDialog('daily-deals')}
                      />
                    </VStack>
                  </Card>

                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center">
                        <Text size="sm" weight="bold">
                          Limited Event Shop
                        </Text>
                        <Badge label="7-Day Event" variant="purple" />
                      </HStack>
                      <Text type="supporting" size="xsm" color="secondary">
                        Seasonal campaign shop with daily open hours and Hero offers.
                      </Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Use Template"
                        onClick={() => openCreateDialog('event-shop')}
                      />
                    </VStack>
                  </Card>
                </div>
              )}
            </VStack>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredShops.map((shop) => {
              const live = shopStatuses.get(shop.id) ?? computeShopLiveStatus(shop);
              const scheduleText = formatShopScheduleSummary(shop);
              const isOpen = live.status === 'OPEN';

              return (
                <Card
                  key={shop.id}
                  padding={4}
                  className={
                    live.status === 'PAUSED' || live.status === 'EXPIRED'
                      ? 'pk-interactive-card opacity-80'
                      : 'pk-interactive-card'
                  }
                >
                  <VStack gap={3}>
                    {/* Header */}
                    <HStack justify="between" vAlign="start" gap={2} wrap="wrap">
                      <VStack gap={1} className="min-w-0 flex-1">
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <StatusDot
                            variant={isOpen ? 'success' : 'neutral'}
                            label={live.label}
                          />
                          <Heading level={5} weight="bold" className="truncate">
                            {shop.name || 'Untitled Shop'}
                          </Heading>
                          <Badge
                            label={live.label}
                            variant={getStatusBadgeVariant(live.status)}
                          />
                          <Badge label={`Order #${shop.displayOrder}`} variant="neutral" />
                        </HStack>
                        {shop.description && (
                          <Text type="supporting" size="sm" color="secondary">
                            {shop.description}
                          </Text>
                        )}
                      </VStack>

                      <HStack gap={1} vAlign="center" className="shrink-0">
                        <IconButton
                          icon={<Edit2 className="w-4 h-4" />}
                          label={`Edit ${shop.name}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditOrDuplicateDialog(shop, 'edit')}
                        />
                        <IconButton
                          icon={<Copy className="w-4 h-4" />}
                          label={`Duplicate ${shop.name}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditOrDuplicateDialog(shop, 'duplicate')}
                        />
                        <IconButton
                          icon={<Power className="w-4 h-4" />}
                          label={shop.isActive ? `Pause ${shop.name}` : `Open ${shop.name}`}
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingSensitive({
                              kind: 'toggle',
                              shop,
                              nextActive: !shop.isActive,
                            })
                          }
                        />
                        <IconButton
                          icon={<Trash2 className="w-4 h-4" />}
                          label={`Delete ${shop.name}`}
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingSensitive({
                              kind: 'delete',
                              shop,
                            })
                          }
                        />
                      </HStack>
                    </HStack>

                    {/* Schedule & Reset Strip */}
                    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5">
                      <VStack gap={1}>
                        <HStack gap={1.5} vAlign="center">
                          <Clock className="w-3.5 h-3.5 text-[var(--color-icon-secondary)] shrink-0" />
                          <Text type="label" size="xsm" color="secondary">
                            SCHEDULE &amp; QUOTA
                          </Text>
                        </HStack>
                        <Text size="sm" weight="medium">
                          {scheduleText}
                        </Text>
                        <Text type="supporting" size="xsm" color="secondary">
                          {live.detail}
                        </Text>
                      </VStack>
                    </div>

                    {/* Items Preview */}
                    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5">
                      <VStack gap={2}>
                        <HStack justify="between" vAlign="center">
                          <Text type="label" size="xsm" color="secondary">
                            CATALOG ITEMS ({shop.items.length})
                          </Text>
                          <Text type="supporting" size="xsm" color="secondary">
                            Priced in Gems
                          </Text>
                        </HStack>

                        {shop.items.length === 0 ? (
                          <Text type="supporting" size="xsm" color="secondary">
                            No items listed yet. Edit this shop to stock items.
                          </Text>
                        ) : (
                          <VStack gap={1}>
                            {shop.items.slice(0, 5).map((item, idx) => (
                              <div
                                key={item.id || `item-${idx}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-background-card)] px-2.5 py-1.5"
                              >
                                <HStack gap={1.5} vAlign="center" wrap="wrap">
                                  <Badge
                                    label={item.reward.type === 'Unit' ? 'Hero' : item.reward.type}
                                    variant={getRewardBadgeVariant(item.reward.type)}
                                  />
                                  <Text size="sm" weight="medium">
                                    {formatRewardName(item.reward, catalogs)}
                                  </Text>
                                </HStack>

                                <HStack gap={1.5} vAlign="center" wrap="wrap">
                                  <Badge
                                    label={
                                      item.purchaseLimit === null
                                        ? 'Unlimited'
                                        : `Max ${item.purchaseLimit} / ${shop.resetPeriod}`
                                    }
                                    variant="neutral"
                                  />
                                  <Badge
                                    label={`${item.price.toLocaleString()} Gems`}
                                    variant="yellow"
                                  />
                                </HStack>
                              </div>
                            ))}
                            {shop.items.length > 5 && (
                              <Text type="supporting" size="xsm" color="secondary">
                                +{shop.items.length - 5} more item(s) — click Edit to view all
                              </Text>
                            )}
                          </VStack>
                        )}
                      </VStack>
                    </div>

                    {/* Footer */}
                    <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                      <Text type="supporting" size="xsm" color="secondary">
                        Ref #{shop.id.slice(-6).toUpperCase()}
                        {shop.createdAt
                          ? ` · Created ${new Date(shop.createdAt).toLocaleDateString()}`
                          : ''}
                      </Text>
                      <Button
                        variant="ghost"
                        size="sm"
                        label="Manage Items"
                        icon={<Icon icon={Package} />}
                        onClick={() => {
                          openEditOrDuplicateDialog(shop, 'edit');
                          setModalTab('items');
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

      {/* Create / Edit / Duplicate Shop Modal */}
      <Dialog
        isOpen={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialogMode(null);
        }}
        purpose="form"
        width={740}
        maxHeight="90dvh"
      >
        <form onSubmit={handleSaveShop} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title={
                dialogMode === 'edit'
                  ? 'Edit In-Game Shop'
                  : dialogMode === 'duplicate'
                    ? 'Duplicate In-Game Shop'
                    : 'Create In-Game Shop'
              }
              subtitle="Configure storefront schedule, reset cycle, and Gem-priced catalog items"
              startContent={<Store className="w-5 h-5 text-[var(--color-accent)]" />}
              onOpenChange={(open) => {
                if (!open && !submitting) setDialogMode(null);
              }}
            />

            <div className="mt-2">
              <TabList
                value={modalTab}
                onChange={(val) => setModalTab(val as ModalTab)}
                role="tablist"
              >
                <Tab value="storefront" label="Storefront & Schedule" />
                <Tab
                  value="items"
                  label="Shop Items"
                  endContent={<Badge label={String(formItems.length)} variant="info" />}
                />
              </TabList>
            </div>
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

              {modalTab === 'storefront' && (
                <VStack gap={3}>
                  {/* Live schedule preview */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={1}>
                      <Text type="label" size="xsm" color="secondary">
                        STOREFRONT SCHEDULE SUMMARY
                      </Text>
                      <Text size="sm" weight="medium">
                        {liveSchedulePreview}
                      </Text>
                    </VStack>
                  </Card>

                  {/* Quick template switcher on create */}
                  {dialogMode === 'create' && (
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="label" size="xsm" color="secondary">
                        QUICK TEMPLATES:
                      </Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Citadel Armory"
                        onClick={() => openCreateDialog('armory')}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Daily Deals"
                        onClick={() => openCreateDialog('daily-deals')}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        label="7-Day Event Shop"
                        onClick={() => openCreateDialog('event-shop')}
                      />
                    </HStack>
                  )}

                  {/* Basics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <TextInput
                        label="Shop Name"
                        value={formName}
                        onChange={setFormName}
                        placeholder="e.g. Citadel Armory or Eclipse Event Shop"
                        isRequired
                      />
                    </div>
                    <NumberInput
                      label="Display Order"
                      value={formDisplayOrder}
                      onChange={setFormDisplayOrder}
                      min={0}
                      isIntegerOnly
                    />
                  </div>

                  <TextArea
                    label="Description (Shown to Players)"
                    value={formDescription}
                    onChange={setFormDescription}
                    rows={2}
                    placeholder="Briefly describe what players can buy in this shop."
                  />

                  <Selector
                    label="Purchase Limit Reset Cycle"
                    options={RESET_FORM_OPTIONS}
                    value={formResetPeriod}
                    onChange={(val) => setFormResetPeriod(String(val || 'Lifetime') as ShopResetPeriod)}
                    width="100%"
                  />

                  {/* Campaign Dates */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                        <Text type="label" size="xsm" color="secondary">
                          CAMPAIGN DATES
                        </Text>
                        <SegmentedControl
                          label="Shop date availability"
                          size="sm"
                          value={formDateMode}
                          onChange={(val) => setFormDateMode(val as 'permanent' | 'scheduled')}
                        >
                          <SegmentedControlItem value="permanent" label="Permanent" />
                          <SegmentedControlItem value="scheduled" label="Scheduled Dates" />
                        </SegmentedControl>
                      </HStack>

                      {formDateMode === 'scheduled' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <Text type="label" size="xsm" color="secondary">
                              Start Date &amp; Time (Local)
                            </Text>
                            <input
                              type="datetime-local"
                              value={formStartDate}
                              onChange={(e) => setFormStartDate(e.target.value)}
                              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <Text type="label" size="xsm" color="secondary">
                              Expiry Date &amp; Time (Local)
                            </Text>
                            <input
                              type="datetime-local"
                              value={formExpiryDate}
                              onChange={(e) => setFormExpiryDate(e.target.value)}
                              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                            />
                          </label>
                        </div>
                      ) : (
                        <Text type="supporting" size="xsm" color="secondary">
                          Shop stays open with no start or end date as long as it is Activated.
                        </Text>
                      )}
                    </VStack>
                  </Card>

                  {/* Daily Open Window (UTC) */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                        <Text type="label" size="xsm" color="secondary">
                          DAILY OPEN HOURS (UTC)
                        </Text>
                        <SegmentedControl
                          label="Daily open hours mode"
                          size="sm"
                          value={formHoursMode}
                          onChange={(val) => setFormHoursMode(val as 'allDay' | 'dailyWindow')}
                        >
                          <SegmentedControlItem value="allDay" label="Open 24 Hours" />
                          <SegmentedControlItem value="dailyWindow" label="Daily Time Window" />
                        </SegmentedControl>
                      </HStack>

                      {formHoursMode === 'dailyWindow' ? (
                        <VStack gap={2}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1">
                              <Text type="label" size="xsm" color="secondary">
                                Opens Daily At (UTC)
                              </Text>
                              <input
                                type="time"
                                value={formDailyStart}
                                onChange={(e) => setFormDailyStart(e.target.value)}
                                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <Text type="label" size="xsm" color="secondary">
                                Closes Daily At (UTC)
                              </Text>
                              <input
                                type="time"
                                value={formDailyEnd}
                                onChange={(e) => setFormDailyEnd(e.target.value)}
                                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                              />
                            </label>
                          </div>
                          <Text type="supporting" size="xsm" color="secondary">
                            Supports overnight windows too (for example, 22:00 to 02:00 UTC).
                          </Text>
                        </VStack>
                      ) : (
                        <Text type="supporting" size="xsm" color="secondary">
                          Available all day during active campaign dates.
                        </Text>
                      )}
                    </VStack>
                  </Card>

                  {/* Publish Status on Create / Duplicate */}
                  {dialogMode !== 'edit' && (
                    <Card variant="muted" padding={3}>
                      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                        <VStack gap={0}>
                          <Text type="label" size="xsm" color="secondary">
                            INITIAL STATUS AFTER CREATION
                          </Text>
                          <Text type="supporting" size="xsm" color="secondary">
                            Open immediately or save as a Paused draft to review first.
                          </Text>
                        </VStack>
                        <SegmentedControl
                          label="Initial shop status"
                          size="sm"
                          value={formPublishMode}
                          onChange={(val) => setFormPublishMode(val as 'draft' | 'open')}
                        >
                          <SegmentedControlItem value="open" label="Activate Immediately" />
                          <SegmentedControlItem value="draft" label="Save as Paused Draft" />
                        </SegmentedControl>
                      </HStack>
                    </Card>
                  )}
                </VStack>
              )}

              {modalTab === 'items' && (
                <VStack gap={3}>
                  <Card variant="muted" padding={3}>
                    <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                      <VStack gap={0}>
                        <Text type="label" size="xsm" color="secondary">
                          ADD ITEMS TO THIS SHOP
                        </Text>
                        <Text type="supporting" size="xsm" color="secondary">
                          Players pay in Gems. Existing item counters are preserved when editing.
                        </Text>
                      </VStack>
                      <HStack gap={1} wrap="wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          label="+ Hero"
                          onClick={() => addItemRow('Unit')}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          label="+ Weapon"
                          onClick={() => addItemRow('Weapon')}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          label="+ Trinket"
                          onClick={() => addItemRow('Trinket')}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          label="+ Gems"
                          onClick={() => addItemRow('Gems')}
                        />
                      </HStack>
                    </HStack>
                  </Card>

                  {formItems.length === 0 ? (
                    <Card variant="muted" padding={4}>
                      <Text type="supporting" size="sm" color="secondary">
                        No items added yet. Click one of the buttons above to stock this shop.
                      </Text>
                    </Card>
                  ) : (
                    <VStack gap={2}>
                      {formItems.map((item, idx) => {
                        const unitDef =
                          item.reward.type === 'Unit'
                            ? catalogs.unitByUid.get(item.reward.definitionId)
                            : undefined;
                        const classOptions: SelectorOptionData[] =
                          unitDef && unitDef.classIds.length > 0
                            ? unitDef.classIds.map((cid) => {
                                const cls = catalogs.classById.get(cid);
                                return {
                                  value: String(cid),
                                  label: cls
                                    ? cls.name || cls.className || `Class #${cid}`
                                    : `Class #${cid}`,
                                };
                              })
                            : classes.map((c) => ({
                                value: String(c.classId),
                                label: c.name || c.className || `Class #${c.classId}`,
                              }));

                        return (
                          <Card key={`shop-item-${idx}`} variant="muted" padding={3}>
                            <VStack gap={2}>
                              <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                                <HStack gap={2} vAlign="center">
                                  <Badge
                                    label={`#${idx + 1} · ${item.reward.type === 'Unit' ? 'Hero' : item.reward.type}`}
                                    variant={getRewardBadgeVariant(item.reward.type)}
                                  />
                                  <Text size="sm" weight="bold">
                                    {formatRewardName(item.reward, catalogs)}
                                  </Text>
                                </HStack>
                                <HStack gap={1}>
                                  <IconButton
                                    icon={<Copy className="w-4 h-4" />}
                                    label={`Duplicate item #${idx + 1}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => duplicateItemRow(idx)}
                                  />
                                  <IconButton
                                    icon={<Trash2 className="w-4 h-4" />}
                                    label={`Remove item #${idx + 1}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItemRow(idx)}
                                  />
                                </HStack>
                              </HStack>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Selector
                                  label="Item Type"
                                  options={ITEM_TYPE_OPTIONS}
                                  value={item.reward.type}
                                  onChange={(val) =>
                                    changeItemType(idx, String(val || 'Weapon') as GachaRewardType)
                                  }
                                  width="100%"
                                />

                                {item.reward.type === 'Gems' && (
                                  <NumberInput
                                    label="Gems Granted"
                                    value={item.reward.amount}
                                    onChange={(val) =>
                                      updateItemRow(idx, (prev) => ({
                                        ...prev,
                                        reward: { ...prev.reward, amount: Math.max(1, val) },
                                      }))
                                    }
                                    min={1}
                                    isIntegerOnly
                                  />
                                )}

                                {item.reward.type === 'Unit' && (
                                  <Selector
                                    label="Hero Unit"
                                    options={unitOptions}
                                    value={String(item.reward.definitionId)}
                                    onChange={(val) => {
                                      const nextUid = Number(val) || 1;
                                      const nextUnit = catalogs.unitByUid.get(nextUid);
                                      updateItemRow(idx, (prev) => {
                                        const nextClassId =
                                          nextUnit &&
                                          nextUnit.classIds.length > 0 &&
                                          !nextUnit.classIds.includes(prev.reward.classId)
                                            ? nextUnit.classIds[0]
                                            : prev.reward.classId;
                                        return {
                                          ...prev,
                                          reward: {
                                            ...prev.reward,
                                            definitionId: nextUid,
                                            classId: nextClassId,
                                          },
                                        };
                                      });
                                    }}
                                    width="100%"
                                  />
                                )}

                                {item.reward.type === 'Weapon' && (
                                  <Selector
                                    label="Weapon"
                                    options={weaponOptions}
                                    value={String(item.reward.definitionId)}
                                    onChange={(val) =>
                                      updateItemRow(idx, (prev) => ({
                                        ...prev,
                                        reward: {
                                          ...prev.reward,
                                          definitionId: Number(val) || 1,
                                        },
                                      }))
                                    }
                                    width="100%"
                                  />
                                )}

                                {item.reward.type === 'Trinket' && (
                                  <Selector
                                    label="Trinket"
                                    options={trinketOptions}
                                    value={String(item.reward.definitionId)}
                                    onChange={(val) =>
                                      updateItemRow(idx, (prev) => ({
                                        ...prev,
                                        reward: {
                                          ...prev.reward,
                                          definitionId: Number(val) || 1,
                                        },
                                      }))
                                    }
                                    width="100%"
                                  />
                                )}
                              </div>

                              {item.reward.type === 'Unit' && (
                                <Selector
                                  label="Starting Class"
                                  options={classOptions}
                                  value={String(item.reward.classId)}
                                  onChange={(val) =>
                                    updateItemRow(idx, (prev) => ({
                                      ...prev,
                                      reward: { ...prev.reward, classId: Number(val) || 1 },
                                    }))
                                  }
                                  width="100%"
                                />
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                                <NumberInput
                                  label="Price (Gems)"
                                  value={item.price}
                                  onChange={(val) =>
                                    updateItemRow(idx, (prev) => ({
                                      ...prev,
                                      price: Math.max(0, val),
                                    }))
                                  }
                                  min={0}
                                  isIntegerOnly
                                />

                                <Selector
                                  label="Rarity Tier"
                                  options={TIER_OPTIONS}
                                  value={String(item.rewardTier)}
                                  onChange={(val) =>
                                    updateItemRow(idx, (prev) => ({
                                      ...prev,
                                      rewardTier: (Number(val) === 3
                                        ? 3
                                        : Number(val) === 2
                                          ? 2
                                          : 1) as 1 | 2 | 3,
                                    }))
                                  }
                                  width="100%"
                                />

                                <VStack gap={1}>
                                  <SegmentedControl
                                    label={`Purchase limit mode for item ${idx + 1}`}
                                    size="sm"
                                    value={item.purchaseLimit === null ? 'unlimited' : 'limited'}
                                    onChange={(val) =>
                                      updateItemRow(idx, (prev) => ({
                                        ...prev,
                                        purchaseLimit: val === 'unlimited' ? null : (prev.purchaseLimit ?? 1),
                                      }))
                                    }
                                  >
                                    <SegmentedControlItem value="limited" label="Capped" />
                                    <SegmentedControlItem value="unlimited" label="Unlimited" />
                                  </SegmentedControl>
                                </VStack>
                              </div>

                              {item.purchaseLimit !== null && (
                                <NumberInput
                                  label={`Max Purchases per Player (${formResetPeriod})`}
                                  value={item.purchaseLimit}
                                  onChange={(val) =>
                                    updateItemRow(idx, (prev) => ({
                                      ...prev,
                                      purchaseLimit: Math.max(1, val),
                                    }))
                                  }
                                  min={1}
                                  isIntegerOnly
                                />
                              )}
                            </VStack>
                          </Card>
                        );
                      })}
                    </VStack>
                  )}

                  <HStack gap={2} vAlign="center">
                    <Shield className="w-4 h-4 text-[var(--color-icon-warning)] shrink-0" />
                    <Text type="supporting" size="xsm" color="secondary">
                      Buying an already-owned Hero, Weapon, or Trinket automatically grants
                      compensation Gems based on its Rarity Tier.
                    </Text>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </div>

          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} justify="between" vAlign="center" wrap="wrap">
              <HStack gap={1.5} vAlign="center">
                <Gem className="w-4 h-4 text-[var(--color-accent)]" />
                <Text type="supporting" size="xsm" color="secondary">
                  {formItems.length} item(s) configured
                </Text>
              </HStack>

              <HStack gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setDialogMode(null)}
                  isDisabled={submitting}
                />
                {modalTab === 'storefront' && (
                  <Button
                    variant="secondary"
                    label={`Next: Shop Items (${formItems.length})`}
                    onClick={() => setModalTab('items')}
                    isDisabled={submitting}
                  />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  label={
                    submitting
                      ? 'Saving...'
                      : dialogMode === 'edit'
                        ? 'Save Changes'
                        : formPublishMode === 'open'
                          ? 'Create & Open Shop'
                          : 'Create Draft Shop'
                  }
                  isLoading={submitting}
                />
              </HStack>
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* Activate / Pause / Delete Confirmation Modal */}
      <SensitiveActionModal
        isOpen={pendingSensitive !== null}
        onClose={() => setPendingSensitive(null)}
        onConfirm={executeSensitiveShopOp}
        title={
          pendingSensitive?.kind === 'delete'
            ? 'Delete In-Game Shop'
            : pendingSensitive?.nextActive
              ? 'Activate In-Game Shop'
              : 'Pause In-Game Shop'
        }
        description={
          pendingSensitive?.kind === 'delete'
            ? 'This permanently deletes the shop and all of its listings from the server. This action cannot be undone.'
            : pendingSensitive?.nextActive
              ? 'Activating this shop makes it visible to players whenever its campaign dates and daily hours are open.'
              : 'Pausing immediately hides this shop from all players until you activate it again.'
        }
        targetLabel="Shop"
        targetSummary={
          pendingSensitive
            ? `${pendingSensitive.shop.name} (${pendingSensitive.shop.items.length} items)`
            : undefined
        }
        severity={pendingSensitive?.kind === 'delete' ? 'CRITICAL' : 'HIGH'}
        requireKeyword={pendingSensitive?.kind === 'delete' ? 'DELETE' : undefined}
        actionLabel={
          pendingSensitive?.kind === 'delete'
            ? 'Delete Permanently'
            : pendingSensitive?.nextActive
              ? 'Activate Shop'
              : 'Pause Shop'
        }
      />
    </ConsolePage>
  );
};

export default ShopManagement;
