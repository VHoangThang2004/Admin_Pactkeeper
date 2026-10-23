import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import { MatchLogInspector } from '../components/MatchLogInspector';
import { Swords, Activity, Server, FileText, RefreshCw } from 'lucide-react';
import type { MatchHistoryItem } from '../types';

/**
 * MatchSupervision Component (Screen 33: Match Inspector & Screen 34: Combat Action Logs)
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * - Central tactical esports & telemetry console for Moderators and Administrators
 * - Real-time Netcode for GameObjects (NGO) headless server status
 * - Live turn-by-turn combat replay, anti-cheat audit trail, and raw Linux VPS log inspector
 */
export const MatchSupervision: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryMatchId = searchParams.get('matchId') || '';

  const [activeMatchesCount, setActiveMatchesCount] = useState<number>(0);
  const [totalMatchesCount, setTotalMatchesCount] = useState<number>(0);
  const [logFilesCount, setLogFilesCount] = useState<number>(0);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);

  const fetchQuickMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const [matchRes, logFilesRes] = await Promise.allSettled([
        adminClient.get('/Match/history'),
        adminClient.get('/Match/logs/files'),
      ]);

      if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
        const matches: MatchHistoryItem[] = matchRes.value.data;
        setTotalMatchesCount(matches.length);
        const live = matches.filter((m) => {
          const s = String(m.status || '').toLowerCase();
          return s === 'inprogress' || s === 'active' || s === 'playing' || s === 'running' || m.status === 1;
        });
        setActiveMatchesCount(live.length);
      }

      if (logFilesRes.status === 'fulfilled' && Array.isArray(logFilesRes.value.data)) {
        setLogFilesCount(logFilesRes.value.data.length);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchQuickMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header Astral Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Subtle ambient light orb */}
        <div 
          className="absolute -top-16 -right-16 w-64 h-64 bg-cyan-500/[0.08] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase font-bold tracking-wider">
                SCREEN 33 & 34 • TACTICAL TELEMETRY
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">Netcode NGO 7777–7800</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel flex items-center gap-3 text-slate-100">
              <Swords className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="gold-gradient-text">MATCH INSPECTOR & SERVER DIAGNOSTICS</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Authoritative turn-by-turn combat replay, anti-cheat audit trail, and raw VPS Dedicated Server telemetry streams.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchQuickMetrics}
              disabled={loadingMetrics}
              className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              title="Refresh telemetry overview"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loadingMetrics ? 'animate-spin' : ''}`} />
              <span>SYNC TELEMETRY</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Telemetry Status Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-4">
          {/* Active Battles */}
          <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Live Battles</span>
              <span className="text-base font-extrabold font-mono text-emerald-300">
                {loadingMetrics ? '...' : `${activeMatchesCount} Active`}
              </span>
            </div>
          </div>

          {/* Recorded Matches */}
          <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <Swords className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Recorded</span>
              <span className="text-base font-extrabold font-mono text-amber-300">
                {loadingMetrics ? '...' : `${totalMatchesCount} Sessions`}
              </span>
            </div>
          </div>

          {/* VPS Log Files */}
          <div className="glass-card-cyan p-3.5 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">VPS Log Files</span>
              <span className="text-base font-extrabold font-mono text-cyan-300">
                {loadingMetrics ? '...' : `${logFilesCount} Logs`}
              </span>
            </div>
          </div>

          {/* Netcode Engine */}
          <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Network Core</span>
              <span className="text-xs font-bold font-mono text-indigo-300">
                NGO / RUDP Headless
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Match Log Inspector */}
      <MatchLogInspector initialMatchId={queryMatchId} />
    </div>
  );
};

export default MatchSupervision;
