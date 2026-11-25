import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit2,
  ExternalLink,
  Gem,
  Package,
  Plus,
  Power,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { GemArt } from '../components/GemArt';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { WEB_TOPUP_URL } from '../constants/links';
import { useThemeMode } from '../hooks/useThemeMode';
import { recordAuditEvent } from '../services/adminSecurityService';
import type {
  AdminPermissionKey,
  CounselRole,
  PurchaseOrder,
  TopUpPackDto,
  TrinketDefinition,
  UnitDefinition,
  WeaponDefinition,
} from '../types';
import { hasPermission } from '../utils/permissions';

type PackCategoryFilter = 'all' | 'gems' | 'bundles';
type OrderStatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'CANCELLED';
type DateRangePreset = 'ALL' | '7D' | '30D' | 'CUSTOM';
type OrderSortOption = 'NEWEST' | 'OLDEST' | 'HIGHEST_AMOUNT';
type RowLimitOption = '25' | '50' | '100' | 'ALL';
type ChartViewMode = 'daily' | 'packs';

interface PaymentWorkspaceData {
  packs: TopUpPackDto[];
  orders: PurchaseOrder[];
  playerNames: Record<string, string>;
  failedSources: string[];
  fetchedAt: number;
}

interface ChartPoint {
  label: string;
  revenue: number;
  paidCount: number;
  totalCount: number;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: ReadonlyArray<{
    value?: number;
    payload?: ChartPoint;
  }>;
}

type OrderTableRow = PurchaseOrder & Record<string, unknown>;

const SORT_OPTIONS: SelectorOptionData[] = [
  { value: 'NEWEST', label: 'Newest First' },
  { value: 'OLDEST', label: 'Oldest First' },
  { value: 'HIGHEST_AMOUNT', label: 'Highest VND Amount' },
];

const ROW_LIMIT_OPTIONS: SelectorOptionData[] = [
  { value: '25', label: 'Show 25' },
  { value: '50', label: 'Show 50' },
  { value: '100', label: 'Show 100' },
  { value: 'ALL', label: 'Show All' },
];

const DATE_INPUT_CLASS =
  'rounded-[var(--radius-sm,8px)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input,var(--color-surface-card))] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors';

