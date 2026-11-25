import { adminClient } from '../api/adminClient';
import type { PlayerProfile } from '../types';
import {
  getPlayerPresence,
  isActiveMatchStatus,
  isAiOrVirtualPlayerId,
  isAiOrVirtualUsername,
  type ActiveMatchInfo,
  type PlayerPresenceInfo,
} from '../utils/presence';
import * as signalR from '@microsoft/signalr';

export type HubConnectionState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected';

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
  hubConnected: boolean;
  hubState: HubConnectionState;
  lastSyncedAt: Date;
}

interface RealtimePresenceEntry {
  status: string;
  updatedAt: number;
}

// Global cached state and subscribers
let cachedData: UnifiedPlayerData | null = null;
const realtimePresenceMap = new Map<string, RealtimePresenceEntry>();
const listeners = new Set<(data: UnifiedPlayerData) => void>();
let hubConnection: signalR.HubConnection | null = null;
let hubConnectionToken: string | null = null;
let hubState: HubConnectionState = 'disconnected';
let autoRefreshTimer: number | null = null;
let inFlightFetch: Promise<UnifiedPlayerData> | null = null;

function resolveLocalPlayerId(): string | null {
  return (
    sessionStorage.getItem('player_id') ||
    sessionStorage.getItem('playerId') ||
    sessionStorage.getItem('adminPlayerId') ||
    localStorage.getItem('player_id') ||
    localStorage.getItem('playerId')
  );
}

function normalizePresencePayload(raw: unknown): {
  playerId: string;
  isOnline: boolean;
  status: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawId = obj.playerId ?? obj.PlayerId;
  if (typeof rawId !== 'string' || !rawId.trim()) return null;
  const trimmedId = rawId.trim();
  if (isAiOrVirtualPlayerId(trimmedId)) return null;
  const rawOnline = obj.isOnline ?? obj.IsOnline;
  const rawStatus = obj.status ?? obj.Status;
  const isOnline = typeof rawOnline === 'boolean' ? rawOnline : rawStatus !== 'offline';
  const status =
    typeof rawStatus === 'string' && rawStatus.trim()
      ? rawStatus.trim().toLowerCase()
      : isOnline
        ? 'idle'
        : 'offline';

  return { playerId: trimmedId, isOnline, status };
}

function extractOnlineSnapshotMap(raw: unknown): Map<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.onlinePlayers && typeof obj.onlinePlayers === 'object'
      ? (obj.onlinePlayers as Record<string, unknown>)
      : obj.OnlinePlayers && typeof obj.OnlinePlayers === 'object'
        ? (obj.OnlinePlayers as Record<string, unknown>)
        : obj;

  const map = new Map<string, string>();
  for (const [pid, val] of Object.entries(candidate)) {
    if (!pid || pid === 'count' || pid === 'Count' || isAiOrVirtualPlayerId(pid)) continue;
    if (typeof val === 'string' && val.trim()) {
      map.set(pid, val.trim().toLowerCase());
    } else if (val === true) {
      map.set(pid, 'idle');
    }
  }
  return map;
}

