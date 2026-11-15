import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  FileText,
  RefreshCw,
  Search,
  Terminal,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StackItem } from '@astryxdesign/core/Stack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import type { MatchLogLevel, MatchLogResponse } from '../types';
import { filterMatchLogLines } from '../utils/logFormat';

interface LogTerminalViewProps {
  logData: MatchLogResponse | null;
  loading?: boolean;
  errorMessage?: string | null;
  selectedMatchId?: string;
  filterLevel: MatchLogLevel | 'ALL';
  onFilterLevelChange: (lvl: MatchLogLevel | 'ALL') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  terminalBodyRef?: React.RefObject<HTMLDivElement | null>;
  maxHeightClass?: string;
  extraControls?: React.ReactNode;
  errorFallbackDetail?: React.ReactNode;
}

const LOG_LEVELS: Array<MatchLogLevel | 'ALL'> = ['ALL', 'ERROR', 'WARN', 'SYSTEM', 'INFO'];

/**
 * Shared dark carbon terminal log stream viewer with severity filtering and search.
 */
export const LogTerminalView: React.FC<LogTerminalViewProps> = ({
  logData,
  loading = false,
  errorMessage = null,
  selectedMatchId = '',
  filterLevel,
  onFilterLevelChange,
  searchQuery,
  onSearchQueryChange,
  autoScroll = false,
  onToggleAutoScroll,
  terminalBodyRef,
  maxHeightClass = 'max-h-[560px] min-h-[360px]',
  extraControls,
  errorFallbackDetail,
}) => {
  const filteredLines = useMemo(
    () => (logData ? filterMatchLogLines(logData.lines, filterLevel, searchQuery) : []),
    [logData, filterLevel, searchQuery]
  );

  const errorCount = useMemo(
    () => logData?.lines.filter((l) => l.level === 'ERROR').length || 0,
    [logData]
  );

  const warnCount = useMemo(
    () => logData?.lines.filter((l) => l.level === 'WARN').length || 0,
    [logData]
  );

  return (
    <Card variant="default" padding={0}>
      <VStack gap={0}>
        {/* Terminal Header Bar */}
        <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <Text type="code" size="xsm" color="secondary">
                Target Log Stream:
              </Text>
              <Text type="code" size="xsm" weight="semibold" color="accent">
                {selectedMatchId
                  ? logData?.logPath || `match_${selectedMatchId}.log`
                  : 'No Match Selected'}
              </Text>
            </HStack>

            {logData && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                {errorCount > 0 && (
                  <Badge
                    label={`${errorCount} ERRORS`}
                    variant="error"
                    icon={<Icon icon={AlertTriangle} />}
                  />
                )}
                {warnCount > 0 && <Badge label={`${warnCount} WARN`} variant="warning" />}

                <SegmentedControl
                  label="Filter log severity"
                  value={filterLevel}
                  onChange={(val) => onFilterLevelChange(val as MatchLogLevel | 'ALL')}
                  size="sm"
                >
                  {LOG_LEVELS.map((lvl) => (
                    <SegmentedControlItem key={lvl} value={lvl} label={lvl} />
                  ))}
                </SegmentedControl>

                <TextInput
                  label="Find in log"
                  isLabelHidden
                  value={searchQuery}
                  onChange={onSearchQueryChange}
                  startIcon={Search}
                  placeholder="Find in log..."
                  hasClear
                  size="sm"
                  width={160}
                />

                {onToggleAutoScroll && (
                  <IconButton
                    label={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
                    tooltip={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
                    variant={autoScroll ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<Icon icon={ArrowDownCircle} />}
                    onClick={onToggleAutoScroll}
                  />
                )}

                {extraControls}
              </HStack>
            )}
          </HStack>
        </div>

        {/* High-contrast carbon terminal body */}
        <div
          ref={terminalBodyRef}
          className={`pk-terminal-surface p-4 ${maxHeightClass} overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text`}
        >
          {loading ? (
            <VStack gap={2} hAlign="center" padding={8}>
              <Icon icon={RefreshCw} size="lg" color="accent" />
              <Text type="code" size="xsm" color="accent">
                Fetching VPS logs via /api/Match/{selectedMatchId}/logs...
              </Text>
            </VStack>
          ) : !selectedMatchId ? (
            <VStack gap={2} hAlign="center" padding={8}>
              <Icon icon={Terminal} size="lg" color="secondary" />
              <Text weight="semibold" size="sm">
                Please select or enter a Match GUID.
              </Text>
              <Text type="supporting" size="xsm">
                Provide a valid match identifier to inspect dedicated server log output.
              </Text>
            </VStack>
          ) : errorMessage ? (
            <VStack gap={3} hAlign="center" padding={6}>
              <Icon icon={AlertCircle} size="lg" color="error" />
              <Text weight="semibold" size="sm">
                No log output available for this session.
              </Text>
              <Text type="code" size="xsm" color="secondary">
                {errorMessage}
              </Text>
              {errorFallbackDetail}
            </VStack>
          ) : filteredLines.length === 0 ? (
            <VStack gap={2} hAlign="center" padding={8}>
              <Icon icon={FileText} size="lg" color="secondary" />
              <Text weight="semibold" size="sm">
                {logData ? 'No log lines matched the active filter.' : 'Log file is empty.'}
              </Text>
              <Text type="supporting" size="xsm">
                Try clearing your search query or level filters.
              </Text>
              {(filterLevel !== 'ALL' || searchQuery.trim()) && (
                <Button
                  label="Reset Filters"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onFilterLevelChange('ALL');
                    onSearchQueryChange('');
                  }}
                />
              )}
            </VStack>
          ) : (
            filteredLines.map((line) => {
              let rowStyle = 'text-slate-200';
              let badgeStyle = 'text-slate-300 bg-slate-800/60';

              if (line.level === 'ERROR') {
                rowStyle =
                  'text-rose-200 bg-rose-950/35 border-l-2 border-rose-500 pl-2 -ml-2';
                badgeStyle = 'text-rose-200 bg-rose-500/30 font-bold';
              } else if (line.level === 'WARN') {
                rowStyle =
                  'text-amber-200 bg-amber-950/30 border-l-2 border-amber-500 pl-2 -ml-2';
                badgeStyle = 'text-amber-200 bg-amber-500/30 font-bold';
              } else if (line.level === 'SYSTEM') {
                rowStyle = 'text-emerald-200';
                badgeStyle = 'text-emerald-200 bg-emerald-500/25 font-semibold';
              }

              return (
                <div
                  key={line.lineNumber}
                  className={`flex items-start gap-3 hover:bg-white/[0.05] py-0.5 rounded px-1.5 transition-colors ${rowStyle}`}
                >
                  <span className="text-slate-500 select-none text-right shrink-0 w-8 font-mono text-[10px]">
                    {line.lineNumber}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 uppercase select-none font-mono ${badgeStyle}`}
                  >
                    {line.level}
                  </span>
                  <span className="break-all whitespace-pre-wrap flex-1">{line.raw}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Terminal Footer Stats */}
        <div className="px-4 py-2.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <HStack gap={4} vAlign="center" wrap="wrap">
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                Total Lines: <strong>{logData?.lines.length || 0}</strong>
              </Text>
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                Filtered: <strong>{filteredLines.length}</strong>
              </Text>
              <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                Retrieved: {logData?.retrievedAt || '--:--'}
              </Text>
            </HStack>
            <StackItem size="static">
              <Text type="code" size="xsm" color="secondary">
                Unity NGO Headless Engine • PactKeeper High Counsel
              </Text>
            </StackItem>
          </HStack>
        </div>
      </VStack>
    </Card>
  );
};
