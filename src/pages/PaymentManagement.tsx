import React, { useState } from 'react';
import type { PurchaseOrder } from '../types';
import { CreditCard, CheckCircle2, Clock, XCircle, TrendingUp, Package } from 'lucide-react';

const mockOrders: PurchaseOrder[] = [
  { id: 'ORD_1001', orderCode: 984012, playerId: 'PLR_1001', amount: 200000, packId: 'PACK_GEMS_1000', status: 'PAID', createdAt: '2026-08-20 12:30' },
  { id: 'ORD_1002', orderCode: 984013, playerId: 'PLR_1005', amount: 500000, packId: 'PACK_GEMS_3000', status: 'PAID', createdAt: '2026-08-20 11:15' },
  { id: 'ORD_1003', orderCode: 984014, playerId: 'PLR_1002', amount: 50000, packId: 'PACK_GEMS_200', status: 'PENDING', createdAt: '2026-08-20 13:05' },
  { id: 'ORD_1004', orderCode: 984015, playerId: 'PLR_1004', amount: 1000000, packId: 'PACK_GEMS_7000', status: 'CANCELLED', createdAt: '2026-08-19 16:40' },
];

export const PaymentManagement: React.FC = () => {
  const [orders] = useState<PurchaseOrder[]>(mockOrders);

  const totalPaidRevenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Payments & payOS Gateway Analytics
          </h2>
          <p className="text-sm text-slate-400">Track top-up orders, payOS webhooks, revenue performance and gem packs.</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Total Processed Revenue</p>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1">{totalPaidRevenue.toLocaleString()} VNĐ</h3>
          <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <TrendingUp className="w-3 h-3" /> payOS Gateway Active
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Completed Transactions</p>
          <h3 className="text-2xl font-bold text-white mt-1">
            {orders.filter((o) => o.status === 'PAID').length} / {orders.length}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">Success rate: 75%</span>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Active Top-up Packs</p>
          <h3 className="text-2xl font-bold text-indigo-400 mt-1">6 Store Packs</h3>
          <span className="text-xs text-indigo-300 flex items-center gap-1 mt-1 font-medium">
            <Package className="w-3 h-3" /> Gems & First-time Bonus
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent payOS Orders</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase">
            <tr>
              <th className="py-3.5 px-5">Order Code</th>
              <th className="py-3.5 px-5">Player ID</th>
              <th className="py-3.5 px-5">Amount (VNĐ)</th>
              <th className="py-3.5 px-5">Pack ID</th>
              <th className="py-3.5 px-5">Created At</th>
              <th className="py-3.5 px-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {orders.map((ord) => (
              <tr key={ord.id} className="hover:bg-slate-800/40">
                <td className="py-4 px-5 font-mono text-indigo-400 font-bold">#{ord.orderCode}</td>
                <td className="py-4 px-5 font-mono text-slate-300">{ord.playerId}</td>
                <td className="py-4 px-5 font-bold text-emerald-400">{ord.amount.toLocaleString()} VNĐ</td>
                <td className="py-4 px-5 text-slate-400">{ord.packId}</td>
                <td className="py-4 px-5 text-slate-400">{ord.createdAt}</td>
                <td className="py-4 px-5 text-right">
                  {ord.status === 'PAID' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PAID
                    </span>
                  )}
                  {ord.status === 'PENDING' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> PENDING
                    </span>
                  )}
                  {ord.status === 'CANCELLED' && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[10px] inline-flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> CANCELLED
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
