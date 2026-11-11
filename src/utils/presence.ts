/**
 * Utility functions for genuine Player Presence detection across Pactkeeper Realm.
 * 
 * Synchronized with Unity_Pactkeeper client architecture:
 * 1. IN BATTLE (⚔️):
 *    - Player is player1Id or player2Id in an ongoing match session (/api/Match/history).
 *    - Status: 'pending', 'active', 'inprogress', 'playing', 'running' (matching NGO dedicated server).
 *    - Real-time status: 'in_match'.
 *    - Location reflects PvP Match ID and mode (e.g. PvP Duel, Ranked Arena, Friendly Match).
 * 
 * 2. ONLINE (🟢):
 *    - Player is connected to LobbyHub SignalR (/hubs/lobby), or
 *    - Active in 3_MainMenu (Lobby & Realm Sanctuary) with recent telemetry, or
 *    - Currently authenticated session user in High Counsel Admin Portal.
 *    - Real-time status: 'idle' or explicit online flag.
 * 
 * 3. OFFLINE (⚪):
 *    - Player is not in match and has no active connection/session.
 *    - Location: 'Inactive'.
 *    - Relative time reflects time elapsed since last verified telemetry.
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
  activeMatch?: ActiveMatchInfo;
}

export interface ActiveMatchInfo {
  matchId: string;
  mode?: string;
  serverIp?: string;
  serverPort?: number;
  status?: string;
}

export interface PresenceEvaluationOptions {
  isCurrentSessionUser?: boolean;
  isOnlineExplicit?: boolean;
  realtimeStatus?: 'idle' | 'in_match' | 'offline' | string | null;
}

/**
 * Checks whether a match status string or integer indicates an active battle in Unity/NGO.
 */
export function isActiveMatchStatus(status?: string | number | null): boolean {
  if (status === null || status === undefined) return false;
  if (typeof status === 'number') return status === 1;
  const s = String(status).trim().toLowerCase();
  return ['pending', 'active', 'inprogress', 'playing', 'running'].includes(s);
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
 * Unity LobbyHub connections, recent telemetry, and authentication states.
 */
export function getPlayerPresence(
  playerId: string,
  activeMatchPlayerMap: Map<string, ActiveMatchInfo>,
  lastActivityTimestamp?: string | Date | null,
  optionsOrSessionUser?: boolean | PresenceEvaluationOptions
): PlayerPresenceInfo {
  const options: PresenceEvaluationOptions =
    typeof optionsOrSessionUser === 'boolean'
      ? { isCurrentSessionUser: optionsOrSessionUser }
      : optionsOrSessionUser || {};

  const isCurrentSessionUser = Boolean(options.isCurrentSessionUser);
  const isOnlineExplicit = Boolean(options.isOnlineExplicit);
  const realtimeStatus = options.realtimeStatus?.toLowerCase();

  const relativeTime = formatRelativeTime(lastActivityTimestamp);

  // 1. Check if currently engaged in a live match (In Battle)
  if (activeMatchPlayerMap.has(playerId) || realtimeStatus === 'in_match') {
    const match = activeMatchPlayerMap.get(playerId) || { matchId: 'LIVE', mode: 'pvp' };
    const matchRef = match.matchId && match.matchId !== 'LIVE' ? `#${match.matchId.slice(-4).toUpperCase()}` : '#LIVE';
    const rawMode = (match.mode || 'pvp').toLowerCase();

    let modeDescription = 'PvP Match';
    if (rawMode === 'ranked') modeDescription = 'Ranked Arena';
    else if (rawMode === 'friendly') modeDescription = 'Friendly Duel';
    else if (rawMode === 'story') modeDescription = 'Story Campaign';

    return {
      state: 'InBattle',
      label: 'IN BATTLE',
      dotColor: 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]',
      badgeBg: 'bg-[#78350f]/40',
      badgeBorder: 'border-[#f59e0b]/60',
      badgeText: 'text-[#fcd34d]',
      relativeTime: 'Active now',
      activityDescription: `${modeDescription} ${matchRef}`,
      activeMatch: match,
    };
  }

  // 2. Check if genuinely online (in Unity 3_MainMenu Sanctuary, LobbyHub WebSocket, or active Admin session)
  const isRecentlyActive = isWithinMinutes(lastActivityTimestamp, 30);
  const isOnlineInLobby =
    isOnlineExplicit ||
    realtimeStatus === 'idle' ||
    realtimeStatus === 'online' ||
    isCurrentSessionUser ||
    isRecentlyActive;

  if (isOnlineInLobby) {
    let locationDescription = 'Lobby & Realm Sanctuary';
    if (isCurrentSessionUser) {
      locationDescription = 'High Counsel Admin Portal';
    } else if (isRecentlyActive && lastActivityTimestamp) {
      locationDescription = 'Lobby & Realm Explorer';
    }

    return {
      state: 'Online',
      label: 'ONLINE',
      dotColor: 'bg-[#10b981] shadow-[0_0_8px_#10b981]',
      badgeBg: 'bg-[#064e3b]/40',
      badgeBorder: 'border-[#10b981]/60',
      badgeText: 'text-[#86efac]',
      relativeTime: isCurrentSessionUser ? 'Active now' : relativeTime,
      activityDescription: locationDescription,
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
