import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PlayerProfile, CounselRole } from '../types';
import { adminClient } from '../api/adminClient';
import { Search, UserCheck, UserX, Coins, Gem, Shield, Edit3, CheckCircle2, Inbox, RefreshCw, UserPlus, Info, Copy, Swords, Terminal } from 'lucide-react';
import { getPlayerPresence } from '../utils/presence';

interface PlayerManagementProps {
  role?: CounselRole;
}

/**
 * Player Management & Live-Ops Moderation Page (Screen 29 & 30)
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * 1. Multi-source Player Aggregation: Combines Google OAuth / Steam sessions,
 *    live support chat tickets (/api/Support/admin/players), and PayOS purchase history (/api/Payment/history).
 * 2. Role-Based Permissions (RBAC):
 *    - Support: Read-only inspection mode.
 *    - Moderator: Disciplinary authority (Account Ban / Unban actions).
 *    - Admin: Full authority including direct treasury balance adjustments with audit logging.
 * 3. Modern Dark Fantasy Glassmorphism Roster with live presence badges and high-contrast modals.
 */
export const PlayerManagement: React.FC<PlayerManagementProps> = ({ role = 'Admin' }) => {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlayerIdInput, setNewPlayerIdInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [adjustGems, setAdjustGems] = useState<number>(0);
  const [adjustGold, setAdjustGold] = useState<number>(0);
  const [compensationReason, setCompensationReason] = useState<string>('');
  const [banTargetPlayer, setBanTargetPlayer] = useState<PlayerProfile | null>(null);
  const [banReason, setBanReason] = useState<string>('');
  const [banDuration, setBanDuration] = useState<'TEMPORARY_24H' | 'TEMPORARY_7D' | 'PERMANENT'>('PERMANENT');
  const [unbanTargetPlayer, setUnbanTargetPlayer] = useState<PlayerProfile | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches and aggregates active player profiles from multiple live backend endpoints
   * and computes their genuine real-time presence (In Battle, Online, Offline).
   */
  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const [supportRes, paymentRes, matchRes, allPlayersRes] = await Promise.allSettled([
        adminClient.get('/support/admin/players'),
        adminClient.get('/Payment/history'),
        adminClient.get('/Match/history'),
        adminClient.get('/player/all'),
      ]);

      // 1. Identify active matches & combatants
      const activeMatchPlayerMap = new Map<string, { matchId: string; mode?: string }>();
      if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
        matchRes.value.data.forEach((m: any) => {
          const s = (m.status || '').toLowerCase();
          const isLive = s === 'inprogress' || s === 'active' || s === 'playing' || s === 'running' || m.status === 1;
          if (isLive) {
            const mId = m.matchId || m.id || '';
            if (m.player1Id) activeMatchPlayerMap.set(m.player1Id, { matchId: mId, mode: m.mode });
            if (m.player2Id) activeMatchPlayerMap.set(m.player2Id, { matchId: mId, mode: m.mode });
          }
        });
      }

      const foundMap = new Map<string, PlayerProfile>();

      // 1.1 Read all registered players from database
      if (allPlayersRes.status === 'fulfilled' && Array.isArray(allPlayersRes.value.data)) {
        allPlayersRes.value.data.forEach((p: any) => {
          if (p.playerId) {
            foundMap.set(p.playerId, {
              playerId: p.playerId,
              username: p.username || p.playerId,
              level: p.level ?? 1,
              experience: p.experience ?? 0,
              gold: p.gold ?? 0,
              gems: p.gems ?? 0,
              lastLogin: p.lastLogin ? new Date(p.lastLogin).toLocaleString() : new Date().toLocaleString(),
              lastActiveTime: p.lastLogin,
              isBanned: Boolean(p.isBanned),
            });
          }
        });
      }

      // 2. Read active player profile from current session / sessionStorage
      const localPlayerId = sessionStorage.getItem('player_id') || sessionStorage.getItem('playerId') || sessionStorage.getItem('adminPlayerId') || localStorage.getItem('player_id') || localStorage.getItem('playerId');
      const localUsername = sessionStorage.getItem('username') || sessionStorage.getItem('adminUsername') || localStorage.getItem('username');
      if (localPlayerId) {
        foundMap.set(localPlayerId, {
          playerId: localPlayerId,
          username: localUsername || localPlayerId,
          level: 1,
          experience: 0,
          gold: 0,
          gems: 0,
          lastLogin: new Date().toLocaleString(),
          lastActiveTime: new Date().toISOString(),
          isBanned: false,
        });
      }

      // 3. Read active support chat players from API
      if (supportRes.status === 'fulfilled' && Array.isArray(supportRes.value.data)) {
        supportRes.value.data.forEach((p: any) => {
          if (p.playerId) {
            const time = p.latestMessageTime || p.lastMessageAt || '';
            foundMap.set(p.playerId, {
              playerId: p.playerId,
              username: (p.playerName || p.username || p.playerId).trim(),
              level: p.level ?? 1,
              experience: p.experience ?? 0,
              gold: p.gold ?? 0,
              gems: p.gems ?? 0,
              lastLogin: time ? new Date(time).toLocaleString() : new Date().toLocaleString(),
              lastActiveTime: time,
              isBanned: false,
            });
          }
        });
      }

      // 4. Read player IDs from Payment orders
      if (paymentRes.status === 'fulfilled' && Array.isArray(paymentRes.value.data)) {
        paymentRes.value.data.forEach((order: any) => {
          const pid = order.playerId || order.userId;
          if (pid && !foundMap.has(pid)) {
            const time = order.createdAt || order.timestamp || '';
            foundMap.set(pid, {
              playerId: pid,
              username: `Traveler #${pid.slice(-4).toUpperCase()}`,
              level: 1,
              experience: 0,
              gold: 0,
              gems: 0,
              lastLogin: time ? new Date(time).toLocaleString() : new Date().toLocaleString(),
              lastActiveTime: time,
              isBanned: false,
            });
          }
        });
      }

      // 5. In-Match active combatants
      activeMatchPlayerMap.forEach((_, pid) => {
        if (!foundMap.has(pid)) {
          foundMap.set(pid, {
            playerId: pid,
            username: `Combatant #${pid.slice(-4).toUpperCase()}`,
            level: 1,
            experience: 0,
            gold: 0,
            gems: 0,
            lastLogin: new Date().toLocaleString(),
            lastActiveTime: new Date().toISOString(),
            isBanned: false,
          });
        }
      });

      // 6. Enrich players with real live balances and presence
      const enrichedPlayers: PlayerProfile[] = [];
      const fetchList = Array.from(foundMap.values());

      await Promise.allSettled(
        fetchList.map(async (p) => {
          let updatedPlayer = { ...p };
          try {
            const profRes = await adminClient.get(`/player/profile/${p.playerId}`);
            if (profRes.data) {
              const d = profRes.data;
              updatedPlayer = {
                ...updatedPlayer,
                username: d.username || d.playerName || updatedPlayer.username,
                level: d.level ?? updatedPlayer.level,
                experience: d.experience ?? updatedPlayer.experience,
                gold: d.gold ?? updatedPlayer.gold,
                gems: d.gems ?? updatedPlayer.gems,
                isBanned: Boolean(d.isBanned),
                lastActiveTime: d.lastActiveTime || d.lastLogin || updatedPlayer.lastActiveTime,
              };
            }
          } catch {
            // Keep base profile
          }

          const isCurrent = p.playerId === localPlayerId;
          const presInfo = getPlayerPresence(p.playerId, activeMatchPlayerMap, updatedPlayer.lastActiveTime, isCurrent);
          updatedPlayer.presence = presInfo.state;
          enrichedPlayers.push(updatedPlayer);
        })
      );

      // Sort by status priority: InBattle > Online > Offline
      enrichedPlayers.sort((a, b) => {
        const order = { InBattle: 0, Online: 1, Offline: 2 };
        const presA = (a.presence as keyof typeof order) || 'Offline';
        const presB = (b.presence as keyof typeof order) || 'Offline';
        return (order[presA] ?? 2) - (order[presB] ?? 2);
      });

      setPlayers(enrichedPlayers);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleAddPlayerById = async () => {
    if (!newPlayerIdInput.trim()) return;
    const targetId = newPlayerIdInput.trim();

    try {
      setLoading(true);
      const res = await adminClient.get(`/player/profile/${targetId}`);
      if (res.data) {
        const d = res.data;
        const newP: PlayerProfile = {
          playerId: targetId,
          username: d.username || d.playerName || `Wanderer #${targetId.slice(-4).toUpperCase()}`,
          level: d.level ?? 1,
          experience: d.experience ?? 0,
          gold: d.gold ?? 0,
          gems: d.gems ?? 0,
          lastLogin: new Date().toLocaleString(),
          isBanned: Boolean(d.isBanned),
          presence: 'Online',
        };
        setPlayers((prev) => [newP, ...prev.filter((p) => p.playerId !== targetId)]);
        setNewPlayerIdInput('');
        setNotification(`Loaded player profile for "${newP.username}" from Database.`);
      }
    } catch {
      const fallbackP: PlayerProfile = {
        playerId: targetId,
        username: `Wanderer #${targetId.slice(-4).toUpperCase()}`,
        level: 1,
        experience: 0,
        gold: 0,
        gems: 0,
        lastLogin: new Date().toLocaleString(),
        isBanned: false,
        presence: 'Offline',
      };
      setPlayers((prev) => [fallbackP, ...prev.filter((p) => p.playerId !== targetId)]);
      setNewPlayerIdInput('');
      setNotification(`Added placeholder for Player ID "${targetId}".`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedPlayer) return;
    try {
      await adminClient.post(`/player/adjust-currencies`, {
        playerId: selectedPlayer.playerId,
        gems: adjustGems,
        gold: adjustGold,
        reason: compensationReason || 'Admin Manual Treasury Adjustment',
      });
      setNotification(`Successfully adjusted currencies for ${selectedPlayer.username} (${adjustGems >= 0 ? '+' : ''}${adjustGems} Gems, ${adjustGold >= 0 ? '+' : ''}${adjustGold} Gold).`);
      setSelectedPlayer(null);
      setAdjustGems(0);
      setAdjustGold(0);
      setCompensationReason('');
      fetchPlayers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to apply currency adjustments.');
    }
  };

  const handleConfirmBan = async () => {
    if (!banTargetPlayer) return;
    if (!banReason.trim()) {
      alert('Violation rationale is required to enforce an authoritative disciplinary sanction.');
      return;
    }
    try {
      await adminClient.post(`/player/ban`, {
        playerId: banTargetPlayer.playerId,
        duration: banDuration,
        reason: banReason.trim(),
      });
      setNotification(`Account sanction enforced against ${banTargetPlayer.username} (${banDuration}) for: "${banReason.trim()}".`);
      setBanTargetPlayer(null);
      setBanReason('');
      fetchPlayers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to enforce disciplinary ban.');
    }
  };

  const handleConfirmUnban = async () => {
    if (!unbanTargetPlayer) return;
    try {
      await adminClient.post(`/player/unban`, {
        playerId: unbanTargetPlayer.playerId,
      });
      setNotification(`Account access successfully restored for ${unbanTargetPlayer.username}.`);
      setUnbanTargetPlayer(null);
      fetchPlayers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restore player account.');
    }
  };

  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.playerId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (presenceFilter === 'ONLINE') return p.presence === 'Online';
    if (presenceFilter === 'BATTLE') return p.presence === 'InBattle';
    if (presenceFilter === 'OFFLINE') return p.presence === 'Offline';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Astral Panel */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div 
          className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/[0.06] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">
                SCREEN 29 & 30 • PLAYER CARE & DISCIPLINE
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">{role === 'Moderator' ? 'User Directory' : 'Accounts Management'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel uppercase gold-gradient-text">
              {role === 'Moderator' ? 'USER DIRECTORY & DISCIPLINARY LOGS' : 'MANAGE USER ACCOUNTS & TREASURY'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Multi-source aggregation across Google OAuth sessions, Live Support Tickets, and In-Match Combatants.
            </p>
          </div>

          <button
            onClick={fetchPlayers}
            disabled={loading}
            className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 self-start md:self-auto shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC PLAYERS</span>
          </button>
        </div>
      </div>

      {/* Role Notice */}
      {role === 'Moderator' && (
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2.5 backdrop-blur-md">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong>Realm Moderator Inspection Mode:</strong> Live presence tracking and match inspection enabled. Account balance adjustments are reserved for High Counsel Administrators.
          </span>
        </div>
      )}

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-mono underline hover:text-white">
            DISMISS
          </button>
        </div>
      )}

      {/* Search & Add Player Controls */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-white/[0.08]">
        <div className="flex items-center gap-3 w-full md:w-96 bg-slate-950/80 border border-white/[0.1] focus-within:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-slate-100 transition-colors">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by Player ID or Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-100 placeholder-slate-500 text-xs font-sans"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <input
            type="text"
            placeholder="Enter Player ID from DB (e.g. Google ID)..."
            value={newPlayerIdInput}
            onChange={(e) => setNewPlayerIdInput(e.target.value)}
            className="bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none font-mono flex-1 md:w-80 transition-colors"
          />
          <button
            onClick={handleAddPlayerById}
            className="btn-primary-gold px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" /> LOAD ID
          </button>
        </div>
      </div>

      {/* Presence Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setPresenceFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              presenceFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.08]'
            }`}
          >
            ALL PLAYERS ({players.length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('ONLINE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              presenceFilter === 'ONLINE'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'bg-white/[0.04] text-emerald-300 hover:text-white border border-emerald-500/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            ONLINE ({players.filter((p) => p.presence === 'Online').length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('BATTLE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              presenceFilter === 'BATTLE'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-white/[0.04] text-amber-300 hover:text-white border border-amber-500/30'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-amber-400" />
            IN BATTLE ({players.filter((p) => p.presence === 'InBattle').length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('OFFLINE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              presenceFilter === 'OFFLINE'
                ? 'bg-slate-700 text-white font-bold shadow'
                : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.08]'
            }`}
          >
            OFFLINE ({players.filter((p) => p.presence === 'Offline').length})
          </button>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Showing {filteredPlayers.length} of {players.length} Heroes
        </span>
      </div>

      {/* Roster Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
            <p className="text-sm font-bold font-cinzel text-slate-200">No player accounts match current search & presence filters.</p>
            <p className="text-xs text-slate-500 font-sans">Type a Player ID into "LOAD ID" to query details.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Player Account</th>
                <th className="py-3.5 px-5">Level & EXP</th>
                <th className="py-3.5 px-5">Currencies</th>
                <th className="py-3.5 px-5">Live Presence</th>
                <th className="py-3.5 px-5">Standing</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-200">
              {filteredPlayers.map((player) => (
                <tr key={player.playerId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/[0.1] flex items-center justify-center text-amber-400 font-bold text-xs font-cinzel shrink-0 shadow">
                          {player.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080a0f] ${
                            player.presence === 'InBattle'
                              ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                              : player.presence === 'Online'
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                              : 'bg-slate-600'
                          }`}
                          title={player.presence || 'Offline'}
                        />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100 text-xs block">
                          {player.username}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-400">
                            Ref: #{player.playerId.slice(-6).toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(player.playerId);
                              setNotification(`Copied Player ID ${player.playerId} to clipboard.`);
                            }}
                            className="text-amber-400 hover:text-amber-300 transition-colors p-0.5"
                            title={`Copy: ${player.playerId}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-5">
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-amber-300 border border-white/[0.08] font-mono font-bold text-[11px]">
                      LV. {player.level}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono mt-1">
                      {player.experience.toLocaleString()} EXP
                    </span>
                  </td>

                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="flex items-center gap-1 text-amber-300 font-semibold">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        {(player.gold ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                        <Gem className="w-3.5 h-3.5 text-cyan-400" />
                        {(player.gems ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 border shadow-sm ${
                          player.presence === 'InBattle'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : player.presence === 'Online'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-white/[0.04] border-white/[0.06] text-slate-400'
                        }`}
                      >
                        {player.presence === 'InBattle' && <Swords className="w-3 h-3 text-amber-400 animate-bounce" />}
                        {player.presence === 'Online' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        {player.presence === 'Offline' && <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                        {player.presence === 'InBattle' ? 'In Battle' : player.presence || 'Offline'}
                      </span>
                      {player.presence === 'InBattle' && (
                        <Link
                          to="/matches"
                          className="px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold inline-flex items-center gap-1 transition-all shadow-sm"
                          title="Inspect Combat Logs for this Battle"
                        >
                          <Terminal className="w-3 h-3" /> LOGS
                        </Link>
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-5">
                    {player.isBanned ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-bold inline-flex items-center gap-1">
                        <UserX className="w-3 h-3" /> EXILED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> NORMAL
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-5 text-right space-x-2">
                    {(role === 'Technical Support' || role === 'Support') ? (
                      <span className="text-xs font-mono text-slate-500 italic px-2.5 py-1 rounded bg-black/40 border border-white/[0.06] inline-block">
                        Read-Only
                      </span>
                    ) : (
                      <>
                        {(role === 'Admin' || role === 'Server') && (
                          <button
                            onClick={() => setSelectedPlayer(player)}
                            className="btn-glass p-1.5 text-amber-400"
                            title="Adjust Currencies"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (player.isBanned) {
                              setUnbanTargetPlayer(player);
                            } else {
                              setBanTargetPlayer(player);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            player.isBanned 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30' 
                              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60'
                          }`}
                        >
                          {player.isBanned ? 'Unban' : 'Ban'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjust Currency Modal (Screen 30: Currency Grant with Audit Log) */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              ADJUST TREASURY — {selectedPlayer.username}
            </h3>
            <p className="text-xs text-slate-400">
              Target Account: <strong className="text-amber-300">{selectedPlayer.username}</strong>
              <span className="font-mono text-slate-500 ml-1.5">(Ref #{selectedPlayer.playerId.slice(-6).toUpperCase()})</span>
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Add / Deduct Gems (+/-)</label>
                <input
                  type="number"
                  value={adjustGems}
                  onChange={(e) => setAdjustGems(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Add / Deduct Gold (+/-)</label>
                <input
                  type="number"
                  value={adjustGold}
                  onChange={(e) => setAdjustGold(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Audit Rationale / Compensation Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Server rollback compensation, test credit"
                  value={compensationReason}
                  onChange={(e) => setCompensationReason(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button onClick={() => setSelectedPlayer(null)} className="btn-glass px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button onClick={handleSaveAdjustment} className="btn-primary-gold px-4 py-1.5 text-xs font-bold">
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disciplinary Ban Sanction Modal (Screen 30: Enforce Ban with Violation Reason) */}
      {banTargetPlayer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-rose-500/40 w-full max-w-md space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold font-cinzel text-rose-300 flex items-center gap-2">
              <UserX className="w-5 h-5 text-rose-400" />
              ENFORCE DISCIPLINARY SANCTION
            </h3>
            <p className="text-xs text-slate-400">
              Target Account: <strong className="text-slate-100">{banTargetPlayer.username}</strong>
              <span className="font-mono text-slate-500 ml-1.5">(ID: {banTargetPlayer.playerId})</span>
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Sanction Duration</label>
                <select
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value as any)}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-rose-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-sans"
                >
                  <option value="TEMPORARY_24H" className="bg-slate-900 text-slate-100">Temporary Suspension (24 Hours)</option>
                  <option value="TEMPORARY_7D" className="bg-slate-900 text-slate-100">Extended Suspension (7 Days)</option>
                  <option value="PERMANENT" className="bg-slate-900 text-slate-100">Permanent Account Ban</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Violation Rationale <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify violation rationale (e.g. Speed hack in combat timeline, malicious desync, harassment)..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-rose-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => {
                  setBanTargetPlayer(null);
                  setBanReason('');
                }}
                className="btn-glass px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBan}
                className="px-4 py-1.5 rounded-xl font-bold font-cinzel bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 transition-all shadow"
              >
                Confirm Ban Sanction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lift Sanction Unban Modal */}
      {unbanTargetPlayer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-emerald-500/40 w-full max-w-md space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold font-cinzel text-emerald-300 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              LIFT ACCOUNT SANCTION
            </h3>
            <p className="text-xs text-slate-400">
              Restore normal game access and matchmaking eligibility for wanderer{' '}
              <strong className="text-slate-100">{unbanTargetPlayer.username}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button onClick={() => setUnbanTargetPlayer(null)} className="btn-glass px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button
                onClick={handleConfirmUnban}
                className="px-4 py-1.5 rounded-xl font-bold font-cinzel bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 transition-all shadow"
              >
                Restore Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
