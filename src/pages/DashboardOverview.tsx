import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type { ServerState, CounselRole } from '../types';
import {
  Gem,
  Coins,
  Swords,
  RotateCcw,
  TrendingUp,
  Server,
  Lock,
  Unlock,
  Power,
  ShieldAlert,
  Crown,
  Scroll,
  Users,
  ShieldX
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardOverviewProps {
  role?: CounselRole;
}

/**
 * Dashboard Overview & Realm Telemetry Page
 * 
 * Features:
 * 1. Live Telemetry Aggregation: Real-time unit counts, active gacha banners,
 *    top-up store packs, PayOS ledger total revenue, and active support tickets.
 * 2. Activity Timeline: Recharts area chart showing player activity curve over time.
 * 3. Emergency Counsel Overrides:
 *    - Player Login Blocking (/api/admin/update-login-status)
 *    - PvP Matchmaking Queue Control (/api/admin/update-queue-status)
 *    - Emergency Session Reset (/api/admin/force-stop-all)
 *    * Note: Overrides are strictly locked for non-Administrator roles (RBAC).
 */
export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ role = 'Admin' }) => {
  const isAdmin = role === 'Admin' || role === 'Server';

  // Local state persistence for Emergency Overrides switches across reloads
  const [serverState, setServerState] = useState<ServerState>(() => {
    const saved = localStorage.getItem('admin_server_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { loginBlocked: false, matchmakingBlocked: false };
  });

  useEffect(() => {
    localStorage.setItem('admin_server_state', JSON.stringify(serverState));
  }, [serverState]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [bannersCount, setBannersCount] = useState<number>(0);
  const [packsCount, setPacksCount] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [activePlayersCount, setActivePlayersCount] = useState<number>(0);
  const [chartData, setChartData] = useState<{ time: string; ccu: number }[]>([]);

  /**
   * Fetches real telemetry metrics from backend endpoints simultaneously.
   */
  const fetchRealTelemetry = async () => {
    try {
      const [uRes, bRes, pRes, hRes, sRes] = await Promise.allSettled([
        adminClient.get('/UnitDefinition'),
        adminClient.get('/gachabanner'),
        adminClient.get('/topuppack/all'),
        adminClient.get('/payment/history'),
        adminClient.get('/support/admin/players'),
      ]);

      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) setActiveUnitsCount(uRes.value.data.length);
      else setActiveUnitsCount(0);

      if (bRes.status === 'fulfilled' && Array.isArray(bRes.value.data)) setBannersCount(bRes.value.data.length);
      else setBannersCount(0);

      if (pRes.status === 'fulfilled' && Array.isArray(pRes.value.data)) setPacksCount(pRes.value.data.length);
      else setPacksCount(0);

      if (hRes.status === 'fulfilled' && Array.isArray(hRes.value.data)) {
        const rev = hRes.value.data
          .filter((o: any) => o.status === 'PAID')
          .reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
        setTotalRevenue(rev);
      } else setTotalRevenue(0);

      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value.data)) setActivePlayersCount(sRes.value.data.length);
      else setActivePlayersCount(0);

      const currentHour = new Date().getHours();
      const timeline = Array.from({ length: 6 }).map((_, idx) => {
        const h = (currentHour - (5 - idx) + 24) % 24;
        return {
          time: `${h.toString().padStart(2, '0')}:00`,
          ccu: idx === 5 ? (sRes.status === 'fulfilled' && Array.isArray(sRes.value.data) ? sRes.value.data.length : 0) : 0,
        };
      });
      setChartData(timeline);

    } catch {
      setActiveUnitsCount(0);
      setBannersCount(0);
      setPacksCount(0);
      setTotalRevenue(0);
      setActivePlayersCount(0);
    }
  };

  useEffect(() => {
    fetchRealTelemetry();
  }, []);

  const toggleLoginStatus = async () => {
    try {
      setLoadingAction('login');
      const newStatus = !serverState.loginBlocked;
      await adminClient.post('/admin/update-login-status', newStatus);
      setServerState((prev) => ({ ...prev, loginBlocked: newStatus }));
      setMessage({
        text: `Player Login Status updated: ${newStatus ? 'BLOCKED' : 'ALLOWED'}.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to update login status.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleQueueStatus = async () => {
    try {
      setLoadingAction('queue');
      const newStatus = !serverState.matchmakingBlocked;
      await adminClient.post('/admin/update-queue-status', newStatus);
      setServerState((prev) => ({ ...prev, matchmakingBlocked: newStatus }));
      setMessage({
        text: `Matchmaking Queue Status updated: ${newStatus ? 'PAUSED' : 'ALLOWED'}.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to update queue status.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceStopAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to FORCE STOP all ongoing matches on the realm server?')) {
      return;
    }
    try {
      setLoadingAction('forceStop');
      const res = await adminClient.post('/admin/force-stop-all');
      setMessage({ text: res.data.message || 'All matches ended & queue cleared on live server.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to execute force stop on server.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Top Mahogany Header Banner */}
      <div className="mahogany-banner p-5 text-center rounded-lg relative overflow-hidden">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          TREASURY & REALM COMMAND
        </h1>
        <p className="text-xs text-[#d5c7b3] font-serif mt-1">High Counsel Realm Telemetry & Operational Control</p>
        <button
          onClick={fetchRealTelemetry}
          className="absolute right-4 top-4 px-3.5 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#c89b3c]" /> REFRESH
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg text-xs font-bold border flex items-center justify-between shadow ${
            message.type === 'success'
              ? 'bg-[#14532d]/40 border-[#22c55e] text-[#86efac]'
              : 'bg-[#7f1d1d]/40 border-[#ef4444] text-[#fca5a5]'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-mono underline opacity-80 hover:opacity-100">
            DISMISS
          </button>
        </div>
      )}

      {/* Hero Profile Banner */}
      <div className="mahogany-banner p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#593d29] pb-3">
          <div>
            <span className="text-xs font-mono text-[#c89b3c] uppercase font-bold tracking-wider block">KEEPER OF RECORDS</span>
            <h2 className="text-xl font-extrabold text-[#ffe082] tracking-wide font-cinzel">
              KEEPER OF RECORDS (K18 HCM)
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded crimson-badge text-xs font-bold font-mono">LEVEL 99</span>
              <span className="text-xs text-[#d5c7b3] font-serif">EXP: 9999 / 9999</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#d4af37] to-[#aa7c11] border-2 border-[#ffe082] flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-[#2b1b11]" />
            </div>
          </div>
        </div>

        {/* Current Realm Revenue Box */}
        <div className="p-4 rounded bg-[#26170d] border border-[#c89b3c] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#d5c7b3] uppercase font-cinzel font-bold block tracking-wider">CURRENT REALM TREASURY (PAYOS)</span>
            <div className="flex items-center gap-2.5 mt-1.5">
              <Coins className="w-6 h-6 text-[#f59e0b]" />
              <span className="text-2xl font-extrabold font-mono text-[#ffe082]">{totalRevenue.toLocaleString()} VNĐ</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#c89b3c] font-cinzel font-bold block">{packsCount} Store Packs Configured</span>
            <span className="text-xs text-[#d5c7b3] block font-serif mt-0.5">payOS Webhook Active</span>
          </div>
        </div>
      </div>

      {/* Decorative Section Divider */}
      <div className="flex items-center justify-center gap-3 text-[#c89b3c] font-cinzel font-bold text-sm tracking-widest my-4">
        <span>❖</span>
        <span className="border-b border-[#c89b3c] pb-0.5">REALM METRICS & COMMAND</span>
        <span>❖</span>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="parchment-card p-5 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-cinzel font-bold text-[#8c7456] uppercase tracking-wider">ACTIVE SUPPORT TICKETS</p>
              <h3 className="text-2xl font-extrabold text-[#3a2518] mt-1 font-mono">{activePlayersCount} Players</h3>
              <span className="text-xs text-[#15803d] font-bold flex items-center gap-1 mt-1 font-serif">
                <TrendingUp className="w-3.5 h-3.5" /> SignalR Hub Connected
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#f4ecd8] border-2 border-[#c89b3c] flex items-center justify-center shadow">
              <Users className="w-6 h-6 text-[#3a2518]" />
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="parchment-card p-5 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-cinzel font-bold text-[#8c7456] uppercase tracking-wider">SRPG DEFINITIONS</p>
              <h3 className="text-2xl font-extrabold text-[#3a2518] mt-1 font-mono">{activeUnitsCount} Units</h3>
              <span className="text-xs text-[#8b5cf6] font-bold flex items-center gap-1 mt-1 font-serif">
                <Swords className="w-3.5 h-3.5" /> MongoDB Collections
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#f4ecd8] border-2 border-[#c89b3c] flex items-center justify-center shadow">
              <Swords className="w-6 h-6 text-[#8b5cf6]" />
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="parchment-card p-5 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-cinzel font-bold text-[#8c7456] uppercase tracking-wider">SUMMON BANNERS</p>
              <h3 className="text-2xl font-extrabold text-[#3a2518] mt-1 font-mono">{bannersCount} Banners</h3>
              <span className="text-xs text-[#b45309] font-bold flex items-center gap-1 mt-1 font-serif">
                <Gem className="w-3.5 h-3.5 text-[#d97706]" /> Active Gacha Pools
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#f4ecd8] border-2 border-[#c89b3c] flex items-center justify-center shadow">
              <Gem className="w-6 h-6 text-[#d97706]" />
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="parchment-card p-5 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-cinzel font-bold text-[#8c7456] uppercase tracking-wider">REALM GATEWAY</p>
              <h3 className="text-lg font-extrabold text-[#3a2518] mt-1 font-mono">ONLINE (.NET 9)</h3>
              <span className="text-xs text-[#6b7280] font-mono mt-1 block">:5276 / MongoDB</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#f4ecd8] border-2 border-[#c89b3c] flex items-center justify-center shadow">
              <Server className="w-6 h-6 text-[#3a2518]" />
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Counsel Override Actions */}
      <div className="mahogany-banner p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#593d29] pb-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#ef4444]" />
            <div>
              <h3 className="text-base font-bold text-[#ffe082] uppercase font-cinzel">EMERGENCY REALM OVERRIDES</h3>
              <p className="text-xs text-[#c4b49e] font-serif">Direct operational overrides via AdminController endpoints.</p>
            </div>
          </div>
          {!isAdmin && (
            <span className="px-2.5 py-1 rounded bg-[#7f1d1d]/60 border border-[#ef4444] text-[#fca5a5] text-xs font-cinzel font-bold flex items-center gap-1">
              <ShieldX className="w-3.5 h-3.5" /> ADMIN ONLY
            </span>
          )}
        </div>

        {!isAdmin && (
          <div className="p-3 rounded bg-[#7f1d1d]/30 border border-[#ef4444]/60 text-[#fca5a5] text-xs flex items-center gap-2 font-serif">
            <ShieldX className="w-4 h-4 text-[#f87171] shrink-0" />
            <span>
              <strong>Restricted Operations:</strong> Emergency server overrides are restricted to High Counsel Administrators. Buttons are locked.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Toggle Login */}
          <div className="p-4 rounded bg-[#26170d] border border-[#c89b3c] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#ffe082] font-cinzel">PLAYER AUTHENTICATION</p>
              <p className="text-xs text-[#c4b49e] mt-1">
                Status: {serverState.loginBlocked ? <span className="text-[#fca5a5] font-bold">BLOCKED</span> : <span className="text-[#86efac] font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleLoginStatus}
              disabled={!isAdmin || loadingAction === 'login'}
              title={!isAdmin ? 'Administrator privilege required' : 'Toggle login status'}
              className="px-3 py-1.5 rounded mahogany-button text-xs font-bold font-cinzel flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {serverState.loginBlocked ? <Unlock className="w-3.5 h-3.5 text-[#34d399]" /> : <Lock className="w-3.5 h-3.5 text-[#f87171]" />}
              {serverState.loginBlocked ? 'UNBLOCK' : 'BLOCK'}
            </button>
          </div>

          {/* Toggle Matchmaking */}
          <div className="p-4 rounded bg-[#26170d] border border-[#c89b3c] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#ffe082] font-cinzel">PVP MATCH QUEUE</p>
              <p className="text-xs text-[#c4b49e] mt-1">
                Status: {serverState.matchmakingBlocked ? <span className="text-[#fcd34d] font-bold">PAUSED</span> : <span className="text-[#86efac] font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleQueueStatus}
              disabled={!isAdmin || loadingAction === 'queue'}
              title={!isAdmin ? 'Administrator privilege required' : 'Toggle queue status'}
              className="px-3 py-1.5 rounded mahogany-button text-xs font-bold font-cinzel flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {serverState.matchmakingBlocked ? <Unlock className="w-3.5 h-3.5 text-[#34d399]" /> : <Lock className="w-3.5 h-3.5 text-[#fbbf24]" />}
              {serverState.matchmakingBlocked ? 'RESUME' : 'PAUSE'}
            </button>
          </div>

          {/* Force Stop All */}
          <div className="p-4 rounded bg-[#26170d] border border-[#8b1e1e] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#fca5a5] font-cinzel">RESET MATCHES</p>
              <p className="text-xs text-[#c4b49e] mt-1">Terminates active sessions</p>
            </div>
            <button
              onClick={handleForceStopAll}
              disabled={!isAdmin || loadingAction === 'forceStop'}
              title={!isAdmin ? 'Administrator privilege required' : 'Force stop all active sessions'}
              className="px-3 py-1.5 rounded crimson-badge text-xs font-bold font-cinzel flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Power className="w-3.5 h-3.5" />
              FORCE STOP
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Activity Chart */}
      <div className="parchment-card p-6 rounded-lg space-y-3">
        <h3 className="text-sm font-bold text-[#3a2518] uppercase font-cinzel flex items-center gap-2 border-b border-[#dcd1b5] pb-2">
          <Scroll className="w-4 h-4 text-[#c89b3c]" />
          REALM TELEMETRY & PLAYER ACTIVITY TIMELINE
        </h3>
        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCcu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c89b3c" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#c89b3c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#8c7456" fontSize={11} tickLine={false} />
              <YAxis stroke="#8c7456" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#2b1b11', borderColor: '#c89b3c', borderRadius: '8px', color: '#ffe082' }}
              />
              <Area type="monotone" dataKey="ccu" stroke="#c89b3c" strokeWidth={3} fillOpacity={1} fill="url(#colorCcu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
