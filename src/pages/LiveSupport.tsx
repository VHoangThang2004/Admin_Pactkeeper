import React, { useState, useEffect } from 'react';
import type { ActiveChatPlayerDto, SupportMessageDto } from '../types';
import { adminClient } from '../api/adminClient';
import { MessageSquare, Send, User, ShieldCheck, Circle, Clock, RefreshCw, Inbox, Copy, Swords } from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { getPlayerPresence } from '../utils/presence';

/**
 * Live Support & Real-Time Player Communications (Customer Support Portal)
 * 
 * Features:
 * 1. Two-way WebSocket messaging with players via Microsoft SignalR (/hubs/support).
 * 2. Active hero tickets list (/api/Support/admin/players).
 * 3. Historical message retrieval (/api/Support/admin/chat/{playerId}).
 * 4. Dispatch administrative replies directly into the game client.
 */
export const LiveSupport: React.FC = () => {
  const [players, setPlayers] = useState<ActiveChatPlayerDto[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeMatchesMap, setActiveMatchesMap] = useState<Map<string, { matchId: string; mode?: string }>>(new Map());

  const activePlayer = players.find((p) => p.playerId === selectedPlayerId);
  const activePlayerRealName =
    (activePlayer?.playerName || activePlayer?.username || '').trim() ||
    messages.find((m) => m.sender !== 'admin' && m.sender !== 'Admin' && m.senderName && m.senderName.trim())?.senderName?.trim() ||
    (selectedPlayerId ? `Traveler #${selectedPlayerId.slice(-4).toUpperCase()}` : 'Traveler');

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const [supportRes, matchRes] = await Promise.allSettled([
        adminClient.get('/support/admin/players'),
        adminClient.get('/Match/history'),
      ]);

      const matchMap = new Map<string, { matchId: string; mode?: string }>();
      if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
        matchRes.value.data.forEach((m: any) => {
          const s = (m.status || '').toLowerCase();
          const isLive = s === 'inprogress' || s === 'active' || s === 'playing' || s === 'running' || m.status === 1;
          if (isLive) {
            const mId = m.matchId || m.id || '';
            if (m.player1Id) matchMap.set(m.player1Id, { matchId: mId, mode: m.mode });
            if (m.player2Id) matchMap.set(m.player2Id, { matchId: mId, mode: m.mode });
          }
        });
      }
      setActiveMatchesMap(matchMap);

      if (supportRes.status === 'fulfilled' && Array.isArray(supportRes.value.data)) {
        const mapped: ActiveChatPlayerDto[] = supportRes.value.data.map((p: any) => {
          const resolvedName = (p.playerName || p.username || '').trim();
          const messageSnippet = p.latestMessageText || p.lastMessage || '';
          const timeSnippet = p.latestMessageTime
            ? new Date(p.latestMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : (p.lastMessageAt || '');
          return {
            playerId: p.playerId,
            playerName: resolvedName,
            username: resolvedName,
            latestMessageText: messageSnippet,
            lastMessage: messageSnippet,
            latestMessageTime: p.latestMessageTime || '',
            lastMessageAt: timeSnippet,
          };
        });
        setPlayers(mapped);
        if (!selectedPlayerId && mapped.length > 0) {
          setSelectedPlayerId(mapped[0].playerId);
        }
      } else {
        setPlayers([]);
      }
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForPlayer = async (playerId: string) => {
    if (!playerId) return;
    try {
      const res = await adminClient.get(`/support/admin/chat/${playerId}`);
      if (Array.isArray(res.data)) {
        setMessages(res.data);
        // Extract real player name if available from non-admin message history
        const playerMsg = res.data.find(
          (m: any) => m.sender !== 'admin' && m.sender !== 'Admin' && m.senderName && m.senderName.trim()
        );
        if (playerMsg) {
          const realName = playerMsg.senderName.trim();
          setPlayers((prev) =>
            prev.map((p) =>
              p.playerId === playerId && (!p.username || p.username.startsWith('Traveler'))
                ? { ...p, username: realName, playerName: realName }
                : p
            )
          );
        }
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      fetchMessagesForPlayer(selectedPlayerId);
    }
  }, [selectedPlayerId]);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/support', {
        accessTokenFactory: () => localStorage.getItem('adminToken') || '',
      })
      .withAutomaticReconnect()
      .build();

    connection
      .start()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));

    connection.on('ReceiveMessage', (senderPlayerId: string, messageData: SupportMessageDto) => {
      if (senderPlayerId === selectedPlayerId) {
        setMessages((prev) => [...prev, messageData]);
      }
      fetchPlayers();
    });

    return () => {
      connection.stop();
    };
  }, [selectedPlayerId]);

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedPlayerId) return;
    const textToSend = replyText;
    setReplyText('');

    try {
      const res = await adminClient.post(`/support/admin/chat/${selectedPlayerId}`, { text: textToSend });
      if (res.data) {
        setMessages((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send reply to player.');
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Header Banner */}
      <div className="mahogany-banner p-5 text-center rounded-lg relative">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          COUNSEL BOARD & LIVE MISSIVES
        </h1>
        <p className="text-xs text-[#d5c7b3] font-serif mt-1">Real-time Hero Support Tickets & SignalR Communication</p>
        <div className="absolute right-4 top-4 flex items-center gap-3">
          <button
            onClick={() => fetchPlayers()}
            className="px-3.5 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> REFRESH
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#26170d] border border-[#c89b3c] text-xs font-cinzel font-bold text-[#ffe082]">
            <Circle className={`w-2.5 h-2.5 rounded-full fill-current ${isConnected ? 'text-[#34d399] animate-pulse' : 'text-[#f59e0b]'}`} />
            <span>{isConnected ? 'SIGNALR ACTIVE' : 'HUB READY'}</span>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
        {/* Player List */}
        <div className="parchment-card rounded-lg flex flex-col overflow-hidden shadow-md">
          <div className="p-3.5 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] font-cinzel font-bold text-xs flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#c89b3c]" />
            ACTIVE COUNSEL INQUIRIES ({players.length})
          </div>
          {players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#8c7456] p-6 space-y-2 font-serif">
              <Inbox className="w-8 h-8 text-[#c89b3c]" />
              <p className="text-sm font-bold font-cinzel">No active missives recorded.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[#dcd1b5]">
              {players.map((p) => {
                const isSelected = selectedPlayerId === p.playerId;
                const pName = (p.playerName || p.username || '').trim();
                const displayName = pName
                  ? pName
                  : (isSelected && activePlayerRealName && !activePlayerRealName.startsWith('Traveler')
                      ? activePlayerRealName
                      : `Traveler #${p.playerId.slice(-4).toUpperCase()}`);
                const presence = getPlayerPresence(p.playerId, activeMatchesMap, p.latestMessageTime || p.lastMessageAt);

                return (
                  <div
                    key={p.playerId}
                    onClick={() => setSelectedPlayerId(p.playerId)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      selectedPlayerId === p.playerId ? 'bg-[#efe5cd] border-l-4 border-[#c89b3c]' : 'hover:bg-[#f4ecd8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-[#3a2518] border border-[#c89b3c] flex items-center justify-center text-[#ffe082] font-bold text-xs font-cinzel shrink-0 shadow-inner">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#2b1b11] ${presence.dotColor}`}
                            title={presence.label}
                          />
                        </div>
                        <div>
                          <span className="font-bold text-[#3a2518] text-sm font-cinzel block leading-tight">{displayName}</span>
                          <span className={`text-[10px] font-cinzel font-bold ${presence.badgeText}`}>
                            {presence.label}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-[#78644e] font-mono">{p.lastMessageAt || ''}</span>
                    </div>
                    <p className="text-xs text-[#523e2b] font-sans truncate pl-9">{p.lastMessage || 'No recent messages'}</p>
                    <div className="flex items-center gap-1.5 pl-9 mt-1">
                      <span className="text-xs font-mono text-[#8c7456]">Ref: #{p.playerId.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Thread */}
        <div className="md:col-span-2 parchment-card rounded-lg flex flex-col overflow-hidden">
          {selectedPlayerId ? (
            <>
              <div className="p-3.5 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-cinzel">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold">
                      COUNSEL THREAD: <span className="text-[#ffe082]">{activePlayerRealName}</span>
                    </h4>
                    {/* Live Presence Badge */}
                    {(() => {
                      const selPresence = getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime || activePlayer?.lastMessageAt);
                      return (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${selPresence.badgeBg} ${selPresence.badgeBorder} ${selPresence.badgeText}`}>
                          {selPresence.state === 'InBattle' && <Swords className="w-3 h-3 text-[#f59e0b]" />}
                          {selPresence.state === 'Online' && <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />}
                          {selPresence.state === 'Offline' && <span className="w-2 h-2 rounded-full bg-[#78644e]" />}
                          {selPresence.label} • {selPresence.activityDescription}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#c4b49e] font-sans">
                      Player: <strong className="text-[#ffe082]">{activePlayerRealName}</strong>
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#21140c] text-[#ffe082] border border-[#523725]">
                      Ref #{selectedPlayerId.slice(-6).toUpperCase()}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedPlayerId)}
                      title={`Copy full ID: ${selectedPlayerId}`}
                      className="text-[#c89b3c] hover:text-[#ffe082] transition-colors p-0.5"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-[#c4b49e] flex items-center gap-1 font-serif">
                  <Clock className="w-3.5 h-3.5 text-[#c89b3c]" /> LIVE THREAD
                </span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f4ecd8]/60 font-serif">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#8c7456] text-xs font-cinzel">
                    No missive exchange history recorded yet.
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isAdmin = msg.sender === 'admin' || msg.sender === 'Admin';
                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-xs text-[#78644e]">
                          {isAdmin ? (
                            <>
                              <span className="font-bold text-[#b45309] font-cinzel">{msg.senderName || 'Keeper of Records'}</span>
                              <ShieldCheck className="w-3 h-3 text-[#b45309]" />
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-[#3a2518]" />
                              <span className="font-bold text-[#3a2518] font-cinzel">{msg.senderName || 'Wanderer'}</span>
                            </>
                          )}
                          <span>• {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`max-w-md p-3 rounded-lg text-xs leading-relaxed ${
                            isAdmin
                              ? 'bg-[#3a2518] text-[#ffe082] border border-[#c89b3c] shadow'
                              : 'bg-[#e8dcbf] text-[#2b1b11] border border-[#c89b3c]/60'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3.5 bg-[#3a2518] border-t-2 border-[#c89b3c] flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Dispatch missive reply to Hero..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-[#26170d] border border-[#c89b3c] rounded px-4 py-2 text-xs text-[#f7f1e1] placeholder-[#a38f78] outline-none font-serif"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 rounded crimson-badge text-xs font-bold font-cinzel flex items-center gap-2 shadow"
                >
                  <Send className="w-3.5 h-3.5" /> SEND MISSIVE
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#8c7456] text-xs font-cinzel">
              Select a Hero missive ticket from the list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
