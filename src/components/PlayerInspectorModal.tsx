import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Edit3,
  Eye,
  Gem,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Terminal,
  Trash2,
  Trophy,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { adminClient } from '../api/adminClient';
import { recordAuditEvent } from '../services/adminSecurityService';
import type {
  ChapterConfig,
  ClassDefinition,
  GachaBanner,
  MatchHistoryItem,
  OwnedUnitRecord,
  PlayerAdminDetails,
  PlayerProfile,
  StoryProgressRecord,
  TrinketDefinition,
  UnitDefinition,
  WeaponDefinition,
} from '../types';
import { isAiOrVirtualPlayerId } from '../utils/presence';
import { getPresenceBadgeVariant, getPresenceDisplayLabel } from '../utils/presenceAstryx';

interface PlayerInspectorModalProps {
  player: PlayerProfile | null;
  canAdjustTreasury: boolean;
  canBanPlayers: boolean;
  canSendNotification: boolean;
  canInspectLogs: boolean;
  onClose: () => void;
  onOpenNotify: (player: PlayerProfile) => void;
  onOpenAdjustCurrencies: (player: PlayerProfile) => void;
  onOpenBanToggle: (player: PlayerProfile) => void;
  onPlayerUpdated: () => void;
  onStatusMessage: (msg: string) => void;
}

type InspectorTab = 'overview' | 'story' | 'stats' | 'content' | 'pity';

interface RewardRuleSummary {
  id: string;
  title?: string;
  name?: string;
  targetCount?: number;
}

