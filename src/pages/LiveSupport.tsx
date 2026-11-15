import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  Check,
  Clock,
  Copy,
  Headphones,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Swords,
  User,
} from 'lucide-react';
import { Avatar, AvatarStatusDot } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import {
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
} from '@astryxdesign/core/Chat';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Section } from '@astryxdesign/core/Section';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
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

function getAvatarDotVariant(state: string): 'success' | 'neutral' | 'error' {
  if (state === 'InBattle' || state === 'Online') return 'success';
  return 'neutral';
}

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
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMatchesMap, setActiveMatchesMap] = useState<Map<string, ActiveMatchSummary>>(
    () => new Map(),
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

  const filteredPlayers = useMemo(() => {
    const q = queueFilter.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const name = (p.playerName || p.username || '').toLowerCase();
      const id = p.playerId.toLowerCase();
      const snippet = (p.latestMessageText || p.lastMessage || '').toLowerCase();
      return name.includes(q) || id.includes(q) || snippet.includes(q);
    });
  }, [players, queueFilter]);

  const activePresence = selectedPlayerId
    ? getPlayerPresence(selectedPlayerId, activeMatchesMap, activePlayer?.latestMessageTime)
    : null;
  const activeMatchInfo = selectedPlayerId ? activeMatchesMap.get(selectedPlayerId) : undefined;

  return (
    <VStack gap={5}>
      {/* Hero Header */}
      <Section padding={5}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge label="LIVE SUPPORT DESK" variant="info" />
              <HStack gap={1.5} vAlign="center">
                <StatusDot
                  variant={isConnected ? 'success' : 'warning'}
                  label={isConnected ? 'SignalR WebSocket live' : 'SignalR Hub standby'}
                />
                <Text type="code" size="xsm" color="secondary">
                  {isConnected ? 'SignalR Live' : 'Hub Standby'}
                </Text>
              </HStack>
            </HStack>
            <HStack gap={2} vAlign="center">
              <Icon icon={Headphones} size="lg" color="accent" />
              <Heading level={1} type="display-2" className="font-cinzel pk-gold-text">
                PLAYER SUPPORT DESK &amp; LIVE DISPATCH
              </Heading>
            </HStack>
            <Text type="supporting" size="sm">
              Authoritative player care, bug triage, and real-time bidirectional support messaging.
            </Text>
          </VStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button
              label="Sync Queue"
              variant="secondary"
              size="md"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              isLoading={loading}
              onClick={() => void fetchPlayers()}
            />
          </HStack>
        </HStack>
      </Section>

      {queueError && (
        <Banner
          status="warning"
          title="Support Queue Sync Notice"
          description={queueError}
          isDismissable
          onDismiss={() => setQueueError(null)}
        />
      )}

      {/* Split Support Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Active Player Inquiries */}
        <div>
          <Section
            padding={0}
            className="flex flex-col h-[560px] lg:h-[660px] overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--color-border-subtle)]">
              <VStack gap={3}>
                <HStack justify="between" vAlign="center">
                  <HStack gap={2} vAlign="center">
                    <Icon icon={MessageSquare} size="sm" color="accent" />
                    <Heading level={2} className="font-cinzel">
                      INQUIRIES ({players.length})
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
              <div className="flex-1 flex items-center justify-center p-6">
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
                      : 'Clear or adjust your search query to inspect other inquiries.'
                  }
                  actions={
                    queueFilter ? (
                      <Button label="Clear Filter" variant="ghost" size="sm" onClick={() => setQueueFilter('')} />
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
                  const presence = getPlayerPresence(
                    p.playerId,
                    activeMatchesMap,
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
                          <HStack gap={2} vAlign="center" className="min-w-0">
                            <Avatar
                              name={displayName}
                              shape="rounded"
                              size="sm"
                              tooltip={false}
                              status={
                                <AvatarStatusDot
                                  variant={getAvatarDotVariant(presence.state)}
                                  label={presence.label}
                                />
                              }
                            />
                            <VStack gap={0} className="min-w-0">
                              <Text weight="semibold" size="sm" maxLines={1}>
                                {displayName}
                              </Text>
                              <Text type="code" size="xsm" color="secondary">
                                #{p.playerId.slice(-6).toUpperCase()}
                              </Text>
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
          </Section>
        </div>

        {/* Right 2 Columns: Live Conversation & Astryx ChatLayout */}
        <div className="lg:col-span-2">
          <Section
            padding={0}
            className="flex flex-col h-[560px] lg:h-[660px] overflow-hidden"
          >
            {selectedPlayerId ? (
              <>
                {/* Conversation Header */}
                <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
                  <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                    <HStack gap={3} vAlign="center" className="min-w-0">
                      <Avatar
                        name={activePlayerRealName}
                        shape="rounded"
                        size="md"
                        tooltip={false}
                        status={
                          activePresence ? (
                            <AvatarStatusDot
                              variant={getAvatarDotVariant(activePresence.state)}
                              label={activePresence.label}
                            />
                          ) : undefined
                        }
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
                        <Badge
                          label={activePresence.label}
                          variant={getPresenceBadgeVariant(activePresence.state)}
                        />
                      )}
                    </HStack>
                  </HStack>
                </div>

                {/* Chat Transcript & Frosted Dock Composer */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <ChatLayout
                    density="balanced"
                    emptyState={
                      <EmptyState
                        icon={<MessageSquare size={26} />}
                        title="No Previous Messages Exchanged"
                        description={`Send a dispatch below to start assisting ${activePlayerRealName}.`}
                      />
                    }
                    composer={
                      <ChatComposer
                        density="balanced"
                        value={replyText}
                        onChange={(val) => {
                          setReplyText(val);
                          if (sendError) setSendError(null);
                        }}
                        onSubmit={(val) => void handleSendMessage(val)}
                        placeholder={`Compose support dispatch to ${activePlayerRealName}...`}
                        status={
                          sendError
                            ? { type: 'error', message: sendError }
                            : undefined
                        }
                      />
                    }
                  >
                    {messages.length > 0 ? (
                      <ChatMessageList density="balanced" align="bottom">
                        {messages.map((m, index) => {
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

                          return (
                            <ChatMessage
                              key={stableKey}
                              sender={isAdmin ? 'user' : 'assistant'}
                              avatar={
                                <Avatar
                                  name={senderLabel}
                                  size="sm"
                                  shape="rounded"
                                  tooltip={false}
                                />
                              }
                            >
                              <ChatMessageBubble
                                variant="filled"
                                name={
                                  <HStack gap={1.5} vAlign="center">
                                    <Icon
                                      icon={isAdmin ? ShieldCheck : User}
                                      size="xsm"
                                      color={isAdmin ? 'accent' : 'secondary'}
                                    />
                                    <Text type="label" size="xsm" weight="semibold">
                                      {senderLabel}
                                    </Text>
                                  </HStack>
                                }
                                metadata={
                                  timestampLabel ? (
                                    <Text type="code" size="xsm" color="secondary">
                                      {timestampLabel}
                                    </Text>
                                  ) : undefined
                                }
                              >
                                <Text
                                  type="body"
                                  size="sm"
                                  display="block"
                                  className="whitespace-pre-wrap"
                                >
                                  {m.text}
                                </Text>
                              </ChatMessageBubble>
                            </ChatMessage>
                          );
                        })}
                      </ChatMessageList>
                    ) : null}
                  </ChatLayout>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <EmptyState
                  icon={<MessageSquare size={32} />}
                  title="No Traveler Selected"
                  description="Select an inquiry from the roster on the left to read and respond."
                />
              </div>
            )}
          </Section>
        </div>
      </div>
    </VStack>
  );
};
