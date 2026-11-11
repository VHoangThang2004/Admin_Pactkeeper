import { adminClient } from '../api/adminClient';
import type { PlayerProfile } from '../types';
import {
  getPlayerPresence,
  isActiveMatchStatus,
  type ActiveMatchInfo,
  type PlayerPresenceInfo,
} from '../utils/presence';
import * as signalR from '@microsoft/signalr';

export interface TrackedPlayerPresence {
  playerId: string;
  username: string;
  presence: PlayerPresenceInfo;
  lastSeen: string;
  level?: number;
  gold?: number;
  gems?: number;
  isBanned?: boolean;
  activeMatch?: ActiveMatchInfo;
}

export interface UnifiedPlayerData {
  players: PlayerProfile[];
  trackedPlayers: TrackedPlayerPresence[];
  activeMatchPlayerMap: Map<string, ActiveMatchInfo>;
  activeMatchesCount: number;
  totalMatchesCount: number;
  counts: {
    total: number;
    online: number;
    inBattle: number;
    offline: number;
  };
  lastSyncedAt: Date;
}

// Global cached state and subscribers
let cachedData: UnifiedPlayerData | null = null;
let realtimePresenceMap = new Map<string, string>(); // playerId -> "idle" | "in_match" | "offline"
const listeners = new Set<(data: UnifiedPlayerData) => void>();
let hubConnection: signalR.HubConnection | null = null;
let autoRefreshTimer: number | null = null;
let isFetching = false;

/**
 * Fetches and aggregates complete player records from all backend endpoints
 * ensuring 100% data consistency between Overview and Accounts management.
 */
