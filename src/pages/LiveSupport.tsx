import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveChatPlayerDto, SupportMessageDto } from '../types';
import { adminClient } from '../api/adminClient';
import {
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  Circle,
  Clock,
  RefreshCw,
  Inbox,
  Copy,
  Swords,
} from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { getPlayerPresence } from '../utils/presence';

/**
 * Player Support Desk & Live Chat Room (Screen 45 & 46)
 * 
 * Features:
 * 1. Two-way WebSocket messaging with players via Microsoft SignalR (/hubs/support).
 * 2. Active hero tickets list (/api/Support/admin/players).
 * 3. Historical message retrieval (/api/Support/admin/chat/{playerId}).
 * 4. Dispatch administrative replies directly into the game client.
 */
export const LiveSupport: React.FC = () => {
  // Support Chat states
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

  const fetchPlayers = useCallback(async () => {
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
        if (mapped.length > 0 && !selectedPlayerId) {
          setSelectedPlayerId(mapped[0].playerId);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [selectedPlayerId]);

  const fetchMessagesForPlayer = useCallback(async (playerId: string) => {
    if (!playerId) return;
    try {
      const res = await adminClient.get(`/support/admin/chat/${playerId}`);
      if (Array.isArray(res.data)) {
        setMessages(res.data);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (selectedPlayerId) {
      fetchMessagesForPlayer(selectedPlayerId);
    }
  }, [selectedPlayerId, fetchMessagesForPlayer]);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/support', {
        accessTokenFactory: () => sessionStorage.getItem('adminToken') || '',
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
  }, [selectedPlayerId, fetchPlayers]);

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
      <div className="mahogany-banner p-5 text-center rounded-lg relative shadow-md">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          PLAYER SUPPORT DESK & LIVE CHAT
        </h1>
        <p className="text-xs text-[#d5c7b3] font-serif mt-1">
          Screen 45 & 46 (SRS Part B) • Real-time Bidirectional Player Assistance via SignalR WebSockets
        </p>

        <div className="absolute right-4 top-4 hidden sm:flex items-center gap-3">
          <button
            onClick={() => fetchPlayers()}
            className="px-3 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> REFRESH
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#26170d] border border-[#c89b3c] text-xs font-cinzel font-bold text-[#ffe082]">
            <Circle className={`w-2.5 h-2.5 rounded-full fill-current ${isConnected ? 'text-[#34d399] animate-pulse' : 'text-[#f59e0b]'}`} />
            <span>{isConnected ? 'SIGNALR ACTIVE' : 'HUB READY'}</span>
          </div>
        </div>
      </div>

      {/* Main Support Chat Station (Screen 45 & 46) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
          {/* Player List */}
          <div className="parchment-card rounded-lg flex flex-col overflow-hidden shadow-md">
            <div className="p-3.5 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] font-cinzel font-bold text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#c89b3c]" />
                ACTIVE INQUIRIES ({players.length})
              </div>
              <button
                type="button"
                onClick={() => fetchPlayers()}
                className="text-[#c89b3c] hover:text-[#ffe082] p-1"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {players.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8c7456] p-6 space-y-2 font-serif">
                <Inbox className="w-8 h-8 text-[#c89b3c]" />
                <p className="text-sm font-bold font-cinzel">No active missives recorded.</p>
                <p className="text-xs text-[#78644e]">Waiting for player support inquiries.</p>
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
                            <div className="w-8 h-8 rounded-full bg-[#3a2518] border border-[#c89b3c] flex items-center justify-center text-[#ffe082] font-cinzel font-bold text-xs shrink-0 shadow">
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#2b1b11] ${presence.dotColor}`}
                              title={presence.label}
                            />
                          </div>
                          <div>
                            <span className="font-bold font-cinzel text-xs text-[#3a2518] block leading-tight">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-[#78644e] font-mono">
                              ID: #{p.playerId.slice(-4).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#78644e] flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#c89b3c]" />
                          {p.lastMessageAt || 'Recent'}
                        </span>
                      </div>
                      <p className="text-xs text-[#523e2b] line-clamp-1 italic font-serif mt-1">
                        "{p.latestMessageText || 'No message snippet'}"
                      </p>
                      {presence.state === 'InBattle' && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-[#d97706] font-bold">
                          <Swords className="w-3 h-3 animate-bounce" />
                          <span>Combat in progress</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat Window */}
          <div className="md:col-span-2 parchment-card rounded-lg flex flex-col overflow-hidden shadow-md">
            {selectedPlayerId ? (
              <>
                {/* Chat Header */}
                <div className="p-3.5 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-[#2b1b11] border border-[#c89b3c] flex items-center justify-center text-[#ffe082] font-cinzel font-bold text-sm shadow">
                        {activePlayerRealName.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#2b1b11] ${
                          getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime).dotColor
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold font-cinzel text-sm text-[#ffe082] leading-tight">
                        {activePlayerRealName}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-[#d4c5b0]">
                          GUID: {selectedPlayerId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedPlayerId);
                            alert('Copied Player ID to clipboard.');
                          }}
                          className="text-[#c89b3c] hover:text-[#ffe082]"
                          title="Copy ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeMatchesMap.has(selectedPlayerId) && (
                      <Link
                        to={`/matches?matchId=${activeMatchesMap.get(selectedPlayerId)?.matchId || ''}`}
                        className="px-2.5 py-1 rounded bg-[#b45309]/30 hover:bg-[#b45309]/50 border border-[#d97706] text-[#fcd34d] text-[11px] font-cinzel font-bold flex items-center gap-1.5 transition-all shadow"
                        title="Inspect Live Battle in Match Supervision"
                      >
                        <Swords className="w-3.5 h-3.5 text-[#fbbf24]" />
                        <span>INSPECT BATTLE</span>
                      </Link>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded bg-[#2b1b11] border border-[#c89b3c] text-[#ffe082] font-cinzel font-bold">
                      {getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime).label}
                    </span>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fdfbf7]/80">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#8c7456] space-y-2 font-serif">
                      <MessageSquare className="w-8 h-8 text-[#c89b3c]" />
                      <p className="text-sm font-bold font-cinzel">No previous dispatches exchanged.</p>
                      <p className="text-xs text-[#78644e]">Begin the counsel by sending a formal response below.</p>
                    </div>
                  ) : (
                    messages.map((m, index) => {
                      const isAdmin = m.sender === 'admin' || m.sender === 'Admin' || m.senderName === 'System Admin' || m.senderName === 'Support';
                      const stableKey = m.id || `${m.sender}-${m.createdAt || ''}-${index}`;
                      return (
                        <div key={stableKey} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-lg p-3 shadow-md ${
                              isAdmin
                                ? 'bg-[#3a2518] text-[#f7f1e1] border border-[#c89b3c]'
                                : 'bg-[#e8dcbf] text-[#2b1b11] border border-[#bfa37c]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-80 border-b border-current/20 pb-1">
                              <span className="font-bold font-cinzel flex items-center gap-1">
                                {isAdmin ? <ShieldCheck className="w-3 h-3 text-[#f59e0b]" /> : <User className="w-3 h-3 text-[#3a2518]" />}
                                {isAdmin ? 'HIGH COUNSEL OPERATOR' : (m.senderName || activePlayerRealName)}
                              </span>
                              <span className="font-mono">
                                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-xs font-serif whitespace-pre-wrap leading-relaxed mt-1">
                              {m.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Input */}
                <div className="p-3 bg-[#eedebc] border-t-2 border-[#c89b3c] flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={`Compose counsel response to ${activePlayerRealName}...`}
                    className="flex-1 bg-[#fdfbf7] border border-[#bfa37c] focus:border-[#c89b3c] rounded px-3 py-2 text-xs text-[#2b1b11] outline-none shadow-inner"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!replyText.trim()}
                    className="px-4 py-2 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5 text-[#c89b3c]" />
                    <span>SEND</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8c7456] space-y-2 font-serif">
                <MessageSquare className="w-12 h-12 text-[#c89b3c]" />
                <p className="text-base font-bold font-cinzel text-[#3a2518]">No Traveler Selected</p>
                <p className="text-xs text-[#78644e]">Select an inquiry from the roster on the left to read and respond.</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};
