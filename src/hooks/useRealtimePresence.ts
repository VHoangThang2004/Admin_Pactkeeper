import { useState, useEffect, useCallback } from 'react';
import {
  fetchUnifiedPlayerData,
  subscribeToUnifiedPresence,
  getCachedUnifiedData,
  type UnifiedPlayerData,
} from '../services/playerPresenceService';

export function useRealtimePresence() {
  const [data, setData] = useState<UnifiedPlayerData | null>(getCachedUnifiedData());
  const [loading, setLoading] = useState<boolean>(!getCachedUnifiedData());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeToUnifiedPresence((updated) => {
      if (!mounted) return;
      setData(updated);
      setLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const refreshed = await fetchUnifiedPlayerData();
      setData(refreshed);
      setError(null);
      return refreshed;
    } catch (err: any) {
      setError(err?.message || 'Failed to sync player telemetry.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    players: data?.players || [],
    trackedPlayers: data?.trackedPlayers || [],
    counts: data?.counts || { total: 0, online: 0, inBattle: 0, offline: 0 },
    activeMatchesCount: data?.activeMatchesCount || 0,
    totalMatchesCount: data?.totalMatchesCount || 0,
    lastSyncedAt: data?.lastSyncedAt,
    loading,
    error,
    refresh,
  };
}
