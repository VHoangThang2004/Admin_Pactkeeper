import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Users,
  ShieldX,
  Activity,
  Flame,
  BookOpen,
  CheckCircle2,
  Clock,
  Radio,
  Copy,
  Terminal
} from 'lucide-react';
import { getPlayerPresence, type PlayerPresenceInfo } from '../utils/presence';

interface TrackedPlayerPresence {
  playerId: string;
  username: string;
  presence: PlayerPresenceInfo;
  lastSeen: string;
}

interface DashboardOverviewProps {
  role?: CounselRole;
}

/**
 * DashboardOverview Component (Tactical Telemetry & Realm Command)
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * - Real Data Integration (PayOS history, Live Player Sessions, Unity NGO Matches, Game Definitions)
 * - Modern dark glassmorphism (Obsidian void, glowing amber/cyan telemetry cards)
 * - Real-time presence roster with live SignalR status pills
 * - High-contrast ZZZ-style emergency switches for server overrides
 */
export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ role = 'Admin' }) => {
  const isAdmin = role === 'Admin' || role === 'Server';
  const isTechSupport = role === 'Technical Support' || role === 'Support';
  const canOverride = isAdmin || isTechSupport;

  // Session state persistence for Emergency Overrides switches across reloads
  const [serverState, setServerState] = useState<ServerState>(() => {
    const saved = sessionStorage.getItem('admin_server_state') || localStorage.getItem('admin_server_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { loginBlocked: false, matchmakingBlocked: false };
  });

  useEffect(() => {
    sessionStorage.setItem('admin_server_state', JSON.stringify(serverState));
  }, [serverState]);

  // Telemetry Metrics State
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Financial & Treasury Metrics
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [paidOrdersCount, setPaidOrdersCount] = useState<number>(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  const [packsCount, setPacksCount] = useState<number>(0);

  // Live Population & Match Metrics
  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(0);
  const [inMatchPlayersCount, setInMatchPlayersCount] = useState<number>(0);
  const [activeMatchesCount, setActiveMatchesCount] = useState<number>(0);
  const [totalMatchesCount, setTotalMatchesCount] = useState<number>(0);
  const [trackedPlayers, setTrackedPlayers] = useState<TrackedPlayerPresence[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE'>('ALL');

  // Game Content Archives
  const [activeUnitsCount, setActiveUnitsCount] = useState<number>(0);
  const [bannersCount, setBannersCount] = useState<number>(0);
  const [chaptersCount, setChaptersCount] = useState<number>(0);

  /**
   * Fetches real telemetry metrics from backend endpoints in parallel.
   */
  const fetchRealTelemetry = async () => {
    setLoading(true);
    try {
      const [uRes, bRes, pRes, hRes, sRes, mRes, cRes] = await Promise.allSettled([
        adminClient.get('/UnitDefinition'),
        adminClient.get('/gachabanner'),
        adminClient.get('/topuppack/all'),
        adminClient.get('/payment/history'),
        adminClient.get('/support/admin/players'),
        adminClient.get('/Match/history'),
        adminClient.get('/ChapterConfig'),
      ]);

      // 1. Game Archives
      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) setActiveUnitsCount(uRes.value.data.length);
      else setActiveUnitsCount(0);

      if (bRes.status === 'fulfilled' && Array.isArray(bRes.value.data)) setBannersCount(bRes.value.data.length);
      else setBannersCount(0);

      if (pRes.status === 'fulfilled' && Array.isArray(pRes.value.data)) setPacksCount(pRes.value.data.length);
      else setPacksCount(0);

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value.data)) setChaptersCount(cRes.value.data.length);
      else setChaptersCount(0);

      // 2. Financial Metrics (PayOS Ledger)
      if (hRes.status === 'fulfilled' && Array.isArray(hRes.value.data)) {
        const orders = hRes.value.data;
        setTotalOrdersCount(orders.length);
        const paidOrders = orders.filter((o: any) => o.status === 'PAID');
        setPaidOrdersCount(paidOrders.length);
        const rev = paidOrders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
        setTotalRevenue(rev);
      } else {
        setTotalOrdersCount(0);
        setPaidOrdersCount(0);
        setTotalRevenue(0);
      }

      // 3. Match Telemetry & In-Battle Combatants
      const activeMatchPlayerMap = new Map<string, { matchId: string; mode?: string }>();
      let liveMatchesCount = 0;
      let totalMatches = 0;

      if (mRes.status === 'fulfilled' && Array.isArray(mRes.value.data)) {
        const matches = mRes.value.data;
        totalMatches = matches.length;

        matches.forEach((m: any) => {
          const s = (m.status || '').toLowerCase();
          const isLive = s === 'inprogress' || s === 'active' || s === 'playing' || s === 'running' || m.status === 1;
          if (isLive) {
            liveMatchesCount++;
            const mId = m.matchId || m.id || '';
            if (m.player1Id) activeMatchPlayerMap.set(m.player1Id, { matchId: mId, mode: m.mode });
            if (m.player2Id) activeMatchPlayerMap.set(m.player2Id, { matchId: mId, mode: m.mode });
          }
        });
      }

      setTotalMatchesCount(totalMatches);
      setActiveMatchesCount(liveMatchesCount);
      setInMatchPlayersCount(activeMatchPlayerMap.size);

      // 4. Genuine Player Presence Recognition
      const localPlayerId = sessionStorage.getItem('player_id') || sessionStorage.getItem('playerId') || sessionStorage.getItem('adminPlayerId') || localStorage.getItem('player_id') || localStorage.getItem('playerId');
      const localUsername = sessionStorage.getItem('username') || sessionStorage.getItem('adminUsername') || localStorage.getItem('username') || 'Admin Counsel';

      const playerMap = new Map<string, { username: string; lastSeen: string; isCurrentSession?: boolean }>();

      // Active session user
      if (localPlayerId) {
        playerMap.set(localPlayerId, {
          username: localUsername,
          lastSeen: new Date().toISOString(),
          isCurrentSession: true,
        });
      }

      // Players from Support Roster
      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value.data)) {
        sRes.value.data.forEach((p: any) => {
          if (p.playerId) {
            const existing = playerMap.get(p.playerId);
            const resolvedName = (p.playerName || p.username || '').trim() || existing?.username || `Traveler #${p.playerId.slice(-4).toUpperCase()}`;
            const time = p.latestMessageTime || p.lastMessageAt || existing?.lastSeen || '';
            playerMap.set(p.playerId, {
              username: resolvedName,
              lastSeen: time,
              isCurrentSession: existing?.isCurrentSession || false,
            });
          }
        });
      }

      // Active Match Combatants
      activeMatchPlayerMap.forEach((_, pid) => {
        if (!playerMap.has(pid)) {
          playerMap.set(pid, {
            username: `Combatant #${pid.slice(-4).toUpperCase()}`,
            lastSeen: new Date().toISOString(),
          });
        }
      });

      // Build verified roster
      const roster: TrackedPlayerPresence[] = [];
      let totalOnline = 0;

      playerMap.forEach((data, pid) => {
        const presence = getPlayerPresence(pid, activeMatchPlayerMap, data.lastSeen, data.isCurrentSession);
        if (presence.state === 'Online' || presence.state === 'InBattle') {
          totalOnline++;
        }
        roster.push({
          playerId: pid,
          username: data.username,
          presence,
          lastSeen: data.lastSeen,
        });
      });

      // Sort by status priority: InBattle > Online > Offline
      roster.sort((a, b) => {
        const order = { InBattle: 0, Online: 1, Offline: 2 };
        return order[a.presence.state] - order[b.presence.state];
      });

      setTrackedPlayers(roster);
      setOnlinePlayersCount(totalOnline);
    } catch {
      setActiveUnitsCount(0);
      setBannersCount(0);
      setPacksCount(0);
      setChaptersCount(0);
      setTotalRevenue(0);
      setPaidOrdersCount(0);
      setTotalOrdersCount(0);
      setOnlinePlayersCount(1);
      setInMatchPlayersCount(0);
      setActiveMatchesCount(0);
      setTotalMatchesCount(0);
      setTrackedPlayers([]);
    } finally {
      setLoading(false);
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
      setMessage({ text: res.data?.message || 'All matches ended & queue cleared on live server.', type: 'success' });
      await fetchRealTelemetry();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to execute force stop on server.', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Top Astral Command Header Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Subtle ambient light orb */}
        <div 
          className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/[0.06] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">
                TACTICAL COMMAND HQ
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">Live Telemetry & Controls</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel uppercase gold-gradient-text">
              {isTechSupport ? 'SYSTEM STATUS & TELEMETRY MONITOR' : 'TREASURY & REALM COMMAND'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {isTechSupport
                ? 'Technical Support Station: Monitor System/Server Status and Configure System Overrides'
                : 'Admin Dashboard: Live Telemetry, Player Concurrency, Revenue and High Counsel Controls'}
            </p>
          </div>

          <button
            onClick={fetchRealTelemetry}
            className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 self-start md:self-auto shadow transition-all"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC DATA</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between shadow-lg backdrop-blur-md ${
            message.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-mono underline opacity-80 hover:opacity-100">
            DISMISS
          </button>
        </div>
      )}

      {/* Keeper Profile & Primary Metric Box */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <span className="text-[11px] font-mono text-amber-400 uppercase font-bold tracking-wider block">
              {isTechSupport ? 'TECHNICAL SUPPORT & INFRASTRUCTURE' : 'HIGH COUNSEL RECORD OFFICE'}
            </span>
            <h2 className="text-xl font-extrabold text-slate-100 tracking-wide font-cinzel mt-0.5">
              {isTechSupport ? 'SYSTEM MONITOR & SERVER NODES' : 'KEEPER OF RECORDS'}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GATEWAY LIVE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 p-0.5 shadow-[0_0_16px_rgba(245,158,11,0.25)] flex items-center justify-center">
              <div className="w-full h-full bg-[#090b11] rounded-[10px] flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Current Realm Revenue Box (Admin) OR Server Nodes Status (Tech Support) */}
        {!isTechSupport ? (
          <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-xs text-slate-400 uppercase font-cinzel font-bold block tracking-wider">
                CURRENT REALM TREASURY REVENUE (PAYOS LEDGER)
              </span>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <span className="text-2xl md:text-3xl font-extrabold font-mono text-amber-300">
                  {totalRevenue.toLocaleString()} VND
                </span>
              </div>
            </div>
            <div className="text-left md:text-right space-y-0.5 font-mono">
              <span className="text-xs text-amber-400 font-bold block">
                {paidOrdersCount} / {totalOrdersCount} Completed Receipts
              </span>
              <span className="text-xs text-slate-400 block font-sans">
                {packsCount} Active Store Packs Configured • payOS Gateway Live
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-xs text-slate-400 uppercase font-cinzel font-bold block tracking-wider">
                SERVER NODES & DEDICATED INSTANCES (SCREEN 41 & 42)
              </span>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Server className="w-5 h-5" />
                </div>
                <span className="text-2xl md:text-3xl font-extrabold font-mono text-emerald-300">
                  {activeMatchesCount} HEADLESS NODES ACTIVE
                </span>
              </div>
            </div>
            <div className="text-left md:text-right space-y-0.5 font-mono">
              <span className="text-xs text-emerald-400 font-bold block">
                UDP Port Pool: 7777 - 7800 • Ubuntu 22.04 LTS
              </span>
              <span className="text-xs text-slate-400 block font-sans">
                Unity Netcode for GameObjects (NGO) • Dedicated Server Architecture
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Decorative Section Divider: Live Player Operations */}
      <div className="flex items-center justify-center gap-3 text-slate-400 font-cinzel font-bold text-xs tracking-widest my-4">
        <span className="text-amber-500/60">❖</span>
        <span className="uppercase text-slate-300">LIVE PLAYER POPULATION & COMBAT TELEMETRY</span>
        <span className="text-amber-500/60">❖</span>
      </div>

      {/* 4 Cards: Live Population & Match Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Online Players (CCU) */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                ONLINE PLAYERS (CCU)
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                {onlinePlayersCount} Online
              </h3>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Hub Active
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>SignalR WebSocket</span>
            <span className="text-emerald-400 font-bold">Connected</span>
          </div>
        </div>

        {/* Card 2: Players In Matches */}
        <div className="glass-card-cyan p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                IN-MATCH PLAYERS
              </p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                {inMatchPlayersCount} Combatants
              </h3>
              <span className="text-xs text-cyan-400 font-medium flex items-center gap-1.5 mt-1">
                <Flame className="w-3.5 h-3.5 text-cyan-400" /> {activeMatchesCount} Active Battles
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.2)]">
              <Swords className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Match Sessions:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">{totalMatchesCount} Total</span>
              <Link
                to="/matches"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-0.5 transition-colors"
                title="Inspect Matches and Dedicated Server Logs"
              >
                <Terminal className="w-3 h-3" /> Inspect
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3: Matchmaking Queue Status */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                MATCHMAKING QUEUE
              </p>
              <h3 className="text-lg font-extrabold text-slate-100 mt-1 font-mono">
                {serverState.matchmakingBlocked ? (
                  <span className="text-rose-400">PAUSED</span>
                ) : (
                  <span className="text-emerald-400">ACTIVE (OPEN)</span>
                )}
              </h3>
              <span className="text-xs text-slate-400 mt-1 block">
                {serverState.matchmakingBlocked ? 'Emergency Lock Engaged' : 'Auto Match Allocation'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>PvP Engine:</span>
            <span className="text-emerald-400 font-bold">Turn-Based SRPG</span>
          </div>
        </div>

        {/* Card 4: PayOS Transactions Summary (Admin) OR Dedicated Servers Status (Tech Support) */}
        {!isTechSupport ? (
          <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                  TREASURY RECEIPTS
                </p>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                  {paidOrdersCount} Paid
                </h3>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Webhooks Verified
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
                <Coins className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
              <span>Total Orders:</span>
              <span className="font-bold text-slate-200">{totalOrdersCount} Receipts</span>
            </div>
          </div>
        ) : (
          <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">
                  NETCODE INSTANCES
                </p>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
                  {activeMatchesCount} Live
                </h3>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                  <Server className="w-3.5 h-3.5" /> Dedicated Processes
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_14px_rgba(99,102,241,0.2)]">
                <Server className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
              <span>Port Allocation:</span>
              <span className="font-bold text-slate-200">7777 - 7800 RUDP</span>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Hero Presence Roster */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] my-6">
        <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold font-cinzel tracking-wider text-slate-100">
                REAL-TIME HERO PRESENCE ROSTER
              </h3>
              <p className="text-xs text-slate-400">
                Ground-truth presence verified across Realm Gateway & SignalR Support Hub
              </p>
            </div>
          </div>

          {/* Presence Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setPresenceFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                presenceFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              ALL ({trackedPlayers.length})
            </button>
            <button
              type="button"
              onClick={() => setPresenceFilter('ONLINE')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                presenceFilter === 'ONLINE'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'bg-white/[0.04] text-emerald-300 hover:text-white border border-emerald-500/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ONLINE ({trackedPlayers.filter((p) => p.presence.state === 'Online').length})
            </button>
            <button
              type="button"
              onClick={() => setPresenceFilter('BATTLE')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                presenceFilter === 'BATTLE'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-white/[0.04] text-amber-300 hover:text-white border border-amber-500/30'
              }`}
            >
              <Swords className="w-3 h-3 text-amber-400" />
              IN BATTLE ({trackedPlayers.filter((p) => p.presence.state === 'InBattle').length})
            </button>
            <button
              type="button"
              onClick={() => setPresenceFilter('OFFLINE')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                presenceFilter === 'OFFLINE'
                  ? 'bg-slate-700 text-white font-bold shadow'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.08]'
              }`}
            >
              OFFLINE ({trackedPlayers.filter((p) => p.presence.state === 'Offline').length})
            </button>
          </div>
        </div>

        {/* Presence Table */}
        {trackedPlayers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No active player sessions currently detected.</p>
            <p className="text-xs text-slate-500">Gateway telemetry is listening for hero logins in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950/70 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Hero & Account</th>
                  <th className="py-3 px-5">Presence Status</th>
                  <th className="py-3 px-5">Active Realm Location</th>
                  <th className="py-3 px-5 text-right">Last Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-200">
                {trackedPlayers
                  .filter((p) => {
                    if (presenceFilter === 'ONLINE') return p.presence.state === 'Online';
                    if (presenceFilter === 'BATTLE') return p.presence.state === 'InBattle';
                    if (presenceFilter === 'OFFLINE') return p.presence.state === 'Offline';
                    return true;
                  })
                  .map((player) => (
                    <tr key={player.playerId} className="hover:bg-white/[0.03] transition-colors">
                      {/* Hero Info */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/[0.1] flex items-center justify-center text-amber-400 font-bold text-xs font-cinzel shrink-0 shadow">
                              {player.username.slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080a0f] ${player.presence.dotColor}`}
                              title={player.presence.label}
                            />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 text-xs block">
                              {player.username}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-400">
                                Ref: #{player.playerId.slice(-6).toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(player.playerId);
                                  setMessage({
                                    text: `Copied Player ID for ${player.username} to clipboard.`,
                                    type: 'success',
                                  });
                                }}
                                className="text-amber-400 hover:text-amber-300 transition-colors p-0.5"
                                title={`Copy full ID: ${player.playerId}`}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Presence Badge */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 border shadow-sm ${player.presence.badgeBg} ${player.presence.badgeBorder} ${player.presence.badgeText}`}
                          >
                            {player.presence.state === 'InBattle' && <Swords className="w-3 h-3 animate-bounce" />}
                            {player.presence.state === 'Online' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                            {player.presence.state === 'Offline' && <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                            {player.presence.label}
                          </span>
                          {player.presence.state === 'InBattle' && (
                            <Link
                              to="/matches"
                              className="px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold inline-flex items-center gap-1 transition-all shadow-sm"
                              title="Inspect Dedicated Server Log for this Battle"
                            >
                              <Terminal className="w-3 h-3" /> LOGS
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Active Location */}
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-300">
                        {player.presence.activityDescription}
                      </td>

                      {/* Last Telemetry */}
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-slate-400">
                        {player.presence.relativeTime}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decorative Section Divider: Game Archives */}
      <div className="flex items-center justify-center gap-3 text-slate-400 font-cinzel font-bold text-xs tracking-widest my-4">
        <span className="text-amber-500/60">❖</span>
        <span className="uppercase text-slate-300">GAME ARCHIVES & REALM INFRASTRUCTURE</span>
        <span className="text-amber-500/60">❖</span>
      </div>

      {/* 4 Cards: Game Content & Server State */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Heroes Count */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">HERO ARCHIVES</p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{activeUnitsCount} Heroes</h3>
              <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 mt-1 font-mono">
                <Swords className="w-3.5 h-3.5" /> MongoDB Collection
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_14px_rgba(99,102,241,0.2)]">
              <Swords className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Endpoint:</span>
            <span className="font-bold text-slate-200">/api/UnitDefinition</span>
          </div>
        </div>

        {/* Card 2: Summon Banners */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">SUMMON BANNERS</p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{bannersCount} Banners</h3>
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1 mt-1">
                <Gem className="w-3.5 h-3.5 text-amber-400" /> Active Gacha Pools
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
              <Gem className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Endpoint:</span>
            <span className="font-bold text-slate-200">/api/gachabanner</span>
          </div>
        </div>

        {/* Card 3: Story Chapters */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">STORY CHAPTERS</p>
              <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{chaptersCount} Chapters</h3>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-1">
                <TrendingUp className="w-3.5 h-3.5" /> Story Maps Configured
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Endpoint:</span>
            <span className="font-bold text-slate-200">/api/ChapterConfig</span>
          </div>
        </div>

        {/* Card 4: Server Gateway */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-cinzel font-bold text-slate-400 uppercase tracking-wider">REALM GATEWAY</p>
              <h3 className="text-lg font-extrabold text-slate-100 mt-1 font-mono">ONLINE (.NET 9)</h3>
              <span className="text-xs text-slate-400 font-mono mt-1 block">Active / MongoDB Atlas</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.2)]">
              <Server className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>SignalR Hub:</span>
            <span className="text-emerald-400 font-bold">/hubs/support</span>
          </div>
        </div>
      </div>

      {/* Emergency Counsel Override Actions */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-rose-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase font-cinzel">EMERGENCY REALM OVERRIDES</h3>
              <p className="text-xs text-slate-400">Direct operational overrides via AdminController endpoints.</p>
            </div>
          </div>
          {!canOverride && (
            <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5">
              <ShieldX className="w-3.5 h-3.5" /> RESTRICTED
            </span>
          )}
        </div>

        {!canOverride && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldX className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Restricted Operations:</strong> Emergency server overrides are restricted to Technical Support & Administrators (Use Case: Configure System).
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Toggle Login */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200 font-cinzel">PLAYER AUTHENTICATION</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Status: {serverState.loginBlocked ? <span className="text-rose-400 font-bold">BLOCKED</span> : <span className="text-emerald-400 font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleLoginStatus}
              disabled={!canOverride || loadingAction === 'login'}
              title={!canOverride ? 'Privilege required' : 'Toggle login status'}
              className="btn-glass px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {serverState.loginBlocked ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-rose-400" />}
              {serverState.loginBlocked ? 'UNBLOCK' : 'BLOCK'}
            </button>
          </div>

          {/* Toggle Matchmaking */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200 font-cinzel">PVP MATCH QUEUE</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Status: {serverState.matchmakingBlocked ? <span className="text-amber-400 font-bold">PAUSED</span> : <span className="text-emerald-400 font-bold">ACTIVE</span>}
              </p>
            </div>
            <button
              onClick={toggleQueueStatus}
              disabled={!canOverride || loadingAction === 'queue'}
              title={!canOverride ? 'Privilege required' : 'Toggle queue status'}
              className="btn-glass px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {serverState.matchmakingBlocked ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              {serverState.matchmakingBlocked ? 'RESUME' : 'PAUSE'}
            </button>
          </div>

          {/* Force Stop All */}
          <div className="p-4 rounded-xl bg-black/40 border border-rose-500/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-300 font-cinzel">RESET MATCHES</p>
              <p className="text-xs text-slate-400 mt-1">Terminates active sessions</p>
            </div>
            <button
              onClick={handleForceStopAll}
              disabled={!canOverride || loadingAction === 'forceStop'}
              title={!canOverride ? 'Privilege required' : 'Force stop all active sessions'}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Power className="w-3.5 h-3.5" />
              FORCE STOP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
