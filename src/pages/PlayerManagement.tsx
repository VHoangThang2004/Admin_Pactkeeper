import React, { useState, useEffect } from 'react';
import type { PlayerProfile, CounselRole } from '../types';
import { adminClient } from '../api/adminClient';
import { Search, UserCheck, UserX, Coins, Gem, Shield, Edit3, CheckCircle2, Inbox, RefreshCw, UserPlus, Info, Copy, Swords } from 'lucide-react';
import { getPlayerPresence } from '../utils/presence';

interface PlayerManagementProps {
  role?: CounselRole;
}

/**
 * Player Management & Live-Ops Moderation Page
 * 
 * Features:
 * 1. Multi-source Player Aggregation: Combines active players from Google OAuth / Steam sessions,
 *    live support chat tickets (/api/Support/admin/players), and PayOS purchase history (/api/Payment/history).
 * 2. Role-Based Permissions (RBAC):
 *    - Support Role: Read-only inspection mode (inspect levels, gems, gold, timestamps for customer support).
 *    - Moderator Role: Disciplinary authority (Account Ban / Unban actions).
 *    - Admin / Server Role: Full authority including direct treasury balance adjustments.
 * 3. Dynamic search by Player ID or Username, and manual DB Player ID loading.
 */
export const PlayerManagement: React.FC<PlayerManagementProps> = ({ role = 'Admin' }) => {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<'ALL' | 'ONLINE' | 'BATTLE' | 'OFFLINE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlayerIdInput, setNewPlayerIdInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [adjustGems, setAdjustGems] = useState<number>(0);
  const [adjustGold, setAdjustGold] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches and aggregates active player profiles from multiple live backend endpoints
   * and computes their genuine real-time presence (In Battle, Online, Offline).
   */
  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const [supportRes, paymentRes, matchRes] = await Promise.allSettled([
        adminClient.get('/support/admin/players'),
        adminClient.get('/Payment/history'),
        adminClient.get('/Match/history'),
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

      // 2. Read active player profile from current session / localStorage (Google OAuth & Active logins)
      const localPlayerId = localStorage.getItem('player_id') || localStorage.getItem('playerId') || localStorage.getItem('adminPlayerId');
      const localUsername = localStorage.getItem('username') || localStorage.getItem('adminUsername');
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

      // 4. Read payment transaction players from API
      if (paymentRes.status === 'fulfilled' && Array.isArray(paymentRes.value.data)) {
        paymentRes.value.data.forEach((ord: any) => {
          if (ord.playerId && !foundMap.has(ord.playerId)) {
            const time = ord.createdAt || '';
            foundMap.set(ord.playerId, {
              playerId: ord.playerId,
              username: ord.playerId,
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

      // 5. Read combatants directly from active match sessions
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

      // 6. Calculate genuine presence per player profile
      const profiles: PlayerProfile[] = [];
      foundMap.forEach((p, pid) => {
        const isCurrentSessionUser = pid === localPlayerId;
        const presence = getPlayerPresence(pid, activeMatchPlayerMap, p.lastActiveTime || p.lastLogin, isCurrentSessionUser);
        profiles.push({
          ...p,
          presence: presence.state,
          presenceDetails: presence.activityDescription,
          lastSeen: presence.relativeTime,
        });
      });

      // Sort by presence priority (InBattle -> Online -> Offline)
      profiles.sort((a, b) => {
        const order = { InBattle: 0, Online: 1, Offline: 2 };
        const orderA = a.presence ? order[a.presence] : 2;
        const orderB = b.presence ? order[b.presence] : 2;
        return orderA - orderB;
      });

      setPlayers(profiles);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleAddPlayerById = () => {
    if (!newPlayerIdInput.trim()) return;
    const pid = newPlayerIdInput.trim();
    if (players.some((p) => p.playerId === pid)) {
      setNotification(`Player ${pid} is already in the list.`);
      return;
    }

    const newProfile: PlayerProfile = {
      playerId: pid,
      username: pid,
      level: 1,
      experience: 0,
      gold: 0,
      gems: 0,
      lastLogin: new Date().toLocaleString(),
      isBanned: false,
      presence: 'Offline',
      presenceDetails: 'Manual Entry',
      lastSeen: 'Offline',
    };

    setPlayers((prev) => [newProfile, ...prev]);
    setNotification(`Loaded Player ${pid} into management session.`);
    setNewPlayerIdInput('');
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

  const toggleBanPlayer = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.playerId === playerId) {
          const updatedState = !p.isBanned;
          setNotification(`Hero ${p.username} status set to: ${updatedState ? 'BANNED' : 'ACTIVE'}`);
          return { ...p, isBanned: updatedState };
        }
        return p;
      })
    );
  };

  const handleSaveAdjustment = () => {
    if (!selectedPlayer) return;
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.playerId === selectedPlayer.playerId) {
          return {
            ...p,
            gems: (p.gems || 0) + adjustGems,
            gold: (p.gold || 0) + adjustGold,
          };
        }
        return p;
      })
    );
    setNotification(`Adjusted currencies for ${selectedPlayer.username} (+${adjustGems} Gems, +${adjustGold} Gold).`);
    setSelectedPlayer(null);
    setAdjustGems(0);
    setAdjustGold(0);
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Header Banner */}
      <div className="mahogany-banner p-5 text-center rounded-lg relative">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          HEROES & REALM PLAYERS
        </h1>
        <p className="text-xs text-[#d5c7b3] font-serif mt-1">
          Inspect player inventories, grant resources & moderate realm accounts
        </p>
        <button
          onClick={() => fetchPlayers()}
          className="absolute right-4 top-4 px-3.5 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> REFRESH PLAYERS
        </button>
      </div>

      {/* Role Access Notice */}
      {role === 'Support' && (
        <div className="p-3.5 rounded bg-[#064e3b]/30 border border-[#10b981]/50 text-[#86efac] text-xs font-serif flex items-center gap-2.5 shadow-sm">
          <Info className="w-4 h-4 text-[#34d399] shrink-0" />
          <span>
            <strong>Customer Support Herald Mode:</strong> Read-only player lookup enabled. Treasury adjustments and account bans are restricted to Realm Moderators and High Counsel Administrators.
          </span>
        </div>
      )}
      {role === 'Moderator' && (
        <div className="p-3.5 rounded bg-[#0c4a6e]/30 border border-[#0284c7]/50 text-[#7dd3fc] text-xs font-serif flex items-center gap-2.5 shadow-sm">
          <Info className="w-4 h-4 text-[#38bdf8] shrink-0" />
          <span>
            <strong>Realm Moderator Mode:</strong> Disciplinary actions (Account Ban / Unban) enabled. Direct treasury currency adjustments are restricted to High Counsel Administrators.
          </span>
        </div>
      )}

      {notification && (
        <div className="p-4 rounded bg-[#14532d]/40 border border-[#22c55e] text-[#86efac] text-xs font-bold font-serif flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-mono underline hover:text-white">
            DISMISS
          </button>
        </div>
      )}

      {/* Search & Add Player Controls */}
      <div className="parchment-card p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-96 bg-[#f4ecd8] border border-[#c89b3c] rounded px-3.5 py-2 text-sm text-[#3a2518]">
          <Search className="w-4 h-4 text-[#c89b3c] shrink-0" />
          <input
            type="text"
            placeholder="Search by Player ID or Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-[#3a2518] placeholder-[#78644e] text-sm font-sans"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <input
            type="text"
            placeholder="Enter Player ID from DB (e.g. Google Player ID)"
            value={newPlayerIdInput}
            onChange={(e) => setNewPlayerIdInput(e.target.value)}
            className="bg-[#f4ecd8] border border-[#c89b3c] rounded px-3.5 py-2 text-sm text-[#3a2518] outline-none font-sans flex-1 md:w-80"
          />
          <button
            onClick={handleAddPlayerById}
            className="px-3.5 py-2 rounded crimson-badge text-xs font-bold font-cinzel flex items-center gap-1.5 shrink-0 tracking-wide"
          >
            <UserPlus className="w-3.5 h-3.5" /> LOAD PLAYER ID
          </button>
        </div>
      </div>

      {/* Presence Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setPresenceFilter('ALL')}
            className={`px-3 py-1.5 rounded text-xs font-cinzel font-bold transition-all ${
              presenceFilter === 'ALL'
                ? 'bg-[#c89b3c] text-[#26170d] shadow font-black'
                : 'bg-[#26170d] text-[#d5c7b3] hover:text-[#ffe082] border border-[#523725]'
            }`}
          >
            ALL PLAYERS ({players.length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('ONLINE')}
            className={`px-3 py-1.5 rounded text-xs font-cinzel font-bold transition-all flex items-center gap-1.5 ${
              presenceFilter === 'ONLINE'
                ? 'bg-[#10b981] text-[#064e3b] shadow font-black'
                : 'bg-[#26170d] text-[#86efac] hover:text-white border border-[#10b981]/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
            ONLINE ({players.filter((p) => p.presence === 'Online').length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('BATTLE')}
            className={`px-3 py-1.5 rounded text-xs font-cinzel font-bold transition-all flex items-center gap-1.5 ${
              presenceFilter === 'BATTLE'
                ? 'bg-[#f59e0b] text-[#451a03] shadow font-black'
                : 'bg-[#26170d] text-[#fcd34d] hover:text-white border border-[#f59e0b]/40'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-[#f59e0b]" />
            IN BATTLE ({players.filter((p) => p.presence === 'InBattle').length})
          </button>
          <button
            type="button"
            onClick={() => setPresenceFilter('OFFLINE')}
            className={`px-3 py-1.5 rounded text-xs font-cinzel font-bold transition-all ${
              presenceFilter === 'OFFLINE'
                ? 'bg-[#78644e] text-white shadow font-black'
                : 'bg-[#26170d] text-[#a89984] hover:text-white border border-[#523725]'
            }`}
          >
            OFFLINE ({players.filter((p) => p.presence === 'Offline').length})
          </button>
        </div>
        <span className="text-xs font-serif text-[#78644e]">
          Showing {filteredPlayers.length} of {players.length} Heroes
        </span>
      </div>

      {/* Table */}
      <div className="parchment-card rounded-lg overflow-hidden shadow-md">
        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
            <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
            <p className="text-sm font-bold font-cinzel">No player accounts match current search & presence filters.</p>
            <p className="text-xs text-[#78644e] font-sans">Type a Player ID into "LOAD PLAYER ID" to query details.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold text-xs border-b border-[#c89b3c] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Player Account</th>
                <th className="py-3.5 px-5">Level & EXP</th>
                <th className="py-3.5 px-5">Currencies</th>
                <th className="py-3.5 px-5">Live Presence</th>
                <th className="py-3.5 px-5">Standing</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
              {filteredPlayers.map((player) => (
                <tr key={player.playerId} className="hover:bg-[#efe5cd] transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-[#3a2518] border-2 border-[#c89b3c] flex items-center justify-center text-[#ffe082] font-bold text-sm font-cinzel shrink-0 shadow">
                          {player.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b1b11] ${
                            player.presence === 'InBattle'
                              ? 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]'
                              : player.presence === 'Online'
                              ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]'
                              : 'bg-[#78644e]'
                          }`}
                          title={player.presence || 'Offline'}
                        />
                      </div>
                      <div>
                        <span className="font-bold font-cinzel text-[#3a2518] text-sm block">
                          {player.username}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-mono text-[#78644e]">
                            Ref: #{player.playerId.slice(-6).toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(player.playerId);
                              setNotification(`Copied Player ID for ${player.username} to clipboard`);
                            }}
                            className="text-[#c89b3c] hover:text-[#b45309] transition-colors p-0.5"
                            title={`Copy full ID: ${player.playerId}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className="font-bold text-[#3a2518]">Lvl {player.level}</span>
                    <span className="text-[#78644e] text-xs block">{player.experience} EXP</span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3 font-mono font-bold">
                      <span className="flex items-center gap-1 text-[#b45309]">
                        <Coins className="w-3.5 h-3.5 text-[#d97706]" /> {player.gold?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-[#0284c7]">
                        <Gem className="w-3.5 h-3.5 text-[#0369a1]" /> {player.gems?.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  {/* Live Presence */}
                  <td className="py-4 px-5">
                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold font-cinzel inline-flex items-center gap-1.5 border shadow-sm ${
                          player.presence === 'InBattle'
                            ? 'bg-[#78350f]/40 border-[#f59e0b]/60 text-[#fcd34d]'
                            : player.presence === 'Online'
                            ? 'bg-[#064e3b]/40 border-[#10b981]/60 text-[#86efac]'
                            : 'bg-[#2b1b11]/30 border-[#523725]/50 text-[#a89984]'
                        }`}
                      >
                        {player.presence === 'InBattle' && <Swords className="w-3 h-3 text-[#f59e0b]" />}
                        {player.presence === 'Online' && (
                          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                        )}
                        {player.presence === 'Offline' && <span className="w-2 h-2 rounded-full bg-[#78644e]" />}
                        {player.presence === 'InBattle' ? 'IN BATTLE' : player.presence === 'Online' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <span className="text-xs text-[#78644e] block font-serif mt-1">
                        {player.lastSeen || player.presenceDetails || player.lastLogin}
                      </span>
                    </div>
                  </td>
                  {/* Account Standing */}
                  <td className="py-4 px-5">
                    {player.isBanned ? (
                      <span className="px-2.5 py-0.5 rounded crimson-badge text-xs font-bold inline-flex items-center gap-1">
                        <UserX className="w-3 h-3" /> BANNED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] border border-[#22c55e] text-xs font-bold inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> NORMAL
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right space-x-2">
                    {role === 'Support' ? (
                      <span className="text-xs font-mono text-[#8c7456] italic px-2.5 py-1 rounded bg-[#2b1b11] border border-[#4d3525] inline-block">
                        Read-Only
                      </span>
                    ) : (
                      <>
                        {(role === 'Admin' || role === 'Server') && (
                          <button
                            onClick={() => setSelectedPlayer(player)}
                            className="p-1.5 rounded mahogany-button"
                            title="Adjust Currencies"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#c89b3c]" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleBanPlayer(player.playerId)}
                          className={`px-3 py-1 rounded text-xs font-bold font-cinzel ${
                            player.isBanned ? 'bg-[#166534] text-[#86efac]' : 'crimson-badge'
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

      {/* Adjust Currency Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="mahogany-banner p-6 rounded-lg border-2 border-[#c89b3c] w-full max-w-md space-y-4 font-serif text-xs">
            <h3 className="text-lg font-bold font-cinzel text-[#ffe082] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#c89b3c]" />
              ADJUST TREASURY - {selectedPlayer.username}
            </h3>
            <p className="text-xs text-[#c4b49e]">
              Wanderer Account: <strong className="text-[#ffe082]">{selectedPlayer.username}</strong>
              <span className="font-mono text-[#c89b3c] ml-1.5">(Ref #{selectedPlayer.playerId.slice(-6).toUpperCase()})</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Add/Deduct Gems (+/-)</label>
                <input
                  type="number"
                  value={adjustGems}
                  onChange={(e) => setAdjustGems(Number(e.target.value))}
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Add/Deduct Gold (+/-)</label>
                <input
                  type="number"
                  value={adjustGold}
                  onChange={(e) => setAdjustGold(Number(e.target.value))}
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#593d29]">
              <button onClick={() => setSelectedPlayer(null)} className="px-3 py-1.5 text-xs text-[#c4b49e]">
                Cancel
              </button>
              <button onClick={handleSaveAdjustment} className="px-4 py-1.5 rounded crimson-badge text-xs font-bold font-cinzel">
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
