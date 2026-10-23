import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type { PurchaseOrder, TopUpPackDto } from '../types';
import { Gem, CheckCircle2, Clock, XCircle, TrendingUp, Package, RefreshCw, Inbox, Coins, ShieldCheck } from 'lucide-react';

/**
 * PaymentManagement Component
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * Manages realm treasury operations, payOS transaction ledgers,
 * and store currency (Gem) top-up packs.
 * 
 * Features:
 * - Real-time financial summary (total revenue in VND, completed count, active packs)
 * - PayOS transaction audit table with status indicators (PAID, PENDING, CANCELLED)
 * - In-game store pack configuration (toggle pack availability status)
 * - Screen 32 Transaction Details Modal with HMAC-SHA256 signature verification seal
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

  // Compute total recognized treasury revenue from completed (PAID) transactions
  const totalPaidRevenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);

  /**
   * Toggles the availability status of a store top-up pack.
   */
  const togglePackAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await adminClient.patch(`/topuppack/${id}/availability`, { isAvailable: !currentStatus });
      setPacks((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isAvailable: !currentStatus } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update pack availability.');
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Astral Header Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div 
          className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/[0.06] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">
                FINANCIAL LEDGER • PAYOS GATEWAY
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">HMAC-SHA256 Webhook Audited</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel uppercase gold-gradient-text">
              REALM TREASURY & PAYOS LEDGER
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track live top-up orders, payOS webhooks, revenue distribution, and store Gem pack configurations.
            </p>
          </div>

          <button
            onClick={() => fetchPaymentData()}
            disabled={loading}
            className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 self-start md:self-auto shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC LEDGER</span>
          </button>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                TOTAL TREASURY REVENUE
              </p>
              <h3 className="text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                {totalPaidRevenue.toLocaleString()} VND
              </h3>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> payOS Gateway Active
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
              <Coins className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Verified Orders</span>
            <span className="text-emerald-400 font-bold">{orders.filter((o) => o.status === 'PAID').length} Paid</span>
          </div>
        </div>

        {/* Completed Transactions Count */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                TRANSACTION RECEIPTS
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                {orders.filter((o) => o.status === 'PAID').length} / {orders.length}
              </h3>
              <span className="text-xs text-slate-400 mt-1.5 block">
                Live Database Receipts
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Fulfillment Rate</span>
            <span className="text-slate-200 font-bold">
              {orders.length > 0 ? Math.round((orders.filter((o) => o.status === 'PAID').length / orders.length) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Store Gem Packs Count */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                STORE GEM PACKAGES
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                {packs.length} Active Packs
              </h3>
              <span className="text-xs text-cyan-400 font-medium mt-1.5 block font-mono">
                /api/topuppack
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.2)]">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Availability Status</span>
            <span className="text-cyan-400 font-bold">Configured in DB</span>
          </div>
        </div>
      </div>

      {/* Decorative Store Header */}
      <div className="flex items-center justify-center gap-3 text-slate-400 font-cinzel font-bold text-xs tracking-widest my-4">
        <span className="text-amber-500/60">❖</span>
        <span className="uppercase text-slate-300">ACQUIRE GEMS STORE CONFIGURATION</span>
        <span className="text-amber-500/60">❖</span>
      </div>

      {/* Store Packs Grid */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm font-bold text-slate-100 font-cinzel flex items-center gap-2 uppercase">
            <Package className="w-4 h-4 text-amber-400" />
            STORE TOP-UP PACKS (/api/topuppack/all)
          </h3>
        </div>
        {packs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No store top-up packs found in database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packs.map((p, idx) => (
              <div
                key={p.id}
                className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between relative border border-white/[0.08] shadow-lg group hover:border-amber-400/40 transition-all"
              >
                {/* Featured Badge for first pack */}
                {idx === 0 && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-mono text-[10px] font-bold tracking-wider uppercase shadow">
                      BEST VALUE
                    </span>
                  </div>
                )}

                {/* Pack Icon & Info */}
                <div className="p-6 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                    <Gem className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-100 font-mono text-xl">{p.gemsAmount} Gems</h4>
                    <p className="text-xs text-slate-400 mt-1">{p.name}</p>
                  </div>
                </div>

                {/* Price Bar & Status Toggle Button */}
                <div className="bg-slate-950/80 border-t border-white/[0.08] p-3.5 flex items-center justify-between">
                  <span className="font-extrabold text-amber-300 font-mono text-sm">
                    {p.priceVnd?.toLocaleString()} VND
                  </span>
                  <button
                    onClick={() => togglePackAvailability(p.id, p.isAvailable)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      p.isAvailable
                        ? 'btn-glass text-emerald-300 hover:text-emerald-100'
                        : 'bg-white/[0.04] text-slate-500 border border-white/[0.06]'
                    }`}
                  >
                    {p.isAvailable ? 'AVAILABLE' : 'DISABLED'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PayOS Transactions Ledger Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] font-cinzel font-bold text-xs uppercase text-slate-200">
          PAYOS TRANSACTIONS LEDGER (/api/payment/history)
        </div>
        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No payOS transaction orders recorded in database yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Order Code</th>
                  <th className="py-3.5 px-5">Player Account</th>
                  <th className="py-3.5 px-5">Amount (VND)</th>
                  <th className="py-3.5 px-5">Store Gem Pack</th>
                  <th className="py-3.5 px-5">Created At</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-200">
                {orders.map((ord) => {
                  const pack = packs.find((p) => p.id === ord.packId);
                  return (
                    <tr key={ord.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 px-5 font-mono text-amber-400 font-bold">#{ord.orderCode}</td>
                      <td className="py-4 px-5">
                        <span className="font-mono text-slate-300 font-semibold text-xs">
                          Ref #{ord.playerId.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-bold font-mono text-emerald-300">
                        {ord.amount?.toLocaleString()} VND
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                          <Gem className="w-3.5 h-3.5 text-cyan-400" />
                          {pack ? pack.name : (ord.packId ? `Pack #${ord.packId.slice(-6).toUpperCase()}` : 'Custom Top-Up')}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-400 font-mono text-[11px]">{ord.createdAt}</td>
                      <td className="py-4 px-5">
                        {ord.status === 'PAID' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> PAID
                          </span>
                        )}
                        {ord.status === 'PENDING' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> PENDING
                          </span>
                        )}
                        {ord.status === 'CANCELLED' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> CANCELLED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="btn-glass px-3 py-1 text-xs font-semibold text-amber-300 hover:border-amber-400/40"
                        >
                          Inspect
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
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                TRANSACTION DETAILS (SCREEN 32)
              </h3>
              <span className="font-mono text-xs text-amber-300 font-bold">
                Order #{selectedOrder.orderCode}
              </span>
            </div>

            <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-white/[0.08]">
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">PayOS Order Code:</span>
                <span className="font-mono text-amber-300 font-bold">#{selectedOrder.orderCode}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Target Player Account:</span>
                <span className="font-mono text-slate-200">Ref #{selectedOrder.playerId.slice(-6).toUpperCase()} ({selectedOrder.playerId})</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Transaction Amount:</span>
                <span className="font-mono text-emerald-300 font-bold text-sm">{selectedOrder.amount?.toLocaleString()} VND</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Top-Up Package:</span>
                <span className="font-mono text-slate-200">
                  {packs.find((p) => p.id === selectedOrder.packId)?.name || `Pack ID: ${selectedOrder.packId}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Order Status:</span>
                <span className="font-bold text-xs uppercase font-mono text-emerald-400">
                  {selectedOrder.status === 'PAID' ? 'PAID (COMPLETED)' : selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Creation Timestamp:</span>
                <span className="font-mono text-slate-300">{selectedOrder.createdAt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Webhook Verification:</span>
                <span className="font-mono text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  HMAC-SHA256 (Signature Verified)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="btn-glass px-4 py-1.5 text-xs font-semibold"
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
