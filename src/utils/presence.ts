/**
 * Utility functions for genuine Player Presence detection across Pactkeeper Realm.
 * 
 * Rules for accurate presence recognition (100% Swagger grounded):
 * 1. IN BATTLE (⚔️): Player is registered as player1Id or player2Id in an ongoing match session (/api/Match/history status: InProgress / Active / Playing).
 * 2. ONLINE (🟢): Player has recent missive or activity timestamp within 30 minutes, or is the currently authenticated session user.
 * 3. OFFLINE (⚪): Player has no ongoing battle and last activity was > 30 minutes ago.
 */

export type PlayerPresenceState = 'Online' | 'InBattle' | 'Offline';

export interface PlayerPresenceInfo {
  state: PlayerPresenceState;
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  relativeTime: string;
  activityDescription: string;
}

/**
 * Calculates a clean, human-readable relative time string in English.
 */
export function formatRelativeTime(timestamp?: string | Date | null): string {
  if (!timestamp) return 'Unknown';
  try {
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 'Unknown';

    const diffMs = Date.now() - time;
    if (diffMs < 0) return 'Just now'; // Handle clock skew gracefully

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 2) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

/**
 * Checks if a given timestamp occurred within the past N minutes.
 */
export function isWithinMinutes(timestamp?: string | Date | null, minutes: number = 30): boolean {
  if (!timestamp) return false;
  try {
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return false;
    const diffMs = Date.now() - time;
    return diffMs >= 0 && diffMs <= minutes * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Evaluates the genuine presence of a player based on active matches,
 * recent support messages, and authentication states.
 */
export function getPlayerPresence(
  playerId: string,
  activeMatchPlayerMap: Map<string, { matchId: string; mode?: string }>,
  lastActivityTimestamp?: string | Date | null,
  isCurrentSessionUser: boolean = false
): PlayerPresenceInfo {
  const relativeTime = formatRelativeTime(lastActivityTimestamp);

  // 1. Check if currently engaged in a live match
  if (activeMatchPlayerMap.has(playerId)) {
    const match = activeMatchPlayerMap.get(playerId)!;
    const matchRef = match.matchId ? `#${match.matchId.slice(-4).toUpperCase()}` : '';
    const modeLabel = match.mode ? ` (${match.mode})` : '';

    return {
      state: 'InBattle',
      label: 'IN BATTLE',
      dotColor: 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]',
      badgeBg: 'bg-[#78350f]/40',
      badgeBorder: 'border-[#f59e0b]/60',
      badgeText: 'text-[#fcd34d]',
      relativeTime: 'Active now',
      activityDescription: `PvP Match ${matchRef}${modeLabel}`,
    };
  }

  // 2. Check if genuinely online (interaction within 30 mins or currently logged in)
  const isRecentlyActive = isWithinMinutes(lastActivityTimestamp, 30);
  if (isRecentlyActive || isCurrentSessionUser) {
    return {
      state: 'Online',
      label: 'ONLINE',
      dotColor: 'bg-[#10b981] shadow-[0_0_8px_#10b981]',
      badgeBg: 'bg-[#064e3b]/40',
      badgeBorder: 'border-[#10b981]/60',
      badgeText: 'text-[#86efac]',
      relativeTime: isCurrentSessionUser ? 'Active now' : relativeTime,
      activityDescription: isCurrentSessionUser ? 'Admin Portal Session' : 'Lobby & Realm Explorer',
    };
  }

  // 3. Otherwise player is offline
  return {
    state: 'Offline',
    label: 'OFFLINE',
    dotColor: 'bg-[#78644e]',
    badgeBg: 'bg-[#2b1b11]/30',
    badgeBorder: 'border-[#523e2b]/50',
    badgeText: 'text-[#a89984]',
    relativeTime: relativeTime !== 'Unknown' ? `Last seen ${relativeTime}` : 'Offline',
    activityDescription: 'Inactive',
  };
}
