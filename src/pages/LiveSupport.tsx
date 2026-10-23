import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveChatPlayerDto, SupportMessageDto } from '../types';
import { adminClient } from '../api/adminClient';
import {
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  Clock,
  RefreshCw,
  Inbox,
  Copy,
  Swords
} from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { getPlayerPresence } from '../utils/presence';

/**
 * Player Support Desk & Live Chat Room (Screen 45 & 46)
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * - Two-way real-time WebSocket messaging with players via Microsoft SignalR (/hubs/support)
 * - Modern Discord / Intercom style dark gaming live support hub
 * - Quick inspection deep-link to /matches for combat-related tickets
 * - Presence detection and message timestamps
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
      {/* Astral Header Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div 
          className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/[0.06] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">
                SCREEN 45 & 46 • LIVE SUPPORT DESK
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">SignalR Real-Time WebSocket</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel uppercase gold-gradient-text">
              PLAYER SUPPORT DESK & LIVE DISPATCH
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authoritative player care, bug triage, and real-time bidirectional support messaging.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchPlayers()}
              disabled={loading}
              className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shadow transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC QUEUE</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/[0.1] text-xs font-mono">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <span className="text-slate-300 text-[11px] font-semibold">{isConnected ? 'SIGNALR LIVE' : 'HUB READY'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Support Chat Station (Screen 45 & 46) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[640px]">
        {/* Player Inquiry List (Left Column) */}
        <div className="glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 uppercase font-cinzel font-bold">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>ACTIVE INQUIRIES ({players.length})</span>
            </div>
            <button
              type="button"
              onClick={() => fetchPlayers()}
              className="text-slate-400 hover:text-amber-300 p-1 transition-colors"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 space-y-2">
              <Inbox className="w-8 h-8 text-amber-400/60" />
              <p className="text-sm font-bold font-cinzel text-slate-200">No active missives recorded.</p>
              <p className="text-xs text-slate-500">Waiting for player support inquiries.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
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
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-l-4 border-l-amber-400 shadow'
                        : 'hover:bg-white/[0.03] border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/[0.1] flex items-center justify-center text-amber-400 font-cinzel font-bold text-xs shrink-0 shadow">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080a0f] ${presence.dotColor}`}
                            title={presence.label}
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-slate-100 block leading-tight">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ID: #{p.playerId.slice(-4).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {p.lastMessageAt || 'Recent'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 italic mt-1">
                      &quot;{p.latestMessageText || 'No message snippet'}&quot;
                    </p>
                    {presence.state === 'InBattle' && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400 font-semibold font-mono">
                        <Swords className="w-3 h-3 animate-bounce" />
                        <span>In Combat Session</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Chat Window (Right 2 Columns) */}
        <div className="md:col-span-2 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {selectedPlayerId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/[0.1] flex items-center justify-center text-amber-400 font-cinzel font-bold text-sm shadow">
                      {activePlayerRealName.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080a0f] ${
                        getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime).dotColor
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 leading-tight">
                      {activePlayerRealName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        GUID: {selectedPlayerId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPlayerId);
                        }}
                        className="text-amber-400 hover:text-amber-300 p-0.5"
                        title="Copy ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {activeMatchesMap.has(selectedPlayerId) && (
                    <Link
                      to={`/matches?matchId=${activeMatchesMap.get(selectedPlayerId)?.matchId || ''}`}
                      className="px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
                      title="Inspect Live Battle in Match Supervision"
                    >
                      <Swords className="w-3.5 h-3.5 text-amber-400" />
                      <span>INSPECT BATTLE</span>
                    </Link>
                  )}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/[0.1] text-amber-300 font-mono font-semibold">
                    {getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime).label}
                  </span>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-[#05070c]">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <MessageSquare className="w-8 h-8 text-amber-400/60" />
                    <p className="text-sm font-semibold text-slate-300">No previous messages exchanged.</p>
                    <p className="text-xs text-slate-500">Begin the player consultation by typing a message below.</p>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const isAdmin = m.sender === 'admin' || m.sender === 'Admin' || m.senderName === 'System Admin' || m.senderName === 'Support';
                    const stableKey = m.id || `${m.sender}-${m.createdAt || ''}-${index}`;
                    return (
                      <div key={stableKey} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl p-4 shadow-lg ${
                            isAdmin
                              ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-100'
                              : 'bg-slate-900/90 border border-white/[0.08] text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1.5 text-[10px] opacity-75 border-b border-white/[0.08] pb-1 font-mono">
                            <span className="font-bold flex items-center gap-1">
                              {isAdmin ? <ShieldCheck className="w-3 h-3 text-amber-400" /> : <User className="w-3 h-3 text-slate-400" />}
                              {isAdmin ? 'HIGH COUNSEL SUPPORT' : (m.senderName || activePlayerRealName)}
                            </span>
                            <span>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">
                            {m.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input Bar */}
              <div className="p-3.5 bg-slate-950/80 border-t border-white/[0.08] flex items-center gap-2.5">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Compose support dispatch to ${activePlayerRealName}...`}
                  className="flex-1 bg-slate-900/90 border border-white/[0.1] focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!replyText.trim()}
                  className="btn-primary-gold px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <MessageSquare className="w-12 h-12 text-amber-400/60" />
              <p className="text-base font-bold font-cinzel text-slate-200">No Traveler Selected</p>
              <p className="text-xs text-slate-500">Select an inquiry from the roster on the left to read and respond.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
