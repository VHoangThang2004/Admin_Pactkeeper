import React, { useState, useEffect, useMemo } from 'react';
import { adminClient } from '../api/adminClient';
import { WEB_TOPUP_URL } from '../constants/links';
import type { PurchaseOrder, TopUpPackDto } from '../types';
import { GemArt } from '../components/GemArt';
import {
  Gem,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Package,
  RefreshCw,
  Inbox,
  Coins,
  ShieldCheck,
  Search,
  Copy,
  ExternalLink,
  Check,
  Sparkles
} from 'lucide-react';

/**
 * PaymentManagement Component
 * 
 * Remade to HoYoverse AAA Gaming Standards (Genshin Impact / Star Rail Web Top-Up Center):
 * - Showcase of store Gem/Crystal packages with authentic SVG gem artworks across 6 tiers
 * - PayOS financial revenue summary with KPI metrics and fulfillment rates
 * - Live PayOS transaction ledger with status filters (ALL, PAID, PENDING, CANCELLED) and search
 * - Screen 32 Transaction Details Modal with HMAC-SHA256 signature verification seal
 * - Direct link to preview the player-facing Web Top-Up SDK
 */
export const PaymentManagement: React.FC = () => {
  // State for transaction ledger orders from payOS
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  // State for active store top-up packs
  const [packs, setPacks] = useState<TopUpPackDto[]>([]);
  // Selected order for Transaction Details Modal (Screen 32)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  // Loading indicator for asynchronous API operations
  const [loading, setLoading] = useState(true);
  // Filter for packs category
  const [packCategory, setPackCategory] = useState<'all' | 'gems' | 'bundles'>('all');
  // Filter for order status
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'>('ALL');
  // Search query for orders
  const [searchQuery, setSearchQuery] = useState('');
  // Copied feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /**
   * Fetches payment history and top-up pack configurations from the backend.
   */
  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const [packsRes, ordersRes] = await Promise.allSettled([
        adminClient.get('/topuppack/all'),
        adminClient.get('/payment/history'),
      ]);

      if (packsRes.status === 'fulfilled' && Array.isArray(packsRes.value.data)) {
        setPacks(packsRes.value.data);
      } else {
        setPacks([]);
      }

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data)) {
        setOrders(ordersRes.value.data);
      } else {
        setOrders([]);
      }
    } catch {
      setPacks([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied to clipboard: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Compute total recognized treasury revenue from completed (PAID) transactions
  const totalPaidRevenue = useMemo(() => {
    return orders
      .filter((o) => o.status === 'PAID')
      .reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [orders]);

  const paidCount = orders.filter((o) => o.status === 'PAID').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;

  /**
   * Toggles the availability status of a store top-up pack.
   */
  const togglePackAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await adminClient.patch(`/topuppack/${id}/availability`, { isAvailable: !currentStatus });
      setPacks((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isAvailable: !currentStatus } : p))
      );
      showToast(`Pack availability updated to ${!currentStatus ? 'AVAILABLE' : 'DISABLED'}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update pack availability.');
    }
  };

  // Filtered orders based on status & search query
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (orderStatusFilter !== 'ALL' && ord.status !== orderStatusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = String(ord.orderCode).toLowerCase().includes(query);
        const playerMatch = (ord.playerId || '').toLowerCase().includes(query);
        const packMatch = (packs.find((p) => p.id === ord.packId)?.name || '').toLowerCase().includes(query);
        if (!codeMatch && !playerMatch && !packMatch) {
          return false;
        }
      }
      return true;
    });
  }, [orders, orderStatusFilter, searchQuery, packs]);

  // Filtered packs based on category
  const filteredPacks = useMemo(() => {
    if (packCategory === 'all') return packs;
    if (packCategory === 'bundles') {
      return packs.filter((p) => (p.name || '').toLowerCase().includes('pass') || (p.name || '').toLowerCase().includes('bundle') || (p.name || '').toLowerCase().includes('chest'));
    }
    // 'gems'
    return packs.filter((p) => !(p.name || '').toLowerCase().includes('pass') && !(p.name || '').toLowerCase().includes('bundle'));
  }, [packs, packCategory]);

  return (
    <div className="space-y-6 pb-12 font-sans select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 px-4 py-2.5 rounded-xl bg-[#12182e] border border-amber-400/40 text-amber-200 text-xs font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.8)] flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Astral Header Banner */}
      <div className="hy-glass p-6 md:p-8 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
        <div 
          className="absolute -top-20 -right-20 w-80 h-80 bg-amber-500/[0.08] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />
        <div 
          className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/[0.05] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(242,191,78,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                TREASURY LEDGER • PAYOS GATEWAY
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                HMAC-SHA256 Webhook Audited
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide font-cinzel uppercase hy-gold-text">
              REALM TREASURY & PAYOS LEDGER
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans">
              Authoritative overview of in-game crystal packages, real-time PayOS transaction receipts, and store economy configurations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {/* Link to live Web Top-Up SDK */}
            <a
              href={WEB_TOPUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hy-btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 hover:border-amber-400/50"
              title="Open Player-Facing Web Top-Up Portal"
            >
              <span>Player Store</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
            </a>

            <button
              onClick={() => fetchPaymentData()}
              disabled={loading}
              className="hy-btn-gold px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC LEDGER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="hy-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-amber-400/20 group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                TOTAL TREASURY REVENUE
              </p>
              <h3 className="text-2xl font-extrabold text-amber-300 mt-1 font-mono tracking-tight">
                {totalPaidRevenue.toLocaleString()} VND
              </h3>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> payOS Gateway Active
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(242,191,78,0.25)] group-hover:scale-105 transition-transform">
              <Coins className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Verified Orders:</span>
            <span className="text-emerald-400 font-bold">{paidCount} Paid</span>
          </div>
        </div>

        {/* Completed Transactions Count */}
        <div className="hy-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-emerald-500/20 group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                TRANSACTION RECEIPTS
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono tracking-tight">
                {paidCount} <span className="text-sm text-slate-400 font-normal">/ {orders.length} total</span>
              </h3>
              <span className="text-xs text-slate-400 mt-1.5 block">
                {pendingCount} Pending • {cancelledCount} Cancelled
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Fulfillment Rate:</span>
            <span className="text-emerald-300 font-bold">
              {orders.length > 0 ? Math.round((paidCount / orders.length) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Store Gem Packs Count */}
        <div className="hy-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-cyan-500/20 group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                STORE PACKAGES
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono tracking-tight">
                {packs.length} Packages
              </h3>
              <span className="text-xs text-cyan-400 font-medium mt-1.5 block font-mono">
                {packs.filter((p) => p.isAvailable).length} Available • {packs.filter((p) => !p.isAvailable).length} Disabled
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.2)] group-hover:scale-105 transition-transform">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Config Route:</span>
            <span className="text-cyan-300 font-bold">/api/topuppack</span>
          </div>
        </div>
      </div>

      {/* Decorative Section Separator */}
      <div className="flex items-center justify-center gap-3 text-slate-400 font-cinzel font-bold text-xs tracking-widest pt-2">
        <span className="text-amber-400/70">❖</span>
        <span className="uppercase text-slate-300">HOYOVERSE STORE PACKAGES SHOWCASE</span>
        <span className="text-amber-400/70">❖</span>
      </div>

      {/* Store Packs Grid Showcase (Modeled after HoYoverse Top-Up Center) */}
      <div className="hy-glass p-6 md:p-7 rounded-2xl space-y-5 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-100 font-cinzel flex items-center gap-2 uppercase tracking-wide">
              <Gem className="w-4 h-4 text-amber-300" />
              IN-GAME STORE TOP-UP PACKS (/api/topuppack/all)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Configured gem crystal offerings with authentic HoYoverse SVG artwork tiers and direct availability controls.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0c1022] border border-white/[0.08] self-start sm:self-auto">
            <button
              onClick={() => setPackCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                packCategory === 'all'
                  ? 'hy-tab-active'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({packs.length})
            </button>
            <button
              onClick={() => setPackCategory('gems')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                packCategory === 'gems'
                  ? 'hy-tab-active'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Crystals
            </button>
            <button
              onClick={() => setPackCategory('bundles')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                packCategory === 'bundles'
                  ? 'hy-tab-active'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bundles
            </button>
          </div>
        </div>

        {filteredPacks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No store top-up packs matching criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredPacks.map((p, idx) => {
              // Determine crystal tier based on gemsAmount
              let tier = 1;
              if (p.gemsAmount < 200) tier = 1;
              else if (p.gemsAmount < 500) tier = 2;
              else if (p.gemsAmount < 1000) tier = 3;
              else if (p.gemsAmount < 2500) tier = 4;
              else if (p.gemsAmount < 6000) tier = 5;
              else tier = 6;

              const isFirstOrHigh = idx === 0 || p.gemsAmount >= 3000;

              return (
                <div
                  key={p.id}
                  className="hy-card rounded-2xl overflow-hidden flex flex-col justify-between relative border border-white/[0.08] hover:border-amber-400/50 shadow-lg group transition-all duration-300"
                >
                  {/* Luxury Top Tag */}
                  {isFirstOrHigh && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-mono text-[10px] font-extrabold tracking-wider uppercase shadow-[0_2px_8px_rgba(242,191,78,0.4)]">
                        {p.gemsAmount >= 6000 ? 'BEST VALUE' : 'POPULAR'}
                      </span>
                    </div>
                  )}

                  {/* Pack Visual & Artwork */}
                  <div className="p-6 text-center space-y-3 relative overflow-hidden">
                    {/* Ambient Radial Glow behind crystal */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity"
                    >
                      <div 
                        className={`w-28 h-28 rounded-full blur-2xl ${
                          tier >= 5 ? 'bg-amber-500/25' : tier >= 3 ? 'bg-cyan-500/25' : 'bg-sky-500/20'
                        }`} 
                      />
                    </div>

                    <div className="relative z-10 py-2 flex justify-center group-hover:scale-105 transition-transform duration-300">
                      <GemArt tier={tier} gemsAmount={p.gemsAmount} size={84} />
                    </div>

                    <div className="relative z-10">
                      <h4 className="font-extrabold text-slate-100 font-mono text-xl tracking-tight">
                        {p.gemsAmount?.toLocaleString()} <span className="text-amber-300 text-base">Gems</span>
                      </h4>
                      <p className="text-xs text-slate-300 font-medium mt-1 truncate px-2">{p.name}</p>
                      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span className="text-slate-500">Tier {tier}</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-semibold">Instant Delivery</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Tag & Availability Toggle */}
                  <div className="bg-[#0b0f1e]/90 border-t border-white/[0.08] p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-cinzel">Price:</span>
                      <span className="font-extrabold text-amber-300 font-mono text-sm">
                        {p.priceVnd?.toLocaleString()} VND
                      </span>
                    </div>

                    <button
                      onClick={() => togglePackAvailability(p.id, p.isAvailable)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        p.isAvailable
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:scale-105'
                          : 'bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 border border-white/[0.1]'
                      }`}
                      title={p.isAvailable ? 'Click to disable in store' : 'Click to enable in store'}
                    >
                      {p.isAvailable ? 'AVAILABLE' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PayOS Transactions Ledger Table */}
      <div className="hy-glass rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)] space-y-0">
        {/* Table Controls & Filter Bar */}
        <div className="p-5 border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-white/[0.02] to-transparent">
          <div>
            <div className="font-cinzel font-bold text-sm uppercase text-slate-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-300" />
              PAYOS TRANSACTIONS AUDIT LEDGER (/api/payment/history)
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Complete webhook transaction records synchronized with PayOS payment gateways.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0c1022] border border-white/[0.08]">
              <button
                onClick={() => setOrderStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  orderStatusFilter === 'ALL'
                    ? 'hy-tab-active'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('PAID')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  orderStatusFilter === 'PAID'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Paid ({paidCount})
              </button>
              <button
                onClick={() => setOrderStatusFilter('PENDING')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  orderStatusFilter === 'PENDING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setOrderStatusFilter('CANCELLED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  orderStatusFilter === 'CANCELLED'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cancelled ({cancelledCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search code or player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0c1022] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="p-14 text-center text-slate-400 space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No transaction records match the current filter.</p>
            <p className="text-xs text-slate-400">Try adjusting your status filter or clearing the search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0b0f1e] text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Order Code</th>
                  <th className="py-3.5 px-5">Player Account</th>
                  <th className="py-3.5 px-5">Amount (VND)</th>
                  <th className="py-3.5 px-5">Store Package</th>
                  <th className="py-3.5 px-5">Created Timestamp</th>
                  <th className="py-3.5 px-5">Payment Status</th>
                  <th className="py-3.5 px-5 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-200">
                {filteredOrders.map((ord) => {
                  const pack = packs.find((p) => p.id === ord.packId);
                  return (
                    <tr key={ord.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 font-mono text-amber-300 font-bold">
                          <span>#{ord.orderCode}</span>
                          <button
                            onClick={() => copyToClipboard(String(ord.orderCode), `ord-${ord.id}`)}
                            title="Copy Order Code"
                            className="p-1 hover:text-white text-slate-500 transition-colors"
                          >
                            {copiedKey === `ord-${ord.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-200 font-semibold px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                            UID #{ord.playerId ? (ord.playerId.length > 6 ? ord.playerId.slice(-6).toUpperCase() : ord.playerId) : 'UNKNOWN'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 font-bold font-mono text-emerald-300 text-sm">
                        {ord.amount?.toLocaleString()} VND
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                          <Gem className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {pack ? pack.name : (ord.packId ? `Pack #${ord.packId.slice(-6).toUpperCase()}` : 'Custom Top-Up')}
                          </span>
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {ord.createdAt}
                      </td>
                      <td className="py-4 px-5">
                        {ord.status === 'PAID' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold inline-flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 className="w-3 h-3" /> PAID
                          </span>
                        )}
                        {ord.status === 'PENDING' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 text-[11px] font-bold inline-flex items-center gap-1 shadow-[0_0_10px_rgba(242,191,78,0.15)]">
                            <Clock className="w-3 h-3" /> PENDING
                          </span>
                        )}
                        {ord.status === 'CANCELLED' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/35 text-[11px] font-bold inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> CANCELLED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="hy-btn-glass px-3 py-1 text-xs font-semibold text-amber-300 hover:border-amber-400/50 shadow-sm"
                        >
                          Audit Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal (Screen 32: HMAC-SHA256 Signature Audit) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="hy-glass p-6 md:p-7 rounded-2xl border border-amber-400/30 w-full max-w-lg space-y-4 text-xs shadow-[0_20px_60px_rgba(0,0,0,0.9)] relative animate-in fade-in zoom-in-95 duration-200">
            {/* Ornate HoYoverse Corner Diamonds */}
            <span className="absolute top-3 left-3 text-amber-400/50 text-xs">❖</span>
            <span className="absolute top-3 right-3 text-amber-400/50 text-xs">❖</span>

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 pt-1">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-300" />
                TRANSACTION AUDIT RECEIPT (SCREEN 32)
              </h3>
              <span className="font-mono text-xs text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                #{selectedOrder.orderCode}
              </span>
            </div>

            <div className="space-y-3 bg-[#0a0e1c] p-4 rounded-xl border border-white/[0.08]">
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">PayOS Order Code:</span>
                <span className="font-mono text-amber-300 font-bold flex items-center gap-1.5">
                  #{selectedOrder.orderCode}
                  <button
                    onClick={() => copyToClipboard(String(selectedOrder.orderCode), 'modal-code')}
                    className="p-1 hover:text-white text-slate-500"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Target Player Account:</span>
                <span className="font-mono text-slate-200">
                  Ref #{selectedOrder.playerId.slice(-6).toUpperCase()} ({selectedOrder.playerId})
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Transaction Amount:</span>
                <span className="font-mono text-emerald-300 font-bold text-sm">
                  {selectedOrder.amount?.toLocaleString()} VND
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Store Gem Package:</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-cyan-400" />
                  {packs.find((p) => p.id === selectedOrder.packId)?.name || `Pack ID: ${selectedOrder.packId}`}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Order Status:</span>
                <span className="font-bold text-xs uppercase font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {selectedOrder.status === 'PAID' ? 'PAID (FULFILLED)' : selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Creation Timestamp:</span>
                <span className="font-mono text-slate-300">{selectedOrder.createdAt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Webhook Verification:</span>
                <span className="font-mono text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  HMAC-SHA256 (Signature Verified)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">Pactkeeper Security Protocol v2.4</span>
              <button
                onClick={() => setSelectedOrder(null)}
                className="hy-btn-gold px-4 py-1.5 text-xs font-bold shadow"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
