import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Terminal,
  Search,
  RefreshCw,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowDownCircle,
  Radio,
  AlertCircle,
  FolderOpen,
  Clock,
  ChevronDown,
  ChevronUp,
  Swords,
  Filter,
  Calendar,
  SlidersHorizontal
} from 'lucide-react';
import { fetchMatchLogs, fetchRecentMatchesForLogs, fetchAvailableLogFiles } from '../api/matchLogApi';
import type { MatchLogResponse, MatchLogLevel, MatchHistoryItem, LogFileInfo } from '../types';

interface MatchLogInspectorProps {
  initialMatchId?: string;
  onSelectMatch?: (matchId: string) => void;
}

export const MatchLogInspector: React.FC<MatchLogInspectorProps> = ({
  initialMatchId = '',
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(initialMatchId);
  const [inputMatchId, setInputMatchId] = useState<string>(initialMatchId);
  const [logData, setLogData] = useState<MatchLogResponse | null>(null);
  const [availableLogFiles, setAvailableLogFiles] = useState<LogFileInfo[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryItem[]>([]);
  const [sourceMode, setSourceMode] = useState<'files' | 'matches'>('files');
  const [browseExpanded, setBrowseExpanded] = useState<boolean>(true);
  const [browseSearch, setBrowseSearch] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(50);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<MatchLogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Helper to format full date (DD/MM/YYYY) and time (HH:mm:ss)
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
        full: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
      };
    } catch {
      return { date: 'N/A', time: '', full: 'N/A' };
    }
  }, []);

  // Strict date descending sorting (newest first from top to bottom)
  const sortedLogFiles = useMemo(() => {
    return [...availableLogFiles].sort((a, b) => {
      const timeA = a.lastModifiedUtc ? new Date(a.lastModifiedUtc).getTime() : 0;
      const timeB = b.lastModifiedUtc ? new Date(b.lastModifiedUtc).getTime() : 0;
      return timeB - timeA;
    });
  }, [availableLogFiles]);

  const sortedMatches = useMemo(() => {
    return [...recentMatches].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [recentMatches]);

  // Current active total count
  const currentTotal = sourceMode === 'files' ? sortedLogFiles.length : sortedMatches.length;

  // Dynamic limit options based on total logs available: 50, 100, 150, 200,...
  const limitOptions = useMemo(() => {
    const total = currentTotal;
    const opts: number[] = [];
    const step = 50;
    for (let i = step; i < total; i += step) {
      opts.push(i);
    }
    return opts;
  }, [currentTotal]);

  // Sliced items for Main Select Dropdown according to displayLimit
  const selectLogFiles = useMemo(() => {
    if (displayLimit === 'ALL') return sortedLogFiles;
    return sortedLogFiles.slice(0, displayLimit);
  }, [sortedLogFiles, displayLimit]);

  const selectMatches = useMemo(() => {
    if (displayLimit === 'ALL') return sortedMatches;
    return sortedMatches.slice(0, displayLimit);
  }, [sortedMatches, displayLimit]);

  // Fetch lists on mount
  const refreshFiles = useCallback(async () => {
    try {
      const [files, matches] = await Promise.allSettled([
        fetchAvailableLogFiles(),
        fetchRecentMatchesForLogs()
      ]);

      if (files.status === 'fulfilled') {
        setAvailableLogFiles(files.value);
        if (!selectedMatchId && files.value.length > 0) {
          const newest = [...files.value].sort((a, b) => {
            const timeA = a.lastModifiedUtc ? new Date(a.lastModifiedUtc).getTime() : 0;
            const timeB = b.lastModifiedUtc ? new Date(b.lastModifiedUtc).getTime() : 0;
            return timeB - timeA;
          })[0];
          setSelectedMatchId(newest.matchId);
          setInputMatchId(newest.matchId);
        }
      }

      if (matches.status === 'fulfilled') {
        setRecentMatches(matches.value);
        if (!selectedMatchId && files.status !== 'fulfilled' && matches.value.length > 0) {
          const newestM = [...matches.value].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          })[0];
          setSelectedMatchId(newestM.matchId);
          setInputMatchId(newestM.matchId);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, [selectedMatchId]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Load log data
  const loadLogs = useCallback(async (matchIdToLoad: string) => {
    if (!matchIdToLoad) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchMatchLogs(matchIdToLoad);
      setLogData(data);
    } catch (err: any) {
      setLogData(null);
      if (err.response?.status === 404) {
        setErrorMessage(`No server log found for Match ID "${matchIdToLoad}".`);
      } else {
        setErrorMessage(err.message || 'Network error: Unable to reach backend gateway API.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      loadLogs(selectedMatchId);
    }
  }, [selectedMatchId, loadLogs]);

  // Live Auto-Refresh polling (tail -f)
  useEffect(() => {
    let interval: any = null;
    if (autoRefresh && selectedMatchId) {
      interval = setInterval(() => {
        loadLogs(selectedMatchId);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedMatchId, loadLogs]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logData, autoScroll]);

  // Filtered log lines
  const filteredLines = useMemo(() => {
    if (!logData) return [];
    return logData.lines.filter((line) => {
      if (filterLevel !== 'ALL' && line.level !== filterLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        return line.raw.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [logData, filterLevel, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMatchId.trim()) {
      setSelectedMatchId(inputMatchId.trim());
    }
  };

  const handleCopyLogs = () => {
    if (!logData) return;
    navigator.clipboard.writeText(logData.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLog = () => {
    if (!logData) return;
    const blob = new Blob([logData.rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMatchId}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const errorCount = useMemo(() => {
    return logData?.lines.filter((l) => l.level === 'ERROR').length || 0;
  }, [logData]);

  const warnCount = useMemo(() => {
    return logData?.lines.filter((l) => l.level === 'WARN').length || 0;
  }, [logData]);

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Top Banner & Quick Controls */}
      <div className="glass-panel p-5 rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-white/[0.1] flex items-center justify-center text-amber-400 shadow-inner">
            <Terminal className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold font-cinzel tracking-wider uppercase flex items-center gap-2 gold-gradient-text">
              MATCH SERVER LOG INSPECTOR
              {logData && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono normal-case flex items-center gap-1 font-bold">
                  <Radio className="w-3 h-3 animate-pulse" /> LIVE VPS LOG
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Streaming real-time stdout/stderr from Dedicated Game Server instance (<code className="text-amber-300 font-mono">logs/match_*.log</code>)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh Tail -f Toggle */}
          <button
            type="button"
            disabled={!selectedMatchId}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed ${
              autoRefresh
                ? 'bg-emerald-500 text-slate-950 font-bold border border-emerald-400 animate-pulse'
                : 'btn-glass text-slate-300'
            }`}
            title="Automatically poll and stream latest log additions every 3 seconds"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>TAIL -F {autoRefresh ? '(STREAMING)' : ''}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => loadLogs(selectedMatchId)}
            disabled={loading || !selectedMatchId}
            className="btn-glass px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>

          {/* Copy Logs */}
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={!logData}
            className="btn-glass px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'COPIED!' : 'COPY'}</span>
          </button>

          {/* Download Log File */}
          <button
            type="button"
            onClick={handleDownloadLog}
            disabled={!logData}
            className="btn-glass px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download full .log file"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>EXPORT .LOG</span>
          </button>
        </div>
      </div>

      {/* Compact Log Selector & Search Bar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-white/[0.08] space-y-3">
        {/* Source Mode Tabs & Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSourceMode('files')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                sourceMode === 'files'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Server Log Files ({availableLogFiles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('matches')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                sourceMode === 'matches'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Match Sessions ({recentMatches.length})</span>
            </button>
          </div>

          {/* Quick Stats / Active Match indicator */}
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>Selected Target:</span>
            <span className="text-amber-300 font-bold">
              {selectedMatchId ? `#${selectedMatchId.slice(0, 8)}` : 'None'}
            </span>
          </div>
        </div>

        {/* Primary Controls Row: Dropdown, Manual Search, Load, and Browse Drawer Toggle */}
        <div className="flex flex-col lg:flex-row items-center gap-2">
          {/* Main Dropdown */}
          <div className="flex-1 w-full relative">
            {sourceMode === 'files' ? (
              <select
                value={selectedMatchId}
                onChange={(e) => {
                  if (e.target.value) {
                    setInputMatchId(e.target.value);
                    setSelectedMatchId(e.target.value);
                  }
                }}
                className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 outline-none transition-all cursor-pointer shadow-inner"
              >
                <option value="" disabled>-- Select Server Log File ({selectLogFiles.length} of {sortedLogFiles.length} files - Newest First) --</option>
                {selectLogFiles.map((file, idx) => {
                  const dt = formatDateTime(file.lastModifiedUtc || file.createdAtUtc);
                  const kb = (file.fileSizeBytes / 1024).toFixed(1);
                  return (
                    <option key={file.fileName} value={file.matchId} className="bg-slate-900 text-slate-100">
                      {idx === 0 ? '★ [LATEST] ' : `[#${idx + 1}] `}[{dt.date} {dt.time}] - {file.fileName} ({kb} KB)
                    </option>
                  );
                })}
              </select>
            ) : (
              <select
                value={selectedMatchId}
                onChange={(e) => {
                  if (e.target.value) {
                    setInputMatchId(e.target.value);
                    setSelectedMatchId(e.target.value);
                  }
                }}
                className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 outline-none transition-all cursor-pointer shadow-inner"
              >
                <option value="" disabled>-- Select Match Session ({selectMatches.length} of {sortedMatches.length} matches - Newest First) --</option>
                {selectMatches.map((m, idx) => {
                  const dt = formatDateTime(m.createdAt);
                  const isLive = (m.status || '').toString().toLowerCase().includes('active');
                  return (
                    <option key={m.matchId} value={m.matchId} className="bg-slate-900 text-slate-100">
                      {isLive ? '🔴 [LIVE] ' : idx === 0 ? '★ [LATEST] ' : `[#${idx + 1}] `}[{dt.date} {dt.time}] - #{m.matchId.slice(0, 8)} - {m.mode || 'PVP'} ({m.status || 'Done'})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Manual Input + Action */}
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputMatchId}
                onChange={(e) => setInputMatchId(e.target.value)}
                placeholder="Or paste custom GUID..."
                className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl pl-8 pr-2 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="btn-primary-gold px-3.5 py-2 text-xs font-bold flex items-center justify-center gap-1 shadow shrink-0"
            >
              <span>LOAD</span>
            </button>
            <button
              type="button"
              onClick={refreshFiles}
              title="Rescan server files & match sessions"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-amber-400 transition-all shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Display Limit Dropdown in Primary Row */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 border border-white/[0.1] rounded-xl px-2.5 py-1.5 shadow-inner">
              <SlidersHorizontal className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-mono text-slate-400">Max:</span>
              <select
                value={displayLimit}
                onChange={(e) => setDisplayLimit(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="bg-transparent text-xs font-mono text-amber-300 font-bold outline-none cursor-pointer"
                title="Select maximum logs to display (50, 100, 150, 200, ... or All)"
              >
                {limitOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
                <option value="ALL" className="bg-slate-900 text-slate-100">
                  All ({currentTotal})
                </option>
              </select>
            </div>

            {/* Toggle Drawer Button */}
            <button
              type="button"
              onClick={() => setBrowseExpanded(!browseExpanded)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                browseExpanded
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                  : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-amber-400/40'
              }`}
              title="Toggle log list sorted by date descending"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Directory ({sourceMode === 'files' ? sortedLogFiles.length : sortedMatches.length})</span>
              {browseExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>

        {/* Clean Info Header / Sorting Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 px-1 text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Order: <strong className="text-amber-300">Newest first (Top to Bottom) ↓</strong> • Showing up to <span className="text-amber-300 font-bold">{displayLimit === 'ALL' ? currentTotal : displayLimit}</span> of {currentTotal} logs
            </span>
          </div>
          {selectedMatchId && (
            <div className="text-[11px] font-mono text-slate-400">
              Selected: <span className="text-amber-300 font-bold">{selectedMatchId}</span>
            </div>
          )}
        </div>

        {/* Vertical Ordered Log List */}
        {browseExpanded && (
          <div className="pt-2 border-t border-white/[0.08] space-y-2">
            {/* Filter toolbar inside drawer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  CHRONOLOGICAL DIRECTORY
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold">
                  {sourceMode === 'files' ? `${sortedLogFiles.length} files` : `${sortedMatches.length} matches`}
                </span>
              </div>

              {/* Toolbar right controls: Search input + Display Limit selector */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Filter className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={browseSearch}
                    onChange={(e) => setBrowseSearch(e.target.value)}
                    placeholder="Filter by date, ID, file..."
                    className="w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400 rounded-lg pl-8 pr-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-white/[0.1]">
                  <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                  <span className="text-[11px] font-mono text-slate-400">Show:</span>
                  <select
                    value={displayLimit}
                    onChange={(e) => setDisplayLimit(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    className="bg-transparent text-xs font-mono text-amber-300 font-bold outline-none cursor-pointer"
                  >
                    {limitOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                        {opt} logs
                      </option>
                    ))}
                    <option value="ALL" className="bg-slate-900 text-slate-100">
                      All ({currentTotal} logs)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Strictly Vertical List Container (Top to Bottom) */}
            <div className="max-h-80 overflow-y-auto rounded-xl bg-slate-950/80 border border-white/[0.08] divide-y divide-white/[0.04] shadow-inner">
              {sourceMode === 'files' ? (
                (() => {
                  const filtered = sortedLogFiles.filter((f) => {
                    if (!browseSearch) return true;
                    const q = browseSearch.toLowerCase();
                    const dt = formatDateTime(f.lastModifiedUtc || f.createdAtUtc);
                    return (
                      f.matchId.toLowerCase().includes(q) ||
                      f.fileName.toLowerCase().includes(q) ||
                      dt.full.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-500 font-mono">
                        No server log files found matching filter &quot;{browseSearch}&quot;
                      </div>
                    );
                  }

                  const displayed = displayLimit === 'ALL' ? filtered : filtered.slice(0, displayLimit);

                  return (
                    <>
                      {displayed.map((file, idx) => {
                        const isSelected = selectedMatchId === file.matchId;
                        const dt = formatDateTime(file.lastModifiedUtc || file.createdAtUtc);
                        const kb = (file.fileSizeBytes / 1024).toFixed(1);

                        return (
                          <div
                            key={file.fileName}
                            onClick={() => {
                              setInputMatchId(file.matchId);
                              setSelectedMatchId(file.matchId);
                            }}
                            className={`w-full p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-amber-500/15 border-l-4 border-l-amber-400 shadow'
                                : 'hover:bg-white/[0.04] border-l-4 border-l-transparent'
                            }`}
                          >
                            {/* 1. Date & Time */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  idx === 0
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                                }`}
                              >
                                {idx === 0 ? '★ LATEST' : `#${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span className="flex items-center gap-1 text-slate-200 font-semibold bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                  {dt.date}
                                </span>
                                <span className="flex items-center gap-1 text-slate-400 bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  {dt.time}
                                </span>
                              </div>
                            </div>

                            {/* 2. File Name & Match GUID */}
                            <div className="flex-1 min-w-0 font-mono">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="text-xs font-bold text-slate-200 truncate">
                                  {file.fileName}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                                  {kb} KB
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block truncate">
                                GUID: {file.matchId}
                              </span>
                            </div>

                            {/* 3. Status Action */}
                            <div className="flex items-center justify-end shrink-0">
                              {isSelected ? (
                                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  STREAMING
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400 group-hover:text-amber-300 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.06]">
                                  SELECT →
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()
              ) : (
                (() => {
                  const filtered = sortedMatches.filter((m) => {
                    if (!browseSearch) return true;
                    const q = browseSearch.toLowerCase();
                    const dt = formatDateTime(m.createdAt);
                    return (
                      m.matchId.toLowerCase().includes(q) ||
                      (m.mode != null && String(m.mode).toLowerCase().includes(q)) ||
                      (m.status != null && String(m.status).toLowerCase().includes(q)) ||
                      dt.full.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-500 font-mono">
                        No match sessions found matching filter &quot;{browseSearch}&quot;
                      </div>
                    );
                  }

                  const displayed = displayLimit === 'ALL' ? filtered : filtered.slice(0, displayLimit);

                  return (
                    <>
                      {displayed.map((m, idx) => {
                        const isSelected = selectedMatchId === m.matchId;
                        const dt = formatDateTime(m.createdAt);
                        const isLive =
                          (m.status || '').toString().toLowerCase().includes('progress') ||
                          (m.status || '').toString().toLowerCase().includes('active');

                        return (
                          <div
                            key={m.matchId}
                            onClick={() => {
                              setInputMatchId(m.matchId);
                              setSelectedMatchId(m.matchId);
                            }}
                            className={`w-full p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-amber-500/15 border-l-4 border-l-amber-400 shadow'
                                : 'hover:bg-white/[0.04] border-l-4 border-l-transparent'
                            }`}
                          >
                            {/* 1. Date & Time */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  idx === 0
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                                }`}
                              >
                                {idx === 0 ? '★ LATEST' : `#${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span className="flex items-center gap-1 text-slate-200 font-semibold bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                  {dt.date}
                                </span>
                                <span className="flex items-center gap-1 text-slate-400 bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  {dt.time}
                                </span>
                              </div>
                            </div>

                            {/* 2. Match ID & Mode */}
                            <div className="flex-1 min-w-0 font-mono">
                              <div className="flex items-center gap-2">
                                <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-xs font-bold text-slate-200 truncate">
                                  Match #{m.matchId.slice(0, 8)}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300 uppercase font-bold">
                                  {m.mode || 'PVP'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block truncate">
                                GUID: {m.matchId}
                              </span>
                            </div>

                            {/* 3. Status & Action */}
                            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                                  isLive
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                                }`}
                              >
                                {m.status || 'Finished'}
                              </span>
                              {isSelected ? (
                                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  VIEWING
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400 hover:text-white px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.06] transition-all">
                                  VIEW LOG →
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real Error Notification Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1 font-mono">
            <strong>Server Response:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Terminal View Container (Deep Carbon Dark Console) */}
      <div className="bg-[#05070c] border border-white/[0.1] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex flex-col">
        {/* Terminal Header Bar */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2 select-none text-xs">
          {/* File location path */}
          <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/80 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]/80 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            <span className="w-3 h-3 rounded-full bg-[#10b981]/80 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="ml-2 text-slate-500">Target Log Stream:</span>
            <span className="text-amber-300 font-semibold break-all">
              {selectedMatchId ? (logData?.logPath || `match_${selectedMatchId}.log`) : 'No Match Selected'}
            </span>
          </div>

          {/* Log Filters & Stats */}
          {logData && (
            <div className="flex flex-wrap items-center gap-2">
              {errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errorCount} ERRORS
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold flex items-center gap-1">
                  {warnCount} WARN
                </span>
              )}

              {/* Filter by level */}
              <div className="flex items-center bg-black/60 rounded-lg border border-white/[0.1] p-0.5">
                {(['ALL', 'ERROR', 'WARN', 'SYSTEM', 'INFO'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                      filterLevel === lvl
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* In-Log Search Input */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in log..."
                  className="bg-black/60 border border-white/[0.1] rounded-lg pl-6 pr-2 py-0.5 text-[11px] font-mono text-slate-100 placeholder-slate-500 outline-none w-28 focus:w-36 transition-all"
                />
              </div>

              {/* Auto scroll toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded-lg border text-[11px] ${
                  autoScroll
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-black/60 text-slate-500 border-white/[0.1]'
                }`}
                title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Terminal Content Body */}
        <div className="p-4 max-h-[580px] min-h-[380px] overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text scrollbar-thin bg-[#04060a]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <p className="font-mono text-xs text-amber-300">Fetching VPS logs via /api/Match/{selectedMatchId}/logs...</p>
            </div>
          ) : !selectedMatchId ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Please select or enter a Match GUID.</p>
              <p className="text-xs text-slate-500">Provide a valid match identifier to inspect dedicated server log output.</p>
            </div>
          ) : errorMessage ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <p className="text-sm font-semibold text-rose-300">No log output available for this session.</p>
              <p className="text-xs text-slate-400 font-mono">{errorMessage}</p>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">
                {logData ? 'No log lines matched the active filter.' : 'Log file is empty.'}
              </p>
              <p className="text-xs text-slate-500">Try clearing your search query or level filters.</p>
            </div>
          ) : (
            filteredLines.map((line) => {
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
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer Bar */}
        <div className="bg-slate-950/90 px-4 py-2.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-4">
            <span>
              Total Lines: <strong className="text-amber-300">{logData?.lines.length || 0}</strong>
            </span>
            <span>
              Filtered: <strong className="text-amber-300">{filteredLines.length}</strong>
            </span>
            <span>
              Retrieved: <span className="text-slate-300">{logData?.retrievedAt || '--:--'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Unity NGO Headless Engine</span>
            <span>❖</span>
            <span>PactKeeper High Counsel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