export const PlayerInspectorModal: React.FC<PlayerInspectorModalProps> = ({
  player,
  canAdjustTreasury,
  canBanPlayers,
  canSendNotification,
  canInspectLogs,
  onClose,
  onOpenNotify,
  onOpenAdjustCurrencies,
  onOpenBanToggle,
  onPlayerUpdated,
  onStatusMessage,
}) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');
  const [details, setDetails] = useState<PlayerAdminDetails | null>(null);
  const [detailsEndpointMissing, setDetailsEndpointMissing] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(Boolean(player));

  const [playerMatches, setPlayerMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(Boolean(player));

  const [unitDefs, setUnitDefs] = useState<UnitDefinition[]>([]);
  const [weaponDefs, setWeaponDefs] = useState<WeaponDefinition[]>([]);
  const [trinketDefs, setTrinketDefs] = useState<TrinketDefinition[]>([]);
  const [classDefs, setClassDefs] = useState<ClassDefinition[]>([]);
  const [chapterConfigs, setChapterConfigs] = useState<ChapterConfig[]>([]);
  const [rewardRules, setRewardRules] = useState<RewardRuleSummary[]>([]);
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [fallbackStoryProgress, setFallbackStoryProgress] = useState<StoryProgressRecord[] | null>(
    null,
  );

  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [savingAction, setSavingAction] = useState<string | null>(null);

  // Editable stats state
  const [statUsername, setStatUsername] = useState(player?.username || '');
  const [statLevel, setStatLevel] = useState(player?.level ?? 1);
  const [statExp, setStatExp] = useState(player?.experience ?? 0);
  const [statGold, setStatGold] = useState(player?.gold ?? 0);
  const [statGems, setStatGems] = useState(player?.gems ?? 0);
  const [statRating, setStatRating] = useState(0);
  const [statRankTier, setStatRankTier] = useState(0);
  const [statRankWins, setStatRankWins] = useState(0);
  const [statRankLosses, setStatRankLosses] = useState(0);

  // Grant content state
  const [grantUnitUId, setGrantUnitUId] = useState<string>('');
  const [grantUnitGrade, setGrantUnitGrade] = useState<number>(1);
  const [grantWeaponId, setGrantWeaponId] = useState<string>('');
  const [grantTrinketId, setGrantTrinketId] = useState<string>('');

  // Inline unit edit state
  const [editingUnit, setEditingUnit] = useState<OwnedUnitRecord | null>(null);
  const [editUnitGrade, setEditUnitGrade] = useState<number>(1);
  const [editUnitClasses, setEditUnitClasses] = useState<number[]>([]);

  // Pity editor state
  const [pityBannerId, setPityBannerId] = useState<string>('');
  const [pityPulls, setPityPulls] = useState<number>(0);
  const [pityGuaranteed, setPityGuaranteed] = useState<boolean>(false);

  // Story progress editor state
  const [storyChapterInput, setStoryChapterInput] = useState<string>('0');
  const [storySceneInput, setStorySceneInput] = useState<string>('0');
  const [storyIsCompleted, setStoryIsCompleted] = useState<boolean>(false);
  const [storyIsChapterCompleted, setStoryIsChapterCompleted] = useState<boolean>(false);

  const syncStatsFormFromDetails = useCallback((record: PlayerAdminDetails) => {
    setStatUsername(record.username || '');
    setStatLevel(record.level ?? 1);
    setStatExp(record.experience ?? 0);
    setStatGold(record.gold ?? 0);
    setStatGems(record.gems ?? 0);
    setStatRating(record.rating ?? 0);
    setStatRankTier(record.rankTier ?? 0);
    setStatRankWins(record.rankWins ?? 0);
    setStatRankLosses(record.rankLosses ?? 0);

    if (record.storyProgress && record.storyProgress.length > 0) {
      const latest = [...record.storyProgress].sort((a, b) => a.chapterId - b.chapterId)[
        record.storyProgress.length - 1
      ];
      setStoryChapterInput(String(latest.chapterId));
      setStorySceneInput(String(latest.sceneId));
      setStoryIsCompleted(Boolean(latest.isCompleted));
      setStoryIsChapterCompleted(Boolean(latest.isChapterCompleted));
    }
  }, []);

  const loadFullDetails = useCallback(
    async (targetPlayer: PlayerProfile, skipInitialLoadingState = false) => {
      if (!skipInitialLoadingState) {
        setLoadingDetails(true);
        setDetailsEndpointMissing(false);
      }
      try {
        const res = await adminClient.get(`/player/details/${encodeURIComponent(targetPlayer.playerId)}`);
        const data = res.data as PlayerAdminDetails;
        const merged: PlayerAdminDetails = {
          ...targetPlayer,
          ...data,
          presence: targetPlayer.presence ?? data.presence,
          presenceDetails: targetPlayer.presenceDetails ?? data.presenceDetails,
          activeMatch: targetPlayer.activeMatch ?? data.activeMatch,
        };
        setDetails(merged);
        syncStatsFormFromDetails(merged);
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          setDetailsEndpointMissing(true);
        }
        try {
          const fallbackRes = await adminClient.get(
            `/player/profile/${encodeURIComponent(targetPlayer.playerId)}`,
          );
          const fallbackData = fallbackRes.data as PlayerAdminDetails;
          const merged: PlayerAdminDetails = {
            ...targetPlayer,
            ...fallbackData,
            presence: targetPlayer.presence ?? fallbackData.presence,
            presenceDetails: targetPlayer.presenceDetails ?? fallbackData.presenceDetails,
            activeMatch: targetPlayer.activeMatch ?? fallbackData.activeMatch,
          };
          setDetails(merged);
          syncStatsFormFromDetails(merged);
        } catch {
          setDetails(targetPlayer);
          syncStatsFormFromDetails(targetPlayer);
        }
      } finally {
        setLoadingDetails(false);
      }
    },
    [syncStatsFormFromDetails],
  );

  useEffect(() => {
    if (!player) return;

    void loadFullDetails(player, true);

    let active = true;
    adminClient
      .get('/Match/history')
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data) ? (res.data as MatchHistoryItem[]) : [];
        setPlayerMatches(
          list.filter((m) => m.player1Id === player.playerId || m.player2Id === player.playerId),
        );
      })
      .catch(() => {
        if (active) setPlayerMatches([]);
      })
      .finally(() => {
        if (active) setLoadingMatches(false);
      });

    Promise.allSettled([
      adminClient.get('/UnitDefinition'),
      adminClient.get('/WeaponDefinition'),
      adminClient.get('/TrinketDefinition'),
      adminClient.get('/ClassDefinition'),
      adminClient.get('/ChapterConfig'),
      adminClient.get('/rewardrule/active'),
      adminClient.get('/gachabanner'),
      adminClient.get(`/Story/admin/player/${encodeURIComponent(player.playerId)}`),
    ]).then(([uRes, wRes, tRes, cRes, chRes, rRes, bRes, sRes]) => {
      if (!active) return;
      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) {
        setUnitDefs(uRes.value.data);
      }
      if (wRes.status === 'fulfilled' && Array.isArray(wRes.value.data)) {
        setWeaponDefs(wRes.value.data);
      }
      if (tRes.status === 'fulfilled' && Array.isArray(tRes.value.data)) {
        setTrinketDefs(tRes.value.data);
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value.data)) {
        setClassDefs(cRes.value.data);
      }
      if (chRes.status === 'fulfilled' && Array.isArray(chRes.value.data)) {
        setChapterConfigs(
          [...(chRes.value.data as ChapterConfig[])].sort((a, b) => a.chapterId - b.chapterId),
        );
      }
      if (rRes.status === 'fulfilled' && Array.isArray(rRes.value.data)) {
        setRewardRules(rRes.value.data);
      }
      if (bRes.status === 'fulfilled' && Array.isArray(bRes.value.data)) {
        setBanners(bRes.value.data);
      }
      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value.data)) {
        const list = sRes.value.data as StoryProgressRecord[];
        setFallbackStoryProgress(list);
        if (list.length > 0) {
          const latest = [...list].sort((a, b) => a.chapterId - b.chapterId)[list.length - 1];
          setStoryChapterInput(String(latest.chapterId));
          setStorySceneInput(String(latest.sceneId));
          setStoryIsCompleted(Boolean(latest.isCompleted));
          setStoryIsChapterCompleted(Boolean(latest.isChapterCompleted));
        }
      }
    });

    return () => {
      active = false;
    };
  }, [player, loadFullDetails]);

  const unitMap = useMemo(() => new Map(unitDefs.map((u) => [u.uId, u])), [unitDefs]);
  const weaponMap = useMemo(() => new Map(weaponDefs.map((w) => [w.weaponId, w])), [weaponDefs]);
  const trinketMap = useMemo(
    () => new Map(trinketDefs.map((t) => [t.trinketId, t])),
    [trinketDefs],
  );
  const classMap = useMemo(() => new Map(classDefs.map((c) => [c.classId, c])), [classDefs]);
  const chapterMap = useMemo(
    () => new Map(chapterConfigs.map((ch) => [ch.chapterId, ch])),
    [chapterConfigs],
  );
  const rewardRuleMap = useMemo(
    () => new Map(rewardRules.map((r) => [r.id, r])),
    [rewardRules],
  );
  const bannerMap = useMemo(() => new Map(banners.map((b) => [b.id, b])), [banners]);

  const chapterSelectOptions = useMemo<SelectorOptionData[]>(
    () =>
      chapterConfigs.map((ch) => ({
        value: String(ch.chapterId),
        label: `Chapter ${ch.chapterId}: ${ch.title || 'Untitled'}`,
      })),
    [chapterConfigs],
  );

  const selectedChapterForEditor = useMemo(
    () => chapterMap.get(Number(storyChapterInput)),
    [chapterMap, storyChapterInput],
  );

  const sceneSelectOptions = useMemo<SelectorOptionData[]>(() => {
    const scenes = selectedChapterForEditor?.scenes ?? [];
    if (scenes.length === 0) {
      return [{ value: '0', label: 'Scene 0' }];
    }
    return [...scenes]
      .sort((a, b) => a.sceneId - b.sceneId)
      .map((s) => ({
        value: String(s.sceneId),
        label: `Scene ${s.sceneId} — ${s.type}${s.mapId ? ` (${s.mapId})` : ''}`,
      }));
  }, [selectedChapterForEditor]);

  const unitOptions = useMemo<SelectorOptionData[]>(
    () =>
      unitDefs.map((u) => ({
        value: String(u.uId),
        label: `${u.unitName || u.name || 'Unit'} (#${u.uId})`,
      })),
    [unitDefs],
  );

  const weaponOptions = useMemo<SelectorOptionData[]>(
    () =>
      weaponDefs.map((w) => ({
        value: String(w.weaponId),
        label: `${w.name} (#${w.weaponId})`,
      })),
    [weaponDefs],
  );

  const trinketOptions = useMemo<SelectorOptionData[]>(
    () =>
      trinketDefs.map((t) => ({
        value: String(t.trinketId),
        label: `${t.name} (#${t.trinketId})`,
      })),
    [trinketDefs],
  );

  const bannerOptions = useMemo<SelectorOptionData[]>(() => {
    const keys = new Set<string>([
      ...banners.map((b) => b.id),
      ...Object.keys(details?.gachaPityByBanner || {}),
    ]);
    return Array.from(keys).map((id) => ({
      value: id,
      label: bannerMap.get(id)?.title ? `${bannerMap.get(id)!.title} (${id.slice(-6)})` : id,
    }));
  }, [banners, bannerMap, details]);

  const activeDetails: PlayerAdminDetails | null = details || player;

  const handleSaveFullStats = async () => {
    if (!activeDetails || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction('stats');
    try {
      const payload = {
        username: statUsername.trim() || activeDetails.username,
        level: Math.max(1, Math.round(statLevel)),
        experience: Math.max(0, Math.round(statExp)),
        gold: Math.max(0, Math.round(statGold)),
        gems: Math.max(0, Math.round(statGems)),
        rating: Math.max(0, Math.round(statRating)),
        rankTier: Math.max(0, Math.round(statRankTier)),
        rankWins: Math.max(0, Math.round(statRankWins)),
        rankLosses: Math.max(0, Math.round(statRankLosses)),
      };
      await adminClient.put(
        `/player/${encodeURIComponent(activeDetails.playerId)}/stats`,
        payload,
      );
      void recordAuditEvent({
        action: 'PLAYER_FULL_STATS_UPDATED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        beforeState: {
          level: activeDetails.level,
          experience: activeDetails.experience,
          gold: activeDetails.gold,
          gems: activeDetails.gems,
          rating: activeDetails.rating,
        },
        afterState: payload,
      });
      setFeedback({ status: 'success', text: 'Updated player stats and progression.' });
      onStatusMessage(`Updated stats for ${payload.username}.`);
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint PUT /api/player/{playerId}/stats is not implemented yet. Use "Adjust Currencies" for Gold/Gems until Backend adds full stats update.'
            : err?.response?.data?.message || 'Failed to update player stats.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleGrantUnit = async () => {
    if (!activeDetails || !grantUnitUId || !canAdjustTreasury) return;
    const unitDefinitionUId = Number(grantUnitUId);
    setFeedback(null);
    setSavingAction('grantUnit');
    try {
      await adminClient.post(`/player/${encodeURIComponent(activeDetails.playerId)}/units`, {
        unitDefinitionUId,
        grade: Math.max(1, Math.round(grantUnitGrade)),
      });
      void recordAuditEvent({
        action: 'PLAYER_UNIT_GRANTED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        afterState: { unitDefinitionUId, grade: grantUnitGrade },
      });
      setFeedback({ status: 'success', text: `Granted Unit #${unitDefinitionUId} to player.` });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint POST /api/player/{playerId}/units is not implemented yet.'
            : err?.response?.data?.message || 'Failed to grant unit.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveOwnedUnit = async () => {
    if (!activeDetails || !editingUnit || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction(`editUnit-${editingUnit.ownedUnitId}`);
    try {
      await adminClient.patch(
        `/player/${encodeURIComponent(activeDetails.playerId)}/units/${encodeURIComponent(editingUnit.ownedUnitId)}`,
        {
          grade: Math.max(1, Math.round(editUnitGrade)),
          unlockedClassIds: editUnitClasses,
        },
      );
      void recordAuditEvent({
        action: 'PLAYER_UNIT_UPDATED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'OwnedUnit',
        targetId: editingUnit.ownedUnitId,
        targetLabel: activeDetails.username,
        beforeState: { grade: editingUnit.grade, unlockedClassIds: editingUnit.unlockedClassIds },
        afterState: { grade: editUnitGrade, unlockedClassIds: editUnitClasses },
      });
      setEditingUnit(null);
      setFeedback({ status: 'success', text: 'Updated owned unit grade & unlocked classes.' });
      await loadFullDetails(activeDetails);
    } catch (err: any) {
      setFeedback({
        status: 'error',
        text: err?.response?.data?.message || 'Failed to update owned unit.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleRemoveOwnedUnit = async (unit: OwnedUnitRecord) => {
    if (!activeDetails || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction(`delUnit-${unit.ownedUnitId}`);
    try {
      await adminClient.delete(
        `/player/${encodeURIComponent(activeDetails.playerId)}/units/${encodeURIComponent(unit.ownedUnitId)}`,
      );
      void recordAuditEvent({
        action: 'PLAYER_UNIT_REMOVED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'OwnedUnit',
        targetId: unit.ownedUnitId,
        targetLabel: activeDetails.username,
        beforeState: { unitDefinitionUId: unit.unitDefinitionUId, grade: unit.grade },
      });
      setFeedback({ status: 'success', text: `Removed owned unit #${unit.unitDefinitionUId}.` });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      setFeedback({
        status: 'error',
        text: err?.response?.data?.message || 'Failed to remove owned unit.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleGrantWeapon = async () => {
    if (!activeDetails || !grantWeaponId || !canAdjustTreasury) return;
    const weaponDefinitionId = Number(grantWeaponId);
    setFeedback(null);
    setSavingAction('grantWeapon');
    try {
      await adminClient.post(`/player/${encodeURIComponent(activeDetails.playerId)}/weapons`, {
        weaponDefinitionId,
      });
      void recordAuditEvent({
        action: 'PLAYER_WEAPON_GRANTED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        afterState: { weaponDefinitionId },
      });
      setFeedback({ status: 'success', text: `Granted Weapon #${weaponDefinitionId}.` });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint POST /api/player/{playerId}/weapons is not implemented yet.'
            : err?.response?.data?.message || 'Failed to grant weapon.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleRemoveWeapon = async (ownedWeaponId: string) => {
    if (!activeDetails || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction(`delWeapon-${ownedWeaponId}`);
    try {
      await adminClient.delete(
        `/player/${encodeURIComponent(activeDetails.playerId)}/weapons/${encodeURIComponent(ownedWeaponId)}`,
      );
      void recordAuditEvent({
        action: 'PLAYER_WEAPON_REMOVED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'OwnedWeapon',
        targetId: ownedWeaponId,
        targetLabel: activeDetails.username,
      });
      setFeedback({ status: 'success', text: 'Removed owned weapon.' });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      setFeedback({
        status: 'error',
        text: err?.response?.data?.message || 'Failed to remove owned weapon.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleGrantTrinket = async () => {
    if (!activeDetails || !grantTrinketId || !canAdjustTreasury) return;
    const trinketDefinitionId = Number(grantTrinketId);
    setFeedback(null);
    setSavingAction('grantTrinket');
    try {
      await adminClient.post(`/player/${encodeURIComponent(activeDetails.playerId)}/trinkets`, {
        trinketDefinitionId,
      });
      void recordAuditEvent({
        action: 'PLAYER_TRINKET_GRANTED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        afterState: { trinketDefinitionId },
      });
      setFeedback({ status: 'success', text: `Granted Trinket #${trinketDefinitionId}.` });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint POST /api/player/{playerId}/trinkets is not implemented yet.'
            : err?.response?.data?.message || 'Failed to grant trinket.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleRemoveTrinket = async (ownedTrinketId: string) => {
    if (!activeDetails || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction(`delTrinket-${ownedTrinketId}`);
    try {
      await adminClient.delete(
        `/player/${encodeURIComponent(activeDetails.playerId)}/trinkets/${encodeURIComponent(ownedTrinketId)}`,
      );
      void recordAuditEvent({
        action: 'PLAYER_TRINKET_REMOVED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'OwnedTrinket',
        targetId: ownedTrinketId,
        targetLabel: activeDetails.username,
      });
      setFeedback({ status: 'success', text: 'Removed owned trinket.' });
      await loadFullDetails(activeDetails);
      onPlayerUpdated();
    } catch (err: any) {
      setFeedback({
        status: 'error',
        text: err?.response?.data?.message || 'Failed to remove owned trinket.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleSavePity = async () => {
    if (!activeDetails || !pityBannerId || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction('pity');
    try {
      await adminClient.put(`/player/${encodeURIComponent(activeDetails.playerId)}/pity`, {
        bannerId: pityBannerId,
        pullsSinceRare: Math.max(0, Math.round(pityPulls)),
        guaranteedFeatured: pityGuaranteed,
      });
      void recordAuditEvent({
        action: 'PLAYER_GACHA_PITY_UPDATED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'PlayerAccount',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        afterState: { bannerId: pityBannerId, pullsSinceRare: pityPulls, guaranteedFeatured: pityGuaranteed },
      });
      setFeedback({ status: 'success', text: `Updated Gacha pity for banner ${pityBannerId}.` });
      await loadFullDetails(activeDetails);
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint PUT /api/player/{playerId}/pity is not implemented yet.'
            : err?.response?.data?.message || 'Failed to update pity state.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveStoryProgress = async () => {
    if (!activeDetails || !canAdjustTreasury) return;
    setFeedback(null);
    setSavingAction('story');
    try {
      const payload = {
        chapterId: Number(storyChapterInput) || 0,
        sceneId: Number(storySceneInput) || 0,
        isCompleted: storyIsCompleted,
        isChapterCompleted: storyIsChapterCompleted,
      };
      await adminClient.put(
        `/player/${encodeURIComponent(activeDetails.playerId)}/story-progress`,
        payload,
      );
      void recordAuditEvent({
        action: 'PLAYER_STORY_PROGRESS_UPDATED',
        category: 'PLAYER',
        severity: 'HIGH',
        targetType: 'StoryProgress',
        targetId: activeDetails.playerId,
        targetLabel: activeDetails.username,
        afterState: payload,
      });
      setFeedback({
        status: 'success',
        text: `Updated story checkpoint to Chapter ${payload.chapterId}, Scene ${payload.sceneId}.`,
      });
      await loadFullDetails(activeDetails);
    } catch (err: any) {
      const status = err?.response?.status;
      setFeedback({
        status: 'error',
        text:
          status === 404 || status === 405
            ? 'Backend endpoint PUT /api/player/{playerId}/story-progress is not implemented yet.'
            : err?.response?.data?.message || 'Failed to update story progress.',
      });
    } finally {
      setSavingAction(null);
    }
  };

  const ownedUnits = details?.ownedUnits ?? [];
  const ownedWeapons = details?.ownedWeapons ?? [];
  const ownedTrinkets = details?.ownedTrinkets ?? [];
  const pityEntries = Object.entries(details?.gachaPityByBanner ?? {});
  const storyRecords = useMemo(() => {
    const raw = details?.storyProgress ?? fallbackStoryProgress ?? [];
    return [...raw].sort((a, b) => a.chapterId - b.chapterId);
  }, [details?.storyProgress, fallbackStoryProgress]);
  const latestStoryRecord =
    storyRecords.length > 0 ? storyRecords[storyRecords.length - 1] : null;
  const storyMatches = useMemo(
    () => playerMatches.filter((m) => String(m.mode || '').toLowerCase() === 'story'),
    [playerMatches],
  );
  const pvpMatchesCount = playerMatches.length - storyMatches.length;
  const teamLoadoutUIds = details?.teamLoadoutUIds ?? [];
  const rewardProgressList = details?.rewardProgress ?? [];

  return (
    <Dialog
      isOpen={player !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="info"
      width={820}
      maxHeight="88dvh"
      padding={5}
    >
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="shrink-0">
          <DialogHeader
            title={activeDetails?.username || 'Player Profile'}
            subtitle="Unified Player Dossier, Stats, Inventory & Activity Management"
            startContent={<Icon icon={Eye} size="md" color="accent" />}
            endContent={
              activeDetails ? (
                <IconButton
                  label="Refresh player dossier"
                  tooltip="Reload Details"
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={RefreshCw} className={loadingDetails ? 'animate-spin' : ''} />}
                  onClick={() => void loadFullDetails(activeDetails)}
                />
              ) : undefined
            }
            onOpenChange={(open) => {
              if (!open) onClose();
            }}
          />
        </div>

        {activeDetails && (
          <>
            <div className="shrink-0">
              <TabList
                value={activeTab}
                onChange={(val) => setActiveTab(val as InspectorTab)}
                role="tablist"
              >
                <Tab value="overview" label="Overview" icon={<Icon icon={Eye} />} />
                <Tab
                  value="story"
                  label="Story & Progress"
                  icon={<Icon icon={BookOpen} />}
                  endContent={
                    latestStoryRecord ? (
                      <Badge
                        label={`C${latestStoryRecord.chapterId}·S${latestStoryRecord.sceneId}`}
                        variant="yellow"
                      />
                    ) : storyMatches.length > 0 ? (
                      <Badge label={`${storyMatches.length} Battles`} variant="info" />
                    ) : undefined
                  }
                />
                <Tab value="stats" label="Stats & Economy" icon={<Icon icon={Trophy} />} />
                <Tab
                  value="content"
                  label="Units & Gear"
                  icon={<Icon icon={Sword} />}
                  endContent={
                    <Badge
                      label={
                        details?.ownedUnits
                          ? ownedUnits.length + ownedWeapons.length + ownedTrinkets.length
                          : (details?.ownedUnitsCount ?? 0) +
                            (details?.ownedWeaponsCount ?? 0) +
                            (details?.ownedTrinketsCount ?? 0)
                      }
                      variant="info"
                    />
                  }
                />
                <Tab value="pity" label="Gacha Pity" icon={<Icon icon={Sparkles} />} />
              </TabList>
            </div>

            {/* Flex-constrained scrollable body so any viewport height scrolls cleanly */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {feedback && (
                <Banner
                  status={feedback.status}
                  title={feedback.status === 'success' ? 'Update Complete' : 'Operation Notice'}
                  description={feedback.text}
                  isDismissable
                  onDismiss={() => setFeedback(null)}
                />
              )}

              {detailsEndpointMissing && activeTab !== 'overview' && (
                <Banner
                  status="warning"
                  title="Extended Backend Player Details Endpoint Pending"
                  description="GET /api/player/details/{playerId} is not yet active on the running backend, so per-item inventory lists cannot be loaded until Backend is updated."
                />
              )}

              {activeTab === 'overview' && (
                <VStack gap={3}>
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <Badge
                          label={getPresenceDisplayLabel(
                            activeDetails.presence || 'Offline',
                            activeDetails.isBanned,
                          )}
                          variant={getPresenceBadgeVariant(
                            activeDetails.presence || 'Offline',
                            activeDetails.isBanned,
                          )}
                        />
                        <Badge
                          label={activeDetails.isBanned ? 'BANNED SANCTION' : 'STANDING: NORMAL'}
                          variant={activeDetails.isBanned ? 'red' : 'green'}
                        />
                      </HStack>

                      {activeDetails.isBanned && activeDetails.banReason && (
                        <Banner
                          status="error"
                          title="Active Ban Rationale"
                          description={activeDetails.banReason}
                        />
                      )}

                      <Divider />

                      <HStack justify="between" vAlign="center" gap={2}>
                        <Text type="label" size="xsm" color="secondary">
                          FULL PLAYER ID
                        </Text>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Icon icon={Copy} />}
                          label="Copy ID"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeDetails.playerId);
                            onStatusMessage(`Copied Player ID for ${activeDetails.username}`);
                          }}
                        />
                      </HStack>
                      <Text type="code" size="xsm" className="break-all">
                        {activeDetails.playerId}
                      </Text>

                      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                        <HStack gap={1} vAlign="center">
                          <Icon icon={Clock} size="xsm" color="secondary" />
                          <Text type="label" size="xsm" color="secondary">
                            LAST LOGIN / TELEMETRY
                          </Text>
                        </HStack>
                        <Text type="code" size="xsm" color="secondary">
                          {activeDetails.lastLogin || activeDetails.presenceDetails || 'Unavailable'}
                        </Text>
                      </HStack>
                    </VStack>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card variant="muted" padding={3}>
                      <VStack gap={1}>
                        <Text type="label" size="xsm" color="secondary">
                          PROGRESSION
                        </Text>
                        <Text type="display-3" weight="bold" hasTabularNumbers>
                          Level {activeDetails.level}
                        </Text>
                        <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                          {(activeDetails.experience ?? 0).toLocaleString()} EXP
                        </Text>
                      </VStack>
                    </Card>

                    <Card variant="muted" padding={3}>
                      <VStack gap={1}>
                        <Text type="label" size="xsm" color="secondary">
                          TREASURY BALANCES
                        </Text>
                        <HStack gap={3} vAlign="center" wrap="wrap">
                          <HStack gap={1} vAlign="center">
                            <Icon icon={Coins} size="sm" color="warning" />
                            <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
                              {(activeDetails.gold ?? 0).toLocaleString()}
                            </Text>
                          </HStack>
                          <HStack gap={1} vAlign="center">
                            <Icon icon={Gem} size="sm" color="accent" />
                            <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
                              {(activeDetails.gems ?? 0).toLocaleString()}
                            </Text>
                          </HStack>
                        </HStack>
                      </VStack>
                    </Card>

                    <Card variant="muted" padding={3}>
                      <VStack gap={1}>
                        <Text type="label" size="xsm" color="secondary">
                          RANKED &amp; INVENTORY
                        </Text>
                        <Text type="code" size="sm" weight="semibold" hasTabularNumbers>
                          Rating {details?.rating ?? 0} (Tier {details?.rankTier ?? 0})
                        </Text>
                        <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
                          W {details?.rankWins ?? 0} / L {details?.rankLosses ?? 0} •{' '}
                          {details?.ownedUnits?.length ?? details?.ownedUnitsCount ?? 0}U /{' '}
                          {details?.ownedWeapons?.length ?? details?.ownedWeaponsCount ?? 0}W /{' '}
                          {details?.ownedTrinkets?.length ?? details?.ownedTrinketsCount ?? 0}T
                        </Text>
                      </VStack>
                    </Card>
                  </div>

                  <Card variant="muted" padding={3}>
                    <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                      <VStack gap={0.5}>
                        <Text type="label" size="xsm" color="secondary">
                          STORY &amp; MODE PROGRESSION SUMMARY
                        </Text>
                        <Text size="sm" weight="semibold">
                          {latestStoryRecord
                            ? `Chapter ${latestStoryRecord.chapterId}${chapterMap.get(latestStoryRecord.chapterId)?.title ? `: ${chapterMap.get(latestStoryRecord.chapterId)!.title}` : ''} — Scene ${latestStoryRecord.sceneId} (${latestStoryRecord.isChapterCompleted ? 'Chapter Completed' : latestStoryRecord.isCompleted ? 'Scene Done' : 'In Progress'})`
                            : detailsEndpointMissing
                              ? `Story Battles Recorded: ${storyMatches.length} • PvP/Other Matches: ${pvpMatchesCount}`
                              : 'No Story progress record yet (New / Pre-Chapter 0)'}
                        </Text>
                      </VStack>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Icon icon={BookOpen} />}
                        label="View Story & Progress"
                        onClick={() => setActiveTab('story')}
                      />
                    </HStack>
                  </Card>

                  {activeDetails.activeMatch?.matchId && (
                    <Card variant="muted" padding={3}>
                      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                        <VStack gap={0.5}>
                          <Text type="label" size="xsm" color="secondary">
                            ACTIVE / RECENT MATCH ID
                          </Text>
                          <Text type="code" size="xsm">
                            {activeDetails.activeMatch.matchId}
                          </Text>
                        </VStack>
                        {canInspectLogs && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Icon icon={Terminal} />}
                            label="Inspect Match Log"
                            onClick={() => {
                              const targetId = activeDetails.activeMatch?.matchId;
                              onClose();
                              if (targetId) {
                                navigate(`/matches?matchId=${encodeURIComponent(targetId)}`);
                              }
                            }}
                          />
                        )}
                      </HStack>
                    </Card>
                  )}

                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <HStack gap={1.5} vAlign="center">
                          <Icon icon={Swords} size="sm" color="accent" />
                          <Text type="label" size="xsm" color="secondary">
                            RECENT MATCH ACTIVITY
                          </Text>
                        </HStack>
                        <Badge
                          label={loadingMatches ? 'Loading...' : `${playerMatches.length} Recorded`}
                          variant="info"
                        />
                      </HStack>

                      {loadingMatches ? (
                        <Text type="supporting" size="xsm">
                          Querying /api/Match/history...
                        </Text>
                      ) : playerMatches.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          No recorded PvP/Story matches found for this player.
                        </Text>
                      ) : (
                        <VStack gap={1.5}>
                          {playerMatches.slice(0, 8).map((m, idx) => {
                            const mId = m.matchId || m.id || `match-${idx}`;
                            const opponentId =
                              m.player1Id === activeDetails.playerId ? m.player2Id : m.player1Id;
                            const opponentLabel = !opponentId
                              ? 'Unknown'
                              : isAiOrVirtualPlayerId(opponentId)
                                ? 'AI Opponent'
                                : `#${opponentId.slice(-6).toUpperCase()}`;
                            const statusStr = String(m.status || 'Completed');
                            const isWinner =
                              Boolean(m.winnerPlayerId) &&
                              m.winnerPlayerId === activeDetails.playerId;
                            const hasWinner = Boolean(m.winnerPlayerId);

                            return (
                              <HStack
                                key={mId}
                                justify="between"
                                vAlign="center"
                                wrap="wrap"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                              >
                                <HStack gap={2} vAlign="center" wrap="wrap">
                                  <Badge
                                    label={String(m.mode || 'PVP').toUpperCase()}
                                    variant="yellow"
                                  />
                                  <Text type="code" size="xsm">
                                    #{mId.slice(0, 8)}
                                  </Text>
                                  <Text type="supporting" size="xsm">
                                    vs {opponentLabel}
                                  </Text>
                                </HStack>
                                <HStack gap={1.5} vAlign="center">
                                  {hasWinner ? (
                                    <Badge
                                      label={isWinner ? 'WIN' : 'LOSS'}
                                      variant={isWinner ? 'success' : 'neutral'}
                                    />
                                  ) : (
                                    <Badge label={statusStr} variant="info" />
                                  )}
                                  {canInspectLogs && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      label="Log"
                                      onClick={() => {
                                        onClose();
                                        navigate(`/matches?matchId=${encodeURIComponent(mId)}`);
                                      }}
                                    />
                                  )}
                                </HStack>
                              </HStack>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  </Card>
                </VStack>
              )}

              {activeTab === 'story' && (
                <VStack gap={3}>
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <HStack gap={1.5} vAlign="center">
                          <Icon icon={BookOpen} size="sm" color="accent" />
                          <Text type="label" size="xsm" color="secondary">
                            STORY CAMPAIGN CHECKPOINT
                          </Text>
                        </HStack>
                        <HStack gap={1.5} vAlign="center">
                          <Badge
                            label={`${storyMatches.length} Story Battles`}
                            variant="info"
                          />
                          <Badge
                            label={`${pvpMatchesCount} PvP / Other`}
                            variant="neutral"
                          />
                        </HStack>
                      </HStack>

                      {storyRecords.length === 0 ? (
                        <Banner
                          status={detailsEndpointMissing ? 'warning' : 'info'}
                          title={
                            detailsEndpointMissing
                              ? 'Detailed Scene Checkpoint Requires Extended Backend Endpoint'
                              : 'No Story Progress Document Found'
                          }
                          description={
                            detailsEndpointMissing
                              ? 'Expose storyProgress inside GET /api/player/details/{playerId} or add GET /api/Story/admin/player/{playerId} on Backend to inspect exact Chapter/Scene checkpoints. Below shows all Story battles from Match History and the game chapter catalog.'
                              : 'This player has not started any Story chapters yet.'
                          }
                        />
                      ) : (
                        <VStack gap={2}>
                          {storyRecords.map((rec) => {
                            const cfg = chapterMap.get(rec.chapterId);
                            const totalScenes = cfg?.scenes?.length ?? 0;
                            const currentSceneCfg = cfg?.scenes?.find(
                              (s) => s.sceneId === rec.sceneId,
                            );

                            return (
                              <Card key={rec.chapterId} variant="default" padding={3}>
                                <VStack gap={1.5}>
                                  <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                                    <HStack gap={2} vAlign="center" wrap="wrap">
                                      <Badge label={`Chapter ${rec.chapterId}`} variant="yellow" />
                                      <Text weight="semibold" size="sm">
                                        {cfg?.title || `Chapter ${rec.chapterId}`}
                                      </Text>
                                    </HStack>
                                    <Badge
                                      label={
                                        rec.isChapterCompleted
                                          ? 'CHAPTER COMPLETED'
                                          : rec.isCompleted
                                            ? `SCENE ${rec.sceneId} DONE`
                                            : `AT SCENE ${rec.sceneId}`
                                      }
                                      variant={
                                        rec.isChapterCompleted
                                          ? 'success'
                                          : rec.isCompleted
                                            ? 'info'
                                            : 'warning'
                                      }
                                      icon={
                                        rec.isChapterCompleted ? (
                                          <Icon icon={CheckCircle2} />
                                        ) : undefined
                                      }
                                    />
                                  </HStack>

                                  <Text type="code" size="xsm" color="secondary">
                                    Scene {rec.sceneId}
                                    {totalScenes > 0 ? ` / ${totalScenes - 1}` : ''}
                                    {currentSceneCfg
                                      ? ` • ${currentSceneCfg.type}${currentSceneCfg.mapId ? ` (${currentSceneCfg.mapId})` : ''}`
                                      : ''}
                                    {rec.updatedAt
                                      ? ` • Updated: ${new Date(rec.updatedAt).toLocaleString()}`
                                      : ''}
                                  </Text>

                                  {currentSceneCfg?.description && (
                                    <Text type="supporting" size="xsm">
                                      {currentSceneCfg.description}
                                    </Text>
                                  )}
                                </VStack>
                              </Card>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  </Card>

                  {/* Story Chapter Map Reference */}
                  {chapterConfigs.length > 0 && (
                    <Card variant="muted" padding={3}>
                      <VStack gap={2}>
                        <Text type="label" size="xsm" color="secondary">
                          CAMPAIGN CHAPTER MAP ({chapterConfigs.length} CHAPTERS)
                        </Text>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {chapterConfigs.map((ch) => {
                            const rec = storyRecords.find((r) => r.chapterId === ch.chapterId);
                            const isAhead =
                              latestStoryRecord && ch.chapterId < latestStoryRecord.chapterId;
                            const isDone = Boolean(rec?.isChapterCompleted || isAhead);
                            const isCurrent = Boolean(rec && !isDone);

                            return (
                              <HStack
                                key={ch.chapterId}
                                justify="between"
                                vAlign="center"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-2"
                              >
                                <VStack gap={0}>
                                  <Text size="sm" weight="semibold">
                                    Ch.{ch.chapterId}: {ch.title}
                                  </Text>
                                  <Text type="code" size="xsm" color="secondary">
                                    {ch.scenes?.length ?? 0} scenes • {ch.mapId || 'Story'}
                                  </Text>
                                </VStack>
                                <Badge
                                  label={
                                    isDone
                                      ? 'Cleared'
                                      : isCurrent
                                        ? `Scene ${rec?.sceneId ?? 0}`
                                        : 'Locked'
                                  }
                                  variant={isDone ? 'success' : isCurrent ? 'yellow' : 'neutral'}
                                />
                              </HStack>
                            );
                          })}
                        </div>
                      </VStack>
                    </Card>
                  )}

                  {/* Active Team Loadout */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <Text type="label" size="xsm" color="secondary">
                        ACTIVE TEAM LOADOUT ({teamLoadoutUIds.length} UNITS)
                      </Text>
                      {teamLoadoutUIds.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          {detailsEndpointMissing
                            ? 'Team loadout details require GET /api/player/details/{playerId}.'
                            : 'No units assigned to active team loadout.'}
                        </Text>
                      ) : (
                        <HStack gap={1.5} wrap="wrap">
                          {teamLoadoutUIds.map((uId) => {
                            const def = unitMap.get(uId);
                            return (
                              <Badge
                                key={uId}
                                label={`${def?.unitName || def?.name || 'Unit'} (#${uId})`}
                                variant="purple"
                              />
                            );
                          })}
                        </HStack>
                      )}
                    </VStack>
                  </Card>

                  {/* Quest / Reward Progress */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <Text type="label" size="xsm" color="secondary">
                        QUEST &amp; REWARD PROGRESS ({rewardProgressList.length})
                      </Text>
                      {rewardProgressList.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          {detailsEndpointMissing
                            ? 'Quest progression requires GET /api/player/details/{playerId}.'
                            : 'No quest/reward progress records yet.'}
                        </Text>
                      ) : (
                        <VStack gap={1.5}>
                          {rewardProgressList.map((rp) => {
                            const rule = rewardRuleMap.get(rp.ruleId);
                            const label = rp.ruleTitle || rule?.title || rule?.name || rp.ruleId;
                            return (
                              <HStack
                                key={rp.id || rp.ruleId}
                                justify="between"
                                vAlign="center"
                                wrap="wrap"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                              >
                                <VStack gap={0}>
                                  <Text size="sm" weight="medium">
                                    {label}
                                  </Text>
                                  <Text type="code" size="xsm" color="secondary">
                                    Progress: {rp.currentCount}
                                    {rp.targetCount ?? rule?.targetCount
                                      ? ` / ${rp.targetCount ?? rule?.targetCount}`
                                      : ''}
                                  </Text>
                                </VStack>
                                <HStack gap={1.5}>
                                  <Badge
                                    label={rp.isCompleted ? 'Completed' : 'In Progress'}
                                    variant={rp.isCompleted ? 'success' : 'info'}
                                  />
                                  {rp.isReceived && <Badge label="Claimed" variant="yellow" />}
                                </HStack>
                              </HStack>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  </Card>

                  {/* Story Battle History */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <Text type="label" size="xsm" color="secondary">
                        STORY BATTLE SESSIONS ({storyMatches.length})
                      </Text>
                      {storyMatches.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          No Story battle sessions recorded in /api/Match/history.
                        </Text>
                      ) : (
                        <VStack gap={1.5}>
                          {storyMatches.slice(0, 10).map((m, idx) => {
                            const mId = m.matchId || m.id || `story-${idx}`;
                            return (
                              <HStack
                                key={mId}
                                justify="between"
                                vAlign="center"
                                wrap="wrap"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                              >
                                <HStack gap={2} vAlign="center">
                                  <Badge label="STORY" variant="yellow" />
                                  <Text type="code" size="xsm">
                                    #{mId.slice(0, 8)}
                                  </Text>
                                </HStack>
                                <HStack gap={1.5} vAlign="center">
                                  <Badge label={String(m.status || 'Completed')} variant="info" />
                                  {canInspectLogs && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      label="Log"
                                      onClick={() => {
                                        onClose();
                                        navigate(`/matches?matchId=${encodeURIComponent(mId)}`);
                                      }}
                                    />
                                  )}
                                </HStack>
                              </HStack>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  </Card>

                  {/* Admin Story Checkpoint Editor */}
                  {canAdjustTreasury && (
                    <Card variant="muted" padding={3}>
                      <VStack gap={3}>
                        <Text type="label" size="xsm" color="secondary">
                          SET / UNLOCK STORY CHECKPOINT
                        </Text>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Selector
                            label="Chapter"
                            options={
                              chapterSelectOptions.length > 0
                                ? chapterSelectOptions
                                : [{ value: '0', label: 'Chapter 0' }]
                            }
                            value={storyChapterInput}
                            onChange={(val) => {
                              setStoryChapterInput(val || '0');
                              setStorySceneInput('0');
                            }}
                            width="100%"
                          />
                          <Selector
                            label="Scene"
                            options={sceneSelectOptions}
                            value={storySceneInput}
                            onChange={(val) => setStorySceneInput(val || '0')}
                            width="100%"
                          />
                        </div>
                        <HStack gap={3} wrap="wrap">
                          <CheckboxInput
                            label="Scene Completed"
                            value={storyIsCompleted}
                            onChange={setStoryIsCompleted}
                          />
                          <CheckboxInput
                            label="Chapter Completed"
                            value={storyIsChapterCompleted}
                            onChange={setStoryIsChapterCompleted}
                          />
                        </HStack>
                        <HStack justify="end">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Icon icon={Save} />}
                            label="Update Story Progress"
                            isLoading={savingAction === 'story'}
                            isDisabled={savingAction !== null}
                            onClick={() => void handleSaveStoryProgress()}
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  )}
                </VStack>
              )}

              {activeTab === 'stats' && (
                <VStack gap={3}>
                  {!canAdjustTreasury && (
                    <Banner
                      status="info"
                      title="Read-Only Inspection"
                      description="Editing player progression, currencies, and ranked stats requires Administrator / treasury.adjust privilege."
                    />
                  )}

                  <Card variant="muted" padding={3}>
                    <VStack gap={3}>
                      <TextInput
                        label="Display Username"
                        value={statUsername}
                        onChange={setStatUsername}
                        isDisabled={!canAdjustTreasury}
                        width="100%"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <NumberInput
                          label="Level"
                          value={statLevel}
                          onChange={setStatLevel}
                          min={1}
                          step={1}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Experience (EXP)"
                          value={statExp}
                          onChange={setStatExp}
                          min={0}
                          step={100}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Gold Balance"
                          value={statGold}
                          onChange={setStatGold}
                          min={0}
                          step={500}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Astral Gems Balance"
                          value={statGems}
                          onChange={setStatGems}
                          min={0}
                          step={60}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Ranked Rating (MMR)"
                          value={statRating}
                          onChange={setStatRating}
                          min={0}
                          step={25}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Rank Tier"
                          value={statRankTier}
                          onChange={setStatRankTier}
                          min={0}
                          step={1}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Ranked Wins"
                          value={statRankWins}
                          onChange={setStatRankWins}
                          min={0}
                          step={1}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                        <NumberInput
                          label="Ranked Losses"
                          value={statRankLosses}
                          onChange={setStatRankLosses}
                          min={0}
                          step={1}
                          isIntegerOnly
                          hasNumberSteppers
                          isDisabled={!canAdjustTreasury}
                          width="100%"
                        />
                      </div>

                      {canAdjustTreasury && (
                        <HStack justify="end">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Icon icon={Save} />}
                            label="Save All Player Stats"
                            isLoading={savingAction === 'stats'}
                            isDisabled={savingAction !== null}
                            onClick={() => void handleSaveFullStats()}
                          />
                        </HStack>
                      )}
                    </VStack>
                  </Card>
                </VStack>
              )}

              {activeTab === 'content' && (
                <VStack gap={3}>
                  {/* Owned Units */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <Text type="label" size="xsm" color="secondary">
                          OWNED UNITS ({ownedUnits.length || details?.ownedUnitsCount || 0})
                        </Text>
                        {canAdjustTreasury && unitOptions.length > 0 && (
                          <HStack gap={1.5} vAlign="center" wrap="wrap">
                            <div className="w-52">
                              <Selector
                                label="Grant Unit"
                                isLabelHidden
                                size="sm"
                                placeholder="Select Unit..."
                                options={unitOptions}
                                value={grantUnitUId}
                                onChange={(val) => setGrantUnitUId(val || '')}
                              />
                            </div>
                            <div className="w-24">
                              <NumberInput
                                label="Grade"
                                isLabelHidden
                                size="sm"
                                value={grantUnitGrade}
                                onChange={setGrantUnitGrade}
                                min={1}
                                max={6}
                                isIntegerOnly
                              />
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Icon icon={Plus} />}
                              label="Grant Unit"
                              isDisabled={!grantUnitUId || savingAction !== null}
                              isLoading={savingAction === 'grantUnit'}
                              onClick={() => void handleGrantUnit()}
                            />
                          </HStack>
                        )}
                      </HStack>

                      {ownedUnits.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          {detailsEndpointMissing
                            ? `Summary count: ${details?.ownedUnitsCount ?? 0} units.`
                            : 'No owned units recorded.'}
                        </Text>
                      ) : (
                        <VStack gap={2}>
                          {ownedUnits.map((unit) => {
                            const def = unitMap.get(unit.unitDefinitionUId);
                            const isEditingThis = editingUnit?.ownedUnitId === unit.ownedUnitId;

                            return (
                              <Card key={unit.ownedUnitId} variant="default" padding={3}>
                                <VStack gap={2}>
                                  <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                                    <VStack gap={0.5}>
                                      <HStack gap={1.5} vAlign="center" wrap="wrap">
                                        <Text weight="semibold" size="sm">
                                          {def?.unitName || def?.name || `Unit #${unit.unitDefinitionUId}`}
                                        </Text>
                                        <Badge label={`uId #${unit.unitDefinitionUId}`} variant="info" />
                                        <Badge label={`Grade ${unit.grade}`} variant="yellow" />
                                      </HStack>
                                      <Text type="code" size="xsm" color="secondary">
                                        Classes:{' '}
                                        {unit.unlockedClassIds.length > 0
                                          ? unit.unlockedClassIds
                                              .map((cid) => classMap.get(cid)?.name || `#${cid}`)
                                              .join(', ')
                                          : 'None'}{' '}
                                        • Move #{unit.equippedMovementSkillId} • Skill #{unit.equippedClassSkillId}
                                      </Text>
                                    </VStack>

                                    {canAdjustTreasury && (
                                      <HStack gap={1.5}>
                                        <IconButton
                                          label="Edit unit grade & classes"
                                          tooltip="Edit Grade / Classes"
                                          variant="secondary"
                                          size="sm"
                                          icon={<Icon icon={Edit3} />}
                                          onClick={() => {
                                            if (isEditingThis) {
                                              setEditingUnit(null);
                                            } else {
                                              setEditingUnit(unit);
                                              setEditUnitGrade(unit.grade);
                                              setEditUnitClasses(unit.unlockedClassIds || []);
                                            }
                                          }}
                                        />
                                        <IconButton
                                          label="Remove unit from player"
                                          tooltip="Remove Unit"
                                          variant="ghost"
                                          size="sm"
                                          icon={<Icon icon={Trash2} color="error" />}
                                          isDisabled={savingAction !== null}
                                          onClick={() => void handleRemoveOwnedUnit(unit)}
                                        />
                                      </HStack>
                                    )}
                                  </HStack>

                                  {isEditingThis && (
                                    <VStack
                                      gap={2}
                                      className="pt-2 border-t border-[var(--color-border-subtle)]"
                                    >
                                      <NumberInput
                                        label="Unit Grade"
                                        size="sm"
                                        value={editUnitGrade}
                                        onChange={setEditUnitGrade}
                                        min={1}
                                        max={6}
                                        isIntegerOnly
                                        hasNumberSteppers
                                        width={160}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {classDefs.map((c) => (
                                          <CheckboxInput
                                            key={c.classId}
                                            label={`${c.name || c.className || 'Class'} (#${c.classId})`}
                                            value={editUnitClasses.includes(c.classId)}
                                            onChange={(checked) =>
                                              setEditUnitClasses((prev) =>
                                                checked
                                                  ? Array.from(new Set([...prev, c.classId]))
                                                  : prev.filter((id) => id !== c.classId),
                                              )
                                            }
                                          />
                                        ))}
                                      </div>
                                      <HStack gap={2} justify="end">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          label="Cancel"
                                          onClick={() => setEditingUnit(null)}
                                        />
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          label="Save Unit"
                                          isLoading={savingAction === `editUnit-${unit.ownedUnitId}`}
                                          onClick={() => void handleSaveOwnedUnit()}
                                        />
                                      </HStack>
                                    </VStack>
                                  )}
                                </VStack>
                              </Card>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  </Card>

                  {/* Owned Weapons */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <Text type="label" size="xsm" color="secondary">
                          OWNED WEAPONS ({ownedWeapons.length || details?.ownedWeaponsCount || 0})
                        </Text>
                        {canAdjustTreasury && weaponOptions.length > 0 && (
                          <HStack gap={1.5} vAlign="center" wrap="wrap">
                            <div className="w-56">
                              <Selector
                                label="Grant Weapon"
                                isLabelHidden
                                size="sm"
                                placeholder="Select Weapon..."
                                options={weaponOptions}
                                value={grantWeaponId}
                                onChange={(val) => setGrantWeaponId(val || '')}
                              />
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Icon icon={Plus} />}
                              label="Grant Weapon"
                              isDisabled={!grantWeaponId || savingAction !== null}
                              isLoading={savingAction === 'grantWeapon'}
                              onClick={() => void handleGrantWeapon()}
                            />
                          </HStack>
                        )}
                      </HStack>

                      {ownedWeapons.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          {detailsEndpointMissing
                            ? `Summary count: ${details?.ownedWeaponsCount ?? 0} weapons.`
                            : 'No owned weapons recorded.'}
                        </Text>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ownedWeapons.map((w) => {
                            const def = weaponMap.get(w.weaponDefinitionId);
                            return (
                              <HStack
                                key={w.ownedWeaponId}
                                justify="between"
                                vAlign="center"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                              >
                                <VStack gap={0}>
                                  <Text size="sm" weight="medium">
                                    {def?.name || `Weapon #${w.weaponDefinitionId}`}
                                  </Text>
                                  <Text type="code" size="xsm" color="secondary">
                                    Def #{w.weaponDefinitionId} • {w.ownedWeaponId.slice(-6)}
                                  </Text>
                                </VStack>
                                {canAdjustTreasury && (
                                  <IconButton
                                    label="Remove weapon"
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon icon={Trash2} color="error" />}
                                    isDisabled={savingAction !== null}
                                    onClick={() => void handleRemoveWeapon(w.ownedWeaponId)}
                                  />
                                )}
                              </HStack>
                            );
                          })}
                        </div>
                      )}
                    </VStack>
                  </Card>

                  {/* Owned Trinkets */}
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                        <Text type="label" size="xsm" color="secondary">
                          OWNED TRINKETS ({ownedTrinkets.length || details?.ownedTrinketsCount || 0})
                        </Text>
                        {canAdjustTreasury && trinketOptions.length > 0 && (
                          <HStack gap={1.5} vAlign="center" wrap="wrap">
                            <div className="w-56">
                              <Selector
                                label="Grant Trinket"
                                isLabelHidden
                                size="sm"
                                placeholder="Select Trinket..."
                                options={trinketOptions}
                                value={grantTrinketId}
                                onChange={(val) => setGrantTrinketId(val || '')}
                              />
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Icon icon={Plus} />}
                              label="Grant Trinket"
                              isDisabled={!grantTrinketId || savingAction !== null}
                              isLoading={savingAction === 'grantTrinket'}
                              onClick={() => void handleGrantTrinket()}
                            />
                          </HStack>
                        )}
                      </HStack>

                      {ownedTrinkets.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          {detailsEndpointMissing
                            ? `Summary count: ${details?.ownedTrinketsCount ?? 0} trinkets.`
                            : 'No owned trinkets recorded.'}
                        </Text>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ownedTrinkets.map((t) => {
                            const def = trinketMap.get(t.trinketDefinitionId);
                            return (
                              <HStack
                                key={t.ownedTrinketId}
                                justify="between"
                                vAlign="center"
                                gap={2}
                                className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                              >
                                <VStack gap={0}>
                                  <Text size="sm" weight="medium">
                                    {def?.name || `Trinket #${t.trinketDefinitionId}`}
                                  </Text>
                                  <Text type="code" size="xsm" color="secondary">
                                    Def #{t.trinketDefinitionId} • {t.ownedTrinketId.slice(-6)}
                                  </Text>
                                </VStack>
                                {canAdjustTreasury && (
                                  <IconButton
                                    label="Remove trinket"
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon icon={Trash2} color="error" />}
                                    isDisabled={savingAction !== null}
                                    onClick={() => void handleRemoveTrinket(t.ownedTrinketId)}
                                  />
                                )}
                              </HStack>
                            );
                          })}
                        </div>
                      )}
                    </VStack>
                  </Card>
                </VStack>
              )}

              {activeTab === 'pity' && (
                <VStack gap={3}>
                  <Card variant="muted" padding={3}>
                    <VStack gap={2}>
                      <Text type="label" size="xsm" color="secondary">
                        RECORDED GACHA PITY COUNTERS ({pityEntries.length})
                      </Text>
                      {pityEntries.length === 0 ? (
                        <Text type="supporting" size="xsm">
                          No banner pity records recorded for this player yet.
                        </Text>
                      ) : (
                        <VStack gap={1.5}>
                          {pityEntries.map(([bannerId, state]) => (
                            <HStack
                              key={bannerId}
                              justify="between"
                              vAlign="center"
                              wrap="wrap"
                              gap={2}
                              className="rounded-md border border-[var(--color-border-subtle)] px-2.5 py-1.5"
                            >
                              <VStack gap={0}>
                                <Text size="sm" weight="semibold">
                                  {bannerMap.get(bannerId)?.title || bannerId}
                                </Text>
                                <Text type="code" size="xsm" color="secondary">
                                  Banner ID: {bannerId}
                                </Text>
                              </VStack>
                              <HStack gap={2} vAlign="center">
                                <Badge label={`${state.pullsSinceRare} Pulls`} variant="info" />
                                <Badge
                                  label={state.guaranteedFeatured ? '50/50 Guaranteed' : '50/50 Active'}
                                  variant={state.guaranteedFeatured ? 'yellow' : 'neutral'}
                                />
                                {canAdjustTreasury && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    label="Edit"
                                    onClick={() => {
                                      setPityBannerId(bannerId);
                                      setPityPulls(state.pullsSinceRare);
                                      setPityGuaranteed(Boolean(state.guaranteedFeatured));
                                    }}
                                  />
                                )}
                              </HStack>
                            </HStack>
                          ))}
                        </VStack>
                      )}
                    </VStack>
                  </Card>

                  {canAdjustTreasury && (
                    <Card variant="muted" padding={3}>
                      <VStack gap={3}>
                        <Text type="label" size="xsm" color="secondary">
                          MODIFY / RESET BANNER PITY
                        </Text>
                        <Selector
                          label="Target Banner"
                          placeholder="Select Banner..."
                          options={bannerOptions}
                          value={pityBannerId}
                          onChange={(val) => {
                            const id = val || '';
                            setPityBannerId(id);
                            const existing = details?.gachaPityByBanner?.[id];
                            if (existing) {
                              setPityPulls(existing.pullsSinceRare);
                              setPityGuaranteed(Boolean(existing.guaranteedFeatured));
                            }
                          }}
                          width="100%"
                        />
                        <HStack gap={3} vAlign="end" wrap="wrap">
                          <NumberInput
                            label="Pulls Since Rare"
                            value={pityPulls}
                            onChange={setPityPulls}
                            min={0}
                            step={1}
                            isIntegerOnly
                            hasNumberSteppers
                            width={180}
                          />
                          <CheckboxInput
                            label="Guaranteed Featured Next (50/50 Lost)"
                            value={pityGuaranteed}
                            onChange={setPityGuaranteed}
                          />
                        </HStack>
                        <HStack justify="end">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Icon icon={Shield} />}
                            label="Save Pity State"
                            isDisabled={!pityBannerId || savingAction !== null}
                            isLoading={savingAction === 'pity'}
                            onClick={() => void handleSavePity()}
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  )}
                </VStack>
              )}
            </VStack>
            </div>

            <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack gap={2} wrap="wrap">
                  {canSendNotification && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={Bell} />}
                      label="Warn / Notify"
                      onClick={() => {
                        onClose();
                        onOpenNotify(activeDetails);
                      }}
                    />
                  )}
                  {canAdjustTreasury && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={Edit3} />}
                      label="Adjust Currencies"
                      onClick={() => {
                        onClose();
                        onOpenAdjustCurrencies(activeDetails);
                      }}
                    />
                  )}
                  {canBanPlayers && (
                    <Button
                      variant={activeDetails.isBanned ? 'secondary' : 'destructive'}
                      size="sm"
                      icon={<Icon icon={activeDetails.isBanned ? UserCheck : UserX} />}
                      label={activeDetails.isBanned ? 'Unban' : 'Ban'}
                      onClick={() => {
                        onClose();
                        onOpenBanToggle(activeDetails);
                      }}
                    />
                  )}
                </HStack>
                <Button variant="primary" size="sm" label="Close" onClick={onClose} />
              </HStack>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