function isBundlePack(pack: TopUpPackDto): boolean {
  const bundledItemCount =
    (pack.unitNames?.length ?? 0) +
    (pack.weaponNames?.length ?? 0) +
    (pack.trinketNames?.length ?? 0);
  if (bundledItemCount > 0) return true;
  const normalized = (pack.name || '').toLowerCase();
  return (
    normalized.includes('pass') ||
    normalized.includes('bundle') ||
    normalized.includes('chest')
  );
}

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('en-US')} ₫`;
}

function formatCompactVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso || 'Unknown';
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDayKey(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function buildOrdersCsv(
  orders: PurchaseOrder[],
  packMap: Map<string, TopUpPackDto>,
  playerNames: Record<string, string>,
): string {
  const headers = [
    'OrderCode',
    'OrderId',
    'PlayerId',
    'Username',
    'PackId',
    'PackName',
    'GemsAmount',
    'AmountVND',
    'Status',
    'CreatedAt',
    'WebhookSignature',
  ];
  const rows = orders.map((order) => {
    const pack = packMap.get(order.packId);
    const sig = order.webhookSignature || order.signature || '';
    return [
      order.orderCode,
      order.id,
      order.playerId,
      playerNames[order.playerId] || '',
      order.packId,
      pack?.name || '',
      pack?.gemsAmount ?? '',
      order.amount,
      order.status,
      order.createdAt,
      sig,
    ]
      .map(escapeCsvCell)
      .join(',');
  });
  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
}

async function loadPaymentWorkspace(): Promise<PaymentWorkspaceData> {
  const [packsRes, ordersRes, playersRes] = await Promise.allSettled([
    adminClient.get('/topuppack/all'),
    adminClient.get('/payment/history'),
    adminClient.get('/player/all'),
  ]);

  const failedSources: string[] = [];

  let packs: TopUpPackDto[] = [];
  if (packsRes.status === 'fulfilled' && Array.isArray(packsRes.value.data)) {
    packs = packsRes.value.data;
  } else {
    failedSources.push('top-up packs');
  }

  let orders: PurchaseOrder[] = [];
  if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data)) {
    orders = ordersRes.value.data;
  } else {
    failedSources.push('payment history');
  }

  const playerNames: Record<string, string> = {};
  if (playersRes.status === 'fulfilled' && Array.isArray(playersRes.value.data)) {
    for (const raw of playersRes.value.data as Array<{
      playerId?: string;
      id?: string;
      username?: string;
    }>) {
      const pid = raw.playerId || raw.id;
      if (pid && raw.username) {
        playerNames[pid] = raw.username;
      }
    }
  }

  return { packs, orders, playerNames, failedSources, fetchedAt: Date.now() };
}

function getOrderStatusBadge(
  status: string,
): { variant: BadgeVariant; icon: React.ReactNode } {
  if (status === 'PAID') {
    return { variant: 'success', icon: <CheckCircle2 size={12} /> };
  }
  if (status === 'PENDING') {
    return { variant: 'warning', icon: <Clock size={12} /> };
  }
  return { variant: 'error', icon: <XCircle size={12} /> };
}

const RevenueTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <Card padding={3} elevation="med">
      <VStack gap={1}>
        <Text weight="semibold" size="xsm">
          {label || point.label}
        </Text>
        <Text type="code" size="xsm">
          Paid Revenue: {formatVnd(point.revenue)}
        </Text>
        <Text type="supporting" size="xsm">
          Paid Orders: {point.paidCount} / {point.totalCount} total
        </Text>
      </VStack>
    </Card>
  );
};

/**
 * PaymentManagement — PayOS Gateway Orders, Revenue Analytics & Storefront Crystal Packs.
 */
type TreasuryTab = 'overview' | 'ledger' | 'catalog';

interface PaymentManagementProps {
  role?: CounselRole;
  permissions?: AdminPermissionKey[];
}

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  role = 'Admin',
  permissions,
}) => {
  const canManagePacks = hasPermission(role, 'payments.manage', permissions);
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [activeTab, setActiveTab] = useState<TreasuryTab>('overview');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [packs, setPacks] = useState<TopUpPackDto[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [anchorMs, setAnchorMs] = useState(0);

  const [packCategory, setPackCategory] = useState<PackCategoryFilter>('all');
  const [togglingPackId, setTogglingPackId] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<OrderSortOption>('NEWEST');
  const [rowLimit, setRowLimit] = useState<RowLimitOption>('50');
  const [chartView, setChartView] = useState<ChartViewMode>('daily');

  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState<'sync' | 'cancel' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; status: 'success' | 'error' } | null>(
    null,
  );

  // Create / Edit / Delete Top-Up Pack state
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<TopUpPackDto | null>(null);
  const [packName, setPackName] = useState('');
  const [packPriceVnd, setPackPriceVnd] = useState<number>(20000);
  const [packGemsAmount, setPackGemsAmount] = useState<number>(300);
  const [packIsAvailable, setPackIsAvailable] = useState<boolean>(true);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [selectedWeaponIds, setSelectedWeaponIds] = useState<number[]>([]);
  const [selectedTrinketIds, setSelectedTrinketIds] = useState<number[]>([]);
  const [catalogUnits, setCatalogUnits] = useState<UnitDefinition[]>([]);
  const [catalogWeapons, setCatalogWeapons] = useState<WeaponDefinition[]>([]);
  const [catalogTrinkets, setCatalogTrinkets] = useState<TrinketDefinition[]>([]);
  const [loadingCatalogItems, setLoadingCatalogItems] = useState(false);
  const [packModalError, setPackModalError] = useState<string | null>(null);
  const [savingPack, setSavingPack] = useState(false);

  const [pendingDeletePack, setPendingDeletePack] = useState<TopUpPackDto | null>(null);
  const [deletingPack, setDeletingPack] = useState(false);
  const [deletePackError, setDeletePackError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPaymentWorkspace()
      .then((res) => {
        if (!active) return;
        setPacks(res.packs);
        setOrders(res.orders);
        setPlayerNames(res.playerNames);
        setAnchorMs(res.fetchedAt);
        setSyncError(
          res.failedSources.length > 0
            ? `Partial API response: could not load ${res.failedSources.join(' and ')}.`
            : null,
        );
      })
      .catch(() => {
        if (!active) return;
        setSyncError('Failed to connect to PayOS & catalog endpoints.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const showNotice = (text: string, status: 'success' | 'error' = 'success') => {
    setNotice({ text, status });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await loadPaymentWorkspace();
      setPacks(res.packs);
      setOrders(res.orders);
      setPlayerNames(res.playerNames);
      setAnchorMs(res.fetchedAt);
      setSyncError(
        res.failedSources.length > 0
          ? `Partial API response: could not load ${res.failedSources.join(' and ')}.`
          : null,
      );
      showNotice('PayOS ledger and pack catalog refreshed.');
    } catch {
      setSyncError('Failed to refresh PayOS telemetry.');
      showNotice('Refresh failed. Check API connectivity.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopy = (key: string, value: string, label: string) => {
    if (!navigator.clipboard) {
      showNotice('Clipboard access is unavailable in this browser context.', 'error');
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopiedKey(key);
        showNotice(`Copied ${label} to clipboard.`);
        window.setTimeout(() => {
          setCopiedKey((prev) => (prev === key ? null : prev));
        }, 1800);
      })
      .catch(() => {
        showNotice('Failed to copy text to clipboard.', 'error');
      });
  };

  const togglePackAvailability = async (pack: TopUpPackDto) => {
    if (togglingPackId || !canManagePacks) return;
    const nextState = !pack.isAvailable;
    setTogglingPackId(pack.id);
    try {
      await adminClient.patch(`/topuppack/${pack.id}/availability`, {
        isAvailable: nextState,
      });
      void recordAuditEvent({
        action: 'TOPUP_PACK_AVAILABILITY_TOGGLED',
        category: 'PAYMENT',
        severity: 'HIGH',
        targetType: 'TopUpPack',
        targetId: pack.id,
        targetLabel: pack.name,
        beforeState: { isAvailable: pack.isAvailable },
        afterState: { isAvailable: nextState },
      });
      setPacks((prev) =>
        prev.map((item) =>
          item.id === pack.id ? { ...item, isAvailable: nextState } : item,
        ),
      );
      showNotice(
        `${pack.name} is now ${nextState ? 'available on storefront' : 'hidden from storefront'}.`,
      );
    } catch {
      showNotice(`Failed to update availability for ${pack.name}.`, 'error');
    } finally {
      setTogglingPackId(null);
    }
  };

  const ensureCatalogDefinitionsLoaded = async () => {
    if (catalogUnits.length === 0 && catalogWeapons.length === 0 && catalogTrinkets.length === 0) {
      setLoadingCatalogItems(true);
      try {
        const [uRes, wRes, tRes] = await Promise.allSettled([
          adminClient.get('/UnitDefinition'),
          adminClient.get('/WeaponDefinition'),
          adminClient.get('/TrinketDefinition'),
        ]);
        if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) {
          setCatalogUnits(uRes.value.data);
        }
        if (wRes.status === 'fulfilled' && Array.isArray(wRes.value.data)) {
          setCatalogWeapons(wRes.value.data);
        }
        if (tRes.status === 'fulfilled' && Array.isArray(tRes.value.data)) {
          setCatalogTrinkets(tRes.value.data);
        }
      } finally {
        setLoadingCatalogItems(false);
      }
    }
  };

  const openCreatePackDialog = async () => {
    setEditingPack(null);
    setPackName('');
    setPackPriceVnd(20000);
    setPackGemsAmount(300);
    setPackIsAvailable(true);
    setSelectedUnitIds([]);
    setSelectedWeaponIds([]);
    setSelectedTrinketIds([]);
    setPackModalError(null);
    setIsPackModalOpen(true);
    await ensureCatalogDefinitionsLoaded();
  };

  const openEditPackDialog = async (pack: TopUpPackDto) => {
    setEditingPack(pack);
    setPackName(pack.name || '');
    setPackPriceVnd(pack.priceVnd ?? 0);
    setPackGemsAmount(pack.gemsAmount ?? 0);
    setPackIsAvailable(Boolean(pack.isAvailable));
    setSelectedUnitIds(pack.unitDefinitionIds ?? []);
    setSelectedWeaponIds(pack.weaponDefinitionIds ?? []);
    setSelectedTrinketIds(pack.trinketDefinitionIds ?? []);
    setPackModalError(null);
    setIsPackModalOpen(true);
    await ensureCatalogDefinitionsLoaded();
  };

  const handleSavePack = async () => {
    if (!canManagePacks) return;
    const trimmedName = packName.trim();
    if (!trimmedName) {
      setPackModalError('Top-Up pack name is required.');
      return;
    }
    if (!Number.isFinite(packPriceVnd) || packPriceVnd <= 0) {
      setPackModalError('Price (VND) must be greater than 0.');
      return;
    }
    if (!Number.isFinite(packGemsAmount) || packGemsAmount < 0) {
      setPackModalError('Astral Gems amount cannot be negative.');
      return;
    }

    setPackModalError(null);
    setSavingPack(true);
    const payload = {
      name: trimmedName,
      priceVnd: Math.round(packPriceVnd),
      gemsAmount: Math.round(packGemsAmount),
      isAvailable: packIsAvailable,
      unitDefinitionIds: selectedUnitIds,
      weaponDefinitionIds: selectedWeaponIds,
      trinketDefinitionIds: selectedTrinketIds,
    };

    try {
      if (editingPack) {
        try {
          await adminClient.put(`/topuppack/${editingPack.id}`, payload);
        } catch (putErr: any) {
          const status = putErr?.response?.status;
          const sameCoreFields =
            trimmedName === editingPack.name &&
            payload.priceVnd === editingPack.priceVnd &&
            payload.gemsAmount === editingPack.gemsAmount &&
            JSON.stringify(selectedUnitIds) === JSON.stringify(editingPack.unitDefinitionIds ?? []) &&
            JSON.stringify(selectedWeaponIds) === JSON.stringify(editingPack.weaponDefinitionIds ?? []) &&
            JSON.stringify(selectedTrinketIds) === JSON.stringify(editingPack.trinketDefinitionIds ?? []);

          if ((status === 404 || status === 405) && sameCoreFields && packIsAvailable !== editingPack.isAvailable) {
            await adminClient.patch(`/topuppack/${editingPack.id}/availability`, {
              isAvailable: packIsAvailable,
            });
          } else {
            throw putErr;
          }
        }

        void recordAuditEvent({
          action: 'TOPUP_PACK_UPDATED',
          category: 'PAYMENT',
          severity: 'HIGH',
          targetType: 'TopUpPack',
          targetId: editingPack.id,
          targetLabel: trimmedName,
          beforeState: {
            name: editingPack.name,
            priceVnd: editingPack.priceVnd,
            gemsAmount: editingPack.gemsAmount,
            isAvailable: editingPack.isAvailable,
          },
          afterState: payload,
        });
        setIsPackModalOpen(false);
        setEditingPack(null);
        showNotice(`Updated Top-Up Pack "${trimmedName}".`);
      } else {
        const res = await adminClient.post('/topuppack', payload);
        const created = res.data as TopUpPackDto;
        if (!packIsAvailable && created?.id) {
          await adminClient.patch(`/topuppack/${created.id}/availability`, {
            isAvailable: false,
          });
        }
        void recordAuditEvent({
          action: 'TOPUP_PACK_CREATED',
          category: 'PAYMENT',
          severity: 'HIGH',
          targetType: 'TopUpPack',
          targetId: created?.id,
          targetLabel: trimmedName,
          afterState: payload,
        });
        setIsPackModalOpen(false);
        showNotice(`Created new Top-Up Pack "${trimmedName}" (${formatVnd(payload.priceVnd)}).`);
      }
      await handleRefresh();
    } catch (err: any) {
      const status = err?.response?.status;
      setPackModalError(
        editingPack && (status === 404 || status === 405)
          ? 'Backend endpoint PUT /api/topuppack/{id} is not implemented yet on the server. Availability toggles work via PATCH; full field edits require adding PUT /api/topuppack/{id} on Backend.'
          : err.response?.data?.message ||
              (editingPack
                ? 'Failed to update Top-Up Pack via PUT /api/topuppack/{id}.'
                : 'Failed to create Top-Up Pack via POST /api/topuppack.'),
      );
    } finally {
      setSavingPack(false);
    }
  };

  const executeDeletePack = async (rationale: string) => {
    if (!pendingDeletePack || !canManagePacks) return;
    setDeletePackError(null);
    setDeletingPack(true);
    try {
      await adminClient.delete(`/topuppack/${pendingDeletePack.id}`);
      void recordAuditEvent({
        action: 'TOPUP_PACK_DELETED',
        category: 'PAYMENT',
        severity: 'CRITICAL',
        targetType: 'TopUpPack',
        targetId: pendingDeletePack.id,
        targetLabel: pendingDeletePack.name,
        rationale,
        beforeState: {
          priceVnd: pendingDeletePack.priceVnd,
          gemsAmount: pendingDeletePack.gemsAmount,
        },
      });
      setPacks((prev) => prev.filter((item) => item.id !== pendingDeletePack.id));
      showNotice(`Deleted Top-Up Pack "${pendingDeletePack.name}".`);
      setPendingDeletePack(null);
    } catch (err: any) {
      setDeletePackError(
        err.response?.data?.message || 'Failed to delete Top-Up Pack via DELETE /api/topuppack.',
      );
    } finally {
      setDeletingPack(false);
    }
  };

  const handleSyncOrder = async (order: PurchaseOrder) => {
    setOrderActionLoading('sync');
    try {
      const res = await adminClient.post(`/Payment/sync/${order.orderCode}`);
      const nextStatus = (res.data?.status || order.status) as PurchaseOrder['status'];
      const msg = res.data?.message || `Reconciled order #${order.orderCode}: ${nextStatus}`;
      setSelectedOrder((prev) => (prev && prev.id === order.id ? { ...prev, status: nextStatus } : prev));
      showNotice(msg);
      await handleRefresh();
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Failed to reconcile order with PayOS.', 'error');
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleCancelPendingOrder = async (order: PurchaseOrder) => {
    setOrderActionLoading('cancel');
    try {
      const res = await adminClient.post(`/Payment/cancel-order/${order.orderCode}`);
      void recordAuditEvent({
        action: 'PAYOS_ORDER_CANCELLED',
        category: 'PAYMENT',
        severity: 'HIGH',
        targetType: 'PurchaseOrder',
        targetId: String(order.orderCode),
        targetLabel: `Order #${order.orderCode}`,
        beforeState: { status: order.status },
        afterState: { status: 'CANCELLED' },
      });
      setSelectedOrder((prev) =>
        prev && prev.id === order.id ? { ...prev, status: 'CANCELLED' } : prev,
      );
      showNotice(res.data?.message || `Cancelled pending order #${order.orderCode}.`);
      await handleRefresh();
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Failed to cancel pending order.', 'error');
    } finally {
      setOrderActionLoading(null);
    }
  };

  const packMap = useMemo(() => {
    const map = new Map<string, TopUpPackDto>();
    for (const pack of packs) {
      map.set(pack.id, pack);
      if (pack.id) {
        map.set(pack.id.trim().toLowerCase(), pack);
      }
    }
    return map;
  }, [packs]);

  const resolvePack = useCallback(
    (packId: string | undefined): TopUpPackDto | undefined => {
      if (!packId) return undefined;
      return packMap.get(packId) ?? packMap.get(packId.trim().toLowerCase());
    },
    [packMap]
  );

  const filteredPacks = useMemo(() => {
    if (packCategory === 'all') return packs;
    if (packCategory === 'bundles') return packs.filter(isBundlePack);
    return packs.filter((p) => !isBundlePack(p));
  }, [packs, packCategory]);

  const dateScopedOrders = useMemo(() => {
    if (datePreset === 'ALL') return orders;

    let minMs: number | null = null;
    let maxMs: number | null = null;

    if (datePreset === '7D') {
      minMs = anchorMs > 0 ? anchorMs - 7 * 24 * 60 * 60 * 1000 : null;
    } else if (datePreset === '30D') {
      minMs = anchorMs > 0 ? anchorMs - 30 * 24 * 60 * 60 * 1000 : null;
    } else {
      if (customStartDate) {
        const start = new Date(`${customStartDate}T00:00:00`);
        if (!Number.isNaN(start.getTime())) minMs = start.getTime();
      }
      if (customEndDate) {
        const end = new Date(`${customEndDate}T23:59:59.999`);
        if (!Number.isNaN(end.getTime())) maxMs = end.getTime();
      }
    }

    return orders.filter((order) => {
      const ts = new Date(order.createdAt).getTime();
      if (Number.isNaN(ts)) return false;
      if (minMs !== null && ts < minMs) return false;
      if (maxMs !== null && ts > maxMs) return false;
      return true;
    });
  }, [orders, datePreset, anchorMs, customStartDate, customEndDate]);

  const kpis = useMemo(() => {
    let grossRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let totalGemsIssued = 0;

    for (const order of dateScopedOrders) {
      if (order.status === 'PAID') {
        paidCount += 1;
        grossRevenue += order.amount || 0;
        const pack = resolvePack(order.packId);
        totalGemsIssued += pack?.gemsAmount ?? 0;
      } else if (order.status === 'PENDING') {
        pendingCount += 1;
      } else {
        cancelledCount += 1;
      }
    }

    const totalOrders = dateScopedOrders.length;
    const avgOrderValue = paidCount > 0 ? grossRevenue / paidCount : 0;
    const conversionRate = totalOrders > 0 ? (paidCount / totalOrders) * 100 : 0;
    const availablePacksCount = packs.filter((p) => p.isAvailable).length;

    return {
      grossRevenue,
      paidCount,
      pendingCount,
      cancelledCount,
      totalOrders,
      avgOrderValue,
      conversionRate,
      totalGemsIssued,
      availablePacksCount,
    };
  }, [dateScopedOrders, packs, resolvePack]);

  const dailyChartData = useMemo<ChartPoint[]>(() => {
    const byDay = new Map<string, ChartPoint>();
    for (const order of dateScopedOrders) {
      const key = toDayKey(order.createdAt);
      if (!key) continue;
      const current = byDay.get(key) ?? {
        label: key,
        revenue: 0,
        paidCount: 0,
        totalCount: 0,
      };
      current.totalCount += 1;
      if (order.status === 'PAID') {
        current.paidCount += 1;
        current.revenue += order.amount || 0;
      }
      byDay.set(key, current);
    }
    return Array.from(byDay.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [dateScopedOrders]);

  const packChartData = useMemo<ChartPoint[]>(() => {
    const byPack = new Map<string, ChartPoint>();
    for (const order of dateScopedOrders) {
      const packName = resolvePack(order.packId)?.name || order.packId || 'Unknown Pack';
      const current = byPack.get(packName) ?? {
        label: packName,
        revenue: 0,
        paidCount: 0,
        totalCount: 0,
      };
      current.totalCount += 1;
      if (order.status === 'PAID') {
        current.paidCount += 1;
        current.revenue += order.amount || 0;
      }
      byPack.set(packName, current);
    }
    return Array.from(byPack.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [dateScopedOrders, resolvePack]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = dateScopedOrders.filter((order) => {
      if (orderStatusFilter !== 'ALL' && order.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      const username = (playerNames[order.playerId] || '').toLowerCase();
      const packName = (resolvePack(order.packId)?.name || '').toLowerCase();
      return (
        String(order.orderCode).toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.playerId.toLowerCase().includes(q) ||
        order.packId.toLowerCase().includes(q) ||
        username.includes(q) ||
        packName.includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'HIGHEST_AMOUNT') {
        return (b.amount || 0) - (a.amount || 0);
      }
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return sortBy === 'OLDEST' ? ta - tb : tb - ta;
    });
  }, [dateScopedOrders, orderStatusFilter, searchQuery, sortBy, playerNames, resolvePack]);

  const displayedOrders = useMemo(() => {
    if (rowLimit === 'ALL') return filteredOrders;
    return filteredOrders.slice(0, Number(rowLimit));
  }, [filteredOrders, rowLimit]);

  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      showNotice('No matching orders to export.', 'error');
      return;
    }
    const csvContent = buildOrdersCsv(filteredOrders, packMap, playerNames);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `pactkeeper-payos-orders-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    void recordAuditEvent({
      action: 'PAYMENT_LEDGER_EXPORTED',
      category: 'PAYMENT',
      severity: 'MEDIUM',
      targetType: 'PayOSLedger',
      targetLabel: `${filteredOrders.length} orders CSV`,
      afterState: { datePreset, orderStatusFilter, rowCount: filteredOrders.length },
    });
    showNotice(`Exported ${filteredOrders.length} orders to CSV.`);
  };

  const chartPalette = useMemo(
    () => ({
      stroke: isDark ? '#f2bf4e' : '#966100',
      fillStop: isDark ? '#f59e0b' : '#b7791f',
      bar: isDark ? '#34d399' : '#059669',
      grid: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.10)',
      axis: isDark ? '#94a3b8' : '#475569',
    }),
    [isDark],
  );

  const orderColumns: TableColumn<OrderTableRow>[] = [
    {
      key: 'orderCode',
      header: 'Order Code',
      width: proportional(1.4, { minWidth: 165 }),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        const orderCodeStr = String(order.orderCode);
        const isCopied = copiedKey === `code-${order.id}`;
        return (
          <VStack gap={0.5}>
            <HStack gap={1} vAlign="center">
              <Text type="code" weight="bold">
                #{orderCodeStr}
              </Text>
              <IconButton
                icon={isCopied ? <Check size={12} /> : <Copy size={12} />}
                label={`Copy order code ${orderCodeStr}`}
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(`code-${order.id}`, orderCodeStr, 'order code')}
              />
            </HStack>
            <Text type="code" size="xsm" color="secondary" maxLines={1}>
              {order.id}
            </Text>
          </VStack>
        );
      },
    },
    {
      key: 'player',
      header: 'Player',
      width: proportional(1.5, { minWidth: 190 }),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        const username = playerNames[order.playerId];
        const isCopied = copiedKey === `player-${order.id}`;
        return (
          <VStack gap={0.5}>
            <Text weight="medium" size="sm" maxLines={1}>
              {username || 'Unknown Account'}
            </Text>
            <HStack gap={1} vAlign="center">
              <Text type="code" size="xsm" color="secondary" maxLines={1}>
                {order.playerId}
              </Text>
              <IconButton
                icon={isCopied ? <Check size={12} /> : <Copy size={12} />}
                label={`Copy player ID ${order.playerId}`}
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(`player-${order.id}`, order.playerId, 'player ID')}
              />
            </HStack>
          </VStack>
        );
      },
    },
    {
      key: 'pack',
      header: 'Pack',
      width: proportional(1.3, { minWidth: 170 }),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        const pack = resolvePack(order.packId);
        return (
          <VStack gap={0.5}>
            <Text weight="medium" size="sm" maxLines={1}>
              {pack?.name || order.packId}
            </Text>
            {pack && (
              <Text type="code" size="xsm" color="secondary">
                {pack.gemsAmount.toLocaleString('en-US')} Gems
              </Text>
            )}
          </VStack>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount (VND)',
      width: pixel(155),
      align: 'end',
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        return (
          <Text type="code" weight="bold" hasTabularNumbers>
            {formatVnd(order.amount)}
          </Text>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        const badgeMeta = getOrderStatusBadge(order.status);
        return <Badge label={order.status} variant={badgeMeta.variant} icon={badgeMeta.icon} />;
      },
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: pixel(175),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        return (
          <Text type="code" size="xsm" color="secondary">
            {formatDateTime(order.createdAt)}
          </Text>
        );
      },
    },
    {
      key: 'actions',
      header: 'Receipt',
      width: pixel(135),
      align: 'end',
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        return (
          <Button
            label="Inspect"
            variant="ghost"
            size="sm"
            icon={<Receipt size={14} />}
            onClick={() => setSelectedOrder(order)}
          />
        );
      },
    },
  ];

  const selectedPack = selectedOrder ? resolvePack(selectedOrder.packId) : undefined;
  const selectedSig = selectedOrder
    ? selectedOrder.webhookSignature || selectedOrder.signature || ''
    : '';

  const recentOrdersPreview = useMemo(() => filteredOrders.slice(0, 5), [filteredOrders]);

  const topBanner =
    notice || syncError ? (
      <VStack gap={2}>
        {notice && (
          <Banner
            status={notice.status}
            title={notice.status === 'error' ? 'Treasury Alert' : 'PayOS Ledger Notice'}
            description={notice.text}
            isDismissable
            onDismiss={() => setNotice(null)}
          />
        )}
        {syncError && (
          <Banner
            status="warning"
            title="Partial Telemetry Synchronization"
            description={syncError}
            isDismissable
            onDismiss={() => setSyncError(null)}
          />
        )}
      </VStack>
    ) : undefined;

  return (
    <ConsolePage
      badge="PAYOS GATEWAY & TREASURY"
      badgeVariant="purple"
      icon={<Icon icon={CreditCard} size="lg" color="accent" />}
      meta={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="code" size="xsm" color="secondary">
            VND Settlement &amp; Crystal Catalog
          </Text>
          <Badge
            label={loading ? 'Orders: ...' : `${kpis.paidCount} Paid / ${dateScopedOrders.length}`}
            variant="success"
          />
          <Badge
            label={loading ? 'Revenue: ...' : formatVnd(kpis.grossRevenue)}
            variant="yellow"
          />
        </HStack>
      }
      title="PAYMENT & TOP-UP ADMINISTRATION"
      subtitle="Monitor VND order settlement, revenue trajectories, and storefront crystal availability."
      actions={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button
            label="Open Storefront"
            variant="secondary"
            size="sm"
            icon={<ExternalLink size={14} />}
            href={WEB_TOPUP_URL}
            target="_blank"
            rel="noopener noreferrer"
          />
          <Button
            label={`Export CSV (${filteredOrders.length})`}
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            isDisabled={filteredOrders.length === 0}
            onClick={handleExportCsv}
          />
          <Button
            label={refreshing ? 'Syncing...' : 'Refresh Telemetry'}
            variant="primary"
            size="sm"
            icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
            isLoading={refreshing || loading}
            onClick={() => void handleRefresh()}
          />
        </HStack>
      }
      banner={topBanner}
      toolbar={
        <VStack gap={2}>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <TabList
              value={activeTab}
              onChange={(val) => setActiveTab(val as TreasuryTab)}
              role="tablist"
            >
              <Tab
                value="overview"
                label="Overview & Analytics"
                icon={<Icon icon={BarChart3} />}
              />
              <Tab
                value="ledger"
                label="PayOS Ledger"
                icon={<Icon icon={Receipt} />}
                endContent={<Badge label={filteredOrders.length} variant="info" />}
              />
              <Tab
                value="catalog"
                label="Crystal Storefront"
                icon={<Icon icon={Package} />}
                endContent={<Badge label={packs.length} variant="yellow" />}
              />
            </TabList>

            <HStack gap={2} vAlign="center" wrap="wrap">
              <Icon icon={Calendar} size="sm" color="accent" />
              <SegmentedControl
                label="Timeframe preset"
                size="sm"
                value={datePreset}
                onChange={(val) => setDatePreset(val as DateRangePreset)}
              >
                <SegmentedControlItem value="ALL" label="All Time" />
                <SegmentedControlItem value="7D" label="7D" />
                <SegmentedControlItem value="30D" label="30D" />
                <SegmentedControlItem value="CUSTOM" label="Custom" />
              </SegmentedControl>

              {datePreset === 'CUSTOM' && (
                <HStack gap={1.5} vAlign="center" wrap="wrap">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    aria-label="Filter start date"
                    className={DATE_INPUT_CLASS}
                  />
                  <Text type="supporting" size="xsm">
                    to
                  </Text>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    aria-label="Filter end date"
                    className={DATE_INPUT_CLASS}
                  />
                  {(customStartDate || customEndDate) && (
                    <Button
                      label="Clear"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                    />
                  )}
                </HStack>
              )}
            </HStack>
          </div>

          {activeTab === 'ledger' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="min-w-[230px] flex-1 max-w-sm">
                  <TextInput
                    label="Search transactions"
                    isLabelHidden
                    size="sm"
                    placeholder="Search Order Code, ID, Username, Player, Pack..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    hasClear
                    startIcon={<Search size={14} />}
                  />
                </div>

                <SegmentedControl
                  label="Filter orders by status"
                  size="sm"
                  value={orderStatusFilter}
                  onChange={(val) => setOrderStatusFilter(val as OrderStatusFilter)}
                >
                  <SegmentedControlItem value="ALL" label={`All (${dateScopedOrders.length})`} />
                  <SegmentedControlItem value="PAID" label={`Paid (${kpis.paidCount})`} />
                  <SegmentedControlItem value="PENDING" label={`Pending (${kpis.pendingCount})`} />
                  <SegmentedControlItem
                    value="CANCELLED"
                    label={`Cancelled (${kpis.cancelledCount})`}
                  />
                </SegmentedControl>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <Selector
                    label="Sort orders"
                    isLabelHidden
                    size="sm"
                    options={SORT_OPTIONS}
                    value={sortBy}
                    onChange={(val) => {
                      if (val) setSortBy(val as OrderSortOption);
                    }}
                    startIcon={<ArrowUpDown size={14} />}
                  />
                </div>
                <div className="w-32">
                  <Selector
                    label="Rows limit"
                    isLabelHidden
                    size="sm"
                    options={ROW_LIMIT_OPTIONS}
                    value={rowLimit}
                    onChange={(val) => {
                      if (val) setRowLimit(val as RowLimitOption);
                    }}
                  />
                </div>
                <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                  {displayedOrders.length}/{filteredOrders.length}
                </Text>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
              <SegmentedControl
                label="Filter top-up packs"
                size="sm"
                value={packCategory}
                onChange={(val) => setPackCategory(val as PackCategoryFilter)}
              >
                <SegmentedControlItem value="all" label={`All (${packs.length})`} />
                <SegmentedControlItem
                  value="gems"
                  label={`Crystals (${packs.filter((p) => !isBundlePack(p)).length})`}
                />
                <SegmentedControlItem
                  value="bundles"
                  label={`Bundles (${packs.filter(isBundlePack).length})`}
                />
              </SegmentedControl>

              <HStack gap={3} vAlign="center" wrap="wrap">
                <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                  {kpis.availablePacksCount} of {packs.length} packs active
                </Text>
                {canManagePacks && (
                  <Button
                    label="Create Top-Up Pack"
                    variant="primary"
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={() => void openCreatePackDialog()}
                  />
                )}
              </HStack>
            </div>
          )}
        </VStack>
      }
    >
      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <VStack gap={4}>
          {/* 4 KPI Summary Cards */}
          <Grid columns={{ minWidth: 220, max: 4 }} gap={4}>
            <Card padding={4}>
              <VStack gap={1.5}>
                <HStack justify="between" vAlign="center">
                  <Text type="label" size="xsm" color="secondary">
                    Paid Revenue (VND)
                  </Text>
                  <Icon icon={TrendingUp} size="md" color="success" />
                </HStack>
                <Text type="display-3" weight="bold" hasTabularNumbers>
                  {loading ? '...' : formatVnd(kpis.grossRevenue)}
                </Text>
                <Text type="supporting" size="xsm">
                  {kpis.paidCount} settled orders in range
                </Text>
              </VStack>
            </Card>

            <Card padding={4}>
              <VStack gap={1.5}>
                <HStack justify="between" vAlign="center">
                  <Text type="label" size="xsm" color="secondary">
                    Avg Order Value &amp; Gems
                  </Text>
                  <Icon icon={Gem} size="md" color="info" />
                </HStack>
                <Text type="display-3" weight="bold" hasTabularNumbers>
                  {loading ? '...' : formatVnd(kpis.avgOrderValue)}
                </Text>
                <Text type="supporting" size="xsm">
                  {kpis.totalGemsIssued.toLocaleString('en-US')} gems matched from catalog
                </Text>
              </VStack>
            </Card>

            <Card padding={4}>
              <VStack gap={1.5}>
                <HStack justify="between" vAlign="center">
                  <Text type="label" size="xsm" color="secondary">
                    Settlement Rate
                  </Text>
                  <Icon icon={CheckCircle2} size="md" color="accent" />
                </HStack>
                <Text type="display-3" weight="bold" hasTabularNumbers>
                  {loading ? '...' : `${kpis.conversionRate.toFixed(1)}%`}
                </Text>
                <Text type="supporting" size="xsm">
                  {kpis.pendingCount} pending · {kpis.cancelledCount} cancelled
                </Text>
              </VStack>
            </Card>

            <Card padding={4}>
              <VStack gap={1.5}>
                <HStack justify="between" vAlign="center">
                  <Text type="label" size="xsm" color="secondary">
                    Storefront Catalog
                  </Text>
                  <Icon icon={Package} size="md" color="accent" />
                </HStack>
                <Text type="display-3" weight="bold" hasTabularNumbers>
                  {loading ? '...' : `${kpis.availablePacksCount} / ${packs.length}`}
                </Text>
                <Text type="supporting" size="xsm">
                  Active top-up packs live for purchase
                </Text>
              </VStack>
            </Card>
          </Grid>

          {/* Recharts Revenue Analytics */}
          <Card padding={4}>
            <VStack gap={4}>
              <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                <VStack gap={0.5}>
                  <HStack gap={2} vAlign="center">
                    <Icon icon={BarChart3} size="md" color="accent" />
                    <Heading level={2} className="font-cinzel">
                      Revenue &amp; Pack Performance Analytics
                    </Heading>
                  </HStack>
                  <Text type="supporting" size="xsm">
                    Aggregated strictly from orders marked PAID inside the selected timeframe.
                  </Text>
                </VStack>

                <SegmentedControl
                  label="Chart mode"
                  size="sm"
                  value={chartView}
                  onChange={(val) => setChartView(val as ChartViewMode)}
                >
                  <SegmentedControlItem value="daily" label="Daily Revenue Trend" />
                  <SegmentedControlItem value="packs" label="Top Packs by Revenue" />
                </SegmentedControl>
              </HStack>

              {(chartView === 'daily' ? dailyChartData : packChartData).length === 0 ? (
                <EmptyState
                  isCompact
                  icon={<BarChart3 size={24} />}
                  title={
                    loading
                      ? 'Loading PayOS Revenue Series...'
                      : 'No Transaction Data in Selected Window'
                  }
                  description="Adjust your timeframe filter or refresh PayOS telemetry."
                />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartView === 'daily' ? (
                      <AreaChart
                        data={dailyChartData}
                        margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="payosRevenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartPalette.fillStop} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={chartPalette.fillStop} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                        <XAxis
                          dataKey="label"
                          stroke={chartPalette.axis}
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={chartPalette.axis}
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={formatCompactVnd}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke={chartPalette.stroke}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#payosRevenueFill)"
                        />
                      </AreaChart>
                    ) : (
                      <BarChart
                        data={packChartData}
                        margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                        <XAxis
                          dataKey="label"
                          stroke={chartPalette.axis}
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={chartPalette.axis}
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={formatCompactVnd}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        <Bar dataKey="revenue" fill={chartPalette.bar} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </VStack>
          </Card>

          {/* Compact Recent Orders Preview */}
          <Card padding={4}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <VStack gap={0.5}>
                  <Heading level={3} className="font-cinzel">
                    Recent PayOS Orders
                  </Heading>
                  <Text type="supporting" size="xsm">
                    Showing latest {recentOrdersPreview.length} matching orders.
                  </Text>
                </VStack>
                <Button
                  label={`Open Full Ledger (${filteredOrders.length})`}
                  variant="secondary"
                  size="sm"
                  endContent={<ChevronRight size={14} />}
                  onClick={() => setActiveTab('ledger')}
                />
              </HStack>

              <div className="pk-table-scroll rounded-lg border border-[var(--color-border-subtle)]">
                <Table
                  columns={orderColumns}
                  data={loading ? [] : (recentOrdersPreview as OrderTableRow[])}
                  idKey="id"
                  density="compact"
                  emptyState={
                    <EmptyState
                      isCompact
                      icon={<Receipt size={24} />}
                      title={loading ? 'Synchronizing PayOS...' : 'No Recent PayOS Orders'}
                      description="No transactions matched the active timeframe."
                    />
                  }
                />
              </div>
            </VStack>
          </Card>
        </VStack>
      )}

      {/* TAB 2: FULL PAYOS LEDGER */}
      {activeTab === 'ledger' && (
        <div key="payment-tab-ledger" className="pk-tab-panel">
          <Card padding={0} className="overflow-hidden">
            <div className="pk-scrollable-panel pk-sticky-table">
              <Table
                columns={orderColumns}
                data={loading ? [] : (displayedOrders as OrderTableRow[])}
                idKey="id"
                density="balanced"
                aria-label="PayOS Transaction Ledger"
                emptyState={
                  <EmptyState
                    isCompact
                    icon={<Receipt size={24} />}
                    title={loading ? 'Synchronizing PayOS Transactions...' : 'No PayOS Orders Match Filters'}
                    description={
                      loading
                        ? 'Fetching latest settlement receipts and player mappings.'
                        : 'Try clearing the search query or widening the date range.'
                    }
                  />
                }
              />
            </div>
            <div className="pk-scroll-footer">
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <Text type="supporting" size="sm" color="secondary">
                  Showing {displayedOrders.length} PayOS transaction{displayedOrders.length === 1 ? '' : 's'}
                </Text>
                <Text type="code" size="sm" color="secondary">
                  PayOS Ledger • Live Sync
                </Text>
              </HStack>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: CRYSTAL STOREFRONT CATALOG */}
      {activeTab === 'catalog' && (
        <div key="payment-tab-catalog" className="pk-tab-panel">
          <Card padding={4}>
            {loading ? (
              <EmptyState
                isCompact
                icon={<Package size={24} />}
                title="Synchronizing Storefront Packs..."
                description="Fetching top-up crystal denominations and bundle manifests."
              />
            ) : filteredPacks.length === 0 ? (
              <EmptyState
                isCompact
                icon={<Package size={24} />}
                title="No Top-Up Packs in Category"
                description="Switch categories to inspect other storefront denominations."
              />
            ) : (
              <Grid columns={{ minWidth: 270, max: 3 }} gap={4} className="pk-kpi-strip">
                {filteredPacks.map((pack) => {
                  const bundleItems = [
                    ...(pack.unitNames ?? []).map((n) => `Unit: ${n}`),
                    ...(pack.weaponNames ?? []).map((n) => `Weapon: ${n}`),
                    ...(pack.trinketNames ?? []).map((n) => `Trinket: ${n}`),
                  ];
                  const isToggling = togglingPackId === pack.id;

                  return (
                    <Card
                      key={pack.id}
                      padding={4}
                      variant={pack.isAvailable ? 'default' : 'muted'}
                      className={
                        pack.isAvailable
                          ? 'pk-interactive-card pk-gold-frame pk-spotlight pk-corner-frame'
                          : 'pk-interactive-card pk-spotlight'
                      }
                    >
                      <VStack gap={3}>
                        <HStack justify="between" vAlign="start" gap={3}>
                          <HStack gap={3} vAlign="center" className="min-w-0">
                            <div className="pk-cashier-stage w-16 h-16 rounded-xl flex items-center justify-center shrink-0">
                              <GemArt gemsAmount={pack.gemsAmount} size={46} />
                            </div>
                            <VStack gap={0.5} className="min-w-0">
                            <Text weight="bold" size="sm" maxLines={1}>
                              {pack.name}
                            </Text>
                            <Text type="code" size="xsm" color="secondary">
                              {pack.gemsAmount.toLocaleString('en-US')} Astral Gems
                            </Text>
                            <Text type="code" size="sm" weight="bold" hasTabularNumbers>
                              {formatVnd(pack.priceVnd)}
                            </Text>
                          </VStack>
                        </HStack>

                        <Badge
                          label={pack.isAvailable ? 'Active' : 'Hidden'}
                          variant={pack.isAvailable ? 'success' : 'neutral'}
                        />
                      </HStack>

                      {bundleItems.length > 0 && (
                        <HStack gap={1.5} wrap="wrap">
                          {bundleItems.map((label) => (
                            <Badge key={label} label={label} variant="purple" />
                          ))}
                        </HStack>
                      )}

                      <div className="pt-3 border-t border-[var(--color-border-subtle)]">
                        <HStack justify="between" vAlign="center" gap={2}>
                          <Text type="code" size="xsm" color="secondary" maxLines={1}>
                            ID: {pack.id}
                          </Text>
                          <StackItem size="static">
                            <HStack gap={1.5} vAlign="center">
                              {canManagePacks && (
                                <>
                                  <IconButton
                                    label={`Edit ${pack.name}`}
                                    tooltip="Edit Pack"
                                    variant="secondary"
                                    size="sm"
                                    icon={<Icon icon={Edit2} />}
                                    isDisabled={togglingPackId !== null || deletingPack}
                                    onClick={() => void openEditPackDialog(pack)}
                                  />
                                  <IconButton
                                    label={`Delete ${pack.name}`}
                                    tooltip="Delete Pack"
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon icon={Trash2} color="error" />}
                                    isDisabled={togglingPackId !== null || deletingPack}
                                    onClick={() => {
                                      setDeletePackError(null);
                                      setPendingDeletePack(pack);
                                    }}
                                  />
                                </>
                              )}
                              <Button
                                label={
                                  isToggling
                                    ? 'Updating...'
                                    : pack.isAvailable
                                      ? 'Disable Pack'
                                      : 'Enable Pack'
                                }
                                variant={pack.isAvailable ? 'destructive' : 'secondary'}
                                size="sm"
                                icon={<Power size={13} />}
                                isDisabled={togglingPackId !== null || !canManagePacks}
                                isLoading={isToggling}
                                onClick={() => void togglePackAvailability(pack)}
                              />
                            </HStack>
                          </StackItem>
                        </HStack>
                      </div>
                    </VStack>
                  </Card>
                );
              })}
            </Grid>
          )}
        </Card>
        </div>
      )}

      {/* Receipt & Webhook Audit Modal */}
      <Dialog
        isOpen={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        purpose="info"
        width={540}
        maxHeight="88dvh"
        padding={5}
      >
        {selectedOrder && (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="shrink-0">
              <DialogHeader
                title={`Order #${selectedOrder.orderCode}`}
                subtitle="PayOS Order Receipt & Webhook Audit"
                endContent={
                  <Badge
                    label={selectedOrder.status}
                    variant={getOrderStatusBadge(selectedOrder.status).variant}
                  />
                }
                onOpenChange={() => setSelectedOrder(null)}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>

            <Card padding={4} variant="muted">
              <VStack gap={3}>
                <HStack justify="between" vAlign="center" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Internal Order ID
                  </Text>
                  <Text type="code" size="xsm">
                    {selectedOrder.id}
                  </Text>
                </HStack>

                <HStack justify="between" vAlign="start" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Player Account
                  </Text>
                  <VStack gap={0} className="text-right">
                    <Text weight="semibold" size="sm">
                      {playerNames[selectedOrder.playerId] || 'Username unavailable'}
                    </Text>
                    <Text type="code" size="xsm" color="secondary">
                      {selectedOrder.playerId}
                    </Text>
                  </VStack>
                </HStack>

                <HStack justify="between" vAlign="center" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Top-Up Pack
                  </Text>
                  <Text size="sm" weight="medium">
                    {selectedPack?.name || selectedOrder.packId}
                    {selectedPack
                      ? ` (${selectedPack.gemsAmount.toLocaleString('en-US')} Gems)`
                      : ''}
                  </Text>
                </HStack>

                <HStack justify="between" vAlign="center" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Settlement Amount
                  </Text>
                  <Text type="code" size="base" weight="bold" hasTabularNumbers>
                    {formatVnd(selectedOrder.amount)}
                  </Text>
                </HStack>

                <HStack justify="between" vAlign="center" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Created At
                  </Text>
                  <Text type="code" size="xsm">
                    {formatDateTime(selectedOrder.createdAt)}
                  </Text>
                </HStack>
              </VStack>
            </Card>

            <Card padding={4} variant="muted">
              <VStack gap={2}>
                <HStack justify="between" vAlign="center" gap={3}>
                  <Text type="label" size="xsm" color="secondary">
                    Webhook Settlement
                  </Text>
                  {selectedOrder.status === 'PAID' ? (
                    <HStack gap={1.5} vAlign="center">
                      <Icon icon={ShieldCheck} size="sm" color="success" />
                      <Text type="code" size="xsm" weight="semibold">
                        {selectedSig
                          ? 'PayOS Paid (Signature Recorded)'
                          : 'PayOS Settled (Server Verified)'}
                      </Text>
                    </HStack>
                  ) : selectedOrder.status === 'PENDING' ? (
                    <HStack gap={1.5} vAlign="center">
                      <Icon icon={Clock} size="sm" color="warning" />
                      <Text type="code" size="xsm" weight="semibold">
                        Awaiting PayOS Callback
                      </Text>
                    </HStack>
                  ) : (
                    <HStack gap={1.5} vAlign="center">
                      <Icon icon={ShieldAlert} size="sm" color="error" />
                      <Text type="code" size="xsm" weight="semibold">
                        Cancelled / Unsettled
                      </Text>
                    </HStack>
                  )}
                </HStack>

                {selectedSig && (
                  <HStack justify="between" vAlign="center" gap={2}>
                    <Text type="code" size="xsm" color="secondary" maxLines={1}>
                      {selectedSig}
                    </Text>
                    <StackItem size="static">
                      <Button
                        label={copiedKey === 'modal-sig' ? 'Copied' : 'Copy'}
                        variant="ghost"
                        size="sm"
                        icon={
                          copiedKey === 'modal-sig' ? (
                            <Check size={13} />
                          ) : (
                            <Copy size={13} />
                          )
                        }
                        onClick={() =>
                          handleCopy('modal-sig', selectedSig, 'webhook signature')
                        }
                      />
                    </StackItem>
                  </HStack>
                )}
              </VStack>
            </Card>
              </VStack>
            </div>

            <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Inspect Player"
                    variant="secondary"
                    size="md"
                    icon={<UserCheck size={14} />}
                    onClick={() => {
                      const targetPlayerId = selectedOrder.playerId;
                      setSelectedOrder(null);
                      navigate(`/players?search=${encodeURIComponent(targetPlayerId)}`);
                    }}
                  />
                  {selectedOrder.status === 'PENDING' && (
                    <>
                      <Button
                        label="Sync PayOS"
                        variant="secondary"
                        size="md"
                        icon={<RefreshCw size={14} />}
                        isLoading={orderActionLoading === 'sync'}
                        isDisabled={orderActionLoading !== null}
                        onClick={() => void handleSyncOrder(selectedOrder)}
                      />
                      {canManagePacks && (
                        <Button
                          label="Cancel Order"
                          variant="destructive"
                          size="md"
                          icon={<XCircle size={14} />}
                          isLoading={orderActionLoading === 'cancel'}
                          isDisabled={orderActionLoading !== null}
                          onClick={() => void handleCancelPendingOrder(selectedOrder)}
                        />
                      )}
                    </>
                  )}
                </HStack>
                <Button
                  label="Close"
                  variant="primary"
                  size="md"
                  onClick={() => setSelectedOrder(null)}
                />
              </HStack>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create / Edit Top-Up Pack Dialog */}
      <Dialog
        isOpen={isPackModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingPack) {
            setIsPackModalOpen(false);
            setEditingPack(null);
            setPackModalError(null);
          }
        }}
        purpose="form"
        width={620}
        maxHeight="88dvh"
        padding={5}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <DialogHeader
              title={editingPack ? `EDIT TOP-UP PACK — ${editingPack.name}` : 'CREATE TOP-UP PACK'}
              subtitle={
                editingPack
                  ? `Modify pack pricing, crystal amount, availability, or bundle items via PUT /api/topuppack/${editingPack.id}`
                  : 'Register a new crystal denomination or hero/equipment bundle via POST /api/topuppack'
              }
              startContent={<Icon icon={Package} size="md" color="accent" />}
              onOpenChange={(open) => {
                if (!open && !savingPack) {
                  setIsPackModalOpen(false);
                  setEditingPack(null);
                  setPackModalError(null);
                }
              }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={4}>
              {packModalError && (
                <Banner
                  status="error"
                  title={editingPack ? 'Update Failed' : 'Creation Failed'}
                  description={packModalError}
                />
              )}

              <TextInput
                label="Pack Name"
                isRequired
                value={packName}
                onChange={setPackName}
                placeholder="e.g. Astral Starter Chest / 980 Astral Gems"
                width="100%"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberInput
                  label="Price (VND)"
                  value={packPriceVnd}
                  onChange={setPackPriceVnd}
                  min={1000}
                  step={10000}
                  isIntegerOnly
                  hasNumberSteppers
                  units="VND"
                  width="100%"
                />
                <NumberInput
                  label="Astral Gems Amount"
                  value={packGemsAmount}
                  onChange={setPackGemsAmount}
                  min={0}
                  step={60}
                  isIntegerOnly
                  hasNumberSteppers
                  units="Gems"
                  width="100%"
                />
              </div>

              <CheckboxInput
                label="Available on Storefront (Active)"
                description="Uncheck to keep this package saved in the catalog as Hidden."
                value={packIsAvailable}
                onChange={setPackIsAvailable}
              />

              <Card variant="muted" padding={3}>
                <VStack gap={3}>
                  <HStack justify="between" vAlign="center">
                    <Text type="label" size="xsm" color="secondary">
                      OPTIONAL BUNDLE ATTACHMENTS
                    </Text>
                    <Badge
                      label={`${selectedUnitIds.length + selectedWeaponIds.length + selectedTrinketIds.length} Selected`}
                      variant="info"
                    />
                  </HStack>

                  {loadingCatalogItems ? (
                    <Text type="supporting" size="xsm">
                      Loading Units, Weapons &amp; Trinkets from CMS...
                    </Text>
                  ) : (
                    <div className="max-h-52 overflow-y-auto pr-1 flex flex-col gap-3">
                      {catalogUnits.length > 0 && (
                        <VStack gap={1}>
                          <Text type="code" size="xsm" color="secondary">
                            Units ({catalogUnits.length})
                          </Text>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {catalogUnits.map((u) => {
                              const checked = selectedUnitIds.includes(u.uId);
                              return (
                                <CheckboxInput
                                  key={u.uId}
                                  label={`${u.unitName || u.name || 'Unit'} (#${u.uId})`}
                                  value={checked}
                                  onChange={(next) =>
                                    setSelectedUnitIds((prev) =>
                                      next ? [...prev, u.uId] : prev.filter((id) => id !== u.uId),
                                    )
                                  }
                                />
                              );
                            })}
                          </div>
                        </VStack>
                      )}

                      {catalogWeapons.length > 0 && (
                        <VStack gap={1}>
                          <Text type="code" size="xsm" color="secondary">
                            Weapons ({catalogWeapons.length})
                          </Text>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {catalogWeapons.map((w) => {
                              const checked = selectedWeaponIds.includes(w.weaponId);
                              return (
                                <CheckboxInput
                                  key={w.weaponId}
                                  label={`${w.name} (#${w.weaponId})`}
                                  value={checked}
                                  onChange={(next) =>
                                    setSelectedWeaponIds((prev) =>
                                      next
                                        ? [...prev, w.weaponId]
                                        : prev.filter((id) => id !== w.weaponId),
                                    )
                                  }
                                />
                              );
                            })}
                          </div>
                        </VStack>
                      )}

                      {catalogTrinkets.length > 0 && (
                        <VStack gap={1}>
                          <Text type="code" size="xsm" color="secondary">
                            Trinkets ({catalogTrinkets.length})
                          </Text>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {catalogTrinkets.map((t) => {
                              const checked = selectedTrinketIds.includes(t.trinketId);
                              return (
                                <CheckboxInput
                                  key={t.trinketId}
                                  label={`${t.name} (#${t.trinketId})`}
                                  value={checked}
                                  onChange={(next) =>
                                    setSelectedTrinketIds((prev) =>
                                      next
                                        ? [...prev, t.trinketId]
                                        : prev.filter((id) => id !== t.trinketId),
                                    )
                                  }
                                />
                              );
                            })}
                          </div>
                        </VStack>
                      )}
                    </div>
                  )}
                </VStack>
              </Card>
            </VStack>
          </div>

          <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
            <HStack gap={2} hAlign="end">
              <Button
                variant="secondary"
                label="Cancel"
                isDisabled={savingPack}
                onClick={() => {
                  setIsPackModalOpen(false);
                  setEditingPack(null);
                  setPackModalError(null);
                }}
              />
              <Button
                variant="primary"
                label={editingPack ? 'Save Pack Changes' : 'Create Pack'}
                icon={editingPack ? <Edit2 size={14} /> : <Plus size={14} />}
                isLoading={savingPack}
                onClick={() => void handleSavePack()}
              />
            </HStack>
          </div>
        </div>
      </Dialog>

      {/* Delete Top-Up Pack Confirmation */}
      <SensitiveActionModal
        isOpen={pendingDeletePack !== null}
        title={`Delete Top-Up Pack — ${pendingDeletePack?.name ?? ''}`}
        description="Permanently removes this top-up package from the storefront catalog via DELETE /api/topuppack/{id}. Historical payment orders keep their recorded amounts."
        severity="CRITICAL"
        actionLabel="Delete Pack"
        targetSummary={
          pendingDeletePack
            ? `${pendingDeletePack.name} (${formatVnd(pendingDeletePack.priceVnd)} • ${pendingDeletePack.gemsAmount} Gems)`
            : undefined
        }
        requireKeyword="DELETE"
        loading={deletingPack}
        error={deletePackError}
        onCancel={() => {
          if (!deletingPack) {
            setPendingDeletePack(null);
            setDeletePackError(null);
          }
        }}
        onConfirm={executeDeletePack}
      />
    </ConsolePage>
  );
};
