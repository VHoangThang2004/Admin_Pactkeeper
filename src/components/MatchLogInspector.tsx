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
  Filter
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
  const [browseExpanded, setBrowseExpanded] = useState<boolean>(false);
  const [browseSearch, setBrowseSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<MatchLogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch real matches history & available log files from backend on mount
  useEffect(() => {
    const loadInitialData = async () => {
      const [matches, files] = await Promise.all([
        fetchRecentMatchesForLogs(),
        fetchAvailableLogFiles(),
      ]);
      setRecentMatches(matches);
      setAvailableLogFiles(files);

      // If no initial match ID was set, automatically select the most recently updated log file!
      if (!selectedMatchId) {
        if (files.length > 0) {
          setSelectedMatchId(files[0].matchId);
          setInputMatchId(files[0].matchId);
        } else if (matches.length > 0) {
          setSelectedMatchId(matches[0].matchId);
          setInputMatchId(matches[0].matchId);
        }
      }
    };
    loadInitialData();
  }, [selectedMatchId]);

  const refreshFiles = async () => {
    const files = await fetchAvailableLogFiles();
    setAvailableLogFiles(files);
  };

  // Fetch logs directly from backend
  const loadLogs = useCallback(async (matchIdToLoad: string) => {
    if (!matchIdToLoad.trim()) {
      setLogData(null);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetchMatchLogs(matchIdToLoad.trim());
      setLogData(res);
      setErrorMessage(null);
    } catch (err: any) {
      setLogData(null);
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.message || err.response.data?.error || err.message;
        if (status === 404) {
          setErrorMessage(msg || `Match log file not found on server (404) for match ${matchIdToLoad.trim()}.`);
        } else {
          setErrorMessage(`Failed to fetch logs from server (${status}): ${msg}`);
        }
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
    <div className="space-y-4 font-sans text-[#f7f1e1]">
      {/* Top Banner & Quick Controls */}
      <div className="mahogany-banner p-4 rounded-lg shadow-md border border-[#c89b3c]/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2b1b11] border border-[#c89b3c] flex items-center justify-center text-[#ffe082] shadow">
            <Terminal className="w-5 h-5 text-[#c89b3c]" />
          </div>
          <div>
            <h2 className="text-base font-bold font-cinzel text-[#ffe082] tracking-wider uppercase flex items-center gap-2">
              MATCH SERVER LOG INSPECTOR
              {logData && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#10b981]/20 border border-[#10b981] text-[#34d399] font-mono normal-case flex items-center gap-1 font-bold">
                  <Radio className="w-3 h-3 animate-pulse" /> LIVE VPS LOG
                </span>
              )}
            </h2>
            <p className="text-xs text-[#c4b49e] font-serif">
              Reading real-time logs from Dedicated Game Server instance (<code className="text-[#ffe082] font-mono">logs/match_*.log</code>)
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
            className={`px-3 py-1.5 rounded text-xs font-cinzel font-bold flex items-center gap-1.5 transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed ${
              autoRefresh
                ? 'bg-[#15803d] text-white border border-[#22c55e] animate-pulse'
                : 'bg-[#2b1b11] text-[#c4b49e] hover:text-white border border-[#523725]'
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
            className="px-3 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>

          {/* Copy Logs */}
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={!logData}
            className="px-3 py-1.5 rounded bg-[#2b1b11] hover:bg-[#3d2719] border border-[#c89b3c] text-xs font-cinzel font-bold flex items-center gap-1.5 text-[#ffe082] shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" /> : <Copy className="w-3.5 h-3.5 text-[#c89b3c]" />}
            <span>{copied ? 'COPIED!' : 'COPY'}</span>
          </button>

          {/* Download Log File */}
          <button
            type="button"
            onClick={handleDownloadLog}
            disabled={!logData}
            className="px-3 py-1.5 rounded bg-[#2b1b11] hover:bg-[#3d2719] border border-[#c89b3c] text-xs font-cinzel font-bold flex items-center gap-1.5 text-[#ffe082] shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download full .log file"
          >
            <Download className="w-3.5 h-3.5 text-[#c89b3c]" />
            <span>EXPORT .LOG</span>
          </button>
        </div>
      </div>

      {/* Compact Log Selector & Search Bar */}
      <div className="bg-[#24160d] p-3 rounded-lg border border-[#c89b3c]/30 space-y-2.5">
        {/* Source Mode Tabs & Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d2719] pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSourceMode('files')}
              className={`px-2.5 py-1 rounded text-xs font-cinzel font-bold flex items-center gap-1.5 transition-all ${
                sourceMode === 'files'
                  ? 'bg-[#c89b3c] text-[#1c120c] shadow'
                  : 'bg-[#170e08] text-[#a89984] hover:text-[#ffe082] border border-[#523725]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Server Log Files ({availableLogFiles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('matches')}
              className={`px-2.5 py-1 rounded text-xs font-cinzel font-bold flex items-center gap-1.5 transition-all ${
                sourceMode === 'matches'
                  ? 'bg-[#c89b3c] text-[#1c120c] shadow'
                  : 'bg-[#170e08] text-[#a89984] hover:text-[#ffe082] border border-[#523725]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Match Sessions ({recentMatches.length})</span>
            </button>
          </div>

          {/* Quick Stats / Active Match indicator */}
          <div className="text-[11px] font-mono text-[#8c7456] flex items-center gap-2">
            <span>Selected Target:</span>
            <span className="text-[#ffe082] font-bold">
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
                className="w-full bg-[#170e08] border border-[#523725] focus:border-[#c89b3c] rounded px-3 py-2 text-xs font-mono text-[#ffe082] outline-none transition-all cursor-pointer shadow-inner"
              >
                <option value="" disabled>-- Select a Server Log File ({availableLogFiles.length} files) --</option>
                {availableLogFiles.map((file, idx) => {
                  const time = file.lastModifiedUtc ? new Date(file.lastModifiedUtc).toLocaleTimeString() : '';
                  const kb = (file.fileSizeBytes / 1024).toFixed(1);
                  return (
                    <option key={file.fileName} value={file.matchId}>
                      {idx === 0 ? '★ [LATEST] ' : ''}{file.fileName} ({kb} KB - {time})
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
                className="w-full bg-[#170e08] border border-[#523725] focus:border-[#c89b3c] rounded px-3 py-2 text-xs font-mono text-[#ffe082] outline-none transition-all cursor-pointer shadow-inner"
              >
                <option value="" disabled>-- Select a Match Session ({recentMatches.length} matches) --</option>
                {recentMatches.map((m, idx) => {
                  const isLive = (m.status || '').toString().toLowerCase().includes('active');
                  return (
                    <option key={m.matchId} value={m.matchId}>
                      {isLive ? '🔴 [LIVE] ' : idx === 0 ? '★ [RECENT] ' : ''}#{m.matchId.slice(0, 8)} - {m.mode || 'PVP'} ({m.status || 'Done'})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Manual Input + Action */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-56">
              <Search className="w-3.5 h-3.5 text-[#8c7456] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputMatchId}
                onChange={(e) => setInputMatchId(e.target.value)}
                placeholder="Or paste custom GUID..."
                className="w-full bg-[#170e08] border border-[#523725] focus:border-[#c89b3c] rounded pl-8 pr-2 py-2 text-xs font-mono text-[#ffe082] placeholder-[#78644e] outline-none transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 rounded mahogany-button text-xs font-cinzel font-bold flex items-center justify-center gap-1 shadow shrink-0"
            >
              <span>LOAD</span>
            </button>
            <button
              type="button"
              onClick={refreshFiles}
              title="Rescan server files & matches"
              className="p-2 rounded bg-[#170e08] hover:bg-[#2b1b11] border border-[#523725] text-[#c89b3c] hover:text-[#ffe082] transition-all shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {/* Toggle Drawer Button */}
            <button
              type="button"
              onClick={() => setBrowseExpanded(!browseExpanded)}
              className={`px-2.5 py-2 rounded border text-xs font-cinzel font-bold flex items-center gap-1 transition-all shrink-0 ${
                browseExpanded
                  ? 'bg-[#c89b3c]/20 border-[#c89b3c] text-[#ffe082]'
                  : 'bg-[#170e08] border-[#523725] text-[#a89984] hover:text-white'
              }`}
              title="Toggle full browse drawer"
            >
              <span>Browse ({sourceMode === 'files' ? availableLogFiles.length : recentMatches.length})</span>
              {browseExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>

        {/* Quick Pick Chips (Clean, single-line, max 4 chips) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
          <span className="text-[11px] text-[#8c7456] font-sans flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#c89b3c]" /> Quick picks:
          </span>
          {sourceMode === 'files'
            ? availableLogFiles.slice(0, 4).map((file, idx) => {
                const isSelected = selectedMatchId === file.matchId;
                const kb = (file.fileSizeBytes / 1024).toFixed(1);
                return (
                  <button
                    key={file.fileName}
                    type="button"
                    onClick={() => {
                      setInputMatchId(file.matchId);
                      setSelectedMatchId(file.matchId);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-[#c89b3c] text-[#1c120c] border-[#ffe082] font-bold shadow'
                        : 'bg-[#170e08] text-[#d4c5b0] hover:text-[#ffe082] border-[#523725]'
                    }`}
                  >
                    {idx === 0 && (
                      <span className="text-[9px] px-1 rounded bg-[#10b981]/20 text-[#34d399] font-sans font-bold">
                        NEW
                      </span>
                    )}
                    <span>#{file.matchId.slice(0, 8)}</span>
                    <span className="text-[10px] text-[#8c7456]">({kb}K)</span>
                  </button>
                );
              })
            : recentMatches.slice(0, 4).map((m) => {
                const isSelected = selectedMatchId === m.matchId;
                const isLive = (m.status || '').toString().toLowerCase().includes('active');
                return (
                  <button
                    key={m.matchId}
                    type="button"
                    onClick={() => {
                      setInputMatchId(m.matchId);
                      setSelectedMatchId(m.matchId);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-[#c89b3c] text-[#1c120c] border-[#ffe082] font-bold shadow'
                        : 'bg-[#170e08] text-[#d4c5b0] hover:text-[#ffe082] border-[#523725]'
                    }`}
                  >
                    {isLive && (
                      <span className="text-[9px] px-1 rounded bg-[#10b981]/20 text-[#34d399] font-sans font-bold">
                        LIVE
                      </span>
                    )}
                    <span>#{m.matchId.slice(0, 8)}</span>
                    <span className="text-[9px] text-[#8c7456] uppercase">{m.mode || 'PVP'}</span>
                  </button>
                );
              })}
        </div>

        {/* Collapsible Browse All Panel (Scrollable, searchable drawer) */}
        {browseExpanded && (
          <div className="pt-2 border-t border-[#3d2719] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-xs">
                <Filter className="w-3 h-3 text-[#8c7456] absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={browseSearch}
                  onChange={(e) => setBrowseSearch(e.target.value)}
                  placeholder="Filter by ID, mode or keyword..."
                  className="w-full bg-[#170e08] border border-[#523725] focus:border-[#c89b3c] rounded pl-7 pr-2 py-1 text-[11px] font-mono text-[#ffe082] placeholder-[#78644e] outline-none"
                />
              </div>
              <span className="text-[11px] text-[#8c7456] font-mono">
                Total {sourceMode === 'files' ? availableLogFiles.length : recentMatches.length} items
              </span>
            </div>

            {/* Scrollable Chip Grid */}
            <div className="max-h-40 overflow-y-auto p-2 rounded bg-[#170e08] border border-[#523725] flex flex-wrap gap-1.5">
              {sourceMode === 'files'
                ? availableLogFiles
                    .filter((f) => !browseSearch || f.matchId.toLowerCase().includes(browseSearch.toLowerCase()))
                    .map((file) => {
                      const isSelected = selectedMatchId === file.matchId;
                      const kb = (file.fileSizeBytes / 1024).toFixed(1);
                      return (
                        <button
                          key={file.fileName}
                          type="button"
                          onClick={() => {
                            setInputMatchId(file.matchId);
                            setSelectedMatchId(file.matchId);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-[#c89b3c] text-[#1c120c] border-[#ffe082] font-bold shadow'
                              : 'bg-[#24160d] text-[#d4c5b0] hover:text-[#ffe082] border-[#523725]'
                          }`}
                        >
                          <span>#{file.matchId.slice(0, 8)}</span>
                          <span className="text-[10px] text-[#8c7456]">({kb} KB)</span>
                        </button>
                      );
                    })
                : recentMatches
                    .filter(
                      (m) =>
                        !browseSearch ||
                        m.matchId.toLowerCase().includes(browseSearch.toLowerCase()) ||
                        (m.mode && m.mode.toLowerCase().includes(browseSearch.toLowerCase()))
                    )
                    .map((m) => {
                      const isSelected = selectedMatchId === m.matchId;
                      const isLive =
                        (m.status || '').toString().toLowerCase().includes('progress') ||
                        (m.status || '').toString().toLowerCase().includes('active');
                      return (
                        <button
                          key={m.matchId}
                          type="button"
                          onClick={() => {
                            setInputMatchId(m.matchId);
                            setSelectedMatchId(m.matchId);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-[#c89b3c] text-[#1c120c] border-[#ffe082] font-bold shadow'
                              : 'bg-[#24160d] text-[#d4c5b0] hover:text-[#ffe082] border-[#523725]'
                          }`}
                        >
                          <span>#{m.matchId.slice(0, 8)}</span>
                          <span
                            className={`text-[9px] px-1 rounded uppercase font-sans font-bold ${
                              isLive ? 'bg-[#10b981]/20 text-[#34d399]' : 'bg-[#4b5563]/20 text-[#9ca3af]'
                            }`}
                          >
                            {m.mode || 'MATCH'}
                          </span>
                        </button>
                      );
                    })}
            </div>
          </div>
        )}
      </div>

      {/* Real Error Notification Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded bg-[#7f1d1d]/30 border border-[#ef4444] text-[#fca5a5] text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#f87171] shrink-0" />
          <div className="flex-1 font-mono">
            <strong>Server Response:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Terminal View Container */}
      <div className="bg-[#120a06] border-2 border-[#523725] focus-within:border-[#c89b3c] rounded-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Terminal Header Bar */}
        <div className="bg-[#1c120c] px-4 py-2.5 border-b border-[#3d2719] flex flex-wrap items-center justify-between gap-2 select-none text-xs">
          {/* File location path */}
          <div className="flex items-center gap-2 font-mono text-[#a89984] text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span className="ml-2 text-[#78644e]">Log Target:</span>
            <span className="text-[#ffe082] font-semibold break-all">
              {selectedMatchId ? (logData?.logPath || `match_${selectedMatchId}.log`) : 'No Match Selected'}
            </span>
          </div>

          {/* Log Filters & Stats */}
          {logData && (
            <div className="flex flex-wrap items-center gap-2">
              {errorCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40 font-mono text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errorCount} ERRORS
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/40 font-mono text-[10px] font-bold flex items-center gap-1">
                  {warnCount} WARN
                </span>
              )}

              {/* Filter by level */}
              <div className="flex items-center bg-[#170e08] rounded border border-[#523725] p-0.5">
                {(['ALL', 'ERROR', 'WARN', 'SYSTEM', 'INFO'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2 py-0.5 rounded text-[10px] font-cinzel font-bold transition-all ${
                      filterLevel === lvl
                        ? 'bg-[#c89b3c] text-[#1c120c]'
                        : 'text-[#8c7456] hover:text-[#d4c5b0]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* In-Log Search Input */}
              <div className="relative">
                <Search className="w-3 h-3 text-[#78644e] absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in log..."
                  className="bg-[#170e08] border border-[#523725] rounded pl-6 pr-2 py-0.5 text-[11px] font-mono text-[#ffe082] placeholder-[#78644e] outline-none w-28 focus:w-36 transition-all"
                />
              </div>

              {/* Auto scroll toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded border text-[11px] ${
                  autoScroll
                    ? 'bg-[#3a2518] text-[#ffe082] border-[#c89b3c]'
                    : 'bg-[#170e08] text-[#78644e] border-[#523725]'
                }`}
                title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Terminal Content Body */}
        <div className="p-4 max-h-[580px] min-h-[380px] overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#8c7456] space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#c89b3c]" />
              <p className="font-cinzel text-xs text-[#ffe082]">Calling GET /api/Match/{selectedMatchId}/logs...</p>
            </div>
          ) : !selectedMatchId ? (
            <div className="text-center py-16 text-[#78644e] space-y-1 font-serif">
              <Terminal className="w-8 h-8 mx-auto text-[#523725]" />
              <p className="text-sm font-bold font-cinzel text-[#a89984]">Please select or enter a Match GUID.</p>
              <p className="text-xs text-[#78644e]">Provide a valid match identifier to inspect dedicated server log output.</p>
            </div>
          ) : errorMessage ? (
            <div className="text-center py-16 text-[#78644e] space-y-2 font-serif">
              <AlertCircle className="w-8 h-8 mx-auto text-[#ef4444]" />
              <p className="text-sm font-bold font-cinzel text-[#fca5a5]">No log output available for this session.</p>
              <p className="text-xs text-[#a89984] font-mono">{errorMessage}</p>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="text-center py-16 text-[#78644e] space-y-1 font-serif">
              <FileText className="w-8 h-8 mx-auto text-[#523725]" />
              <p className="text-sm font-bold font-cinzel text-[#a89984]">
                {logData ? 'No log lines matched the active filter.' : 'Log file is empty.'}
              </p>
              <p className="text-xs text-[#78644e]">Try clearing your search query or level filters.</p>
            </div>
          ) : (
            filteredLines.map((line) => {
              let rowColor = 'text-[#e2d9cc]';
              let badgeColor = 'text-[#9ca3af] bg-[#374151]/30';

              if (line.level === 'ERROR') {
                rowColor = 'text-[#fca5a5] bg-[#7f1d1d]/20 border-l-2 border-[#ef4444] pl-2 -ml-2';
                badgeColor = 'text-[#f87171] bg-[#ef4444]/20 font-bold';
              } else if (line.level === 'WARN') {
                rowColor = 'text-[#fcd34d] bg-[#78350f]/15 border-l-2 border-[#f59e0b] pl-2 -ml-2';
                badgeColor = 'text-[#fbbf24] bg-[#f59e0b]/20 font-bold';
              } else if (line.level === 'SYSTEM') {
                rowColor = 'text-[#86efac]';
                badgeColor = 'text-[#34d399] bg-[#10b981]/20 font-semibold';
              }

              return (
                <div key={line.lineNumber} className={`flex items-start gap-3 hover:bg-[#1f120a] py-0.5 rounded px-1 transition-colors ${rowColor}`}>
                  <span className="text-[#64503e] select-none text-right shrink-0 w-8 font-mono text-[10px]">
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
        <div className="bg-[#170e08] px-4 py-2 border-t border-[#3d2719] flex flex-wrap items-center justify-between text-[11px] text-[#8c7456] font-mono">
          <div className="flex items-center gap-4">
            <span>
              Total Lines: <strong className="text-[#ffe082]">{logData?.lines.length || 0}</strong>
            </span>
            <span>
              Filtered: <strong className="text-[#ffe082]">{filteredLines.length}</strong>
            </span>
            <span>
              Retrieved: <span className="text-[#d4c5b0]">{logData?.retrievedAt || '--:--'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[#78644e]">
            <span>Dedicated Server Logs: Unity Headless</span>
            <span>❖</span>
            <span>PactKeeper High Counsel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