export async function fetchUnifiedPlayerData(): Promise<UnifiedPlayerData> {
  if (isFetching && cachedData) {
    return cachedData;
  }

  isFetching = true;
  try {
    const [allPlayersRes, matchRes, supportRes, paymentRes] = await Promise.allSettled([
      adminClient.get('/player/all'),
      adminClient.get('/Match/history'),
      adminClient.get('/support/admin/players'),
      adminClient.get('/payment/history'),
    ]);

    // 1. Process active matches & in-battle combatants (NGO Game Server)
    const activeMatchPlayerMap = new Map<string, ActiveMatchInfo>();
    let liveMatchesCount = 0;
    let totalMatchesCount = 0;

    if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
      totalMatchesCount = matchRes.value.data.length;
      matchRes.value.data.forEach((m: any) => {
        if (isActiveMatchStatus(m.status)) {
          liveMatchesCount++;
          const info: ActiveMatchInfo = {
            matchId: m.matchId || m.id || '',
            mode: m.mode,
            serverIp: m.serverIp,
            serverPort: m.serverPort,
            status: m.status,
          };
          if (m.player1Id) activeMatchPlayerMap.set(m.player1Id, info);
          if (m.player2Id) activeMatchPlayerMap.set(m.player2Id, info);
        }
      });
    }

    // 2. Map support chat interactions (provides real-name Google OAuth metadata and latest missive timestamps)
    const supportMap = new Map<string, { playerName?: string; latestMessageTime?: string }>();
    if (supportRes.status === 'fulfilled' && Array.isArray(supportRes.value.data)) {
      supportRes.value.data.forEach((s: any) => {
        if (s.playerId) {
          supportMap.set(s.playerId, {
            playerName: s.playerName,
            latestMessageTime: s.latestMessageTime || s.lastMessageAt,
          });
        }
      });
    }

    // 3. Map payment order transactions
    const paymentMap = new Map<string, string>();
    if (paymentRes.status === 'fulfilled' && Array.isArray(paymentRes.value.data)) {
      paymentRes.value.data.forEach((o: any) => {
        const pid = o.playerId || o.userId;
        const time = o.createdAt || o.timestamp;
        if (pid && time) {
          const existing = paymentMap.get(pid);
          if (!existing || new Date(time).getTime() > new Date(existing).getTime()) {
            paymentMap.set(pid, time);
          }
        }
      });
    }

    // 4. Current session admin ID
    const localPlayerId =
      sessionStorage.getItem('player_id') ||
      sessionStorage.getItem('playerId') ||
      sessionStorage.getItem('adminPlayerId') ||
      localStorage.getItem('player_id') ||
      localStorage.getItem('playerId');

    const foundMap = new Map<string, PlayerProfile>();

    // 5. Seed with ground-truth players from /player/all
    if (allPlayersRes.status === 'fulfilled' && Array.isArray(allPlayersRes.value.data)) {
      allPlayersRes.value.data.forEach((p: any) => {
        if (!p.playerId) return;
        const sInfo = supportMap.get(p.playerId);
        const pTime = paymentMap.get(p.playerId);

        // Resolve display name: support name > username > fallback
        let displayName = (p.username || '').trim();
        if (sInfo?.playerName && (!displayName || displayName === p.playerId)) {
          displayName = sInfo.playerName.trim();
        }
        if (!displayName) {
          displayName = `Traveler #${p.playerId.slice(-4).toUpperCase()}`;
        }

        // Determine most recent verifiable activity time
        const candidates = [p.lastLogin, sInfo?.latestMessageTime, pTime].filter(Boolean) as string[];
        let latestActivity: string | undefined = undefined;
        if (candidates.length > 0) {
          latestActivity = candidates.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          )[0];
        }

        foundMap.set(p.playerId, {
          id: p.id || p.playerId,
          playerId: p.playerId,
          username: displayName,
          level: p.level ?? 1,
          experience: p.experience ?? 0,
          gold: p.gold ?? 0,
          gems: p.gems ?? 0,
          isBanned: Boolean(p.isBanned),
          banReason: p.banReason,
          lastLogin: p.lastLogin ? new Date(p.lastLogin).toLocaleString() : 'Never',
          lastActiveTime: latestActivity || p.lastLogin,
          lastSeen: latestActivity || p.lastLogin,
        });
      });
    }

    // 6. Include any players from support chat not yet in /player/all
    supportMap.forEach((sInfo, pid) => {
      if (!foundMap.has(pid)) {
        foundMap.set(pid, {
          id: pid,
          playerId: pid,
          username: (sInfo.playerName || pid).trim(),
          level: 1,
          experience: 0,
          gold: 0,
          gems: 0,
          isBanned: false,
          lastLogin: sInfo.latestMessageTime ? new Date(sInfo.latestMessageTime).toLocaleString() : 'Recent Chat',
          lastActiveTime: sInfo.latestMessageTime,
          lastSeen: sInfo.latestMessageTime,
        });
      }
    });

    // 7. Include any active match combatants not yet recorded
    activeMatchPlayerMap.forEach((_match, pid) => {
      if (!foundMap.has(pid)) {
        foundMap.set(pid, {
          id: pid,
          playerId: pid,
          username: `Combatant #${pid.slice(-4).toUpperCase()}`,
          level: 1,
          experience: 0,
          gold: 0,
          gems: 0,
          isBanned: false,
          lastLogin: 'In Match',
          lastActiveTime: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });
      }
    });

    // 8. Compute genuine presence for all players
    const enrichedList: PlayerProfile[] = [];
    const trackedList: TrackedPlayerPresence[] = [];

    foundMap.forEach((p) => {
      const isCurrentSessionUser = Boolean(localPlayerId && p.playerId === localPlayerId);
      const signalRStatus = realtimePresenceMap.get(p.playerId);

      const presenceInfo = getPlayerPresence(
        p.playerId,
        activeMatchPlayerMap,
        p.lastActiveTime,
        {
          isCurrentSessionUser,
          realtimeStatus: signalRStatus,
        }
      );

      const enrichedPlayer: PlayerProfile = {
        ...p,
        presence: presenceInfo.state,
        presenceDetails: presenceInfo.activityDescription,
        presenceInfo,
        activeMatch: activeMatchPlayerMap.get(p.playerId),
      };

      enrichedList.push(enrichedPlayer);

      trackedList.push({
        playerId: p.playerId,
        username: p.username,
        presence: presenceInfo,
        lastSeen: p.lastActiveTime || p.lastLogin || '',
        level: p.level,
        gold: p.gold,
        gems: p.gems,
        isBanned: p.isBanned,
        activeMatch: activeMatchPlayerMap.get(p.playerId),
      });
    });

    // 9. Sort priority: InBattle (0) > Online (1) > Offline (2), then by username
    const order = { InBattle: 0, Online: 1, Offline: 2 };
    enrichedList.sort((a, b) => {
      const stateA = a.presence || 'Offline';
      const stateB = b.presence || 'Offline';
      const diff = (order[stateA] ?? 2) - (order[stateB] ?? 2);
      if (diff !== 0) return diff;
      return a.username.localeCompare(b.username);
    });

    trackedList.sort((a, b) => {
      const diff = (order[a.presence.state] ?? 2) - (order[b.presence.state] ?? 2);
      if (diff !== 0) return diff;
      return a.username.localeCompare(b.username);
    });

    // 10. Compute exact metrics
    const totalCount = enrichedList.length;
    const onlineCount = enrichedList.filter((p) => p.presence === 'Online').length;
    const inBattleCount = enrichedList.filter((p) => p.presence === 'InBattle').length;
    const offlineCount = enrichedList.filter((p) => p.presence === 'Offline').length;

    const data: UnifiedPlayerData = {
      players: enrichedList,
      trackedPlayers: trackedList,
      activeMatchPlayerMap,
      activeMatchesCount: liveMatchesCount,
      totalMatchesCount,
      counts: {
        total: totalCount,
        online: onlineCount,
        inBattle: inBattleCount,
        offline: offlineCount,
      },
      lastSyncedAt: new Date(),
    };

    cachedData = data;
    notifyListeners(data);
    return data;
  } finally {
    isFetching = false;
  }
}

