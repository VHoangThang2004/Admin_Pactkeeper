import React, { useState, useEffect } from 'react';
import type { SupportTicket, SupportMessage } from '../types';
import { Headphones, Send, User, ShieldCheck, Circle, MessageSquare, Clock } from 'lucide-react';
import * as signalR from '@microsoft/signalr';

const mockTickets: SupportTicket[] = [
  {
    id: 'TCK_9001',
    playerId: 'PLR_1001',
    playerUsername: 'ArthurPendragon',
    subject: 'Stamina not refilling after story chapter 2 clear',
    status: 'Open',
    createdAt: '2026-08-20 12:10',
    messages: [
      { id: 'MSG_1', ticketId: 'TCK_9001', senderId: 'PLR_1001', senderName: 'ArthurPendragon', message: 'Hello Admin, my stamina didn\'t refill after clearing Stage 2-1.', sentAt: '12:10', isFromAdmin: false },
    ],
  },
  {
    id: 'TCK_9002',
    playerId: 'PLR_1002',
    playerUsername: 'ShadowBlade99',
    subject: 'Failed to claim gacha pity reward',
    status: 'Pending',
    createdAt: '2026-08-20 11:45',
    messages: [
      { id: 'MSG_2', ticketId: 'TCK_9002', senderId: 'PLR_1002', senderName: 'ShadowBlade99', message: 'I reached 90 pulls on Divine Knight banner but didn\'t get pity.', sentAt: '11:45', isFromAdmin: false },
      { id: 'MSG_3', ticketId: 'TCK_9002', senderId: 'ADM_001', senderName: 'Admin', message: 'Checking your pull logs now.', sentAt: '11:50', isFromAdmin: true },
    ],
  },
];

export const LiveSupport: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>(mockTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('TCK_9001');
  const [replyText, setReplyText] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const activeTicket = tickets.find((t) => t.id === selectedTicketId);

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
      .catch((err) => console.log('SignalR Hub Connection Notice (Backend may be offline):', err.message));

    connection.on('ReceiveSupportMessage', (messageData: SupportMessage) => {
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === messageData.ticketId) {
            return { ...t, messages: [...t.messages, messageData] };
          }
          return t;
        })
      );
    });

    return () => {
      connection.stop();
    };
  }, []);

  const handleSendMessage = () => {
    if (!replyText.trim() || !activeTicket) return;
    const newMsg: SupportMessage = {
      id: `MSG_${Date.now()}`,
      ticketId: activeTicket.id,
      senderId: 'ADM_001',
      senderName: 'Game Administrator',
      message: replyText,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isFromAdmin: true,
    };

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === activeTicket.id) {
          return { ...t, messages: [...t.messages, newMsg] };
        }
        return t;
      })
    );
    setReplyText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Headphones className="w-6 h-6 text-indigo-400" />
            Live Customer Support & SignalR Chat
          </h2>
          <p className="text-sm text-slate-400">Real-time player tickets and customer support communication.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
          <Circle className={`w-2.5 h-2.5 rounded-full fill-current ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span>{isConnected ? 'SignalR Connected' : 'Support Hub Ready'}</span>
        </div>
      </div>

      {/* Main Support Interface */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
        {/* Ticket List Panel */}
        <div className="glass-panel rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Active Tickets ({tickets.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicketId(t.id)}
                className={`p-4 cursor-pointer transition-all ${
                  selectedTicketId === t.id ? 'bg-indigo-600/15 border-l-4 border-indigo-500' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-200 text-xs">{t.playerUsername}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{t.createdAt}</span>
                </div>
                <p className="text-xs text-slate-300 font-medium truncate">{t.subject}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-indigo-400 font-mono">{t.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      t.status === 'Open' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Thread Panel */}
        <div className="md:col-span-2 glass-panel rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
          {activeTicket ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div>
                  <h4 className="text-sm font-bold text-white">{activeTicket.subject}</h4>
                  <span className="text-xs text-slate-400">
                    Player: <strong className="text-indigo-300">{activeTicket.playerUsername}</strong> ({activeTicket.playerId})
                  </span>
                </div>
                <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" /> Ticket #{activeTicket.id}
                </span>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
                {activeTicket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isFromAdmin ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                      {msg.isFromAdmin ? (
                        <>
                          <span className="font-semibold text-indigo-400">Game Admin</span>
                          <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-300">{msg.senderName}</span>
                        </>
                      )}
                      <span>• {msg.sentAt}</span>
                    </div>
                    <div
                      className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.isFromAdmin
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                          : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-tl-none'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type reply to player..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              Select a support ticket to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
