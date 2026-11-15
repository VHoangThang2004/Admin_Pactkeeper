import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileText,
  Filter,
  FolderOpen,
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
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { Section } from '@astryxdesign/core/Section';
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
}

export const MatchLogInspector: React.FC<MatchLogInspectorProps> = ({
  initialMatchId = '',
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

  return (
    <VStack gap={4}>
      {/* Header & Streaming Actions */}
      <Section padding={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
              <Icon icon={Terminal} size="md" color="accent" />
            </div>
            <VStack gap={0.5}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Heading level={2} className="font-cinzel pk-gold-text">
                  MATCH SERVER LOG INSPECTOR
                </Heading>
                {logData && (
                  <Badge
                    label="LIVE VPS LOG"
                    variant="success"
                    icon={<Icon icon={Radio} />}
                  />
                )}
              </HStack>
              <Text type="supporting" size="xsm">
                Streaming real-time stdout/stderr from Dedicated Game Server instance (
                <code>logs/match_*.log</code>)
              </Text>
            </VStack>
          </HStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            <Switch
              label={autoRefresh ? 'TAIL -F (Streaming)' : 'TAIL -F'}
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
        </HStack>
      </Section>

      {/* Log Source, Dropdown, Manual GUID & Chronological Directory */}
      <Section padding={4}>
        <VStack gap={3}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <Badge
              label={`Dedicated VPS Log Files (${availableLogFiles.length})`}
              variant="info"
              icon={<Icon icon={FolderOpen} />}
            />
            <HStack gap={2} vAlign="center">
              <Text type="code" size="xsm" color="secondary">
                Selected Target:
              </Text>
              <Text type="code" size="xsm" weight="bold" color="accent">
                {selectedMatchId ? `#${selectedMatchId.slice(0, 8)}` : 'None'}
              </Text>
            </HStack>
          </HStack>

          <Divider />

          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <div className="flex-1 min-w-[260px]">
              <Selector
                label="Select Server Log File"
                isLabelHidden
                options={fileSelectOptions}
                value={selectedMatchId}
                hasSearch
                placeholder={`Select Server Log File (${selectLogFiles.length} of ${sortedLogFiles.length} files - Newest First)`}
                onChange={(val) => {
                  if (val) {
                    setInputMatchId(val);
                    setSelectedMatchId(val);
                  }
                }}
                width="100%"
              />
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
              <InputGroup label="Load custom Match GUID" isLabelHidden>
                <TextInput
                  label="Custom Match GUID"
                  isLabelHidden
                  value={inputMatchId}
                  onChange={setInputMatchId}
                  startIcon={Search}
                  placeholder="Or paste custom GUID..."
                  width={200}
                />
                <Button type="submit" variant="primary" label="Load" />
              </InputGroup>

              <IconButton
                label="Rescan server files on VPS"
                tooltip="Rescan server files on VPS"
                variant="secondary"
                icon={<Icon icon={RefreshCw} />}
                onClick={refreshFiles}
              />

              <Selector
                label="Max logs to display"
                isLabelHidden
                startIcon={SlidersHorizontal}
                options={limitSelectOptions}
                value={String(displayLimit)}
                onChange={(val) => setDisplayLimit(val === 'ALL' ? 'ALL' : Number(val))}
                variant="secondary"
                width={140}
              />

              <Button
                variant={browseExpanded ? 'primary' : 'secondary'}
                icon={<Icon icon={Calendar} />}
                endContent={<Icon icon={browseExpanded ? ChevronUp : ChevronDown} />}
                label={`Directory (${sortedLogFiles.length})`}
                onClick={() => setBrowseExpanded((prev) => !prev)}
              />
            </form>
          </HStack>

          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <HStack gap={1.5} vAlign="center">
              <Icon icon={Clock} size="xsm" color="accent" />
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                Order: <strong>Newest first (Top to Bottom)</strong> • Showing up to{' '}
                <strong>{displayLimit === 'ALL' ? currentTotal : displayLimit}</strong> of{' '}
                {currentTotal} logs
              </Text>
            </HStack>
            {selectedMatchId && (
              <Text type="code" size="xsm" color="secondary">
                Selected: <strong>{selectedMatchId}</strong>
              </Text>
            )}
          </HStack>

          {browseExpanded && (
            <>
              <Divider />
              <Card variant="muted" padding={3}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <HStack gap={2} vAlign="center">
                    <Icon icon={Calendar} size="sm" color="accent" />
                    <Text weight="semibold" size="xsm" className="font-cinzel">
                      CHRONOLOGICAL DIRECTORY
                    </Text>
                    <Badge label={`${sortedLogFiles.length} files`} variant="yellow" />
                  </HStack>

                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <TextInput
                      label="Filter directory files"
                      isLabelHidden
                      value={browseSearch}
                      onChange={setBrowseSearch}
                      startIcon={Filter}
                      placeholder="Filter by date, ID, file..."
                      hasClear
                      size="sm"
                      width={240}
                    />
                    <Selector
                      label="Directory display limit"
                      isLabelHidden
                      startIcon={SlidersHorizontal}
                      options={limitSelectOptions}
                      value={String(displayLimit)}
                      onChange={(val) => setDisplayLimit(val === 'ALL' ? 'ALL' : Number(val))}
                      size="sm"
                      variant="secondary"
                      width={130}
                    />
                  </HStack>
                </HStack>
              </Card>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredDirectoryFiles.length === 0 ? (
                  <EmptyState
                    isCompact
                    title={`No server log files found matching "${browseSearch}"`}
                    description="Clear the directory filter or rescan VPS log files."
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
                        padding={3}
                      >
                        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Badge
                              label={idx === 0 ? 'LATEST' : `#${idx + 1}`}
                              variant={idx === 0 ? 'success' : 'neutral'}
                            />
                            <HStack gap={1} vAlign="center">
                              <Icon icon={Calendar} size="xsm" color="accent" />
                              <Text type="code" size="xsm" weight="semibold" hasTabularNumbers>
                                {dt.date}
                              </Text>
                            </HStack>
                            <HStack gap={1} vAlign="center">
                              <Icon icon={Clock} size="xsm" color="secondary" />
                              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                                {dt.time}
                              </Text>
                            </HStack>
                          </HStack>

                          <div className="flex-1 min-w-[200px]">
                            <HStack gap={2} vAlign="center">
                              <Icon icon={FileText} size="xsm" color="info" />
                              <Text type="code" size="xsm" weight="semibold" maxLines={1}>
                                {file.fileName}
                              </Text>
                              <Badge label={`${kb} KB`} variant="neutral" />
                            </HStack>
                            <Text type="code" size="2xs" color="secondary" maxLines={1}>
                              GUID: {file.matchId}
                            </Text>
                          </div>

                          <HStack gap={2} vAlign="center">
                            {isSelected ? (
                              <HStack gap={1.5} vAlign="center">
                                <StatusDot variant="success" isPulsing label="Streaming" />
                                <Badge label="STREAMING" variant="success" />
                              </HStack>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                label="Select →"
                                onClick={() => {
                                  setInputMatchId(file.matchId);
                                  setSelectedMatchId(file.matchId);
                                }}
                              />
                            )}
                          </HStack>
                        </HStack>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </VStack>
      </Section>

      {errorMessage && (
        <Banner status="error" title="Server Response" description={errorMessage} />
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
      />
    </VStack>
  );
};
