import React, { useState } from 'react';
import { adminClient } from '../api/adminClient';
import type { ServerState } from '../types';
import {
  Activity,
  Users,
  Swords,
  ShieldAlert,
  Power,
  RotateCcw,
  TrendingUp,
  Server,
  DollarSign,
  Lock,
  Unlock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockCcuData = [
  { time: '00:00', ccu: 320, revenue: 120 },
  { time: '04:00', ccu: 180, revenue: 45 },
  { time: '08:00', ccu: 540, revenue: 310 },
  { time: '12:00', ccu: 890, revenue: 650 },
  { time: '16:00', ccu: 1120, revenue: 840 },
  { time: '20:00', ccu: 1450, revenue: 1200 },
  { time: '23:59', ccu: 980, revenue: 780 },
];

export const DashboardOverview: React.FC = () => {
  const [serverState, setServerState] = useState<ServerState>({
    loginBlocked: false,
    matchmakingBlocked: false,
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const toggleLoginStatus = async () => {
    try {
      setLoadingAction('login');
      const newStatus = !serverState.loginBlocked;
      await adminClient.post('/admin/update-login-status', newStatus);
      setServerState((prev) => ({ ...prev, loginBlocked: newStatus }));
      setMessage({
        text: `Player Login is now ${newStatus ? 'BLOCKED' : 'ALLOWED'}.`,
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
        text: `Matchmaking Queue is now ${newStatus ? 'BLOCKED' : 'ALLOWED'}.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to update queue status.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceStopAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to FORCE STOP all ongoing matches and clear the matchmaking queue?')) {
      return;
    }
    try {
      setLoadingAction('forceStop');
      const res = await adminClient.post('/admin/force-stop-all');
      setMessage({ text: res.data.message || 'All matches ended & queue cleared successfully.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to execute force stop.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Server Control & Overview</h2>
          <p className="text-sm text-slate-400">Real-time system telemetry and emergency management controls.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-card text-slate-300 hover:text-white text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Online (CCU)</p>
            <h3 className="text-2xl font-bold text-white mt-1">1,450</h3>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> +14.2% vs yesterday
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Ongoing PvP Matches</p>
            <h3 className="text-2xl font-bold text-white mt-1">42</h3>
            <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1 mt-1">
              <Swords className="w-3 h-3" /> LiteNetLib UDP Server
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 glow-purple">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Today's Revenue (payOS)</p>
            <h3 className="text-2xl font-bold text-white mt-1">3,940,000 đ</h3>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> 48 Transactions
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 glow-emerald">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Backend Server Status</p>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">Healthy (.NET 9)</h3>
            <span className="text-xs text-slate-400 font-medium mt-1 block">Latency: 18ms</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Server className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Emergency Server Controls */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Emergency Server Actions</h3>
            <p className="text-xs text-slate-400">Direct operational overrides via AdminController endpoints.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Toggle Login */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Player Authentication</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Status: {serverState.loginBlocked ? <span className="text-rose-400 font-bold">BLOCKED</span> : <span className="text-emerald-400 font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleLoginStatus}
              disabled={loadingAction === 'login'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                serverState.loginBlocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {serverState.loginBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {serverState.loginBlocked ? 'Unblock Login' : 'Block Login'}
            </button>
          </div>

          {/* Toggle Matchmaking */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">PvP Matchmaking Queue</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Status: {serverState.matchmakingBlocked ? <span className="text-amber-400 font-bold">PAUSED</span> : <span className="text-emerald-400 font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleQueueStatus}
              disabled={loadingAction === 'queue'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                serverState.matchmakingBlocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {serverState.matchmakingBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {serverState.matchmakingBlocked ? 'Resume Queue' : 'Pause Queue'}
            </button>
          </div>

          {/* Force Stop All */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-950/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-300">Force Reset Matches</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Terminates all active sessions & clears queue</p>
            </div>
            <button
              onClick={handleForceStopAll}
              disabled={loadingAction === 'forceStop'}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all"
            >
              <Power className="w-3.5 h-3.5" />
              Force Stop All
            </button>
          </div>
        </div>
      </div>

      {/* Chart Telemetry */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-4">24-Hour Concurrent Player (CCU) Activity</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockCcuData}>
              <defs>
                <linearGradient id="colorCcu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="ccu" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCcu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
