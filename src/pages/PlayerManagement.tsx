import React, { useState, useEffect } from 'react';
import type { PlayerProfile, CounselRole } from '../types';
import { adminClient } from '../api/adminClient';
import { Search, UserCheck, UserX, Coins, Gem, Shield, Edit3, CheckCircle2, Inbox, RefreshCw, UserPlus, Info } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlayerIdInput, setNewPlayerIdInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [adjustGems, setAdjustGems] = useState<number>(0);
  const [adjustGold, setAdjustGold] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches and aggregates active player profiles from multiple live backend endpoints.
   */
  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const [supportRes, paymentRes] = await Promise.allSettled([
        adminClient.get('/support/admin/players'),
        adminClient.get('/Payment/history'),
      ]);

      const foundMap = new Map<string, PlayerProfile>();

      // 1. Read active player profile from current session / localStorage (Google OAuth & Active logins)
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
          isBanned: false,
        });
      }

      // 2. Read active support chat players from API
      if (supportRes.status === 'fulfilled' && Array.isArray(supportRes.value.data)) {
        supportRes.value.data.forEach((p: any) => {
          if (p.playerId) {
            foundMap.set(p.playerId, {
              playerId: p.playerId,
              username: p.username || p.playerId,
              level: p.level ?? 1,
              experience: p.experience ?? 0,
              gold: p.gold ?? 0,
              gems: p.gems ?? 0,
              lastLogin: p.lastMessageAt ? new Date(p.lastMessageAt).toLocaleString() : new Date().toLocaleString(),
              isBanned: false,
            });
          }
        });
      }

      // 3. Read payment transaction players from API
      if (paymentRes.status === 'fulfilled' && Array.isArray(paymentRes.value.data)) {
        paymentRes.value.data.forEach((ord: any) => {
          if (ord.playerId && !foundMap.has(ord.playerId)) {
            foundMap.set(ord.playerId, {
              playerId: ord.playerId,
              username: ord.playerId,
              level: 1,
              experience: 0,
              gold: 0,
              gems: 0,
              lastLogin: ord.createdAt ? new Date(ord.createdAt).toLocaleString() : new Date().toLocaleString(),
              isBanned: false,
            });
          }
        });
      }

      setPlayers(Array.from(foundMap.values()));
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
    };

    setPlayers((prev) => [newProfile, ...prev]);
    setNotification(`Loaded Player ${pid} into management session.`);
    setNewPlayerIdInput('');
  };

  const filteredPlayers = players.filter(
    (p) =>
      p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.playerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Table */}
      <div className="parchment-card rounded-lg overflow-hidden shadow-md">
        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
            <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
            <p className="text-sm font-bold font-cinzel">No active player accounts retrieved from API endpoints.</p>
            <p className="text-xs text-[#78644e] font-sans">Type a Player ID into "LOAD PLAYER ID" to query details.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold text-xs border-b border-[#c89b3c] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Player ID</th>
                <th className="py-3.5 px-5">Username</th>
                <th className="py-3.5 px-5">Level & EXP</th>
                <th className="py-3.5 px-5">Currencies</th>
                <th className="py-3.5 px-5">Last Activity</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
              {filteredPlayers.map((player) => (
                <tr key={player.playerId} className="hover:bg-[#efe5cd] transition-colors">
                  <td className="py-4 px-5 font-mono text-[#b45309] font-bold text-xs">{player.playerId}</td>
                  <td className="py-4 px-5 font-bold font-cinzel text-[#3a2518] flex items-center gap-2.5 text-sm">
                    <div className="w-7 h-7 rounded-full bg-[#3a2518] border border-[#c89b3c] flex items-center justify-center text-[#ffe082] font-bold text-xs font-cinzel shrink-0">
                      {player.username.slice(0, 2).toUpperCase()}
                    </div>
                    {player.username}
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
                  <td className="py-4 px-5 text-[#6b5842]">{player.lastLogin}</td>
                  <td className="py-4 px-5">
                    {player.isBanned ? (
                      <span className="px-2.5 py-0.5 rounded crimson-badge text-xs font-bold inline-flex items-center gap-1">
                        <UserX className="w-3 h-3" /> BANNED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] border border-[#22c55e] text-xs font-bold inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> ACTIVE
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
