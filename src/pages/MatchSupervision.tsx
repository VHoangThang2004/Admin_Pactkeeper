import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import { MatchLogInspector } from '../components/MatchLogInspector';
import { Swords, Activity, Server, FileText, RefreshCw } from 'lucide-react';
import type { MatchHistoryItem } from '../types';

/**
 * MatchSupervision Component (Screen 33: Match Inspector & Screen 34: Combat Action Logs)
 * 
 * Central supervision console for Moderators and Administrators to:
 * 1. Query ongoing and historical PvP combat matches by Match ID or Player ID.
 * 2. Replay and audit turn-by-turn RPC action packets (timestamps, unit grid coordinates, ability casts).
 * 3. Stream and inspect raw Unity Headless Dedicated Server log files from Linux VPS host.
 * 4. Verify combat fairness, detect desynchronization bugs, and enforce anti-cheat rules.
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
      {/* Page Header Banner */}
      <div className="mahogany-banner p-6 rounded-lg space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#593d29] pb-3">
          <div>
            <span className="text-xs font-mono text-[#c89b3c] uppercase font-bold tracking-wider block">
              SCREEN 33 & 34 • MATCH SUPERVISION & COMBAT ACTION LOGS
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold text-[#ffe082] tracking-wide font-cinzel flex items-center gap-2.5">
              <Swords className="w-6 h-6 text-[#d4af37]" />
              MATCH INSPECTOR & SERVER DIAGNOSTICS
            </h2>
            <p className="text-xs text-[#d5c7b3] font-serif mt-1">
              Authoritative turn-by-turn combat replay, anti-cheat audit trail, and live Dedicated Server log stream.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchQuickMetrics}
              disabled={loadingMetrics}
              className="p-2 rounded bg-[#3a2518] hover:bg-[#4a3020] border border-[#c89b3c] text-[#ffe082] text-xs font-cinzel font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              title="Refresh telemetry overview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
              REFRESH TELEMETRY
            </button>
          </div>
        </div>

        {/* 4 Quick Telemetry Status Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-[#26170d] border border-[#c89b3c]/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#10b981]/10 border border-[#10b981]/40 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#34d399] animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-[#d5c7b3] uppercase tracking-wider block">Active Battles</span>
              <span className="text-base font-extrabold font-mono text-[#34d399]">
                {loadingMetrics ? '...' : `${activeMatchesCount} Live`}
              </span>
            </div>
          </div>

          <div className="p-3 rounded bg-[#26170d] border border-[#c89b3c]/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/40 flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4 text-[#fbbf24]" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-[#d5c7b3] uppercase tracking-wider block">Recorded Matches</span>
              <span className="text-base font-extrabold font-mono text-[#ffe082]">
                {loadingMetrics ? '...' : `${totalMatchesCount} Total`}
              </span>
            </div>
          </div>

          <div className="p-3 rounded bg-[#26170d] border border-[#c89b3c]/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/40 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#60a5fa]" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-[#d5c7b3] uppercase tracking-wider block">VPS Log Files</span>
              <span className="text-base font-extrabold font-mono text-[#93c5fd]">
                {loadingMetrics ? '...' : `${logFilesCount} Logs`}
              </span>
            </div>
          </div>

          <div className="p-3 rounded bg-[#26170d] border border-[#c89b3c]/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/40 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-[#d5c7b3] uppercase tracking-wider block">Engine Protocol</span>
              <span className="text-xs font-extrabold font-mono text-[#c4b5fd]">
                Netcode / RUDP
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