function buildUnifiedSnapshot(
  basePlayers: PlayerProfile[],
  activeMatchPlayerMap: Map<string, ActiveMatchInfo>,
  activeMatchesCount: number,
  totalMatchesCount: number,
  onlineSnapshotMap: Map<string, string> | null
): UnifiedPlayerData {
  const localPlayerId = resolveLocalPlayerId();
  const enrichedList: PlayerProfile[] = [];
  const trackedList: TrackedPlayerPresence[] = [];

  for (const p of basePlayers) {
    if (isAiOrVirtualPlayerId(p.playerId) || isAiOrVirtualUsername(p.username)) {
      continue;
    }
    const isCurrentSessionUser = Boolean(localPlayerId && p.playerId === localPlayerId);
    const realtimeEntry = realtimePresenceMap.get(p.playerId);

    const snapshotStatus = onlineSnapshotMap?.get(p.playerId);
    const hasBackendBoolean = typeof p.isOnline === 'boolean';
    const isOnlineExplicit =
      onlineSnapshotMap !== null
        ? Boolean(snapshotStatus || p.isOnline)
        : hasBackendBoolean
          ? Boolean(p.isOnline)
          : undefined;

    const effectiveRealtimeStatus =
      realtimeEntry?.status ?? snapshotStatus ?? p.presenceStatus;

    const presenceInfo = getPlayerPresence(
      p.playerId,
      activeMatchPlayerMap,
      p.lastActiveTime,
      {
        isCurrentSessionUser,
        isOnlineExplicit,
        realtimeStatus: effectiveRealtimeStatus,
      }
    );

    const enrichedPlayer: PlayerProfile = {
      ...p,
      isOnline:
        presenceInfo.state === 'Online' || presenceInfo.state === 'InBattle',
      presenceStatus:
        presenceInfo.state === 'InBattle'
          ? 'in_match'
          : presenceInfo.state === 'Online'
            ? 'idle'
            : 'offline',
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
  }

  // Sort priority: InBattle (0) > Online (1) > Offline (2), then by username
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

  const totalCount = enrichedList.length;
  const onlineCount = enrichedList.filter((p) => p.presence === 'Online').length;
  const inBattleCount = enrichedList.filter((p) => p.presence === 'InBattle').length;
  const offlineCount = enrichedList.filter((p) => p.presence === 'Offline').length;

  return {
    players: enrichedList,
    trackedPlayers: trackedList,
    activeMatchPlayerMap,
    activeMatchesCount,
    totalMatchesCount,
    counts: {
      total: totalCount,
      online: onlineCount,
      inBattle: inBattleCount,
      offline: offlineCount,
    },
    hubConnected: hubState === 'connected',
    hubState,
    lastSyncedAt: new Date(),
  };
}

function recomputeCachedData(onlineSnapshotMap: Map<string, string> | null = null) {
  if (!cachedData) return;

  // Preserve base profile metadata, dropping cached derived fields unless explicit snapshot replaces them
  const basePlayers = cachedData.players
    .filter((p) => !isAiOrVirtualPlayerId(p.playerId) && !isAiOrVirtualUsername(p.username))
    .map((p) => ({
      ...p,
      isOnline: onlineSnapshotMap !== null ? onlineSnapshotMap.has(p.playerId) : p.isOnline,
      presenceStatus:
        onlineSnapshotMap !== null
          ? onlineSnapshotMap.get(p.playerId) || 'offline'
          : p.presenceStatus,
    }));

  cachedData = buildUnifiedSnapshot(
    basePlayers,
    cachedData.activeMatchPlayerMap,
    cachedData.activeMatchesCount,
    cachedData.totalMatchesCount,
    onlineSnapshotMap
  );
  notifyListeners(cachedData);
}

/**
 * Fetches and aggregates complete player records from all backend endpoints
 * ensuring 100% data consistency between Overview and Accounts management.
 */
export async function fetchUnifiedPlayerData(): Promise<UnifiedPlayerData> {
  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    const fetchStartedAt = Date.now();
    const [allPlayersRes, matchRes, supportRes, paymentRes, onlineRes] =
      await Promise.allSettled([
        adminClient.get('/player/all'),
        adminClient.get('/Match/history'),
        adminClient.get('/support/admin/players'),
        adminClient.get('/payment/history'),
        adminClient.get('/admin/online-players'),
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
          if (m.player1Id && !isAiOrVirtualPlayerId(m.player1Id)) {
            activeMatchPlayerMap.set(m.player1Id, info);
          }
          if (m.player2Id && !isAiOrVirtualPlayerId(m.player2Id)) {
            activeMatchPlayerMap.set(m.player2Id, info);
          }
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

    // 4. Online Hub snapshot from /admin/online-players (authoritative when backend exposes it)
    const onlineSnapshotMap =
      onlineRes.status === 'fulfilled'
        ? extractOnlineSnapshotMap(onlineRes.value.data)
        : null;

    const foundMap = new Map<string, PlayerProfile>();
    let playersIncludeAuthoritativePresence = false;

    // 5. Seed with ground-truth players from /player/all
    if (allPlayersRes.status === 'fulfilled' && Array.isArray(allPlayersRes.value.data)) {
      allPlayersRes.value.data.forEach((p: any) => {
        if (!p.playerId || isAiOrVirtualPlayerId(p.playerId) || isAiOrVirtualUsername(p.username)) return;
        const sInfo = supportMap.get(p.playerId);
        const pTime = paymentMap.get(p.playerId);

        const rawIsOnline = p.isOnline ?? p.IsOnline;
        const rawPresenceStatus = p.presenceStatus ?? p.PresenceStatus;
        if (typeof rawIsOnline === 'boolean') {
          playersIncludeAuthoritativePresence = true;
        }

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
          isOnline: typeof rawIsOnline === 'boolean' ? rawIsOnline : undefined,
          presenceStatus:
            typeof rawPresenceStatus === 'string'
              ? rawPresenceStatus.toLowerCase()
              : undefined,
          lastLogin: p.lastLogin ? new Date(p.lastLogin).toLocaleString() : 'Never',
          lastActiveTime: latestActivity || p.lastLogin,
          lastSeen: latestActivity || p.lastLogin,
        });
      });
    }

    // 6. Include any players from support chat not yet in /player/all
    supportMap.forEach((sInfo, pid) => {
      if (isAiOrVirtualPlayerId(pid) || isAiOrVirtualUsername(sInfo.playerName)) return;
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
          lastLogin: sInfo.latestMessageTime
            ? new Date(sInfo.latestMessageTime).toLocaleString()
            : 'Recent Chat',
          lastActiveTime: sInfo.latestMessageTime,
          lastSeen: sInfo.latestMessageTime,
        });
      }
    });

    // 7. Include any genuine match participants not yet recorded in /player/all (human players only, never AI/virtual entities)
    activeMatchPlayerMap.forEach((_match, pid) => {
      if (isAiOrVirtualPlayerId(pid)) return;
      if (!foundMap.has(pid)) {
        foundMap.set(pid, {
          id: pid,
          playerId: pid,
          username: `Traveler #${pid.slice(-4).toUpperCase()}`,
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

    // Clear stale realtime entries older than this authoritative REST snapshot so
    // disconnects/reconnects missed by SignalR cannot linger forever.
    if (onlineSnapshotMap !== null || playersIncludeAuthoritativePresence) {
      for (const [pid, entry] of realtimePresenceMap.entries()) {
        if (entry.updatedAt < fetchStartedAt) {
          realtimePresenceMap.delete(pid);
        }
      }
    }

    const data = buildUnifiedSnapshot(
      Array.from(foundMap.values()),
      activeMatchPlayerMap,
      liveMatchesCount,
      totalMatchesCount,
      onlineSnapshotMap
    );

    cachedData = data;
    notifyListeners(data);
    return data;
  })().finally(() => {
    inFlightFetch = null;
  });

  return inFlightFetch;
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
    fetchUnifiedPlayerData().catch(() => {});
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

/**
 * Stops SignalR LobbyHub connection and clears cached presence state (e.g. on logout).
 */
export function stopPresenceSync(): void {
  stopAutoRefresh();
  realtimePresenceMap.clear();
  cachedData = null;
  hubState = 'disconnected';
  hubConnectionToken = null;
  if (hubConnection) {
    const conn = hubConnection;
    hubConnection = null;
    conn.stop().catch(() => {});
  }
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

function setHubState(next: HubConnectionState) {
  if (hubState === next) return;
  hubState = next;
  if (cachedData) {
    cachedData = {
      ...cachedData,
      hubConnected: next === 'connected',
      hubState: next,
    };
    notifyListeners(cachedData);
  }
}

function applyOnlineSnapshot(rawSnapshot: unknown) {
  const snapshotMap = extractOnlineSnapshotMap(rawSnapshot);
  if (!snapshotMap) return;

  const now = Date.now();
  realtimePresenceMap.clear();
  snapshotMap.forEach((status, pid) => {
    realtimePresenceMap.set(pid, { status, updatedAt: now });
  });

  if (cachedData) {
    recomputeCachedData(snapshotMap);
  } else {
    fetchUnifiedPlayerData().catch(() => {});
  }
}

function applySinglePresenceUpdate(raw: unknown) {
  const normalized = normalizePresencePayload(raw);
  if (!normalized) return;

  realtimePresenceMap.set(normalized.playerId, {
    status: normalized.status,
    updatedAt: Date.now(),
  });

  const matchStateChanged =
    cachedData &&
    ((normalized.status === 'in_match' &&
      !cachedData.activeMatchPlayerMap.has(normalized.playerId)) ||
      (normalized.status !== 'in_match' &&
        cachedData.activeMatchPlayerMap.has(normalized.playerId)));

  if (
    cachedData &&
    cachedData.players.some((p) => p.playerId === normalized.playerId)
  ) {
    recomputeCachedData(null);
    if (matchStateChanged) {
      fetchUnifiedPlayerData().catch(() => {});
    }
  } else {
    fetchUnifiedPlayerData().catch(() => {});
  }
}

/**
 * Connects to SignalR LobbyHub to receive live presence notifications from Unity clients.
 */
function ensureHubConnection() {
  const token = sessionStorage.getItem('adminToken');
  if (!token) {
    stopPresenceSync();
    return;
  }

  if (hubConnection && hubConnectionToken === token) {
    if (hubConnection.state === signalR.HubConnectionState.Disconnected) {
      setHubState('connecting');
      hubConnection
        .start()
        .then(() => {
          setHubState('connected');
          return hubConnection?.invoke('GetOnlinePlayers').then(applyOnlineSnapshot).catch(() => {});
        })
        .catch(() => {
          setHubState('disconnected');
        });
    }
    return;
  }

  if (hubConnection) {
    const oldConn = hubConnection;
    hubConnection = null;
    oldConn.stop().catch(() => {});
  }

  try {
    hubConnectionToken = token;
    setHubState('connecting');

    // Vercel Rewrites do not proxy WebSocket upgrades; use SSE/LongPolling on relative prod URLs
    const useProxySafeTransports = !import.meta.env.DEV;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/lobby', {
        accessTokenFactory: () => sessionStorage.getItem('adminToken') || '',
        ...(useProxySafeTransports
          ? {
              transport:
                signalR.HttpTransportType.ServerSentEvents |
                signalR.HttpTransportType.LongPolling,
            }
          : {}),
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hubConnection = connection;

    connection.on('OnOnlinePlayersSnapshot', (snapshot: unknown) => {
      applyOnlineSnapshot(snapshot);
    });

    connection.on('OnFriendPresenceChanged', (presence: unknown) => {
      applySinglePresenceUpdate(presence);
    });

    connection.on('OnPlayerPresenceChanged', (presence: unknown) => {
      applySinglePresenceUpdate(presence);
    });

    connection.onreconnecting(() => {
      setHubState('reconnecting');
    });

    connection.onreconnected(() => {
      setHubState('connected');
      connection
        .invoke('GetOnlinePlayers')
        .then(applyOnlineSnapshot)
        .catch(() => {});
      fetchUnifiedPlayerData().catch(() => {});
    });

    connection.onclose(() => {
      if (hubConnection === connection) {
        setHubState('disconnected');
      }
    });

    connection
      .start()
      .then(() => {
        if (hubConnection !== connection) return;
        setHubState('connected');
        connection
          .invoke('GetOnlinePlayers')
          .then(applyOnlineSnapshot)
          .catch(() => {});
      })
      .catch(() => {
        if (hubConnection === connection) {
          setHubState('disconnected');
        }
      });
  } catch {
    setHubState('disconnected');
  }
}
