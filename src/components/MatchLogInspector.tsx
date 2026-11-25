import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Filter,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { fetchAvailableLogFiles, fetchMatchLogs } from '../api/matchLogApi';
import type { LogFileInfo, MatchLogLevel, MatchLogResponse } from '../types';
import { downloadLogText, formatLogDateTime } from '../utils/logFormat';
import { LogTerminalView } from './LogTerminalView';

interface MatchLogInspectorProps {
  initialMatchId?: string;
  onSelectMatch?: (matchId: string) => void;
  fillHeight?: boolean;
}

export const MatchLogInspector: React.FC<MatchLogInspectorProps> = ({
  initialMatchId = '',
  onSelectMatch,
  fillHeight = false,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(initialMatchId);
  const [prevInitialMatchId, setPrevInitialMatchId] = useState<string>(initialMatchId);
  const [inputMatchId, setInputMatchId] = useState<string>(initialMatchId);
  const [logData, setLogData] = useState<MatchLogResponse | null>(null);
  const [availableLogFiles, setAvailableLogFiles] = useState<LogFileInfo[]>([]);
  const [browseExpanded, setBrowseExpanded] = useState<boolean>(true);
  const [browseSearch, setBrowseSearch] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number | 'ALL'>(50);
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [resolvedMatchId, setResolvedMatchId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<MatchLogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(false);

  const terminalBodyRef = useRef<HTMLDivElement | null>(null);
  const selectedMatchIdRef = useRef<string>(selectedMatchId);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  if (initialMatchId !== prevInitialMatchId) {
    setPrevInitialMatchId(initialMatchId);
    if (initialMatchId && initialMatchId !== selectedMatchId) {
      setSelectedMatchId(initialMatchId);
      setInputMatchId(initialMatchId);
    }
  }

  const loading =
    manualLoading || (Boolean(selectedMatchId) && resolvedMatchId !== selectedMatchId);

  const sortedLogFiles = useMemo(() => {
    return [...availableLogFiles].sort((a, b) => {
      const timeA = a.lastModifiedUtc ? new Date(a.lastModifiedUtc).getTime() : 0;
      const timeB = b.lastModifiedUtc ? new Date(b.lastModifiedUtc).getTime() : 0;
      return timeB - timeA;
    });
  }, [availableLogFiles]);

  const currentTotal = sortedLogFiles.length;

  const limitOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 50; i < currentTotal; i += 50) {
      opts.push(i);
    }
    return opts;
  }, [currentTotal]);

  const selectLogFiles = useMemo(() => {
    if (displayLimit === 'ALL') return sortedLogFiles;
    return sortedLogFiles.slice(0, displayLimit);
  }, [sortedLogFiles, displayLimit]);

  const applyAvailableFiles = useCallback((files: LogFileInfo[]) => {
    setAvailableLogFiles(files);
    if (!selectedMatchIdRef.current && files.length > 0) {
      const newest = [...files].sort((a, b) => {
        const timeA = a.lastModifiedUtc ? new Date(a.lastModifiedUtc).getTime() : 0;
        const timeB = b.lastModifiedUtc ? new Date(b.lastModifiedUtc).getTime() : 0;
        return timeB - timeA;
      })[0];
      setSelectedMatchId(newest.matchId);
      setInputMatchId(newest.matchId);
    }
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const files = await fetchAvailableLogFiles(200);
      applyAvailableFiles(files);
    } catch {
      // Graceful fallback
    }
  }, [applyAvailableFiles]);

  useEffect(() => {
    let active = true;
    fetchAvailableLogFiles(200)
      .then((files) => {
        if (active) applyAvailableFiles(files);
      })
      .catch(() => {
        // Graceful fallback
      });
    return () => {
      active = false;
    };
  }, [applyAvailableFiles]);

  const loadLogs = useCallback(async (matchIdToLoad: string) => {
    if (!matchIdToLoad) return;
    setManualLoading(true);
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
      setResolvedMatchId(matchIdToLoad);
      setManualLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedMatchId) return;
    let active = true;
    fetchMatchLogs(selectedMatchId)
      .then((data) => {
        if (!active) return;
        setLogData(data);
        setErrorMessage(null);
      })
      .catch((err: any) => {
        if (!active) return;
        setLogData(null);
        if (err.response?.status === 404) {
          setErrorMessage(`No server log found for Match ID "${selectedMatchId}".`);
        } else {
          setErrorMessage(err.message || 'Network error: Unable to reach backend gateway API.');
        }
      })
      .finally(() => {
        if (active) setResolvedMatchId(selectedMatchId);
      });
    return () => {
      active = false;
    };
  }, [selectedMatchId]);

  useEffect(() => {
    if (!autoRefresh || !selectedMatchId) return;
    const interval = setInterval(() => {
      void loadLogs(selectedMatchId);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedMatchId, loadLogs]);

  useEffect(() => {
    if (autoScroll && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logData, autoScroll]);

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
    downloadLogText(selectedMatchId, logData.rawText);
  };

  const fileSelectOptions = useMemo(() => {
    return selectLogFiles.map((file, idx) => {
      const dt = formatLogDateTime(file.lastModifiedUtc || file.createdAtUtc);
      const kb = (file.fileSizeBytes / 1024).toFixed(1);
      return {
        value: file.matchId,
        label: `${idx === 0 ? '★ [LATEST] ' : `[#${idx + 1}] `}[${dt.date} ${dt.time}] - ${file.fileName} (${kb} KB)`,
      };
    });
  }, [selectLogFiles]);

  const limitSelectOptions = useMemo(() => {
    const base = limitOptions.map((opt) => ({ value: String(opt), label: `${opt} logs` }));
    base.push({ value: 'ALL', label: `All (${currentTotal} logs)` });
    return base;
  }, [limitOptions, currentTotal]);

  const filteredDirectoryFiles = useMemo(() => {
    const q = browseSearch.trim().toLowerCase();
    const filtered = sortedLogFiles.filter((f) => {
      if (!q) return true;
      const dt = formatLogDateTime(f.lastModifiedUtc || f.createdAtUtc);
      return (
        f.matchId.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        dt.full.toLowerCase().includes(q)
      );
    });
    return displayLimit === 'ALL' ? filtered : filtered.slice(0, displayLimit);
  }, [sortedLogFiles, browseSearch, displayLimit]);

  const handleSelectTarget = (matchId: string) => {
    setInputMatchId(matchId);
    setSelectedMatchId(matchId);
    onSelectMatch?.(matchId);
  };

  const containerClass = fillHeight
    ? 'flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3 overflow-hidden'
    : 'grid grid-cols-1 xl:grid-cols-12 gap-3';

  return (
    <div className={containerClass}>
      {/* Left IDE Rail: VPS Log Directory & Custom GUID Loader */}
      {browseExpanded && (
        <Card
          variant="default"
          padding={0}
          className={`xl:col-span-4 flex flex-col min-h-0 overflow-hidden ${fillHeight ? '' : 'max-h-[680px]'}`}
        >
          {/* Directory Header */}
          <div className="shrink-0 p-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
            <VStack gap={2}>
              <HStack justify="between" vAlign="center" gap={2}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={FolderOpen} size="sm" color="accent" />
                  <Text type="label" size="xsm" weight="bold" className="font-cinzel">
                    VPS LOG DIRECTORY
                  </Text>
                  <Badge label={`${sortedLogFiles.length}`} variant="info" />
                </HStack>

                <HStack gap={1.5} vAlign="center">
                  <Selector
                    label="Max logs to display"
                    isLabelHidden
                    startIcon={SlidersHorizontal}
                    options={limitSelectOptions}
                    value={String(displayLimit)}
                    onChange={(val) => setDisplayLimit(val === 'ALL' ? 'ALL' : Number(val))}
                    variant="secondary"
                    size="sm"
                    width={118}
                  />
                  <IconButton
                    label="Rescan server files on VPS"
                    tooltip="Rescan VPS files"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={RefreshCw} />}
                    onClick={refreshFiles}
                  />
                </HStack>
              </HStack>

              {/* Manual GUID Search */}
              <form onSubmit={handleSearchSubmit}>
                <InputGroup label="Load custom Match GUID" isLabelHidden>
                  <TextInput
                    label="Custom Match GUID"
                    isLabelHidden
                    size="sm"
                    value={inputMatchId}
                    onChange={setInputMatchId}
                    startIcon={Search}
                    placeholder="Paste Match GUID to load..."
                    width="100%"
                  />
                  <Button type="submit" variant="primary" size="sm" label="Load" />
                </InputGroup>
              </form>

              {/* Filter Directory */}
              <TextInput
                label="Filter directory files"
                isLabelHidden
                value={browseSearch}
                onChange={setBrowseSearch}
                startIcon={Filter}
                placeholder="Filter directory by date, GUID, file..."
                hasClear
                size="sm"
                width="100%"
              />
            </VStack>
          </div>

          {/* Scrollable Log File List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
            {filteredDirectoryFiles.length === 0 ? (
              <EmptyState
                isCompact
                title={
                  sortedLogFiles.length === 0
                    ? 'No VPS log files currently detected'
                    : `No files matching "${browseSearch}"`
                }
                description={
                  sortedLogFiles.length === 0
                    ? 'Older matches rotate off VPS disk; paste a specific GUID above to query archives.'
                    : 'Clear the directory filter or click Rescan.'
                }
              />
            ) : (
              filteredDirectoryFiles.map((file, idx) => {
                const isSelected = selectedMatchId === file.matchId;
                const dt = formatLogDateTime(file.lastModifiedUtc || file.createdAtUtc);
                const kb = (file.fileSizeBytes / 1024).toFixed(1);

                return (
                  <Card
                    key={file.fileName}
                    variant={isSelected ? 'yellow' : 'default'}
                    padding={2}
                  >
                    <VStack gap={1.5}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <HStack gap={1.5} vAlign="center">
                          <Badge
                            label={idx === 0 ? 'LATEST' : `#${idx + 1}`}
                            variant={idx === 0 ? 'success' : 'neutral'}
                          />
                          <Text type="code" size="xsm" weight="semibold" hasTabularNumbers>
                            {dt.date} {dt.time}
                          </Text>
                        </HStack>
                        <Badge label={`${kb} KB`} variant="neutral" />
                      </HStack>

                      <HStack justify="between" vAlign="center" gap={2}>
                        <div className="min-w-0 flex-1">
                          <Text type="code" size="xsm" weight="semibold" maxLines={1}>
                            {file.fileName}
                          </Text>
                          <Text type="code" size="sm" color="secondary" maxLines={1}>
                            {file.matchId}
                          </Text>
                        </div>

                        {isSelected ? (
                          <HStack gap={1} vAlign="center" className="shrink-0">
                            <StatusDot variant="success" isPulsing label="Streaming" />
                            <Badge label="ACTIVE" variant="success" />
                          </HStack>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            label="Open"
                            onClick={() => handleSelectTarget(file.matchId)}
                          />
                        )}
                      </HStack>
                    </VStack>
                  </Card>
                );
              })
            )}
          </div>

          <div className="shrink-0 px-3 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
            <HStack gap={1.5} vAlign="center" justify="between">
              <HStack gap={1.5} vAlign="center">
                <Icon icon={Clock} size="xsm" color="accent" />
                <Text type="code" size="sm" color="secondary" hasTabularNumbers>
                  Showing {filteredDirectoryFiles.length} of {currentTotal} (Newest First)
                </Text>
              </HStack>
              <Text type="code" size="sm" color="accent" weight="bold">
                {selectedMatchId ? `#${selectedMatchId.slice(0, 8)}` : 'None'}
              </Text>
            </HStack>
          </div>
        </Card>
      )}

      {/* Right Main Pane: Compact Controls + Full-Height Terminal */}
      <div
        className={`${browseExpanded ? 'xl:col-span-8' : 'xl:col-span-12'} flex flex-col min-h-0 gap-2.5 overflow-hidden`}
      >
        {/* Stream Controls Header Bar */}
        <Card variant="default" padding={3} className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <Button
                variant={browseExpanded ? 'secondary' : 'primary'}
                size="sm"
                icon={<Icon icon={browseExpanded ? PanelLeftClose : PanelLeftOpen} />}
                label={browseExpanded ? 'Hide Files' : `Files (${sortedLogFiles.length})`}
                onClick={() => setBrowseExpanded((prev) => !prev)}
              />

              <div className="w-[260px] max-w-full">
                <Selector
                  label="Select Server Log File"
                  isLabelHidden
                  size="sm"
                  options={fileSelectOptions}
                  value={selectedMatchId}
                  hasSearch
                  placeholder={`Quick pick (${selectLogFiles.length} newest)...`}
                  onChange={(val) => {
                    if (val) handleSelectTarget(val);
                  }}
                  width="100%"
                />
              </div>

              {logData ? (
                <Badge
                  label="LIVE VPS LOG"
                  variant="success"
                  icon={<Icon icon={Radio} />}
                />
              ) : (
                <HStack gap={1.5} vAlign="center">
                  <Icon icon={Terminal} size="xsm" color="accent" />
                  <Text type="code" size="xsm" color="secondary">
                    logs/match_*.log
                  </Text>
                </HStack>
              )}
            </div>

            <HStack gap={2} vAlign="center" wrap="wrap">
              <Switch
                label={autoRefresh ? 'TAIL -F (Live)' : 'TAIL -F'}
                value={autoRefresh}
                isDisabled={!selectedMatchId}
                size="sm"
                onChange={(checked) => setAutoRefresh(checked)}
              />
              <Button
                variant="secondary"
                size="sm"
                isDisabled={!selectedMatchId}
                isLoading={loading}
                icon={<Icon icon={RefreshCw} />}
                label="Sync"
                onClick={() => loadLogs(selectedMatchId)}
              />
              <Button
                variant="secondary"
                size="sm"
                isDisabled={!logData}
                icon={<Icon icon={copied ? CheckCircle2 : Copy} />}
                label={copied ? 'Copied!' : 'Copy'}
                onClick={handleCopyLogs}
              />
              <Button
                variant="secondary"
                size="sm"
                isDisabled={!logData}
                icon={<Icon icon={Download} />}
                label="Export .log"
                tooltip="Download full .log file"
                onClick={handleDownloadLog}
              />
            </HStack>
          </div>
        </Card>

        {errorMessage && (
          <div className="shrink-0">
            <Banner status="error" title="Server Response" description={errorMessage} />
          </div>
        )}

        <LogTerminalView
          logData={logData}
          loading={loading}
          errorMessage={errorMessage}
          selectedMatchId={selectedMatchId}
          filterLevel={filterLevel}
          onFilterLevelChange={setFilterLevel}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
          terminalBodyRef={terminalBodyRef}
          fillHeight={fillHeight}
        />
      </div>
    </div>
  );
};
