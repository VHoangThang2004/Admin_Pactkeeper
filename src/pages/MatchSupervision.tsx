import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import { fetchAvailableLogFiles, fetchMatchLogs } from '../api/matchLogApi';
import { MatchLogInspector } from '../components/MatchLogInspector';
import {
  Swords,
  Activity,
  Server,
  FileText,
  RefreshCw,
  Search,
  Copy,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  ChevronRight,
  Radio,
  X,
  User,
  Download,
  Terminal,
} from 'lucide-react';
import type { MatchHistoryItem, LogFileInfo, MatchLogResponse, MatchLogLevel } from '../types';

/**
 * MatchSupervision Component (Screen 33: Match Inspector & Screen 34: Combat Action Logs)
 * 
 * Remade to HoYoverse AAA Gaming Standards:
 * - Central tactical esports & telemetry console for Moderators and Administrators
 * - Dual Page-Level Tabs:
 *   1. Dedicated Server Diagnostics: Raw dedicated VPS log stream and diagnostics
 *   2. Match Sessions Directory: Comprehensive match database records and in-modal log inspection
 */
export const MatchSupervision: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryMatchId = searchParams.get('matchId') || '';

  // Page-Level Tab: Default to Dedicated Server Diagnostics
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'sessions'>('diagnostics');

  // Target Match ID for dedicated log inspector tab
  const [targetMatchId, setTargetMatchId] = useState<string>(queryMatchId);

  // Match telemetry data
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [playerNamesMap, setPlayerNamesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  // Selected match for detailed modal inspection (Screen 33 detail)
  const [inspectingMatch, setInspectingMatch] = useState<MatchHistoryItem | null>(null);

  // Selected match for in-modal log inspection
  const [inspectingLogMatch, setInspectingLogMatch] = useState<MatchHistoryItem | null>(null);
  const [modalLogData, setModalLogData] = useState<MatchLogResponse | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalFilterLevel, setModalFilterLevel] = useState<MatchLogLevel | 'ALL'>('ALL');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalCopied, setModalCopied] = useState<boolean>(false);

  // Tab 2 (Sessions) Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'PVP' | 'RANKED' | 'FRIENDLY'>('ALL');
  const [logFilter, setLogFilter] = useState<'ALL' | 'HAS_LOG' | 'NO_LOG'>('ALL');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(50);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Fast format timestamp helper
   */
  const formatDateTime = useCallback((dateStr?: string) => {
    if (!dateStr) return { date: 'N/A', time: '', full: 'N/A' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: 'N/A', time: '', full: 'N/A' };
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return {
        date: `${day}/${month}/${year}`,
        time: `${hours}:${minutes}:${seconds}`,
        full: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
      };
    } catch {
      return { date: 'N/A', time: '', full: 'N/A' };
    }
  }, []);

  /**
   * Fetches telemetry, match sessions, server log files, and player directory
   */
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [matchRes, logFilesData, playerRes] = await Promise.allSettled([
        adminClient.get('/Match/history'),
        fetchAvailableLogFiles(200),
        adminClient.get('/player/all'),
      ]);

      if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
        setMatches(matchRes.value.data);
      }

      if (logFilesData.status === 'fulfilled' && Array.isArray(logFilesData.value)) {
        setLogFiles(logFilesData.value);
      }

      if (playerRes.status === 'fulfilled' && Array.isArray(playerRes.value.data)) {
        const pMap = new Map<string, string>();
        playerRes.value.data.forEach((p: any) => {
          if (p.playerId) {
            const name = (p.username || '').trim() || `Traveler #${p.playerId.slice(-4).toUpperCase()}`;
            pMap.set(p.playerId, name);
          }
        });
        setPlayerNamesMap(pMap);
      }
    } catch {
      // Graceful error fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update target match when queryParam changes
  useEffect(() => {
    if (queryMatchId) {
      setTargetMatchId(queryMatchId);
      setActiveTab('diagnostics');
    }
  }, [queryMatchId]);

  // Set of Match IDs that currently have a physical .log file on VPS disk
  const logFileSet = useMemo(() => {
    const set = new Set<string>();
    logFiles.forEach((f) => {
      if (f.matchId) set.add(f.matchId.toLowerCase().trim());
    });
    return set;
  }, [logFiles]);

  // Active (Live) battles count
  const liveMatches = useMemo(() => {
    return matches.filter((m) => {
      const s = String(m.status || '').toLowerCase();
      return s === 'inprogress' || s === 'active' || s === 'playing' || s === 'running' || m.status === 1;
    });
  }, [matches]);

  // Filtered match sessions for Tab 2
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const mId = (m.matchId || '').toLowerCase();
      const p1 = (m.player1Id || '').toLowerCase();
      const p2 = (m.player2Id || '').toLowerCase();
      const p1Name = (playerNamesMap.get(m.player1Id || '') || '').toLowerCase();
      const p2Name = (playerNamesMap.get(m.player2Id || '') || '').toLowerCase();
      const mode = String(m.mode || 'pvp').toLowerCase();
      const status = String(m.status || 'completed').toLowerCase();
      const isLive = status.includes('progress') || status.includes('active') || status.includes('playing') || m.status === 1;
      const hasLog = logFileSet.has(mId);

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          mId.includes(q) ||
          p1.includes(q) ||
          p2.includes(q) ||
          p1Name.includes(q) ||
          p2Name.includes(q) ||
          mode.includes(q);
        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter === 'LIVE' && !isLive) return false;
      if (statusFilter === 'COMPLETED' && (isLive || status.includes('cancel'))) return false;
      if (statusFilter === 'CANCELLED' && !status.includes('cancel')) return false;

      // Mode filter
      if (modeFilter !== 'ALL' && mode !== modeFilter.toLowerCase()) return false;

      // Log availability filter
      if (logFilter === 'HAS_LOG' && !hasLog) return false;
      if (logFilter === 'NO_LOG' && hasLog) return false;

      return true;
    });
  }, [matches, searchQuery, statusFilter, modeFilter, logFilter, logFileSet, playerNamesMap]);

  // Sliced matches according to display limit
  const displayedMatches = useMemo(() => {
    if (displayLimit === 'ALL') return filteredMatches;
    return filteredMatches.slice(0, displayLimit);
  }, [filteredMatches, displayLimit]);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch log for in-modal inspection when inspectingLogMatch is chosen
  useEffect(() => {
    if (!inspectingLogMatch) {
      setModalLogData(null);
      setModalError(null);
      return;
    }

    const loadModalLogs = async () => {
      setModalLoading(true);
      setModalError(null);
      try {
        const data = await fetchMatchLogs(inspectingLogMatch.matchId);
        setModalLogData(data);
      } catch (err: any) {
        setModalLogData(null);
        if (err.response?.status === 404) {
          setModalError('No physical .log file found on VPS disk.');
        } else {
          setModalError(err.message || 'Error reaching backend server.');
        }
      } finally {
        setModalLoading(false);
      }
    };

    loadModalLogs();
  }, [inspectingLogMatch]);

  // Filtered lines inside the Inspect Log Modal
  const filteredModalLines = useMemo(() => {
    if (!modalLogData) return [];
    return modalLogData.lines.filter((line) => {
      if (modalFilterLevel !== 'ALL' && line.level !== modalFilterLevel) {
        return false;
      }
      if (modalSearch.trim()) {
        return line.raw.toLowerCase().includes(modalSearch.toLowerCase());
      }
      return true;
    });
  }, [modalLogData, modalFilterLevel, modalSearch]);

  const handleCopyModalLogs = () => {
    if (!modalLogData) return;
    navigator.clipboard.writeText(modalLogData.rawText);
    setModalCopied(true);
    setTimeout(() => setModalCopied(false), 2000);
  };

  const handleDownloadModalLog = () => {
    if (!modalLogData || !inspectingLogMatch) return;
    const blob = new Blob([modalLogData.rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inspectingLogMatch.matchId}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 select-none font-sans text-slate-100">
      {/* Page Header Astral Banner */}
      <div className="hy-glass p-6 md:p-8 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
        {/* Ornate Corner Marks */}
        <span className="absolute top-3 left-3 text-amber-400/40 text-xs">❖</span>
        <span className="absolute top-3 right-3 text-amber-400/40 text-xs">❖</span>

        {/* Ambient Glow Orbs */}
        <div
          className="absolute -top-16 -right-16 w-80 h-80 bg-cyan-500/[0.08] rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 -left-16 w-72 h-72 bg-amber-500/[0.05] rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 uppercase font-bold tracking-wider shadow-[0_0_12px_rgba(56,189,248,0.15)]">
                OPERATIONAL TELEMETRY & DIAGNOSTICS
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">Netcode NGO 7777–7800</span>
            </div>
            <h2 className="text-xl md:text-3xl font-extrabold tracking-wide font-cinzel flex items-center gap-3 text-slate-100">
              <Swords className="w-6 h-6 text-amber-300 drop-shadow-[0_0_8px_rgba(242,191,78,0.5)]" />
              <span className="hy-gold-text">MATCH SUPERVISION & SERVER LOGS</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl font-sans">
              Authoritative overview of live & historical SRPG battles alongside raw dedicated VPS diagnostic logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAllData}
              disabled={loading}
              className="hy-btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shadow transition-all disabled:opacity-50"
              title="Refresh telemetry overview"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC TELEMETRY</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Telemetry Status Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-4 relative z-10">
          {/* Active Battles */}
          <div className="hy-card p-3.5 rounded-xl flex items-center gap-3 border border-emerald-500/20 hover:border-emerald-500/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Live Battles</span>
              <span className="text-base font-extrabold font-mono text-emerald-300">
                {loading ? '...' : `${liveMatches.length} Active`}
              </span>
            </div>
          </div>

          {/* Recorded Matches */}
          <div className="hy-card p-3.5 rounded-xl flex items-center gap-3 border border-amber-400/20 hover:border-amber-400/50">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(242,191,78,0.2)]">
              <Swords className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Recorded</span>
              <span className="text-base font-extrabold font-mono text-amber-300">
                {loading ? '...' : `${matches.length} Matches`}
              </span>
            </div>
          </div>

          {/* Log Archives */}
          <div className="hy-card p-3.5 rounded-xl flex items-center gap-3 border border-cyan-500/20 hover:border-cyan-500/50">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">VPS Log Files</span>
              <span className="text-base font-extrabold font-mono text-cyan-300">
                {loading ? '...' : `${logFiles.length} Logs`}
              </span>
            </div>
          </div>

          {/* Netcode Engine */}
          <div className="hy-card p-3.5 rounded-xl flex items-center gap-3 border border-indigo-500/20 hover:border-indigo-500/50">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Dedicated VPS</span>
              <span className="text-base font-extrabold font-mono text-indigo-300">Ubuntu 22.04</span>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE-LEVEL TABS (Without (50) and (510)) */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('diagnostics')}
          className={`px-5 py-2.5 rounded-xl text-xs font-cinzel font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-300'
              : 'hy-glass text-slate-300 hover:text-white hover:border-cyan-400/40'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>DEDICATED SERVER DIAGNOSTICS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-2.5 rounded-xl text-xs font-cinzel font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_20px_rgba(242,191,78,0.4)] border border-amber-300'
              : 'hy-glass text-slate-300 hover:text-white hover:border-amber-400/40'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>MATCH SESSIONS DIRECTORY</span>
          {liveMatches.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-500 text-white font-extrabold animate-pulse">
              {liveMatches.length} LIVE
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DEDICATED SERVER DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          {/* Quick Notice about VPS Retention */}
          <div className="hy-card p-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-xs flex items-center justify-between gap-3 text-cyan-200">
            <div className="flex items-center gap-2 font-mono">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Viewing dedicated server stdout/stderr files currently stored on VPS disk (<code className="text-amber-300 font-bold">{logFiles.length} files</code> available). Older matches rotate automatically to maintain disk performance.
              </span>
            </div>
            {targetMatchId && (
              <button
                type="button"
                onClick={() => setTargetMatchId('')}
                className="text-[11px] underline text-cyan-300 hover:text-cyan-100 shrink-0 font-mono"
              >
                Clear Target Match
              </button>
            )}
          </div>

          {/* Embedded Match Log Inspector Terminal (Strictly Server Log Files) */}
          <MatchLogInspector initialMatchId={targetMatchId} />
        </div>
      )}

      {/* TAB 2: MATCH SESSIONS DIRECTORY */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="hy-glass p-4 rounded-2xl border border-white/[0.08] space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Match GUID, Player ID, Player Alias, or Mode..."
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/[0.08]">
                {(['ALL', 'LIVE', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      statusFilter === st
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'LIVE' ? '🔴 LIVE' : st}
                  </button>
                ))}
              </div>

              {/* Mode Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/[0.08]">
                <Swords className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-mono text-amber-300 outline-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-100">All Modes</option>
                  <option value="PVP" className="bg-slate-900 text-slate-100">PVP</option>
                  <option value="RANKED" className="bg-slate-900 text-slate-100">Ranked</option>
                  <option value="FRIENDLY" className="bg-slate-900 text-slate-100">Friendly</option>
                </select>
              </div>

              {/* Log Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/[0.08]">
                <FileText className="w-3.5 h-3.5 text-cyan-400 ml-1.5" />
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-mono text-cyan-300 outline-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-100">All Logs</option>
                  <option value="HAS_LOG" className="bg-slate-900 text-slate-100">Has VPS Log ({logFileSet.size})</option>
                  <option value="NO_LOG" className="bg-slate-900 text-slate-100">No Log / Archived</option>
                </select>
              </div>

              {/* Page Display Limit */}
              <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/[0.08]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono text-slate-400">Show:</span>
                <select
                  value={displayLimit}
                  onChange={(e) => setDisplayLimit(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="bg-transparent text-xs font-mono text-amber-300 font-bold outline-none cursor-pointer"
                >
                  <option value={25} className="bg-slate-900 text-slate-100">25</option>
                  <option value={50} className="bg-slate-900 text-slate-100">50</option>
                  <option value={100} className="bg-slate-900 text-slate-100">100</option>
                  <option value={200} className="bg-slate-900 text-slate-100">200</option>
                  <option value="ALL" className="bg-slate-900 text-slate-100">All ({filteredMatches.length})</option>
                </select>
              </div>
            </div>

            {/* Quick Summary Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1 px-1 border-t border-white/[0.04]">
              <span>
                Displaying <strong className="text-amber-300">{displayedMatches.length}</strong> of{' '}
                <strong className="text-slate-200">{filteredMatches.length}</strong> matches (Total Recorded: {matches.length})
              </span>
              <span>Sorted by Latest First ↓</span>
            </div>
          </div>

          {/* Matches List Table */}
          <div className="hy-glass rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950/80 text-[11px] font-cinzel font-bold text-amber-400/90 uppercase tracking-wider border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Match ID / Mode</th>
                    <th className="py-3 px-4">Status & Server Host</th>
                    <th className="py-3 px-4">Combatants (P1 vs P2)</th>
                    <th className="py-3 px-4">Diagnostics Log</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {displayedMatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <Swords className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                        No match sessions found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    displayedMatches.map((m, idx) => {
                      const mId = m.matchId || m.id || '';
                      const isLive =
                        String(m.status || '').toLowerCase().includes('progress') ||
                        String(m.status || '').toLowerCase().includes('active') ||
                        String(m.status || '').toLowerCase().includes('playing') ||
                        m.status === 1;
                      const hasLog = logFileSet.has(mId.toLowerCase());
                      const dt = formatDateTime(m.createdAt);
                      const p1Name = playerNamesMap.get(m.player1Id || '') || (m.player1Id ? `Traveler #${m.player1Id.slice(-4).toUpperCase()}` : 'Player 1');
                      const p2Name = playerNamesMap.get(m.player2Id || '') || (m.player2Id ? `Traveler #${m.player2Id.slice(-4).toUpperCase()}` : 'Player 2');

                      return (
                        <tr
                          key={mId || idx}
                          className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                          onClick={() => setInspectingMatch(m)}
                        >
                          {/* Match ID / Mode */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-100 font-bold group-hover:text-amber-300 transition-colors">
                                #{mId.slice(0, 8)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopy(mId, e)}
                                title="Copy full GUID"
                                className="text-slate-500 hover:text-amber-300 transition-colors"
                              >
                                {copiedId === mId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase font-bold">
                                {m.mode || 'PVP'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {dt.date} {dt.time}
                              </span>
                            </div>
                          </td>

                          {/* Status & Server Host */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {isLive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                                  <Radio className="w-3 h-3" /> LIVE COMBAT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                                  {m.status || 'Finished'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <Server className="w-3 h-3 text-indigo-400" />
                              <span>{m.serverIp || 'VPS'}:{m.serverPort || '7777'}</span>
                            </div>
                          </td>

                          {/* Combatants */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-cyan-300 font-semibold truncate max-w-[120px]" title={p1Name}>
                                {p1Name}
                              </span>
                              <span className="text-amber-400/80 font-bold text-[10px]">VS</span>
                              <span className="text-rose-300 font-semibold truncate max-w-[120px]" title={p2Name}>
                                {p2Name}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[240px]">
                              P1: {m.player1Id?.slice(0, 10)}... • P2: {m.player2Id?.slice(0, 10)}...
                            </div>
                          </td>

                          {/* Diagnostics Log Status */}
                          <td className="py-3.5 px-4">
                            {hasLog ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> VPS Log Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-white/[0.02] border border-white/[0.06]">
                                Archived / Rotated
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectingLogMatch(m)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow ${
                                  hasLog
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                    : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.1]'
                                }`}
                                title="Inspect session logs in modal"
                              >
                                <span>Inspect Log</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MATCH DETAIL MODAL */}
      {inspectingMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setInspectingMatch(null)}
        >
          <div
            className="hy-card p-6 md:p-8 rounded-2xl border border-white/[0.15] shadow-2xl max-w-xl w-full space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-bold">
                  MATCH SESSION RECORD
                </span>
                <h3 className="text-lg font-bold font-cinzel text-slate-100 mt-1 flex items-center gap-2">
                  <Swords className="w-5 h-5 text-amber-400" />
                  <span>Match #{inspectingMatch.matchId?.slice(0, 10)}</span>
                </h3>
              </div>
              <button
                onClick={() => setInspectingMatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/[0.08] space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Full Match GUID:</span>
                  <span className="text-amber-300 select-all font-bold">{inspectingMatch.matchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Game Mode:</span>
                  <span className="text-slate-200 uppercase font-bold">{inspectingMatch.mode || 'PVP'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Server Host:</span>
                  <span className="text-indigo-300">{inspectingMatch.serverIp || 'VPS'}:{inspectingMatch.serverPort || '7777'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recorded Status:</span>
                  <span className="text-emerald-300 font-bold">{inspectingMatch.status || 'Finished'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created At:</span>
                  <span className="text-slate-300">{formatDateTime(inspectingMatch.createdAt).full}</span>
                </div>
              </div>

              {/* Combatants Box */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/[0.08] space-y-2">
                <span className="text-slate-400 text-[11px] block font-cinzel uppercase font-bold text-amber-400">
                  Combatants
                </span>
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Player 1:
                  </span>
                  <span className="text-slate-200">
                    {playerNamesMap.get(inspectingMatch.player1Id || '') || inspectingMatch.player1Id || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Player 2:
                  </span>
                  <span className="text-slate-200">
                    {playerNamesMap.get(inspectingMatch.player2Id || '') || inspectingMatch.player2Id || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Log File Availability Notice */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                logFileSet.has((inspectingMatch.matchId || '').toLowerCase())
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-950 border-white/[0.08] text-slate-400'
              }`}>
                <FileText className="w-4 h-4 shrink-0" />
                <div className="text-[11px]">
                  {logFileSet.has((inspectingMatch.matchId || '').toLowerCase()) ? (
                    <span>Physical .log file is present on Dedicated VPS disk ready for diagnostic streaming.</span>
                  ) : (
                    <span>Log file has been rotated/archived from VPS disk. Older sessions retain database records without raw logs.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setInspectingMatch(null)}
                className="hy-btn-glass px-4 py-2 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const m = inspectingMatch;
                  setInspectingMatch(null);
                  setInspectingLogMatch(m);
                }}
                className="btn-primary-gold px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Inspect Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT LOG MODAL FOR MATCH SESSIONS */}
      {inspectingLogMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setInspectingLogMatch(null)}
        >
          <div
            className="hy-card p-6 rounded-2xl border border-white/[0.15] shadow-2xl max-w-4xl w-full space-y-4 relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase font-bold">
                    MATCH ACTION LOG INSPECTOR
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase font-bold font-mono">
                    {inspectingLogMatch.mode || 'PVP'}
                  </span>
                </div>
                <h3 className="text-base md:text-lg font-bold font-cinzel text-slate-100 mt-1 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-400" />
                  <span>Match #{inspectingLogMatch.matchId}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(inspectingLogMatch.matchId, e)}
                    title="Copy GUID"
                    className="text-slate-500 hover:text-amber-300 transition-colors ml-1"
                  >
                    {copiedId === inspectingLogMatch.matchId ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Combatants: <span className="text-cyan-300">{playerNamesMap.get(inspectingLogMatch.player1Id || '') || inspectingLogMatch.player1Id || 'P1'}</span> vs <span className="text-rose-300">{playerNamesMap.get(inspectingLogMatch.player2Id || '') || inspectingLogMatch.player2Id || 'P2'}</span> • Server: {inspectingLogMatch.serverIp || 'VPS'}:{inspectingLogMatch.serverPort || '7777'}
                </p>
              </div>
              <button
                onClick={() => setInspectingLogMatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col space-y-3 min-h-0">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                  <p className="font-mono text-xs text-amber-300">Retrieving dedicated server logs from VPS...</p>
                </div>
              ) : modalError ? (
                <div className="py-12 px-6 rounded-xl bg-slate-950/80 border border-white/[0.08] text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-200">No Physical Log File on VPS Disk</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    The raw stdout/stderr log file for this match has been rotated or cleared from the server disk to optimize storage. Session results and telemetry remain permanently preserved in MongoDB.
                  </p>
                  <div className="p-3 max-w-md mx-auto rounded-lg bg-slate-900 border border-white/[0.05] text-[11px] font-mono text-slate-300 text-left space-y-1">
                    <div>• Match ID: <span className="text-amber-300">{inspectingLogMatch.matchId}</span></div>
                    <div>• Mode: <span className="text-slate-200 uppercase">{inspectingLogMatch.mode || 'PVP'}</span></div>
                    <div>• Status: <span className="text-emerald-300">{inspectingLogMatch.status || 'Finished'}</span></div>
                    <div>• Recorded At: <span>{formatDateTime(inspectingLogMatch.createdAt).full}</span></div>
                  </div>
                </div>
              ) : modalLogData ? (
                <div className="flex flex-col flex-1 overflow-hidden space-y-2">
                  {/* Modal Toolbar: Search, Level Filter, Copy, Download */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2 rounded-xl border border-white/[0.08] text-xs">
                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Filter log lines..."
                        className="bg-transparent border-none text-xs font-mono text-slate-200 outline-none w-full placeholder-slate-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(['ALL', 'ERROR', 'WARN', 'SYSTEM', 'INFO'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setModalFilterLevel(lvl)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                            modalFilterLevel === lvl
                              ? lvl === 'ERROR'
                                ? 'bg-rose-500 text-white'
                                : lvl === 'WARN'
                                ? 'bg-amber-500 text-slate-950'
                                : lvl === 'SYSTEM'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-cyan-500 text-slate-950'
                              : 'bg-white/[0.04] text-slate-400 hover:text-white'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleCopyModalLogs}
                        className="hy-btn-glass px-2.5 py-1 text-xs flex items-center gap-1 text-slate-300 hover:text-white"
                        title="Copy all logs"
                      >
                        {modalCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{modalCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadModalLog}
                        className="hy-btn-glass px-2.5 py-1 text-xs flex items-center gap-1 text-cyan-300 hover:text-white"
                        title="Export .log file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Terminal View Body */}
                  <div className="flex-1 overflow-y-auto rounded-xl p-3 font-mono text-xs leading-relaxed space-y-1 select-text bg-[#04060a] border border-white/[0.08] shadow-inner max-h-[50vh]">
                    {filteredModalLines.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        No log lines matched the active filter.
                      </div>
                    ) : (
                      filteredModalLines.map((line) => {
                        let rowColor = 'text-slate-300';
                        let badgeColor = 'text-slate-400 bg-slate-800/40';

                        if (line.level === 'ERROR') {
                          rowColor = 'text-rose-200 bg-rose-950/20 border-l-2 border-rose-500 pl-2 -ml-2';
                          badgeColor = 'text-rose-300 bg-rose-500/20 font-bold';
                        } else if (line.level === 'WARN') {
                          rowColor = 'text-amber-200 bg-amber-950/20 border-l-2 border-amber-500 pl-2 -ml-2';
                          badgeColor = 'text-amber-300 bg-amber-500/20 font-bold';
                        } else if (line.level === 'SYSTEM') {
                          rowColor = 'text-emerald-200';
                          badgeColor = 'text-emerald-300 bg-emerald-500/20 font-semibold';
                        }

                        return (
                          <div key={line.lineNumber} className={`flex items-start gap-3 hover:bg-white/[0.03] py-0.5 rounded px-1 transition-colors ${rowColor}`}>
                            <span className="text-slate-600 select-none text-right shrink-0 w-8 font-mono text-[10px]">
                              {line.lineNumber}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded shrink-0 uppercase select-none font-mono ${badgeColor}`}>
                              {line.level}
                            </span>
                            <span className="break-all whitespace-pre-wrap flex-1">
                              {line.raw}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom stats */}
                  <div className="text-[11px] font-mono text-slate-500 flex justify-between px-1">
                    <span>Showing {filteredModalLines.length} of {modalLogData.lines.length} lines</span>
                    <span>Retrieved: {modalLogData.retrievedAt}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setInspectingLogMatch(null)}
                className="hy-btn-glass px-4 py-2 text-xs font-semibold"
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

export default MatchSupervision;
