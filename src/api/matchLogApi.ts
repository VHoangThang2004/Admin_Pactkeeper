import { adminClient } from './adminClient';
import type { MatchLogLine, MatchLogResponse, MatchLogLevel, MatchHistoryItem, LogFileInfo } from '../types';

/**
 * Parses raw text from Unity Dedicated Server log into structured lines.
 */
export const parseRawLogLines = (rawText: string): MatchLogLine[] => {
  const lines = rawText.split(/\r?\n/);
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      // Extract module tag like [ServerController], [MapRegistry], etc.
      const tagMatch = line.match(/^\[([a-zA-Z0-9_-]+)\]/);
      const tag = tagMatch ? tagMatch[1] : undefined;

      // Extract timestamp if present like [2026-10-12 03:15:00] or similar
      const timeMatch = line.match(/\[(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]/);
      const timestamp = timeMatch ? timeMatch[1] : undefined;

      const lower = line.toLowerCase();
      let level: MatchLogLevel = 'INFO';

      if (
        lower.includes('shutting down') ||
        lower.includes('too many errors') ||
        lower.includes('failed') ||
        lower.includes('no asset found') ||
        lower.includes('error') ||
        lower.includes('exception') ||
        lower.includes('fatal')
      ) {
        level = 'ERROR';
      } else if (
        lower.includes('warning') ||
        lower.includes('retrying') ||
        lower.includes('cancelled') ||
        lower.includes('disconnect') ||
        lower.includes('timeout')
      ) {
        level = 'WARN';
      } else if (
        lower.includes('system') ||
        lower.includes('initialized') ||
        lower.includes('reporting') ||
        lower.includes('loaded')
      ) {
        level = 'SYSTEM';
      }

      return {
        lineNumber: index + 1,
        raw: line,
        level,
        tag,
        timestamp,
        message: line,
      };
    });
};

/**
 * Genuine API call: Fetches match server logs directly from backend VPS API endpoint.
 * Endpoint: GET /api/Match/{matchId}/logs
 */
export const fetchMatchLogs = async (matchId: string): Promise<MatchLogResponse> => {
  const cleanId = matchId.trim();
  if (!cleanId) {
    throw new Error('Match ID is required.');
  }

  // Real API request to backend
  const response = await adminClient.get(`/Match/${encodeURIComponent(cleanId)}/logs`);

  let raw = '';
  if (typeof response.data === 'string') {
    raw = response.data;
  } else if (response.data?.logs) {
    raw = Array.isArray(response.data.logs) ? response.data.logs.join('\n') : response.data.logs;
  } else if (response.data?.log) {
    raw = Array.isArray(response.data.log) ? response.data.log.join('\n') : response.data.log;
  } else if (response.data?.rawText) {
    raw = response.data.rawText;
  } else if (response.data?.content) {
    raw = response.data.content;
  } else {
    raw = JSON.stringify(response.data, null, 2);
  }

  const lines = parseRawLogLines(raw);
  const hasError = lines.some((l) => l.level === 'ERROR');

  return {
    matchId: cleanId,
    logPath: response.data?.logPath || response.data?.path || `match_${cleanId}.log`,
    source: 'live_server',
    lines,
    rawText: raw,
    retrievedAt: new Date().toLocaleTimeString(),
    serverStatus: hasError ? 'crashed' : 'active',
  };
};

/**
 * Genuine API call: Fetches recent matches list from GET /api/Match/history.
 * No hardcoded fallback.
 */
export const fetchRecentMatchesForLogs = async (): Promise<MatchHistoryItem[]> => {
  try {
    const res = await adminClient.get('/Match/history');
    if (Array.isArray(res.data)) {
      return res.data.map((m: any) => ({
        matchId: m.matchId || m.id || '',
        id: m.id || m.matchId,
        mode: m.mode || 'PVP',
        status: m.status || 'Completed',
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        createdAt: m.createdAt || m.startTime,
        winnerPlayerId: m.winnerPlayerId,
      }));
    }
  } catch (error) {
    console.error('Failed to fetch match history from backend:', error);
  }

  return [];
};

/**
 * Genuine API call: Fetches available log files on server sorted by last modified descending.
 * Endpoint: GET /api/Match/log-files
 */
export const fetchAvailableLogFiles = async (): Promise<LogFileInfo[]> => {
  try {
    const res = await adminClient.get('/Match/log-files');
    if (Array.isArray(res.data)) {
      return res.data.map((f: any) => ({
        matchId: f.matchId,
        fileName: f.fileName,
        fileSizeBytes: f.fileSizeBytes || 0,
        lastModifiedUtc: f.lastModifiedUtc,
        createdAtUtc: f.createdAtUtc,
      }));
    }
  } catch (error) {
    console.error('Failed to fetch available log files from server:', error);
  }
  return [];
};

