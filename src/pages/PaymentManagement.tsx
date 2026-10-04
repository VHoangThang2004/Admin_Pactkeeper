import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type { PurchaseOrder, TopUpPackDto } from '../types';
import { Gem, CheckCircle2, Clock, XCircle, TrendingUp, Package, RefreshCw, Inbox } from 'lucide-react';

export const PaymentManagement: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [packs, setPacks] = useState<TopUpPackDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const [packsRes, ordersRes] = await Promise.allSettled([
        adminClient.get('/topuppack/all'),
        adminClient.get('/payment/history'),
      ]);

      if (packsRes.status === 'fulfilled' && Array.isArray(packsRes.value.data)) {
        setPacks(packsRes.value.data);
      } else setPacks([]);

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data)) {
        setOrders(ordersRes.value.data);
      } else setOrders([]);
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

  const totalPaidRevenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);

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
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="mahogany-banner p-4 text-center rounded-lg relative">
        <h1 className="text-xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          REALM TREASURY & PAYOS LEDGER
        </h1>
        <p className="text-xs text-[#c4b49e] font-serif mt-0.5">Track live top-up orders, payOS webhooks, revenue & store packs</p>
        <button
          onClick={() => fetchPaymentData()}
          className="absolute right-4 top-3.5 px-3 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> REFRESH LEDGER
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mahogany-banner p-5 rounded-lg">
          <p className="text-xs text-[#c4b49e] font-cinzel font-bold">TOTAL TREASURY REVENUE</p>
          <h3 className="text-2xl font-extrabold text-[#ffe082] mt-1 font-mono">{totalPaidRevenue.toLocaleString()} VNĐ</h3>
          <span className="text-xs text-[#34d399] flex items-center gap-1 mt-1 font-serif">
            <TrendingUp className="w-3.5 h-3.5" /> payOS Gateway Active
          </span>
        </div>

        <div className="mahogany-banner p-5 rounded-lg">
          <p className="text-xs text-[#c4b49e] font-cinzel font-bold">COMPLETED TRANSACTIONS</p>
          <h3 className="text-2xl font-extrabold text-[#ffe082] mt-1 font-mono">
            {orders.filter((o) => o.status === 'PAID').length} / {orders.length} Orders
          </h3>
          <span className="text-xs text-[#c4b49e] font-serif mt-1 block">Live DB Receipts</span>
        </div>

        <div className="mahogany-banner p-5 rounded-lg">
          <p className="text-xs text-[#c4b49e] font-cinzel font-bold">STORE GEM PACKS</p>
          <h3 className="text-2xl font-extrabold text-[#ffe082] mt-1 font-mono">{packs.length} Active Packs</h3>
          <span className="text-xs text-[#c89b3c] font-serif mt-1 block">/api/topuppack</span>
        </div>
      </div>

      {/* Decorative Acquire Gems Section Header (Matches Screenshot) */}
      <div className="flex items-center justify-center gap-3 text-[#c89b3c] font-cinzel font-bold text-sm tracking-widest my-4">
        <Gem className="w-4 h-4 text-[#d97706]" />
        <span className="border-b border-[#c89b3c] pb-0.5">ACQUIRE GEMS STORE CONFIGURATION</span>
        <Gem className="w-4 h-4 text-[#d97706]" />
      </div>

      {/* Store Packs Grid (Exact Parchment & Ribbon Badge Design from Screenshot) */}
      <div className="parchment-card p-5 rounded-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#c89b3c] pb-3">
          <h3 className="text-sm font-bold text-[#3a2518] font-cinzel flex items-center gap-2">
            <Package className="w-4 h-4 text-[#c89b3c]" />
            STORE TOP-UP PACKS (/api/topuppack/all)
          </h3>
        </div>
        {packs.length === 0 ? (
          <div className="p-8 text-center text-[#8c7456] space-y-2 font-serif">
            <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
            <p className="text-xs font-bold font-cinzel">No store top-up packs found in database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packs.map((p, idx) => (
              <div key={p.id} className="parchment-card rounded-lg overflow-hidden flex flex-col justify-between relative shadow-md">
                {/* Red Ribbon Badge like "BEST VALUE" in screenshot */}
                {idx === 0 && (
                  <div className="absolute top-2 right-2 rotate-12 z-10">
                    <span className="crimson-badge px-2 py-0.5 text-[9px] font-bold uppercase shadow">
                      BEST VALUE
                    </span>
                  </div>
                )}
                
                {/* Icon & Details */}
                <div className="p-6 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#e8dcbf] border-2 border-[#c89b3c] flex items-center justify-center shadow-inner">
                    <Gem className="w-8 h-8 text-[#d97706]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#3a2518] font-mono text-xl">{p.gemsAmount} Gems</h4>
                    <p className="text-xs text-[#78644e] font-serif">{p.name}</p>
                  </div>
                </div>

                {/* Dark Mahogany Bottom Price Strip (Matches Screenshot!) */}
                <div className="bg-[#3a2518] border-t-2 border-[#c89b3c] p-3 text-center flex items-center justify-between">
                  <span className="font-extrabold text-[#ffe082] font-mono text-sm">{p.priceVnd?.toLocaleString()} VND</span>
                  <button
                    onClick={() => togglePackAvailability(p.id, p.isAvailable)}
                    className="px-2.5 py-1 rounded mahogany-button text-[10px] font-bold font-cinzel"
                  >
                    {p.isAvailable ? 'AVAILABLE' : 'DISABLED'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="parchment-card rounded-lg overflow-hidden">
        <div className="p-4 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] font-cinzel font-bold text-sm">
          PAYOS TRANSACTIONS LEDGER (/api/payment/history)
        </div>
        {orders.length === 0 ? (
          <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
            <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
            <p className="text-sm font-bold font-cinzel">No payOS transaction orders recorded in database yet.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-serif">
            <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold border-b border-[#c89b3c] uppercase">
              <tr>
                <th className="py-3.5 px-5">Order Code</th>
                <th className="py-3.5 px-5">Player ID</th>
                <th className="py-3.5 px-5">Amount (VNĐ)</th>
                <th className="py-3.5 px-5">Pack ID</th>
                <th className="py-3.5 px-5">Created At</th>
                <th className="py-3.5 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#efe5cd]">
                  <td className="py-4 px-5 font-mono text-[#b45309] font-bold">#{ord.orderCode}</td>
                  <td className="py-4 px-5 font-mono text-[#3a2518]">{ord.playerId}</td>
                  <td className="py-4 px-5 font-bold font-mono text-[#15803d]">{ord.amount?.toLocaleString()} VNĐ</td>
                  <td className="py-4 px-5 text-[#6b5842]">{ord.packId}</td>
                  <td className="py-4 px-5 text-[#6b5842]">{ord.createdAt}</td>
                  <td className="py-4 px-5 text-right">
                    {ord.status === 'PAID' && (
                      <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] text-[10px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PAID
                      </span>
                    )}
                    {ord.status === 'PENDING' && (
                      <span className="px-2.5 py-0.5 rounded bg-[#854d0e] text-[#fef08a] text-[10px] font-bold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> PENDING
                      </span>
                    )}
                    {ord.status === 'CANCELLED' && (
                      <span className="px-2.5 py-0.5 rounded crimson-badge text-[10px] font-bold inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> CANCELLED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
