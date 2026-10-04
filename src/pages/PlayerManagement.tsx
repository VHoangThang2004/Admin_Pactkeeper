import React, { useState } from 'react';
import type { PlayerProfile } from '../types';
import { Search, UserCheck, UserX, Coins, Gem, Shield, Edit3, CheckCircle2 } from 'lucide-react';

const mockPlayers: PlayerProfile[] = [
  { playerId: 'PLR_1001', username: 'ArthurPendragon', level: 45, experience: 8900, gold: 154000, gems: 3200, stamina: 120, lastLogin: '2026-08-20 12:45', isBanned: false },
  { playerId: 'PLR_1002', username: 'ShadowBlade99', level: 32, experience: 4200, gold: 85000, gems: 850, stamina: 90, lastLogin: '2026-08-20 11:30', isBanned: false },
  { playerId: 'PLR_1003', username: 'CheaterProMax', level: 99, experience: 99999, gold: 9999999, gems: 999999, stamina: 999, lastLogin: '2026-08-19 18:20', isBanned: true },
  { playerId: 'PLR_1004', username: 'ElenaMage', level: 28, experience: 3100, gold: 42000, gems: 1400, stamina: 60, lastLogin: '2026-08-20 09:15', isBanned: false },
  { playerId: 'PLR_1005', username: 'ValkyrieLeader', level: 50, experience: 12500, gold: 310000, gems: 8500, stamina: 150, lastLogin: '2026-08-20 13:00', isBanned: false },
];

export const PlayerManagement: React.FC = () => {
  const [players, setPlayers] = useState<PlayerProfile[]>(mockPlayers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [adjustGems, setAdjustGems] = useState<number>(0);
  const [adjustGold, setAdjustGold] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

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
          setNotification(`Player ${p.username} status set to: ${updatedState ? 'BANNED' : 'ACTIVE'}`);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Player Moderation & Profiles</h2>
          <p className="text-sm text-slate-400">Search, inspect inventories, ban/unban accounts, and grant resources.</p>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 w-96 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-300">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Player ID or Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-200 placeholder-slate-500 text-xs"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-white font-bold">{filteredPlayers.length}</span> players
        </div>
      </div>

      {/* Players Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-5">Player ID</th>
              <th className="py-3.5 px-5">Username</th>
              <th className="py-3.5 px-5">Level & EXP</th>
              <th className="py-3.5 px-5">Currencies</th>
              <th className="py-3.5 px-5">Last Login</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredPlayers.map((player) => (
              <tr key={player.playerId} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-5 font-mono text-indigo-400 font-semibold">{player.playerId}</td>
                <td className="py-4 px-5 font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold text-[10px]">
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                  {player.username}
                </td>
                <td className="py-4 px-5">
                  <span className="font-semibold text-slate-200">Lvl {player.level}</span>
                  <span className="text-slate-500 text-[11px] block">{player.experience} EXP</span>
                </td>
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-amber-300 font-medium">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> {player.gold?.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-cyan-300 font-medium">
                      <Gem className="w-3.5 h-3.5 text-cyan-400" /> {player.gems?.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-400">{player.lastLogin}</td>
                <td className="py-4 px-5">
                  {player.isBanned ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-[10px] inline-flex items-center gap-1">
                      <UserX className="w-3 h-3" /> BANNED
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[10px] inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> ACTIVE
                    </span>
                  )}
                </td>
                <td className="py-4 px-5 text-right space-x-2">
                  <button
                    onClick={() => setSelectedPlayer(player)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Adjust Currencies"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleBanPlayer(player.playerId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      player.isBanned
                        ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white'
                        : 'bg-rose-600/80 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {player.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust Currency Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Adjust Currencies - {selectedPlayer.username}
            </h3>
            <p className="text-xs text-slate-400">Directly grant or deduct Gems and Gold for this player profile.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Add/Deduct Gems (+/-)</label>
                <input
                  type="number"
                  value={adjustGems}
                  onChange={(e) => setAdjustGems(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Add/Deduct Gold (+/-)</label>
                <input
                  type="number"
                  value={adjustGold}
                  onChange={(e) => setAdjustGold(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustment}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
              >
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
