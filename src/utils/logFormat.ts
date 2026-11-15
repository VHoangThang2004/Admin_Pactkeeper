import type { MatchLogLevel, MatchLogLine } from '../types';

export interface FormattedDateTime {
  date: string;
  time: string;
  full: string;
}

/**
 * Formats an ISO or UTC timestamp into DD/MM/YYYY date and HH:mm:ss time strings.
 */
export function formatLogDateTime(dateStr?: string): FormattedDateTime {
  if (!dateStr) return { date: 'N/A', time: '', full: 'N/A' };
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return { date: 'N/A', time: '', full: 'N/A' };
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
}

/**
 * Filters parsed server log lines by severity level and case-insensitive substring query.
 */
export function filterMatchLogLines(
  lines: MatchLogLine[],
  filterLevel: MatchLogLevel | 'ALL',
  searchQuery: string
): MatchLogLine[] {
  const q = searchQuery.trim().toLowerCase();
  return lines.filter((line) => {
    if (filterLevel !== 'ALL' && line.level !== filterLevel) return false;
    if (q) return line.raw.toLowerCase().includes(q);
    return true;
  });
}

/**
 * Downloads raw log content as a `<filename>.log` UTF-8 text file.
 */
export function downloadLogText(matchId: string, rawText: string): void {
  const blob = new Blob([rawText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${matchId}.log`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