/**
 * Returns the currently cached presence snapshot immediately if available.
 */
export function getCachedUnifiedData(): UnifiedPlayerData | null {
  return cachedData;
}

/**
 * Subscribes a React component to live player presence updates.
 * Automatically initiates polling and SignalR connection.
 */
export function subscribeToUnifiedPresence(
  callback: (data: UnifiedPlayerData) => void
): () => void {
  listeners.add(callback);

  if (cachedData) {
    callback(cachedData);
  } else {
    fetchUnifiedPlayerData();
  }

  ensureHubConnection();
  ensureAutoRefresh();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      stopAutoRefresh();
    }
  };
}

function notifyListeners(data: UnifiedPlayerData) {
  listeners.forEach((listener) => {
    try {
      listener(data);
    } catch (err) {
      console.error('[playerPresenceService] Listener error:', err);
    }
  });
}

function ensureAutoRefresh() {
  if (autoRefreshTimer !== null) return;
  // Auto-poll every 12 seconds to keep live metrics continuously fresh
  autoRefreshTimer = window.setInterval(() => {
    fetchUnifiedPlayerData().catch(() => {});
  }, 12000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer !== null) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

/**
 * Connects to SignalR LobbyHub to receive live presence notifications from Unity clients.
 */
function ensureHubConnection() {
  const token = sessionStorage.getItem('adminToken');
  if (!token || hubConnection) return;

  try {
    hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/lobby', {
        accessTokenFactory: () => sessionStorage.getItem('adminToken') || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build();

    hubConnection.on('OnFriendPresenceChanged', (presence: { playerId: string; isOnline: boolean; status: string }) => {
      if (presence && presence.playerId) {
        realtimePresenceMap.set(presence.playerId, presence.status || (presence.isOnline ? 'idle' : 'offline'));
        fetchUnifiedPlayerData().catch(() => {});
      }
    });

    hubConnection.on('OnPlayerPresenceChanged', (presence: { playerId: string; isOnline: boolean; status: string }) => {
      if (presence && presence.playerId) {
        realtimePresenceMap.set(presence.playerId, presence.status || (presence.isOnline ? 'idle' : 'offline'));
        fetchUnifiedPlayerData().catch(() => {});
      }
    });

    hubConnection.start().catch(() => {
      // LobbyHub connection may be optional if server runs in minimal mode
    });
  } catch {
    // Non-blocking fallback
  }
}
