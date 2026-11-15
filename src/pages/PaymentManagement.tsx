import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Gem,
  Package,
  Power,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
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
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Section } from '@astryxdesign/core/Section';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { GemArt } from '../components/GemArt';
import { WEB_TOPUP_URL } from '../constants/links';
import { useThemeMode } from '../hooks/useThemeMode';
import { recordAuditEvent } from '../services/adminSecurityService';
import type { PurchaseOrder, TopUpPackDto } from '../types';

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
export const PaymentManagement: React.FC = () => {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; status: 'success' | 'error' } | null>(
    null,
  );

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
    if (togglingPackId) return;
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

  const packMap = useMemo(() => {
    const map = new Map<string, TopUpPackDto>();
    for (const pack of packs) {
      map.set(pack.id, pack);
    }
    return map;
  }, [packs]);

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
        const pack = packMap.get(order.packId);
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
  }, [dateScopedOrders, packs, packMap]);

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
      const packName = packMap.get(order.packId)?.name || order.packId || 'Unknown Pack';
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
  }, [dateScopedOrders, packMap]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = dateScopedOrders.filter((order) => {
      if (orderStatusFilter !== 'ALL' && order.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      const username = (playerNames[order.playerId] || '').toLowerCase();
      const packName = (packMap.get(order.packId)?.name || '').toLowerCase();
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
  }, [dateScopedOrders, orderStatusFilter, searchQuery, sortBy, playerNames, packMap]);

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
      width: proportional(1.4),
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
      width: proportional(1.5),
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
      width: proportional(1.3),
      renderCell: (row) => {
        const order = row as unknown as PurchaseOrder;
        const pack = packMap.get(order.packId);
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
      width: pixel(135),
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
      width: pixel(150),
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
      width: pixel(110),
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

  const selectedPack = selectedOrder ? packMap.get(selectedOrder.packId) : undefined;
  const selectedSig = selectedOrder
    ? selectedOrder.webhookSignature || selectedOrder.signature || ''
    : '';

  return (
    <VStack gap={5}>
      {notice && (
        <Banner
          status={notice.status}
          title={notice.status === 'error' ? 'Treasury Alert' : 'PayOS Ledger Notice'}
          description={notice.text}
          isDismissable
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Header & Top Actions */}
      <Section padding={5}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge label="PAYOS GATEWAY & TREASURY" variant="purple" />
              <Text type="code" size="xsm" color="secondary">
                VND Settlement &amp; Crystal Catalog
              </Text>
            </HStack>
            <HStack gap={2} vAlign="center">
              <Icon icon={CreditCard} size="lg" color="accent" />
              <Heading level={1} type="display-2" className="font-cinzel pk-gold-text">
                PAYMENT &amp; TOP-UP ADMINISTRATION
              </Heading>
            </HStack>
            <Text type="supporting" size="sm">
              Monitor VND order settlement, revenue trajectories, and storefront crystal availability.
            </Text>
          </VStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button
              label="Open Storefront"
              variant="secondary"
              size="md"
              icon={<ExternalLink size={14} />}
              href={WEB_TOPUP_URL}
              target="_blank"
              rel="noopener noreferrer"
            />
            <Button
              label={`Export CSV (${filteredOrders.length})`}
              variant="secondary"
              size="md"
              icon={<Download size={14} />}
              isDisabled={filteredOrders.length === 0}
              onClick={handleExportCsv}
            />
            <Button
              label={refreshing ? 'Syncing...' : 'Refresh Telemetry'}
              variant="primary"
              size="md"
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              isLoading={refreshing || loading}
              onClick={() => void handleRefresh()}
            />
          </HStack>
        </HStack>
      </Section>

      {syncError && (
        <Banner
          status="warning"
          title="Partial Telemetry Synchronization"
          description={syncError}
          isDismissable
          onDismiss={() => setSyncError(null)}
        />
      )}

      {/* Global Date Scope Bar */}
      <Section padding={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={2} vAlign="center">
            <Icon icon={Calendar} size="sm" color="accent" />
            <Text type="label" size="sm" weight="semibold">
              Telemetry Timeframe
            </Text>
          </HStack>

          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Timeframe preset"
              value={datePreset}
              onChange={(val) => setDatePreset(val as DateRangePreset)}
            >
              <SegmentedControlItem value="ALL" label="All Time" />
              <SegmentedControlItem value="7D" label="Last 7 Days" />
              <SegmentedControlItem value="30D" label="Last 30 Days" />
              <SegmentedControlItem value="CUSTOM" label="Custom Range" />
            </SegmentedControl>

            {datePreset === 'CUSTOM' && (
              <HStack gap={2} vAlign="center" wrap="wrap">
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
        </HStack>
      </Section>

      {/* KPI Summary Cards */}
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
              {kpis.totalGemsIssued.toLocaleString('en-US')} gems delivered to accounts
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
      <Section padding={5}>
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
      </Section>

      {/* Storefront Packs Catalog */}
      <Section padding={5}>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <VStack gap={0.5}>
              <Heading level={2} className="font-cinzel">
                Top-Up Packs &amp; Bundles Catalog
              </Heading>
              <Text type="supporting" size="xsm">
                Toggle storefront availability via PATCH /topuppack/&#123;id&#125;/availability.
              </Text>
            </VStack>

            <SegmentedControl
              label="Filter top-up packs"
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
          </HStack>

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
            <Grid columns={{ minWidth: 270, max: 3 }} gap={4}>
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
                  >
                    <VStack gap={3}>
                      <HStack justify="between" vAlign="start" gap={3}>
                        <HStack gap={3} vAlign="center" className="min-w-0">
                          <div className="w-14 h-14 rounded-[var(--radius-md,10px)] bg-slate-950/90 border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                            <GemArt gemsAmount={pack.gemsAmount} size={44} />
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
                              isDisabled={togglingPackId !== null}
                              isLoading={isToggling}
                              onClick={() => void togglePackAvailability(pack)}
                            />
                          </StackItem>
                        </HStack>
                      </div>
                    </VStack>
                  </Card>
                );
              })}
            </Grid>
          )}
        </VStack>
      </Section>

      {/* Transactions Ledger */}
      <Section padding={5}>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <VStack gap={0.5}>
              <Heading level={2} className="font-cinzel">
                PayOS Transaction Ledger
              </Heading>
              <Text type="supporting" size="xsm">
                Showing {displayedOrders.length} of {filteredOrders.length} matching orders (
                {dateScopedOrders.length} inside active date filter).
              </Text>
            </VStack>

            <SegmentedControl
              label="Filter orders by status"
              value={orderStatusFilter}
              onChange={(val) => setOrderStatusFilter(val as OrderStatusFilter)}
            >
              <SegmentedControlItem value="ALL" label={`All (${dateScopedOrders.length})`} />
              <SegmentedControlItem value="PAID" label={`Paid (${kpis.paidCount})`} />
              <SegmentedControlItem value="PENDING" label={`Pending (${kpis.pendingCount})`} />
              <SegmentedControlItem value="CANCELLED" label={`Cancelled (${kpis.cancelledCount})`} />
            </SegmentedControl>
          </HStack>

          {/* Search, Sort & Limit Controls */}
          <HStack gap={3} wrap="wrap" vAlign="center">
            <div className="flex-1 min-w-[240px]">
              <TextInput
                label="Search transactions"
                isLabelHidden
                size="sm"
                placeholder="Search by Order Code, Order ID, Username, Player ID, or Pack..."
                value={searchQuery}
                onChange={setSearchQuery}
                hasClear
                startIcon={<Search size={14} />}
              />
            </div>

            <div className="w-48">
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

            <div className="w-36">
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
          </HStack>

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
        </VStack>
      </Section>

      {/* Receipt & Webhook Audit Modal */}
      <Dialog
        isOpen={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        purpose="info"
        width={540}
      >
        {selectedOrder && (
          <VStack gap={4}>
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

            <HStack justify="end">
              <Button
                label="Close"
                variant="secondary"
                size="md"
                onClick={() => setSelectedOrder(null)}
              />
            </HStack>
          </VStack>
        )}
      </Dialog>
    </VStack>
  );
};
