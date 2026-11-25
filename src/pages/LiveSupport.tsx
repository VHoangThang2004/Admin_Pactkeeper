import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Headphones,
  Inbox,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Swords,
  User,
} from 'lucide-react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { ImageLightboxModal } from '../components/ui/ImageLightboxModal';
import { useRealtimePresence } from '../hooks/useRealtimePresence';
import type { ActiveChatPlayerDto, SupportMessageDto } from '../types';
import { getPlayerPresence } from '../utils/presence';
import { getPresenceBadgeVariant } from '../utils/presenceAstryx';

interface ActiveMatchSummary {
  matchId: string;
  mode?: string;
}

interface RawSupportPlayerRecord {
  playerId?: string;
  playerName?: string;
  username?: string;
  latestMessageText?: string;
  lastMessage?: string;
  latestMessageTime?: string;
  lastMessageAt?: string;
}

interface RawMatchHistoryRecord {
  matchId?: string;
  id?: string;
  status?: string | number;
  mode?: string;
  player1Id?: string;
  player2Id?: string;
}

function getPresenceDotVariant(state: string): 'success' | 'neutral' | 'error' {
  if (state === 'InBattle' || state === 'Online') return 'success';
  return 'neutral';
}

const MessageAttachment: React.FC<{ url: string; onZoom?: (url: string) => void }> = ({
  url,
  onZoom,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent-primary)] hover:underline"
      >
        <Paperclip size={13} />
        <span>View Attachment</span>
        <ExternalLink size={12} />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onZoom?.(url)}
      className="pk-attachment-btn mt-1.5 block overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-black/20 cursor-zoom-in"
      title="Click to inspect attachment"
    >
      <img
        src={url}
        alt="Support message attachment"
        onError={() => setImgFailed(true)}
        className="pk-attachment-thumb max-h-48 w-auto max-w-full object-contain"
      />
    </button>
  );
};

const QUICK_TRIAGE_REPLIES = [
  {
    label: 'Investigating',
    text: 'Hello! Our High Counsel engineering team has received your ticket and is inspecting the server logs now.',
  },
  {
    label: 'Order Verified',
    text: 'We have verified your PayOS receipt and confirmed your crystals have been credited to your realm ledger.',
  },
  {
    label: 'Restart Client',
    text: 'Could you please fully restart the PactKeeper client and relogin so your session state refreshes cleanly?',
  },
  {
    label: 'Resolved',
    text: 'This issue has been resolved on our end. Let us know right here if you run into any further trouble!',
  },
];

/**
 * Player Support Desk & Live Chat Room (Screen 45 & 46).
 * Preserves SignalR /hubs/support real-time updates, HTTP endpoints, and battle inspection deep links.
 */
