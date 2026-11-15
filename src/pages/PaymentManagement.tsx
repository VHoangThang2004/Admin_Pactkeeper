import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  X,
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
import { adminClient } from '../api/adminClient';
import { GemArt } from '../components/GemArt';
import { WEB_TOPUP_URL } from '../constants/links';
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
  // Prefix spreadsheet formula triggers to neutralize CSV injection when opened in Excel.
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function buildOrdersCsv(
  orders: PurchaseOrder[],
  packMap: Map<string, TopUpPackDto>,
  playerNames: Record<string, string>
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

const RevenueTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="hy-glass rounded-xl border border-amber-400/30 px-3.5 py-2.5 text-xs shadow-xl">
      <div className="font-semibold text-amber-200 mb-1">{label || point.label}</div>
      <div className="text-slate-200">
        Paid Revenue:{' '}
        <span className="font-mono font-bold text-emerald-300">
          {formatVnd(point.revenue)}
        </span>
      </div>
      <div className="text-slate-400 mt-0.5">
        Paid Orders: <span className="text-slate-100 font-medium">{point.paidCount}</span> /{' '}
        {point.totalCount} total
      </div>
    </div>
  );
};

export const PaymentManagement: React.FC = () => {
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
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

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
            : null
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
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const showToast = (text: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToastMessage({ text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3500);
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
          : null
      );
      showToast('PayOS ledger and pack catalog refreshed.');
    } catch {
      setSyncError('Failed to refresh PayOS telemetry.');
      showToast('Refresh failed. Check API connectivity.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopy = (key: string, value: string, label: string) => {
    if (!navigator.clipboard) {
      showToast('Clipboard access is unavailable in this browser context.', 'error');
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => {
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        setCopiedKey(key);
        showToast(`Copied ${label} to clipboard.`);
        copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1800);
      })
      .catch(() => {
        showToast('Failed to copy text to clipboard.', 'error');
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
      setPacks((prev) =>
        prev.map((item) =>
          item.id === pack.id ? { ...item, isAvailable: nextState } : item
        )
      );
      showToast(
        `${pack.name} is now ${nextState ? 'available on storefront' : 'hidden from storefront'}.`
      );
    } catch {
      showToast(`Failed to update availability for ${pack.name}.`, 'error');
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
      showToast('No matching orders to export.', 'error');
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
    showToast(`Exported ${filteredOrders.length} orders to CSV.`);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
            toastMessage.tone === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
              : 'bg-slate-900/95 border-amber-400/40 text-amber-100'
          }`}
        >
          {toastMessage.tone === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-100"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Top Actions */}
      <div className="hy-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-300/90">
              PayOS Gateway &amp; Economy Treasury
            </span>
          </div>
          <h1 className="text-2xl font-bold hy-gold-text mt-1">
            Payment &amp; Top-Up Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor VND order settlement, revenue trajectories, and storefront crystal availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={WEB_TOPUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hy-btn-glass px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
            Open Player Storefront
          </a>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredOrders.length === 0}
            className="hy-btn-glass px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-emerald-300" />
            Export CSV ({filteredOrders.length})
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="hy-btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Partial Sync / Error Warning */}
      {syncError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Global Date Scope Bar */}
      <div className="hy-glass rounded-2xl border border-white/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Telemetry Timeframe:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ALL', label: 'All Time' },
              { id: '7D', label: 'Last 7 Days' },
              { id: '30D', label: 'Last 30 Days' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                datePreset === preset.id
                  ? 'hy-tab-active'
                  : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {datePreset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-white/10">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                aria-label="Filter start date"
                className="bg-slate-950/80 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400/60"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                aria-label="Filter end date"
                className="bg-slate-950/80 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400/60"
              />
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-xs text-slate-400 hover:text-amber-300 px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="hy-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Paid Revenue (VND)
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 font-mono mt-2">
            {loading ? '...' : formatVnd(kpis.grossRevenue)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {kpis.paidCount} settled orders in range
          </div>
        </div>

        <div className="hy-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avg Order Value &amp; Gems
            </span>
            <Gem className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-200 font-mono mt-2">
            {loading ? '...' : formatVnd(kpis.avgOrderValue)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {kpis.totalGemsIssued.toLocaleString('en-US')} gems delivered to accounts
          </div>
        </div>

        <div className="hy-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Settlement Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-200 font-mono mt-2">
            {loading ? '...' : `${kpis.conversionRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {kpis.pendingCount} pending · {kpis.cancelledCount} cancelled
          </div>
        </div>

        <div className="hy-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Storefront Catalog
            </span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-200 font-mono mt-2">
            {loading ? '...' : `${kpis.availablePacksCount} / ${packs.length}`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Active top-up packs live for purchase
          </div>
        </div>
      </div>

      {/* Recharts Revenue Analytics */}
      <div className="hy-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Revenue &amp; Pack Performance Analytics
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated strictly from orders marked PAID inside the selected timeframe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChartView('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartView === 'daily'
                  ? 'hy-tab-active'
                  : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              Daily Revenue Trend
            </button>
            <button
              type="button"
              onClick={() => setChartView('packs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartView === 'packs'
                  ? 'hy-tab-active'
                  : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              Top Packs by Revenue
            </button>
          </div>
        </div>

        {(chartView === 'daily' ? dailyChartData : packChartData).length === 0 ? (
          <div className="h-56 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-sm text-slate-500">
            {loading
              ? 'Loading PayOS revenue series...'
              : 'No transaction data falls within the selected timeframe.'}
          </div>
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
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={formatCompactVnd}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#fbbf24"
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={formatCompactVnd}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" fill="#34d399" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Storefront Packs Catalog */}
      <div className="hy-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Top-Up Packs &amp; Bundles Catalog
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Toggle availability directly via{' '}
              <code className="text-amber-300">PATCH /topuppack/&#123;id&#125;/availability</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { id: 'all', label: `All (${packs.length})` },
                {
                  id: 'gems',
                  label: `Crystals (${packs.filter((p) => !isBundlePack(p)).length})`,
                },
                {
                  id: 'bundles',
                  label: `Bundles & Passes (${packs.filter(isBundlePack).length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPackCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  packCategory === tab.id
                    ? 'hy-tab-active'
                    : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Synchronizing storefront packs...
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-white/10 rounded-xl">
            No top-up packs in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPacks.map((pack) => {
              const bundleItems = [
                ...(pack.unitNames ?? []).map((n) => `Unit: ${n}`),
                ...(pack.weaponNames ?? []).map((n) => `Weapon: ${n}`),
                ...(pack.trinketNames ?? []).map((n) => `Trinket: ${n}`),
              ];
              const isToggling = togglingPackId === pack.id;

              return (
                <div
                  key={pack.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                    pack.isAvailable
                      ? 'bg-slate-900/60 border-amber-400/25'
                      : 'bg-slate-950/70 border-white/10 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-center shrink-0">
                        <GemArt gemsAmount={pack.gemsAmount} size={46} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-100">{pack.name}</div>
                        <div className="text-xs text-cyan-300 font-semibold mt-0.5">
                          {pack.gemsAmount.toLocaleString('en-US')} Astral Gems
                        </div>
                        <div className="text-xs font-mono text-amber-300 mt-0.5">
                          {formatVnd(pack.priceVnd)}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        pack.isAvailable
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}
                    >
                      {pack.isAvailable ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  {bundleItems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {bundleItems.map((label) => (
                        <span
                          key={label}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/30 text-purple-200"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500 truncate">
                      ID: {pack.id}
                    </span>
                    <button
                      type="button"
                      disabled={togglingPackId !== null}
                      onClick={() => togglePackAvailability(pack)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                        pack.isAvailable
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {isToggling
                        ? 'Updating...'
                        : pack.isAvailable
                        ? 'Disable Pack'
                        : 'Enable Pack'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions Ledger */}
      <div className="hy-card p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">PayOS Transaction Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {displayedOrders.length} of {filteredOrders.length} matching orders (
              {dateScopedOrders.length} inside active date filter).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'ALL', label: `All (${dateScopedOrders.length})` },
                { id: 'PAID', label: `Paid (${kpis.paidCount})` },
                { id: 'PENDING', label: `Pending (${kpis.pendingCount})` },
                { id: 'CANCELLED', label: `Cancelled (${kpis.cancelledCount})` },
              ] as const
            ).map((statusTab) => (
              <button
                key={statusTab.id}
                type="button"
                onClick={() => setOrderStatusFilter(statusTab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  orderStatusFilter === statusTab.id
                    ? 'hy-tab-active'
                    : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:text-slate-200'
                }`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search / Sort / Row Limit Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order Code, Order ID, Username, Player ID, or Pack..."
              className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as OrderSortOption)}
                aria-label="Sort orders"
                className="bg-transparent text-slate-200 focus:outline-none"
              >
                <option value="NEWEST" className="bg-slate-900">
                  Newest First
                </option>
                <option value="OLDEST" className="bg-slate-900">
                  Oldest First
                </option>
                <option value="HIGHEST_AMOUNT" className="bg-slate-900">
                  Highest VND Amount
                </option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300">
              <span className="text-slate-400">Show:</span>
              <select
                value={rowLimit}
                onChange={(e) => setRowLimit(e.target.value as RowLimitOption)}
                aria-label="Row limit"
                className="bg-transparent text-slate-200 focus:outline-none"
              >
                <option value="25" className="bg-slate-900">
                  25
                </option>
                <option value="50" className="bg-slate-900">
                  50
                </option>
                <option value="100" className="bg-slate-900">
                  100
                </option>
                <option value="ALL" className="bg-slate-900">
                  All
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/70 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Order Code</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Pack</th>
                <th className="py-3 px-4">Amount (VND)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Synchronizing PayOS transactions...
                  </td>
                </tr>
              ) : displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No PayOS orders match your active filters.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const pack = packMap.get(order.packId);
                  const username = playerNames[order.playerId];
                  const orderCodeStr = String(order.orderCode);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-amber-300 font-semibold">
                          <span>#{orderCodeStr}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(`code-${order.id}`, orderCodeStr, 'order code')
                            }
                            className="text-slate-500 hover:text-amber-300"
                            aria-label={`Copy order code ${orderCodeStr}`}
                          >
                            {copiedKey === `code-${order.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-[160px]">
                          {order.id}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-100 font-medium">
                          {username || 'Unknown Account'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                          <span className="truncate max-w-[150px]">{order.playerId}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `player-${order.id}`,
                                order.playerId,
                                'player ID'
                              )
                            }
                            className="text-slate-500 hover:text-amber-300"
                            aria-label={`Copy player ID ${order.playerId}`}
                          >
                            {copiedKey === `player-${order.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">
                          {pack?.name || order.packId}
                        </div>
                        {pack && (
                          <div className="text-[11px] text-cyan-300">
                            {pack.gemsAmount.toLocaleString('en-US')} Gems
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                        {formatVnd(order.amount)}
                      </td>

                      <td className="py-3 px-4">
                        {order.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            PAID
                          </span>
                        ) : order.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            PENDING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            CANCELLED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="hy-btn-glass px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5 text-amber-300" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen 32: Receipt & Webhook Audit Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="hy-glass w-full max-w-lg rounded-2xl border border-amber-400/30 p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                  PayOS Order Receipt
                </div>
                <h3 className="text-xl font-bold text-slate-100 font-mono mt-1">
                  Order #{selectedOrder.orderCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/10"
                aria-label="Close receipt modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Internal Order ID:</span>
                <span className="font-mono text-xs text-slate-200 break-all text-right">
                  {selectedOrder.id}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Player Account:</span>
                <div className="text-right">
                  <div className="text-slate-100 font-semibold">
                    {playerNames[selectedOrder.playerId] || 'Username unavailable'}
                  </div>
                  <div className="font-mono text-xs text-slate-400">
                    {selectedOrder.playerId}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Top-Up Pack:</span>
                <span className="text-slate-100 font-medium text-right">
                  {packMap.get(selectedOrder.packId)?.name || selectedOrder.packId}
                  {packMap.get(selectedOrder.packId) && (
                    <span className="text-cyan-300 text-xs ml-2">
                      ({packMap.get(selectedOrder.packId)!.gemsAmount.toLocaleString('en-US')}{' '}
                      Gems)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Settlement Amount:</span>
                <span className="font-mono font-bold text-amber-300 text-base">
                  {formatVnd(selectedOrder.amount)}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Payment Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    selectedOrder.status === 'PAID'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : selectedOrder.status === 'PENDING'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {selectedOrder.status}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Created At:</span>
                <span className="text-slate-200 text-xs">
                  {formatDateTime(selectedOrder.createdAt)}
                </span>
              </div>

              {/* Status-accurate Webhook Audit Row */}
              <div className="pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-slate-400">Webhook Settlement:</span>
                  {selectedOrder.status === 'PAID' ? (
                    <span className="font-mono text-emerald-300 font-semibold text-xs flex items-center gap-1.5 text-right">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      {selectedOrder.webhookSignature || selectedOrder.signature
                        ? 'PayOS Paid (Signature Recorded)'
                        : 'PayOS Settled (Server Verified)'}
                    </span>
                  ) : selectedOrder.status === 'PENDING' ? (
                    <span className="font-mono text-amber-300 font-semibold text-xs flex items-center gap-1.5 text-right">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      Awaiting PayOS Callback
                    </span>
                  ) : (
                    <span className="font-mono text-rose-300 font-semibold text-xs flex items-center gap-1.5 text-right">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      Cancelled / Unsettled
                    </span>
                  )}
                </div>

                {(selectedOrder.webhookSignature || selectedOrder.signature) && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-300 truncate">
                      {selectedOrder.webhookSignature || selectedOrder.signature}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          'modal-sig',
                          selectedOrder.webhookSignature || selectedOrder.signature || '',
                          'webhook signature'
                        )
                      }
                      className="text-xs text-amber-300 hover:text-amber-200 shrink-0"
                    >
                      {copiedKey === 'modal-sig' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="hy-btn-glass px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