export const LiveSupport: React.FC = () => {
  const [players, setPlayers] = useState<ActiveChatPlayerDto[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [replyText, setReplyText] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [queueScope, setQueueScope] = useState<'ALL' | 'ACTIVE'>('ALL');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [activeMatchesMap, setActiveMatchesMap] = useState<Map<string, ActiveMatchSummary>>(
    () => new Map(),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedPlayerId]);
  const { trackedPlayers } = useRealtimePresence();
  const trackedPresenceMap = useMemo(
    () => new Map(trackedPlayers.map((tp) => [tp.playerId, tp.presence])),
    [trackedPlayers],
  );

  const resolvePlayerPresence = useCallback(
    (playerId: string, fallbackTime?: string) => {
      const unified = trackedPresenceMap.get(playerId);
      if (unified) return unified;
      return getPlayerPresence(playerId, activeMatchesMap, fallbackTime);
    },
    [trackedPresenceMap, activeMatchesMap],
  );

  const selectedPlayerIdRef = useRef(selectedPlayerId);
  useEffect(() => {
    selectedPlayerIdRef.current = selectedPlayerId;
  }, [selectedPlayerId]);

  const activePlayer = players.find((p) => p.playerId === selectedPlayerId);
  const activePlayerRealName =
    (activePlayer?.playerName || activePlayer?.username || '').trim() ||
    messages
      .find(
        (m) =>
          m.sender !== 'admin' &&
          m.sender !== 'Admin' &&
          m.senderName &&
          m.senderName.trim(),
      )
      ?.senderName?.trim() ||
    (selectedPlayerId ? `Traveler #${selectedPlayerId.slice(-4).toUpperCase()}` : 'Traveler');

  const loadSupportQueueData = useCallback(async () => {
    const [supportRes, matchRes] = await Promise.allSettled([
      adminClient.get('/support/admin/players'),
      adminClient.get('/Match/history'),
    ]);

    const matchMap = new Map<string, ActiveMatchSummary>();
    if (matchRes.status === 'fulfilled' && Array.isArray(matchRes.value.data)) {
      (matchRes.value.data as RawMatchHistoryRecord[]).forEach((m) => {
        const s = String(m.status ?? '').toLowerCase();
        const isLive =
          s === 'inprogress' ||
          s === 'active' ||
          s === 'playing' ||
          s === 'running' ||
          m.status === 1;
        if (isLive) {
          const mId = m.matchId || m.id || '';
          if (m.player1Id) matchMap.set(m.player1Id, { matchId: mId, mode: m.mode });
          if (m.player2Id) matchMap.set(m.player2Id, { matchId: mId, mode: m.mode });
        }
      });
    }

    let mappedPlayers: ActiveChatPlayerDto[] = [];
    if (supportRes.status === 'fulfilled' && Array.isArray(supportRes.value.data)) {
      mappedPlayers = (supportRes.value.data as RawSupportPlayerRecord[]).map((p) => {
        const resolvedName = (p.playerName || p.username || '').trim();
        const messageSnippet = p.latestMessageText || p.lastMessage || '';
        const timeSnippet = p.latestMessageTime
          ? new Date(p.latestMessageTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : p.lastMessageAt || '';
        return {
          playerId: p.playerId || '',
          playerName: resolvedName,
          username: resolvedName,
          latestMessageText: messageSnippet,
          lastMessage: messageSnippet,
          latestMessageTime: p.latestMessageTime || '',
          lastMessageAt: timeSnippet,
        };
      });
    }

    return {
      matchMap,
      mappedPlayers,
      supportFailed: supportRes.status === 'rejected',
    };
  }, []);

  const applySupportQueue = useCallback(
    (result: {
      matchMap: Map<string, ActiveMatchSummary>;
      mappedPlayers: ActiveChatPlayerDto[];
      supportFailed: boolean;
    }) => {
      setActiveMatchesMap(result.matchMap);
      setPlayers(result.mappedPlayers);
      setQueueError(
        result.supportFailed ? 'Unable to sync support queue from backend.' : null,
      );
      if (result.mappedPlayers.length > 0 && !selectedPlayerIdRef.current) {
        setSelectedPlayerId(result.mappedPlayers[0].playerId);
      }
    },
    [],
  );

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadSupportQueueData();
      applySupportQueue(result);
    } catch {
      setQueueError('Failed to refresh active support inquiries.');
    } finally {
      setLoading(false);
    }
  }, [loadSupportQueueData, applySupportQueue]);

  useEffect(() => {
    let active = true;
    loadSupportQueueData()
      .then((result) => {
        if (active) applySupportQueue(result);
      })
      .catch(() => {
        if (active) setQueueError('Unable to reach support queue endpoint.');
      });
    return () => {
      active = false;
    };
  }, [loadSupportQueueData, applySupportQueue]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    let active = true;
    adminClient
      .get(`/support/admin/chat/${selectedPlayerId}`)
      .then((res) => {
        if (!active) return;
        setMessages(Array.isArray(res.data) ? res.data : []);
        setSendError(null);
      })
      .catch(() => {
        if (active) setMessages([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPlayerId]);

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

    connection.onreconnecting(() => setIsConnected(false));
    connection.onreconnected(() => setIsConnected(true));
    connection.onclose(() => setIsConnected(false));

    connection.on('ReceiveMessage', (senderPlayerId: string, messageData: SupportMessageDto) => {
      if (senderPlayerId === selectedPlayerIdRef.current) {
        setMessages((prev) => [...prev, messageData]);
      }
      loadSupportQueueData()
        .then(applySupportQueue)
        .catch(() => {});
    });

    return () => {
      connection.stop();
    };
  }, [loadSupportQueueData, applySupportQueue]);

  const handleSendMessage = async (submittedText: string) => {
    const trimmed = submittedText.trim();
    if (!trimmed || !selectedPlayerId) return;

    setSendError(null);
    setReplyText('');

    try {
      const res = await adminClient.post(`/support/admin/chat/${selectedPlayerId}`, {
        text: trimmed,
      });
      if (res.data) {
        setMessages((prev) => [...prev, res.data]);
      }
    } catch (err: unknown) {
      const responseMsg = (
        err as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setSendError(responseMsg || 'Failed to send reply to player.');
      setReplyText(trimmed);
    }
  };

  const handleCopyPlayerId = async (playerId: string) => {
    try {
      await navigator.clipboard.writeText(playerId);
      setCopiedId(playerId);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === playerId ? null : prev));
      }, 1500);
    } catch {
      // Ignore clipboard permission denials
    }
  };

  const activeQueueCount = useMemo(
    () =>
      players.filter((p) => {
        const presence = resolvePlayerPresence(
          p.playerId,
          p.latestMessageTime || p.lastMessageAt,
        );
        return presence.state === 'Online' || presence.state === 'InBattle';
      }).length,
    [players, resolvePlayerPresence],
  );

  const filteredPlayers = useMemo(() => {
    const q = queueFilter.trim().toLowerCase();
    return players.filter((p) => {
      if (queueScope === 'ACTIVE') {
        const presence = resolvePlayerPresence(
          p.playerId,
          p.latestMessageTime || p.lastMessageAt,
        );
        if (presence.state === 'Offline') return false;
      }
      if (!q) return true;
      const name = (p.playerName || p.username || '').toLowerCase();
      const id = p.playerId.toLowerCase();
      const snippet = (p.latestMessageText || p.lastMessage || '').toLowerCase();
      return name.includes(q) || id.includes(q) || snippet.includes(q);
    });
  }, [players, queueFilter, queueScope, resolvePlayerPresence]);

  const activePresence = selectedPlayerId
    ? resolvePlayerPresence(selectedPlayerId, activePlayer?.latestMessageTime)
    : null;
  const activeMatchInfo = selectedPlayerId ? activeMatchesMap.get(selectedPlayerId) : undefined;

  return (
    <ConsolePage
      fillBody
      badge="LIVE SUPPORT DESK"
      badgeVariant="info"
      icon={<Icon icon={Headphones} size="md" color="accent" />}
      title="PLAYER SUPPORT DESK & LIVE DISPATCH"
      subtitle="Authoritative player care, bug triage, and real-time bidirectional support messaging."
      meta={
        <HStack gap={1.5} vAlign="center">
          <StatusDot
            variant={isConnected ? 'success' : 'warning'}
            label={isConnected ? 'SignalR WebSocket live' : 'SignalR Hub standby'}
          />
          <Text type="code" size="xsm" color="secondary">
            {isConnected ? 'SignalR Live' : 'Hub Standby'}
          </Text>
          <Badge label={`${players.length} Inquiries`} variant="neutral" />
        </HStack>
      }
      actions={
        <Button
          label="Sync Queue"
          variant="secondary"
          size="md"
          icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
          isLoading={loading}
          onClick={() => void fetchPlayers()}
        />
      }
      banner={
        queueError ? (
          <Banner
            status="warning"
            title="Support Queue Sync Notice"
            description={queueError}
            isDismissable
            onDismiss={() => setQueueError(null)}
          />
        ) : undefined
      }
    >
      {/* Split Support Console (Fills remaining height cleanly!) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Column: Active Player Inquiries */}
        <Card
          padding={0}
          elevation="low"
          className="flex flex-col h-[340px] lg:h-full min-h-0"
        >
          <div className="shrink-0 p-3.5 sm:p-4 border-b border-[var(--color-border-subtle)]">
            <VStack gap={2}>
              <HStack justify="between" vAlign="center" gap={2}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={MessageSquare} size="sm" color="accent" />
                  <Heading level={2} className="font-cinzel">
                    INQUIRIES ({filteredPlayers.length})
                  </Heading>
                </HStack>
                <IconButton
                  icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
                  label="Refresh queue"
                  size="sm"
                  variant="ghost"
                  isLoading={loading}
                  onClick={() => void fetchPlayers()}
                />
              </HStack>

              <SegmentedControl
                label="Filter queue by activity"
                value={queueScope}
                onChange={(val) => setQueueScope(val as 'ALL' | 'ACTIVE')}
                size="sm"
              >
                <SegmentedControlItem value="ALL" label={`All (${players.length})`} />
                <SegmentedControlItem value="ACTIVE" label={`Online / Battle (${activeQueueCount})`} />
              </SegmentedControl>

              <TextInput
                label="Filter support queue"
                isLabelHidden
                size="sm"
                placeholder="Search Traveler, GUID, or snippet..."
                value={queueFilter}
                onChange={setQueueFilter}
                hasClear
                startIcon={<Search size={14} />}
              />
            </VStack>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="flex-1 min-h-0 flex items-center justify-center p-6">
              <EmptyState
                icon={<Inbox size={26} />}
                title={
                  players.length === 0
                    ? 'No Active Missives'
                    : 'No Matching Inquiries'
                }
                description={
                  players.length === 0
                    ? 'Waiting for incoming player support requests.'
                    : 'Clear search or switch queue filter to inspect other inquiries.'
                }
                actions={
                  queueFilter || queueScope !== 'ALL' ? (
                    <Button
                      label="Reset Filters"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setQueueFilter('');
                        setQueueScope('ALL');
                      }}
                    />
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div
              className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--color-border-subtle)]"
              role="listbox"
              aria-label="Player support inquiries"
            >
              {filteredPlayers.map((p) => {
                const isSelected = selectedPlayerId === p.playerId;
                const pName = (p.playerName || p.username || '').trim();
                const displayName = pName
                  ? pName
                  : isSelected && activePlayerRealName && !activePlayerRealName.startsWith('Traveler')
                    ? activePlayerRealName
                    : `Traveler #${p.playerId.slice(-4).toUpperCase()}`;
                const presence = resolvePlayerPresence(
                  p.playerId,
                  p.latestMessageTime || p.lastMessageAt,
                );

                return (
                  <button
                    key={p.playerId}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedPlayerId(p.playerId)}
                    className="w-full text-left p-3.5 transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-primary)]"
                    style={{
                      borderLeftWidth: 3,
                      borderLeftStyle: 'solid',
                      borderLeftColor: isSelected
                        ? 'var(--color-accent-primary)'
                        : 'transparent',
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--color-accent-primary) 9%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <VStack gap={1.5}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <HStack gap={3} vAlign="center" className="min-w-0">
                          <Avatar
                            name={displayName}
                            shape="circle"
                            size="md"
                            tooltip={false}
                          />
                          <VStack gap={0.5} className="min-w-0">
                            <Text weight="semibold" size="sm" maxLines={1}>
                              {displayName}
                            </Text>
                            <HStack gap={1.5} vAlign="center">
                              <StatusDot
                                variant={getPresenceDotVariant(presence.state)}
                                label={presence.label}
                              />
                              <Text type="code" size="xsm" color="secondary">
                                #{p.playerId.slice(-6).toUpperCase()}
                              </Text>
                            </HStack>
                          </VStack>
                        </HStack>

                        <StackItem size="static">
                          <HStack gap={1} vAlign="center">
                            <Icon icon={Clock} size="xsm" color="secondary" />
                            <Text type="code" size="xsm" color="secondary">
                              {p.lastMessageAt || 'Recent'}
                            </Text>
                          </HStack>
                        </StackItem>
                      </HStack>

                      <Text type="supporting" size="xsm" maxLines={1}>
                        “{p.latestMessageText || 'No message snippet'}”
                      </Text>

                      {presence.state === 'InBattle' && (
                        <div>
                          <Badge
                            label="In Combat Session"
                            variant="warning"
                            icon={<Swords size={11} />}
                          />
                        </div>
                      )}
                    </VStack>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right 2 Columns: Live Conversation & Astryx ChatLayout */}
        <Card
          padding={0}
          elevation="low"
          className="lg:col-span-2 flex flex-col h-[520px] lg:h-full min-h-0"
        >
          {selectedPlayerId ? (
            <>
              {/* Conversation Header */}
              <div className="shrink-0 p-3.5 sm:p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
                <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                  <HStack gap={3} vAlign="center" className="min-w-0">
                    <Avatar
                      name={activePlayerRealName}
                      shape="circle"
                      size="md"
                      tooltip={false}
                    />
                    <VStack gap={0.5} className="min-w-0">
                      <Heading level={2}>
                        {activePlayerRealName}
                      </Heading>
                      <HStack gap={1.5} vAlign="center">
                        <Text type="code" size="xsm" color="secondary" maxLines={1}>
                          GUID: {selectedPlayerId}
                        </Text>
                        <IconButton
                          icon={
                            copiedId === selectedPlayerId ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )
                          }
                          label={
                            copiedId === selectedPlayerId
                              ? 'GUID copied'
                              : 'Copy Player GUID'
                          }
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleCopyPlayerId(selectedPlayerId)}
                        />
                      </HStack>
                    </VStack>
                  </HStack>

                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Button
                      label="Player Profile"
                      variant="ghost"
                      size="sm"
                      icon={<User size={14} />}
                      href={`/players?search=${encodeURIComponent(selectedPlayerId)}`}
                    />
                    {activeMatchInfo && (
                      <Button
                        label="Inspect Battle"
                        variant="secondary"
                        size="sm"
                        icon={<Swords size={14} />}
                        href={`/matches?matchId=${activeMatchInfo.matchId}`}
                      />
                    )}
                    {activePresence && (
                      <HStack gap={1.5} vAlign="center">
                        <StatusDot
                          variant={getPresenceDotVariant(activePresence.state)}
                          label={activePresence.label}
                        />
                        <Badge
                          label={activePresence.label}
                          variant={getPresenceBadgeVariant(activePresence.state)}
                        />
                      </HStack>
                    )}
                  </HStack>
                </HStack>

                {/* Quick Triage Reply Macros */}
                <div className="mt-2.5 pt-2 border-t border-[var(--color-border-subtle)] flex items-center gap-1.5 flex-wrap">
                  <Text type="label" size="xsm" color="secondary">
                    Quick Fill:
                  </Text>
                  {QUICK_TRIAGE_REPLIES.map((macro) => (
                    <button
                      key={macro.label}
                      type="button"
                      onClick={() => setReplyText(macro.text)}
                      className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-background-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                    >
                      + {macro.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Transcript & Pinned Non-Clipped Composer (SDK_Pactkeeper Parity) */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="pk-chat-messages">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <EmptyState
                        icon={<MessageSquare size={26} />}
                        title="No Previous Messages Exchanged"
                        description={`Send a dispatch below to start assisting ${activePlayerRealName}.`}
                      />
                    </div>
                  ) : (
                    messages.map((m, index) => {
                      const isAdmin =
                        m.sender === 'admin' ||
                        m.sender === 'Admin' ||
                        m.senderName === 'System Admin' ||
                        m.senderName === 'Support';
                      const stableKey =
                        m.id || `${m.sender}-${m.createdAt || ''}-${index}`;
                      const senderLabel = isAdmin
                        ? 'High Counsel Support'
                        : m.senderName || activePlayerRealName;
                      const timestampLabel = m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';
                      const hasText = Boolean(m.text && m.text.trim());
                      const hasAttachment = Boolean(m.attachmentUrl);

                      return (
                        <div
                          key={stableKey}
                          className={`flex items-end gap-2.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isAdmin && (
                            <Avatar
                              name={senderLabel}
                              size="sm"
                              shape="circle"
                              tooltip={false}
                            />
                          )}

                          <div
                            className={
                              isAdmin ? 'pk-chat-bubble-admin' : 'pk-chat-bubble-player'
                            }
                          >
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-90">
                                {isAdmin ? (
                                  <ShieldCheck size={13} />
                                ) : (
                                  <User size={13} />
                                )}
                                {senderLabel}
                              </span>
                              {timestampLabel && (
                                <span className="font-mono text-[11px] opacity-75">
                                  {timestampLabel}
                                </span>
                              )}
                            </div>

                            {hasText && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap m-0">
                                {m.text}
                              </p>
                            )}
                            {hasAttachment && m.attachmentUrl && (
                              <MessageAttachment
                                url={m.attachmentUrl}
                                onZoom={(url) => setZoomImageUrl(url)}
                              />
                            )}
                            {!hasText && !hasAttachment && (
                              <p className="text-sm italic opacity-75 m-0">
                                (Empty missive)
                              </p>
                            )}
                          </div>

                          {isAdmin && (
                            <Avatar
                              name={senderLabel}
                              size="sm"
                              shape="circle"
                              tooltip={false}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Pinned Composer */}
                <form
                  className="pk-chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (replyText.trim()) {
                      void handleSendMessage(replyText);
                    }
                  }}
                >
                  {sendError && (
                    <div className="mb-2">
                      <Banner status="error" title="Dispatch Failed" description={sendError} />
                    </div>
                  )}
                  <div className="flex items-end gap-2.5">
                    <textarea
                      className="pk-chat-textarea flex-1"
                      rows={2}
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        if (sendError) setSendError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (replyText.trim()) {
                            void handleSendMessage(replyText);
                          }
                        }
                      }}
                      placeholder={`Compose support dispatch to ${activePlayerRealName}... (Enter to send, Shift+Enter for newline)`}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      label="Send"
                      icon={<Icon icon={Send} size="sm" />}
                      isDisabled={!replyText.trim()}
                    />
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center p-6">
              <EmptyState
                icon={<MessageSquare size={32} />}
                title="No Traveler Selected"
                description="Select an inquiry from the roster on the left to read and respond."
              />
            </div>
          )}
        </Card>
      </div>

      <ImageLightboxModal
        src={zoomImageUrl}
        title={`Attachment — ${activePlayerRealName}`}
        onClose={() => setZoomImageUrl(null)}
      />
    </ConsolePage>
  );
};
