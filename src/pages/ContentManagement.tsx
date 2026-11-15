import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { IconButton } from '@astryxdesign/core/IconButton';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import {
  BookOpen,
  Edit2,
  Gem,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  Zap,
} from 'lucide-react';
import { adminClient } from '../api/adminClient';
import { ConsolePage } from '../components/ConsolePage';
import { SensitiveActionModal } from '../components/SensitiveActionModal';
import { recordAuditEvent } from '../services/adminSecurityService';
import type {
  ChapterConfig,
  ClassDefinition,
  SceneConfig,
  SkillDefinition,
  TrinketDefinition,
  UnitDefinition,
  WeaponDefinition,
} from '../types';

type ContentTab = 'units' | 'chapters' | 'weapons' | 'trinkets' | 'classes' | 'skills';

type UnitRow = UnitDefinition & Record<string, unknown>;
type ChapterRow = ChapterConfig & Record<string, unknown>;
type WeaponRow = WeaponDefinition & Record<string, unknown>;
type TrinketRow = TrinketDefinition & Record<string, unknown>;

interface PendingDeleteTarget {
  endpoint: string;
  id: string;
  name: string;
}

interface StatModifierShape {
  maxHP?: number;
  maxSkillPoint?: number;
  speed?: number;
}

const SCENE_TYPE_OPTIONS: SelectorOptionData[] = [
  { value: 'Battle', label: 'Battle (PVE Grid)' },
  { value: 'Cutscene', label: 'Cutscene' },
  { value: 'Dialogue', label: 'Dialogue' },
];

function extractApiError(err: unknown, fallback: string): string {
  const errObj = err as { response?: { data?: { message?: string } }; message?: string };
  return errObj?.response?.data?.message || errObj?.message || fallback;
}

function renderStatModifierBadges(
  modifiers: StatModifierShape | undefined,
  emptyLabel: string
): React.ReactNode {
  const speed = modifiers?.speed ?? 0;
  const maxHP = modifiers?.maxHP ?? 0;
  const maxSP = modifiers?.maxSkillPoint ?? 0;

  if (!speed && !maxHP && !maxSP) {
    return (
      <Text type="supporting" size="xsm" color="secondary">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <HStack gap={1.5} wrap="wrap">
      {speed > 0 && <Badge variant="warning" label={`+${speed} Speed`} />}
      {maxHP > 0 && <Badge variant="success" label={`+${maxHP} MaxHP`} />}
      {maxSP > 0 && <Badge variant="cyan" label={`+${maxSP} SP`} />}
    </HStack>
  );
}

export const ContentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ContentTab>('units');
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'STARTER' | 'GACHA'>('ALL');
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [chapters, setChapters] = useState<ChapterConfig[]>([]);
  const [weapons, setWeapons] = useState<WeaponDefinition[]>([]);
  const [trinkets, setTrinkets] = useState<TrinketDefinition[]>([]);
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [feedback, setFeedback] = useState<{
    status: 'success' | 'error' | 'warning';
    title: string;
    detail: string;
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Sensitive delete guard state
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit Modals State
  const [editingUnit, setEditingUnit] = useState<UnitDefinition | null>(null);
  const [editingWeapon, setEditingWeapon] = useState<WeaponDefinition | null>(null);
  const [editingTrinket, setEditingTrinket] = useState<TrinketDefinition | null>(null);
  const [editingChapter, setEditingChapter] = useState<ChapterConfig | null>(null);
  const [editingClass, setEditingClass] = useState<ClassDefinition | null>(null);
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);

  // Add Modals State
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitClassId, setNewUnitClassId] = useState(1);

  const [isAddingWeapon, setIsAddingWeapon] = useState(false);
  const [newWeaponName, setNewWeaponName] = useState('');
  const [newWeaponClassId, setNewWeaponClassId] = useState(1);
  const [newWeaponSkillId, setNewWeaponSkillId] = useState(101);
  const [newWeaponSpeedMod, setNewWeaponSpeedMod] = useState(0);
  const [newWeaponHpMod, setNewWeaponHpMod] = useState(0);

  const [isAddingTrinket, setIsAddingTrinket] = useState(false);
  const [newTrinketName, setNewTrinketName] = useState('');
  const [newTrinketSkillId, setNewTrinketSkillId] = useState(4001);
  const [newTrinketSpeedMod, setNewTrinketSpeedMod] = useState(0);
  const [newTrinketHpMod, setNewTrinketHpMod] = useState(0);

  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterMapId, setNewChapterMapId] = useState('MD_PVE_C0S1');

  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassMoveSkillId, setNewClassMoveSkillId] = useState(1001);
  const [newClassSkillId, setNewClassSkillId] = useState(3001);

  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillId, setNewSkillId] = useState(1001);

  // Chapter Scene Editor Subform State
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [newSceneType, setNewSceneType] = useState('Battle');
  const [newSceneMapId, setNewSceneMapId] = useState('MD_PVE_C0S1');

  const loadContentCollections = useCallback(async () => {
    const [uRes, cRes, wRes, tRes, clRes, sRes] = await Promise.allSettled([
      adminClient.get('/UnitDefinition'),
      adminClient.get('/ChapterConfig'),
      adminClient.get('/WeaponDefinition'),
      adminClient.get('/TrinketDefinition'),
      adminClient.get('/ClassDefinition'),
      adminClient.get('/SkillDefinition'),
    ]);

    return {
      units: uRes.status === 'fulfilled' && Array.isArray(uRes.value.data) ? uRes.value.data : [],
      chapters: cRes.status === 'fulfilled' && Array.isArray(cRes.value.data) ? cRes.value.data : [],
      weapons: wRes.status === 'fulfilled' && Array.isArray(wRes.value.data) ? wRes.value.data : [],
      trinkets: tRes.status === 'fulfilled' && Array.isArray(tRes.value.data) ? tRes.value.data : [],
      classes: clRes.status === 'fulfilled' && Array.isArray(clRes.value.data) ? clRes.value.data : [],
      skills: sRes.status === 'fulfilled' && Array.isArray(sRes.value.data) ? sRes.value.data : [],
    };
  }, []);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadContentCollections();
      setUnits(data.units);
      setChapters(data.chapters);
      setWeapons(data.weapons);
      setTrinkets(data.trinkets);
      setClasses(data.classes);
      setSkills(data.skills);
    } catch {
      setUnits([]);
      setChapters([]);
      setWeapons([]);
      setTrinkets([]);
      setClasses([]);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [loadContentCollections]);

  useEffect(() => {
    let active = true;
    loadContentCollections()
      .then((data) => {
        if (!active) return;
        setUnits(data.units);
        setChapters(data.chapters);
        setWeapons(data.weapons);
        setTrinkets(data.trinkets);
        setClasses(data.classes);
        setSkills(data.skills);
      })
      .catch(() => {
        if (!active) return;
        setUnits([]);
        setChapters([]);
        setWeapons([]);
        setTrinkets([]);
        setClasses([]);
        setSkills([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadContentCollections]);

  const classSelectorOptions = useMemo<SelectorOptionData[]>(() => {
    if (classes.length === 0) {
      return [{ value: '1', label: 'Class 1' }];
    }
    return classes.map((c) => ({
      value: String(c.classId),
      label: c.name || c.className || `Class #${c.classId}`,
    }));
  }, [classes]);

  const classLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of classes) {
      if (c.classId !== undefined) {
        map.set(Number(c.classId), c.name || c.className || `Class #${c.classId}`);
      }
    }
    return map;
  }, [classes]);

  // Shared Delete Handler
  const handleDelete = useCallback((endpoint: string, id: string | undefined, name: string) => {
    if (!id) {
      setFeedback({
        status: 'error',
        title: 'Cannot Delete Record',
        detail: `Cannot delete ${name}: Missing database ObjectId.`,
      });
      return;
    }
    setDeleteError(null);
    setPendingDelete({ endpoint, id, name });
  }, []);

  const executePendingDelete = async (rationale: string) => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await adminClient.delete(`/${pendingDelete.endpoint}/${pendingDelete.id}`);
      await recordAuditEvent({
        action: 'GAME_DEFINITION_DELETED',
        category: 'CONTENT',
        severity: 'HIGH',
        targetType: pendingDelete.endpoint,
        targetId: pendingDelete.id,
        targetLabel: pendingDelete.name,
        rationale,
      });
      setFeedback({
        status: 'success',
        title: 'Definition Deleted',
        detail: `Removed "${pendingDelete.name}" from ${pendingDelete.endpoint}.`,
      });
      setPendingDelete(null);
      await fetchContent();
    } catch (err: unknown) {
      const msg = extractApiError(err, `Failed to delete ${pendingDelete.name}.`);
      setDeleteError(msg);
      void recordAuditEvent({
        action: 'GAME_DEFINITION_DELETE_FAILED',
        category: 'CONTENT',
        severity: 'HIGH',
        targetType: pendingDelete.endpoint,
        targetId: pendingDelete.id,
        targetLabel: pendingDelete.name,
        rationale,
        status: 'FAILED',
        errorMessage: msg,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Shared mutation runner with non-blocking banners
  const runContentMutation = async (opts: {
    execute: () => Promise<void>;
    auditAction: string;
    targetType: string;
    targetId?: string;
    targetLabel: string;
    successTitle: string;
    successDetail: string;
    errorFallback: string;
    onSuccess?: () => void;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      await opts.execute();
      void recordAuditEvent({
        action: opts.auditAction,
        category: 'CONTENT',
        severity: 'MEDIUM',
        targetType: opts.targetType,
        targetId: opts.targetId,
        targetLabel: opts.targetLabel,
      });
      await fetchContent();
      opts.onSuccess?.();
      setFeedback({
        status: 'success',
        title: opts.successTitle,
        detail: opts.successDetail,
      });
    } catch (err: unknown) {
      setModalError(extractApiError(err, opts.errorFallback));
    } finally {
      setSaving(false);
    }
  };

  // HERO UNIT HANDLERS
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      setModalError('Hero Unit Name is required.');
      return;
    }
    const maxUid = units.reduce((max, u) => Math.max(max, u.uId || 0), 0);
    const newUid = maxUid > 0 ? maxUid + 1 : 101;
    const payload: Partial<UnitDefinition> = {
      uId: newUid,
      unitName: trimmed,
      classIds: [newUnitClassId],
      passiveSkillId: -1,
      statsByGrade: [
        {
          grade: 1,
          maxHP: 100,
          speed: 5,
          maxSkillPoint: 3,
          damageMultiplier: 100,
          damageReduction: 0,
        },
      ],
      givenAtRegister: false,
    };

    await runContentMutation({
      execute: () => adminClient.post('/UnitDefinition', payload).then(() => undefined),
      auditAction: 'UNIT_DEFINITION_CREATED',
      targetType: 'UnitDefinition',
      targetLabel: trimmed,
      successTitle: 'Hero Definition Created',
      successDetail: `Created Hero "${trimmed}" (UID #${newUid}).`,
      errorFallback: 'Failed to add hero definition.',
      onSuccess: () => {
        setIsAddingUnit(false);
        setNewUnitName('');
        setNewUnitClassId(1);
      },
    });
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit?.id) return;
    const target = editingUnit;
    await runContentMutation({
      execute: () => adminClient.put(`/UnitDefinition/${target.id}`, target).then(() => undefined),
      auditAction: 'UNIT_DEFINITION_UPDATED',
      targetType: 'UnitDefinition',
      targetId: target.id,
      targetLabel: target.unitName || target.name || target.id!,
      successTitle: 'Hero Definition Updated',
      successDetail: `Saved changes to "${target.unitName || target.name || `UID #${target.uId}`}".`,
      errorFallback: 'Failed to update hero definition.',
      onSuccess: () => setEditingUnit(null),
    });
  };

  // WEAPON HANDLERS
  const handleAddWeapon = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWeaponName.trim();
    if (!trimmed) {
      setModalError('Weapon Name is required.');
      return;
    }
    const maxWId = weapons.reduce((max, w) => Math.max(max, w.weaponId || 0), 0);
    const newWId = maxWId > 0 ? maxWId + 1 : 201;
    const payload = {
      weaponId: newWId,
      name: trimmed,
      classId: newWeaponClassId,
      skillId: newWeaponSkillId,
      statModifiers: {
        speed: newWeaponSpeedMod,
        maxHP: newWeaponHpMod,
        maxSkillPoint: 0,
        damageMultiplier: 0,
        damageReduction: 0,
      },
      givenAtRegister: false,
    };

    await runContentMutation({
      execute: () => adminClient.post('/WeaponDefinition', payload).then(() => undefined),
      auditAction: 'WEAPON_DEFINITION_CREATED',
      targetType: 'WeaponDefinition',
      targetLabel: trimmed,
      successTitle: 'Weapon Created',
      successDetail: `Added weapon "${trimmed}" (#${newWId}).`,
      errorFallback: 'Failed to add weapon definition.',
      onSuccess: () => {
        setIsAddingWeapon(false);
        setNewWeaponName('');
        setNewWeaponSpeedMod(0);
        setNewWeaponHpMod(0);
      },
    });
  };

  const handleUpdateWeapon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWeapon?.id) return;
    const target = editingWeapon;
    await runContentMutation({
      execute: () => adminClient.put(`/WeaponDefinition/${target.id}`, target).then(() => undefined),
      auditAction: 'WEAPON_DEFINITION_UPDATED',
      targetType: 'WeaponDefinition',
      targetId: target.id,
      targetLabel: target.name || target.id!,
      successTitle: 'Weapon Updated',
      successDetail: `Saved changes to weapon "${target.name || `#${target.weaponId}`}".`,
      errorFallback: 'Failed to update weapon definition.',
      onSuccess: () => setEditingWeapon(null),
    });
  };

  // TRINKET HANDLERS
  const handleAddTrinket = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTrinketName.trim();
    if (!trimmed) {
      setModalError('Trinket Name is required.');
      return;
    }
    const maxTId = trinkets.reduce((max, t) => Math.max(max, t.trinketId || 0), 0);
    const newTId = maxTId > 0 ? maxTId + 1 : 401;
    const payload = {
      trinketId: newTId,
      name: trimmed,
      skillId: newTrinketSkillId,
      statModifiers: {
        speed: newTrinketSpeedMod,
        maxHP: newTrinketHpMod,
        maxSkillPoint: 0,
        damageMultiplier: 0,
        damageReduction: 0,
      },
      givenAtRegister: false,
    };

    await runContentMutation({
      execute: () => adminClient.post('/TrinketDefinition', payload).then(() => undefined),
      auditAction: 'TRINKET_DEFINITION_CREATED',
      targetType: 'TrinketDefinition',
      targetLabel: trimmed,
      successTitle: 'Trinket Created',
      successDetail: `Added trinket "${trimmed}" (#${newTId}).`,
      errorFallback: 'Failed to add trinket definition.',
      onSuccess: () => {
        setIsAddingTrinket(false);
        setNewTrinketName('');
        setNewTrinketSpeedMod(0);
        setNewTrinketHpMod(0);
      },
    });
  };

  const handleUpdateTrinket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrinket?.id) return;
    const target = editingTrinket;
    await runContentMutation({
      execute: () => adminClient.put(`/TrinketDefinition/${target.id}`, target).then(() => undefined),
      auditAction: 'TRINKET_DEFINITION_UPDATED',
      targetType: 'TrinketDefinition',
      targetId: target.id,
      targetLabel: target.name || target.id!,
      successTitle: 'Trinket Updated',
      successDetail: `Saved changes to trinket "${target.name || `#${target.trinketId}`}".`,
      errorFallback: 'Failed to update trinket definition.',
      onSuccess: () => setEditingTrinket(null),
    });
  };

  // CHAPTER HANDLERS
  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChapterTitle.trim();
    if (!trimmed) {
      setModalError('Chapter Title is required.');
      return;
    }
    const maxCId = chapters.reduce((max, c) => Math.max(max, c.chapterId ?? -1), -1);
    const newCId = maxCId >= 0 ? maxCId + 1 : 1;
    const mapId = newChapterMapId.trim() || 'MD_PVE_C0S1';
    const payload = {
      chapterId: newCId,
      title: trimmed,
      mapId,
      scenes: [
        {
          sceneId: 0,
          type: 'Battle',
          autoResume: false,
          autoAdvance: false,
          description: `${trimmed} - Prologue Battle`,
          mapId,
        },
      ],
    };

    await runContentMutation({
      execute: () => adminClient.post('/ChapterConfig', payload).then(() => undefined),
      auditAction: 'CHAPTER_CONFIG_CREATED',
      targetType: 'ChapterConfig',
      targetLabel: trimmed,
      successTitle: 'Chapter Created',
      successDetail: `Created Chapter #${newCId}: "${trimmed}".`,
      errorFallback: 'Failed to add chapter configuration.',
      onSuccess: () => {
        setIsAddingChapter(false);
        setNewChapterTitle('');
        setNewChapterMapId('MD_PVE_C0S1');
      },
    });
  };

  const handleUpdateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter?.id) return;
    const target = editingChapter;
    await runContentMutation({
      execute: () => adminClient.put(`/ChapterConfig/${target.id}`, target).then(() => undefined),
      auditAction: 'CHAPTER_CONFIG_UPDATED',
      targetType: 'ChapterConfig',
      targetId: target.id,
      targetLabel: target.title || target.chapterName || target.id!,
      successTitle: 'Chapter Updated',
      successDetail: `Updated Chapter #${target.chapterId}.`,
      errorFallback: 'Failed to update chapter configuration.',
      onSuccess: () => setEditingChapter(null),
    });
  };

  // CLASS HANDLERS
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) {
      setModalError('Class Archetype Name is required.');
      return;
    }
    const maxClId = classes.reduce((max, c) => Math.max(max, Number(c.classId) || 0), 0);
    const newClId = maxClId > 0 ? maxClId + 1 : 1;
    const payload = {
      classId: newClId,
      name: trimmed,
      movementSkillId: newClassMoveSkillId,
      classSkillId: newClassSkillId,
    };

    await runContentMutation({
      execute: () => adminClient.post('/ClassDefinition', payload).then(() => undefined),
      auditAction: 'CLASS_DEFINITION_CREATED',
      targetType: 'ClassDefinition',
      targetLabel: trimmed,
      successTitle: 'Class Definition Created',
      successDetail: `Registered Class "${trimmed}" (#${newClId}).`,
      errorFallback: 'Failed to add class definition.',
      onSuccess: () => {
        setIsAddingClass(false);
        setNewClassName('');
        setNewClassMoveSkillId(1001);
        setNewClassSkillId(3001);
      },
    });
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass?.id) return;
    const target = editingClass;
    await runContentMutation({
      execute: () => adminClient.put(`/ClassDefinition/${target.id}`, target).then(() => undefined),
      auditAction: 'CLASS_DEFINITION_UPDATED',
      targetType: 'ClassDefinition',
      targetId: target.id,
      targetLabel: target.name || target.className || target.id!,
      successTitle: 'Class Definition Updated',
      successDetail: `Updated Class "${target.name || target.className || `#${target.classId}`}".`,
      errorFallback: 'Failed to update class definition.',
      onSuccess: () => setEditingClass(null),
    });
  };

  // SKILL HANDLERS
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillNum = Number(newSkillId);
    await runContentMutation({
      execute: () =>
        adminClient.post('/SkillDefinition', { skillId: skillNum }).then(() => undefined),
      auditAction: 'SKILL_DEFINITION_CREATED',
      targetType: 'SkillDefinition',
      targetLabel: `Skill #${skillNum}`,
      successTitle: 'Skill Definition Created',
      successDetail: `Registered Combat Skill #${skillNum}.`,
      errorFallback: 'Failed to add skill definition.',
      onSuccess: () => {
        setIsAddingSkill(false);
        setNewSkillId(1001);
      },
    });
  };

  const handleUpdateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill?.id) return;
    const target = editingSkill;
    await runContentMutation({
      execute: () => adminClient.put(`/SkillDefinition/${target.id}`, target).then(() => undefined),
      auditAction: 'SKILL_DEFINITION_UPDATED',
      targetType: 'SkillDefinition',
      targetId: target.id,
      targetLabel: target.skillName || String(target.skillId || target.id),
      successTitle: 'Skill Definition Updated',
      successDetail: `Updated Skill #${target.skillId}.`,
      errorFallback: 'Failed to update skill definition.',
      onSuccess: () => setEditingSkill(null),
    });
  };

  // DataTable schemas
  const unitColumns = useMemo<TableColumn<UnitRow>[]>(
    () => [
      {
        key: 'uId',
        header: 'Hero UID',
        width: pixel(110),
        renderCell: (u) => (
          <Text type="code" weight="bold" color="accent">
            UID #{u.uId ?? '—'}
          </Text>
        ),
      },
      {
        key: 'unitName',
        header: 'Hero Name',
        width: proportional(1.5, { minWidth: 160 }),
        renderCell: (u) => (
          <HStack gap={2} vAlign="center">
            <Badge
              variant="yellow"
              label={(u.unitName || u.name || 'HR').slice(0, 2).toUpperCase()}
            />
            <Text weight="semibold" color="primary">
              {u.unitName || u.name || `Unit #${u.uId}`}
            </Text>
          </HStack>
        ),
      },
      {
        key: 'passiveSkillId',
        header: 'Passive Skill',
        width: pixel(135),
        renderCell: (u) =>
          u.passiveSkillId && u.passiveSkillId !== -1 ? (
            <Badge
              variant="warning"
              label={`Skill #${u.passiveSkillId}`}
              icon={<Zap className="w-3 h-3" />}
            />
          ) : (
            <Text type="supporting" size="xsm" color="secondary">
              None
            </Text>
          ),
      },
      {
        key: 'classIds',
        header: 'Class Designation',
        width: proportional(1.5, { minWidth: 160 }),
        renderCell: (u) => {
          const ids =
            u.classIds && u.classIds.length > 0
              ? u.classIds
              : u.classId !== undefined
              ? [Number(u.classId)]
              : [];
          if (ids.length === 0) {
            return (
              <Text type="supporting" size="xsm" color="secondary">
                Unassigned
              </Text>
            );
          }
          return (
            <HStack gap={1.5} wrap="wrap">
              {ids.map((cId) => (
                <Badge
                  key={cId}
                  variant="info"
                  label={classLabelById.get(Number(cId)) || `Class #${cId}`}
                />
              ))}
            </HStack>
          );
        },
      },
      {
        key: 'givenAtRegister',
        header: 'Availability',
        width: pixel(130),
        renderCell: (u) =>
          u.givenAtRegister ? (
            <Badge variant="success" label="STARTER" />
          ) : (
            <Badge variant="neutral" label="GACHA ONLY" />
          ),
      },
      {
        key: 'statsByGrade',
        header: 'Base Grade Stats',
        width: pixel(170),
        renderCell: (u) => {
          const g1 = Array.isArray(u.statsByGrade) ? u.statsByGrade[0] : undefined;
          return g1 ? (
            <Text type="code" size="xsm" color="secondary">
              HP {g1.maxHP ?? u.baseHp ?? '—'} • SPD {g1.speed ?? u.baseSpeed ?? '—'} •{' '}
              {u.statsByGrade?.length} tier{u.statsByGrade?.length === 1 ? '' : 's'}
            </Text>
          ) : (
            <Text type="supporting" size="xsm" color="secondary">
              Default stats
            </Text>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        width: pixel(110),
        align: 'end',
        renderCell: (u) => (
          <HStack gap={1.5} justify="end">
            <IconButton
              size="sm"
              variant="secondary"
              label={`Edit ${u.unitName || `Hero #${u.uId}`}`}
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setModalError(null);
                setEditingUnit(u);
              }}
            />
            <IconButton
              size="sm"
              variant="destructive"
              label={`Delete ${u.unitName || `Hero #${u.uId}`}`}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDelete('UnitDefinition', u.id, u.unitName || `Hero #${u.uId}`)}
            />
          </HStack>
        ),
      },
    ],
    [classLabelById, handleDelete]
  );

  const chapterColumns = useMemo<TableColumn<ChapterRow>[]>(
    () => [
      {
        key: 'chapterId',
        header: 'Chapter ID',
        width: pixel(115),
        renderCell: (ch) => (
          <Text type="code" weight="bold" color="accent">
            CH. #{ch.chapterId}
          </Text>
        ),
      },
      {
        key: 'title',
        header: 'Chapter Title',
        width: proportional(1.8, { minWidth: 180 }),
        renderCell: (ch) => (
          <Text weight="semibold" color="primary">
            {ch.title || ch.chapterName || `Chapter #${ch.chapterId}`}
          </Text>
        ),
      },
      {
        key: 'mapId',
        header: 'Map Reference',
        width: pixel(165),
        renderCell: (ch) => (
          <Text type="code" size="xsm" color="secondary">
            {ch.mapId || 'MD_PVE_C0S1'}
          </Text>
        ),
      },
      {
        key: 'scenesCount',
        header: 'Scenes Count',
        width: pixel(125),
        renderCell: (ch) => (
          <Badge variant="info" label={`${ch.scenes?.length || 0} scenes`} />
        ),
      },
      {
        key: 'sceneTypes',
        header: 'Scene Types',
        width: proportional(1.4, { minWidth: 150 }),
        renderCell: (ch) => {
          const types = Array.from(
            new Set((ch.scenes || []).map((s) => s.type).filter(Boolean))
          ) as string[];
          if (types.length === 0) {
            return (
              <Text type="supporting" size="xsm" color="secondary">
                No scenes
              </Text>
            );
          }
          return (
            <HStack gap={1.5} wrap="wrap">
              {types.map((t) => (
                <Badge key={t} variant="purple" label={t} />
              ))}
            </HStack>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        width: pixel(110),
        align: 'end',
        renderCell: (ch) => (
          <HStack gap={1.5} justify="end">
            <IconButton
              size="sm"
              variant="secondary"
              label={`Edit Chapter #${ch.chapterId}`}
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setModalError(null);
                setNewSceneDescription('');
                setNewSceneType('Battle');
                setNewSceneMapId(ch.mapId || 'MD_PVE_C0S1');
                setEditingChapter(ch);
              }}
            />
            <IconButton
              size="sm"
              variant="destructive"
              label={`Delete Chapter #${ch.chapterId}`}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() =>
                handleDelete(
                  'ChapterConfig',
                  ch.id,
                  ch.title || ch.chapterName || `Chapter #${ch.chapterId}`
                )
              }
            />
          </HStack>
        ),
      },
    ],
    [handleDelete]
  );

  const weaponColumns = useMemo<TableColumn<WeaponRow>[]>(
    () => [
      {
        key: 'weaponId',
        header: 'Weapon ID',
        width: pixel(110),
        renderCell: (w) => (
          <Text type="code" weight="bold" color="accent">
            #{w.weaponId ?? '—'}
          </Text>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        width: proportional(1.4, { minWidth: 150 }),
        renderCell: (w) => (
          <Text weight="semibold" color="primary">
            {w.name || `Weapon #${w.weaponId}`}
          </Text>
        ),
      },
      {
        key: 'classId',
        header: 'Class Requirement (BR-04)',
        width: pixel(175),
        renderCell: (w) => (
          <Badge
            variant="cyan"
            icon={<Shield className="w-3 h-3" />}
            label={
              w.classId !== undefined
                ? classLabelById.get(Number(w.classId)) || `Class #${w.classId}`
                : 'All Classes'
            }
          />
        ),
      },
      {
        key: 'skillId',
        header: 'Weapon Skill',
        width: pixel(125),
        renderCell: (w) => (
          <Badge
            variant="warning"
            icon={<Zap className="w-3 h-3" />}
            label={`Skill #${w.skillId ?? '—'}`}
          />
        ),
      },
      {
        key: 'statModifiers',
        header: 'Stat Modifiers',
        width: proportional(1.5, { minWidth: 165 }),
        renderCell: (w) => renderStatModifierBadges(w.statModifiers, 'None (Base Weapon)'),
      },
      {
        key: 'givenAtRegister',
        header: 'Availability',
        width: pixel(125),
        renderCell: (w) =>
          w.givenAtRegister ? (
            <Badge variant="success" label="STARTER" />
          ) : (
            <Badge variant="neutral" label="GACHA ONLY" />
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: pixel(110),
        align: 'end',
        renderCell: (w) => (
          <HStack gap={1.5} justify="end">
            <IconButton
              size="sm"
              variant="secondary"
              label={`Edit ${w.name || `Weapon #${w.weaponId}`}`}
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setModalError(null);
                setEditingWeapon(w);
              }}
            />
            <IconButton
              size="sm"
              variant="destructive"
              label={`Delete ${w.name || `Weapon #${w.weaponId}`}`}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDelete('WeaponDefinition', w.id, w.name || `Weapon #${w.weaponId}`)}
            />
          </HStack>
        ),
      },
    ],
    [classLabelById, handleDelete]
  );

  const trinketColumns = useMemo<TableColumn<TrinketRow>[]>(
    () => [
      {
        key: 'trinketId',
        header: 'Trinket ID',
        width: pixel(110),
        renderCell: (t) => (
          <Text type="code" weight="bold" color="accent">
            #{t.trinketId ?? '—'}
          </Text>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        width: proportional(1.4, { minWidth: 150 }),
        renderCell: (t) => (
          <Text weight="semibold" color="primary">
            {t.name || `Trinket #${t.trinketId}`}
          </Text>
        ),
      },
      {
        key: 'skillId',
        header: 'Associated Skill',
        width: pixel(135),
        renderCell: (t) => (
          <Badge
            variant="warning"
            icon={<Sparkles className="w-3 h-3" />}
            label={`Skill #${t.skillId ?? '—'}`}
          />
        ),
      },
      {
        key: 'statModifiers',
        header: 'Stat Modifiers',
        width: proportional(1.5, { minWidth: 165 }),
        renderCell: (t) => renderStatModifierBadges(t.statModifiers, 'None (Base Trinket)'),
      },
      {
        key: 'givenAtRegister',
        header: 'Availability',
        width: pixel(125),
        renderCell: (t) =>
          t.givenAtRegister ? (
            <Badge variant="success" label="STARTER" />
          ) : (
            <Badge variant="neutral" label="GACHA ONLY" />
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: pixel(110),
        align: 'end',
        renderCell: (t) => (
          <HStack gap={1.5} justify="end">
            <IconButton
              size="sm"
              variant="secondary"
              label={`Edit ${t.name || `Trinket #${t.trinketId}`}`}
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setModalError(null);
                setEditingTrinket(t);
              }}
            />
            <IconButton
              size="sm"
              variant="destructive"
              label={`Delete ${t.name || `Trinket #${t.trinketId}`}`}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDelete('TrinketDefinition', t.id, t.name || `Trinket #${t.trinketId}`)}
            />
          </HStack>
        ),
      },
    ],
    [handleDelete]
  );

  const unitRows = useMemo<UnitRow[]>(() => units.map((u) => ({ ...u })), [units]);
  const chapterRows = useMemo<ChapterRow[]>(() => chapters.map((c) => ({ ...c })), [chapters]);
  const weaponRows = useMemo<WeaponRow[]>(() => weapons.map((w) => ({ ...w })), [weapons]);
  const trinketRows = useMemo<TrinketRow[]>(() => trinkets.map((t) => ({ ...t })), [trinkets]);

  const skillUsageMap = useMemo(() => {
    const map = new Map<number, string[]>();
    const addRef = (skillId: unknown, refLabel: string) => {
      const idNum = Number(skillId);
      if (!Number.isFinite(idNum) || idNum <= 0) return;
      const list = map.get(idNum) ?? [];
      list.push(refLabel);
      map.set(idNum, list);
    };
    for (const u of units) {
      addRef(u.passiveSkillId, `Hero: ${u.unitName || u.name || `#${u.uId}`}`);
    }
    for (const w of weapons) {
      addRef(w.skillId, `Weapon: ${w.name || `#${w.weaponId}`}`);
    }
    for (const t of trinkets) {
      addRef(t.skillId, `Trinket: ${t.name || `#${t.trinketId}`}`);
    }
    for (const c of classes) {
      const cLabel = c.name || c.className || `#${c.classId}`;
      addRef(c.movementSkillId, `Move: ${cLabel}`);
      addRef(c.classSkillId, `Class: ${cLabel}`);
    }
    return map;
  }, [units, weapons, trinkets, classes]);

  const normalizedQuery = searchTerm.trim().toLowerCase();

  const matchesAvailability = useCallback(
    (givenAtRegister: boolean | undefined) => {
      if (availabilityFilter === 'STARTER') return Boolean(givenAtRegister);
      if (availabilityFilter === 'GACHA') return !givenAtRegister;
      return true;
    },
    [availabilityFilter]
  );

  const filteredUnitRows = useMemo(
    () =>
      unitRows.filter((u) => {
        if (!matchesAvailability(u.givenAtRegister)) return false;
        if (!normalizedQuery) return true;
        return (
          (u.unitName || u.name || '').toLowerCase().includes(normalizedQuery) ||
          String(u.uId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(u.passiveSkillId ?? '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [unitRows, matchesAvailability, normalizedQuery]
  );

  const filteredChapterRows = useMemo(
    () =>
      chapterRows.filter((c) => {
        if (!normalizedQuery) return true;
        const sceneMatch = (c.scenes || []).some((sc) =>
          `${sc.mapId || ''} ${sc.description || ''} ${sc.type || ''}`
            .toLowerCase()
            .includes(normalizedQuery)
        );
        return (
          sceneMatch ||
          String(c.chapterName || c.title || c.chapterTitle || '')
            .toLowerCase()
            .includes(normalizedQuery) ||
          String(c.chapterId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(c.mapId ?? '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [chapterRows, normalizedQuery]
  );

  const filteredWeaponRows = useMemo(
    () =>
      weaponRows.filter((w) => {
        if (!matchesAvailability(w.givenAtRegister)) return false;
        if (!normalizedQuery) return true;
        return (
          (w.name || '').toLowerCase().includes(normalizedQuery) ||
          String(w.weaponId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(w.skillId ?? '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [weaponRows, matchesAvailability, normalizedQuery]
  );

  const filteredTrinketRows = useMemo(
    () =>
      trinketRows.filter((t) => {
        if (!matchesAvailability(t.givenAtRegister)) return false;
        if (!normalizedQuery) return true;
        return (
          (t.name || '').toLowerCase().includes(normalizedQuery) ||
          String(t.trinketId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(t.skillId ?? '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [trinketRows, matchesAvailability, normalizedQuery]
  );

  const filteredClasses = useMemo(
    () =>
      classes.filter((c) => {
        if (!normalizedQuery) return true;
        return (
          (c.name || c.className || '').toLowerCase().includes(normalizedQuery) ||
          String(c.classId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(c.movementSkillId ?? '').toLowerCase().includes(normalizedQuery) ||
          String(c.classSkillId ?? '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [classes, normalizedQuery]
  );

  const filteredSkills = useMemo(
    () =>
      skills.filter((s) => {
        if (!normalizedQuery) return true;
        const refs = skillUsageMap.get(Number(s.skillId)) ?? [];
        return (
          (s.skillName || '').toLowerCase().includes(normalizedQuery) ||
          String(s.skillId ?? '').toLowerCase().includes(normalizedQuery) ||
          refs.some((r) => r.toLowerCase().includes(normalizedQuery))
        );
      }),
    [skills, normalizedQuery, skillUsageMap]
  );

  const activeTabMeta = useMemo(() => {
    switch (activeTab) {
      case 'units':
        return {
          endpoint: '/api/UnitDefinition',
          addLabel: 'Add Hero',
          shown: filteredUnitRows.length,
          total: units.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingUnit(true);
          },
        };
      case 'chapters':
        return {
          endpoint: '/api/ChapterConfig',
          addLabel: 'Add Chapter',
          shown: filteredChapterRows.length,
          total: chapters.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingChapter(true);
          },
        };
      case 'weapons':
        return {
          endpoint: '/api/WeaponDefinition',
          addLabel: 'Add Weapon',
          shown: filteredWeaponRows.length,
          total: weapons.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingWeapon(true);
          },
        };
      case 'trinkets':
        return {
          endpoint: '/api/TrinketDefinition',
          addLabel: 'Add Trinket',
          shown: filteredTrinketRows.length,
          total: trinkets.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingTrinket(true);
          },
        };
      case 'classes':
        return {
          endpoint: '/api/ClassDefinition',
          addLabel: 'Add Class',
          shown: filteredClasses.length,
          total: classes.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingClass(true);
          },
        };
      case 'skills':
      default:
        return {
          endpoint: '/api/SkillDefinition',
          addLabel: 'Add Skill',
          shown: filteredSkills.length,
          total: skills.length,
          onAdd: () => {
            setModalError(null);
            setIsAddingSkill(true);
          },
        };
    }
  }, [
    activeTab,
    filteredUnitRows.length,
    units.length,
    filteredChapterRows.length,
    chapters.length,
    filteredWeaponRows.length,
    weapons.length,
    filteredTrinketRows.length,
    trinkets.length,
    filteredClasses.length,
    classes.length,
    filteredSkills.length,
    skills.length,
  ]);

  const showAvailabilityFilter =
    activeTab === 'units' || activeTab === 'weapons' || activeTab === 'trinkets';

  return (
    <ConsolePage
      badge="GAME DESIGN ARCHIVES • MONGODB"
      badgeVariant="yellow"
      icon={<Sword className="w-6 h-6 text-amber-500" />}
      meta={
        <Text type="code" size="xsm" color="secondary">
          6 Core SRPG Domains • {activeTabMeta.endpoint}
        </Text>
      }
      title="SRPG ARCHIVES & ARMORY DEFINITIONS"
      subtitle="Live Game Content CMS: In-browser Create, Edit & Delete for Heroes, Chapters, Weapons, Trinkets, Classes & Skills."
      actions={
        <HStack gap={2} vAlign="center">
          <Button
            variant="secondary"
            size="sm"
            label={loading ? 'Syncing...' : 'Sync Archives'}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => void fetchContent()}
            isDisabled={loading}
          />
          <Button
            variant="primary"
            size="sm"
            label={activeTabMeta.addLabel}
            icon={<Plus className="w-4 h-4" />}
            onClick={activeTabMeta.onAdd}
          />
        </HStack>
      }
      banner={
        feedback ? (
          <Banner
            status={feedback.status}
            title={feedback.title}
            description={feedback.detail}
            isDismissable
            onDismiss={() => setFeedback(null)}
          />
        ) : undefined
      }
      toolbar={
        <VStack gap={2}>
          <TabList
            value={activeTab}
            onChange={(val) => setActiveTab(val as ContentTab)}
            role="tablist"
            hasDivider
          >
            <Tab
              value="units"
              panelId="panel-units"
              label="Heroes"
              icon={<Shield className="w-4 h-4" />}
              endContent={<Badge variant="yellow" label={units.length} />}
            />
            <Tab
              value="chapters"
              panelId="panel-chapters"
              label="Chapters"
              icon={<BookOpen className="w-4 h-4" />}
              endContent={<Badge variant="green" label={chapters.length} />}
            />
            <Tab
              value="weapons"
              panelId="panel-weapons"
              label="Weapons"
              icon={<Sword className="w-4 h-4" />}
              endContent={<Badge variant="cyan" label={weapons.length} />}
            />
            <Tab
              value="trinkets"
              panelId="panel-trinkets"
              label="Trinkets"
              icon={<Gem className="w-4 h-4" />}
              endContent={<Badge variant="purple" label={trinkets.length} />}
            />
            <Tab
              value="classes"
              panelId="panel-classes"
              label="Classes"
              icon={<Layers className="w-4 h-4" />}
              endContent={<Badge variant="info" label={classes.length} />}
            />
            <Tab
              value="skills"
              panelId="panel-skills"
              label="Skills"
              icon={<Zap className="w-4 h-4" />}
              endContent={<Badge variant="warning" label={skills.length} />}
            />
          </TabList>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <TextInput
                label="Filter current archive tab"
                isLabelHidden
                size="sm"
                value={searchTerm}
                onChange={setSearchTerm}
                startIcon={<Search className="w-4 h-4" />}
                placeholder={`Filter ${activeTab} by name, ID, or skill reference...`}
                hasClear
                width={320}
              />

              {showAvailabilityFilter && (
                <SegmentedControl
                  label="Filter by availability"
                  size="sm"
                  value={availabilityFilter}
                  onChange={(val) => setAvailabilityFilter(val as 'ALL' | 'STARTER' | 'GACHA')}
                >
                  <SegmentedControlItem value="ALL" label="All Pools" />
                  <SegmentedControlItem value="STARTER" label="Starter" />
                  <SegmentedControlItem value="GACHA" label="Gacha Only" />
                </SegmentedControl>
              )}
            </div>

            <Text type="code" size="xsm" color="secondary" hasTabularNumbers>
              Showing {activeTabMeta.shown} of {activeTabMeta.total} entries
            </Text>
          </div>
        </VStack>
      }
    >
      {/* Main Active Tab Card */}
      <Card padding={4}>
        {/* 1. HERO UNITS TAB */}
        {activeTab === 'units' && (
          <div role="tabpanel" id="panel-units">
            {filteredUnitRows.length === 0 ? (
              <EmptyState
                title={
                  units.length === 0
                    ? 'No Hero Definitions Recorded'
                    : 'No Heroes Match Current Filter'
                }
                description={
                  units.length === 0
                    ? 'Create a playable hero unit definition in MongoDB to configure classes and passive skills.'
                    : 'Clear search or switch Starter/Gacha pool filter to inspect other hero records.'
                }
                icon={<Shield className="w-8 h-8" />}
                actions={
                  units.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Hero"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingUnit(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Table
                columns={unitColumns}
                data={filteredUnitRows}
                idKey="id"
                density="balanced"
                hasHover
                aria-label="SRPG Hero Definitions"
              />
            )}
          </div>
        )}

        {/* 2. CHAPTERS TAB */}
        {activeTab === 'chapters' && (
          <div role="tabpanel" id="panel-chapters">
            {filteredChapterRows.length === 0 ? (
              <EmptyState
                title={
                  chapters.length === 0
                    ? 'No Story Chapter Configurations Found'
                    : 'No Chapters Match Search'
                }
                description={
                  chapters.length === 0
                    ? 'Create a story chapter configuration and attach PVE battle, dialogue, or cutscene scenes.'
                    : 'Clear search query to inspect all story chapters.'
                }
                icon={<BookOpen className="w-8 h-8" />}
                actions={
                  chapters.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Chapter"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingChapter(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Table
                columns={chapterColumns}
                data={filteredChapterRows}
                idKey="id"
                density="balanced"
                hasHover
                aria-label="Story Chapters"
              />
            )}
          </div>
        )}

        {/* 3. WEAPONS TAB */}
        {activeTab === 'weapons' && (
          <div role="tabpanel" id="panel-weapons">
            {filteredWeaponRows.length === 0 ? (
              <EmptyState
                title={
                  weapons.length === 0
                    ? 'No Weapon Definitions Found'
                    : 'No Weapons Match Current Filter'
                }
                description={
                  weapons.length === 0
                    ? 'Define class-restricted weapons and combat skill attachments.'
                    : 'Clear search or switch pool filter to inspect other weapons.'
                }
                icon={<Sword className="w-8 h-8" />}
                actions={
                  weapons.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Weapon"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingWeapon(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Table
                columns={weaponColumns}
                data={filteredWeaponRows}
                idKey="id"
                density="balanced"
                hasHover
                aria-label="Weapon Definitions"
              />
            )}
          </div>
        )}

        {/* 4. TRINKETS TAB */}
        {activeTab === 'trinkets' && (
          <div role="tabpanel" id="panel-trinkets">
            {filteredTrinketRows.length === 0 ? (
              <EmptyState
                title={
                  trinkets.length === 0
                    ? 'No Trinket Definitions Found'
                    : 'No Trinkets Match Current Filter'
                }
                description={
                  trinkets.length === 0
                    ? 'Create accessory artifacts with passive combat skills and stat modifiers.'
                    : 'Clear search or switch pool filter to inspect other trinkets.'
                }
                icon={<Gem className="w-8 h-8" />}
                actions={
                  trinkets.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Trinket"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingTrinket(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Table
                columns={trinketColumns}
                data={filteredTrinketRows}
                idKey="id"
                density="balanced"
                hasHover
                aria-label="Trinket Definitions"
              />
            )}
          </div>
        )}

        {/* 5. CLASSES TAB */}
        {activeTab === 'classes' && (
          <div role="tabpanel" id="panel-classes">
            {filteredClasses.length === 0 ? (
              <EmptyState
                title={
                  classes.length === 0
                    ? 'No Class Definitions Found'
                    : 'No Classes Match Search'
                }
                description={
                  classes.length === 0
                    ? 'Add an SRPG class archetype with movement and class combat skill mappings.'
                    : 'Clear search query to inspect all class definitions.'
                }
                icon={<Layers className="w-8 h-8" />}
                actions={
                  classes.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Class"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingClass(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Grid columns={{ minWidth: 250, max: 3, repeat: 'fit' }} gap={3}>
                {filteredClasses.map((c, idx) => (
                  <Card key={c.id || idx} variant="muted" padding={4}>
                    <VStack gap={3}>
                      <HStack justify="between" vAlign="center" gap={2}>
                        <Heading level={3} type="display-3">
                          {c.name || c.className || `Class #${c.classId}`}
                        </Heading>
                        <Badge variant="yellow" label={`ID #${c.classId}`} />
                      </HStack>

                      <VStack gap={1}>
                        <HStack justify="between">
                          <Text type="supporting" size="xsm" color="secondary">
                            Movement Skill
                          </Text>
                          <Text type="code" size="xsm" weight="bold" color="primary">
                            #{c.movementSkillId ?? '—'}
                          </Text>
                        </HStack>
                        <HStack justify="between">
                          <Text type="supporting" size="xsm" color="secondary">
                            Class Combat Skill
                          </Text>
                          <Text type="code" size="xsm" weight="bold" color="accent">
                            #{c.classSkillId ?? '—'}
                          </Text>
                        </HStack>
                      </VStack>

                      <HStack justify="end" gap={1.5}>
                        <Button
                          size="sm"
                          variant="secondary"
                          label="Edit"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setModalError(null);
                            setEditingClass(c);
                          }}
                        />
                        <IconButton
                          size="sm"
                          variant="destructive"
                          label={`Delete Class #${c.classId}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() =>
                            handleDelete(
                              'ClassDefinition',
                              c.id,
                              c.name || c.className || `Class #${c.classId}`
                            )
                          }
                        />
                      </HStack>
                    </VStack>
                  </Card>
                ))}
              </Grid>
            )}
          </div>
        )}

        {/* 6. SKILLS TAB */}
        {activeTab === 'skills' && (
          <div role="tabpanel" id="panel-skills">
            {filteredSkills.length === 0 ? (
              <EmptyState
                title={
                  skills.length === 0
                    ? 'No Skill Definitions Found'
                    : 'No Skills Match Search'
                }
                description={
                  skills.length === 0
                    ? 'Register combat and passive skill IDs referenced by units, weapons, and classes.'
                    : 'Clear search query to inspect all skill definitions.'
                }
                icon={<Zap className="w-8 h-8" />}
                actions={
                  skills.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Add Skill"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setIsAddingSkill(true)}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Grid columns={{ minWidth: 185, max: 5, repeat: 'fit' }} gap={3}>
                {filteredSkills.map((s, idx) => {
                  const refs = skillUsageMap.get(Number(s.skillId)) ?? [];
                  return (
                    <Card key={s.id || idx} variant="muted" padding={3}>
                      <VStack gap={2} hAlign="center">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <Badge variant="yellow" label={`Skill #${s.skillId}`} />
                        {s.skillName && (
                          <Text
                            size="xsm"
                            weight="medium"
                            color="secondary"
                            className="text-center"
                          >
                            {s.skillName}
                          </Text>
                        )}
                        <div className="flex flex-wrap justify-center gap-1 min-h-[20px]">
                          {refs.length === 0 ? (
                            <Badge variant="neutral" label="Unreferenced" />
                          ) : (
                            <>
                              {refs.slice(0, 2).map((refLabel, rIdx) => (
                                <Badge key={rIdx} variant="info" label={refLabel} />
                              ))}
                              {refs.length > 2 && (
                                <Badge variant="neutral" label={`+${refs.length - 2}`} />
                              )}
                            </>
                          )}
                        </div>
                        <HStack gap={1.5} justify="center">
                          <IconButton
                            size="sm"
                            variant="secondary"
                            label={`Edit Skill #${s.skillId}`}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setModalError(null);
                              setEditingSkill(s);
                            }}
                          />
                          <IconButton
                            size="sm"
                            variant="destructive"
                            label={`Delete Skill #${s.skillId}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDelete('SkillDefinition', s.id, `Skill #${s.skillId}`)
                            }
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  );
                })}
              </Grid>
            )}
          </div>
        )}
      </Card>

      {/* ========================================================= */}
      {/* EDIT DIALOGS                                              */}
      {/* ========================================================= */}

      {/* DIALOG: Edit Hero Unit */}
      <Dialog
        isOpen={editingUnit !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUnit(null);
        }}
        purpose="form"
        width={520}
      >
        {editingUnit && (
          <VStack gap={4}>
            <DialogHeader
              title={`Edit Hero • UID #${editingUnit.uId}`}
              startContent={<Shield className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingUnit(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateUnit}>
              <VStack gap={3}>
                <TextInput
                  label="Hero Unit Name"
                  value={editingUnit.unitName || ''}
                  onChange={(val) => setEditingUnit({ ...editingUnit, unitName: val })}
                  isRequired
                />
                <NumberInput
                  label="Passive Skill ID (-1 for None)"
                  value={editingUnit.passiveSkillId ?? -1}
                  onChange={(val) => setEditingUnit({ ...editingUnit, passiveSkillId: val })}
                  isIntegerOnly
                />

                <VStack gap={1.5}>
                  <Text size="sm" weight="medium" color="secondary">
                    Assigned SRPG Classes
                  </Text>
                  <Grid columns={{ minWidth: 150, max: 3, repeat: 'fit' }} gap={2}>
                    {classes.map((c) => {
                      const cId = Number(c.classId);
                      const isChecked = (editingUnit.classIds || []).includes(cId);
                      return (
                        <Card key={c.classId} variant="muted" padding={2}>
                          <CheckboxInput
                            label={c.name || `Class #${c.classId}`}
                            value={isChecked}
                            onChange={(checked) => {
                              const prev = editingUnit.classIds || [];
                              const updated = checked
                                ? prev.includes(cId)
                                  ? prev
                                  : [...prev, cId]
                                : prev.filter((id) => id !== cId);
                              setEditingUnit({ ...editingUnit, classIds: updated });
                            }}
                          />
                        </Card>
                      );
                    })}
                  </Grid>
                </VStack>

                <CheckboxInput
                  label="Initial Starter Hero"
                  description="Grant this hero automatically to newly registered accounts without gacha summoning."
                  value={editingUnit.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingUnit({ ...editingUnit, givenAtRegister: checked })
                  }
                />

                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button variant="secondary" label="Cancel" onClick={() => setEditingUnit(null)} />
                  <Button
                    type="submit"
                    variant="primary"
                    label="Save Changes"
                    isLoading={saving}
                  />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* DIALOG: Edit Weapon (BR-04) */}
      <Dialog
        isOpen={editingWeapon !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWeapon(null);
        }}
        purpose="form"
        width={520}
      >
        {editingWeapon && (
          <VStack gap={4}>
            <DialogHeader
              title={`Edit Weapon • #${editingWeapon.weaponId}`}
              startContent={<Sword className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingWeapon(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateWeapon}>
              <VStack gap={3}>
                <TextInput
                  label="Weapon Name"
                  value={editingWeapon.name || ''}
                  onChange={(val) => setEditingWeapon({ ...editingWeapon, name: val })}
                  isRequired
                />
                <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={3}>
                  <Selector
                    label="Class Requirement (BR-04)"
                    options={classSelectorOptions}
                    value={String(editingWeapon.classId ?? 1)}
                    onChange={(val) =>
                      setEditingWeapon({ ...editingWeapon, classId: Number(val) })
                    }
                  />
                  <NumberInput
                    label="Weapon Skill ID"
                    value={editingWeapon.skillId ?? 101}
                    onChange={(val) => setEditingWeapon({ ...editingWeapon, skillId: val })}
                    isIntegerOnly
                  />
                </Grid>

                <Grid columns={{ minWidth: 130, max: 3, repeat: 'fit' }} gap={3}>
                  <NumberInput
                    label="Speed Mod (+)"
                    value={editingWeapon.statModifiers?.speed ?? 0}
                    onChange={(val) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: { ...editingWeapon.statModifiers, speed: val },
                      })
                    }
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Max HP Mod (+)"
                    value={editingWeapon.statModifiers?.maxHP ?? 0}
                    onChange={(val) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: { ...editingWeapon.statModifiers, maxHP: val },
                      })
                    }
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Max SP Mod (+)"
                    value={editingWeapon.statModifiers?.maxSkillPoint ?? 0}
                    onChange={(val) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: { ...editingWeapon.statModifiers, maxSkillPoint: val },
                      })
                    }
                    isIntegerOnly
                  />
                </Grid>

                <CheckboxInput
                  label="Starter Weapon"
                  description="Grant this weapon to newly created player inventories."
                  value={editingWeapon.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingWeapon({ ...editingWeapon, givenAtRegister: checked })
                  }
                />

                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onClick={() => setEditingWeapon(null)}
                  />
                  <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* DIALOG: Edit Trinket */}
      <Dialog
        isOpen={editingTrinket !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTrinket(null);
        }}
        purpose="form"
        width={520}
      >
        {editingTrinket && (
          <VStack gap={4}>
            <DialogHeader
              title={`Edit Trinket • #${editingTrinket.trinketId}`}
              startContent={<Gem className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingTrinket(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateTrinket}>
              <VStack gap={3}>
                <TextInput
                  label="Trinket Name"
                  value={editingTrinket.name || ''}
                  onChange={(val) => setEditingTrinket({ ...editingTrinket, name: val })}
                  isRequired
                />
                <NumberInput
                  label="Associated Skill ID"
                  value={editingTrinket.skillId ?? 4001}
                  onChange={(val) => setEditingTrinket({ ...editingTrinket, skillId: val })}
                  isIntegerOnly
                />

                <Grid columns={{ minWidth: 130, max: 3, repeat: 'fit' }} gap={3}>
                  <NumberInput
                    label="Speed Mod (+)"
                    value={editingTrinket.statModifiers?.speed ?? 0}
                    onChange={(val) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: { ...editingTrinket.statModifiers, speed: val },
                      })
                    }
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Max HP Mod (+)"
                    value={editingTrinket.statModifiers?.maxHP ?? 0}
                    onChange={(val) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: { ...editingTrinket.statModifiers, maxHP: val },
                      })
                    }
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Max SP Mod (+)"
                    value={editingTrinket.statModifiers?.maxSkillPoint ?? 0}
                    onChange={(val) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: { ...editingTrinket.statModifiers, maxSkillPoint: val },
                      })
                    }
                    isIntegerOnly
                  />
                </Grid>

                <CheckboxInput
                  label="Starter Trinket"
                  description="Grant this trinket immediately upon registration."
                  value={editingTrinket.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingTrinket({ ...editingTrinket, givenAtRegister: checked })
                  }
                />

                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onClick={() => setEditingTrinket(null)}
                  />
                  <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* DIALOG: Edit Chapter & Scenes */}
      <Dialog
        isOpen={editingChapter !== null}
        onOpenChange={(open) => {
          if (!open) setEditingChapter(null);
        }}
        purpose="form"
        width={600}
      >
        {editingChapter && (
          <VStack gap={4}>
            <DialogHeader
              title={`Edit Chapter • CH #${editingChapter.chapterId}`}
              startContent={<BookOpen className="w-5 h-5 text-emerald-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingChapter(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateChapter}>
              <VStack gap={3}>
                <TextInput
                  label="Chapter Title"
                  value={editingChapter.title || editingChapter.chapterName || ''}
                  onChange={(val) => setEditingChapter({ ...editingChapter, title: val })}
                  isRequired
                />
                <TextInput
                  label="Default Map Reference ID"
                  value={editingChapter.mapId || 'MD_PVE_C0S1'}
                  onChange={(val) => setEditingChapter({ ...editingChapter, mapId: val })}
                />

                <Card variant="muted" padding={3}>
                  <VStack gap={2}>
                    <HStack justify="between" vAlign="center">
                      <Text size="sm" weight="bold" color="primary">
                        Scenes Sequence ({editingChapter.scenes?.length || 0})
                      </Text>
                    </HStack>

                    {editingChapter.scenes && editingChapter.scenes.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {editingChapter.scenes.map((sc, scIdx) => (
                          <Card key={scIdx} variant="default" padding={2}>
                            <HStack justify="between" vAlign="center" gap={2}>
                              <VStack gap={0.5}>
                                <HStack gap={1.5} vAlign="center" wrap="wrap">
                                  <Badge variant="yellow" label={`Scene #${sc.sceneId}`} />
                                  <Badge variant="purple" label={sc.type || 'Battle'} />
                                  <Text type="code" size="xsm" color="secondary">
                                    Map: {sc.mapId || editingChapter.mapId}
                                  </Text>
                                </HStack>
                                <Text size="xsm" color="secondary">
                                  {sc.description || sc.sceneName || 'Battle encounter sequence'}
                                </Text>
                              </VStack>
                              <IconButton
                                size="sm"
                                variant="destructive"
                                label={`Remove Scene #${sc.sceneId}`}
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => {
                                  const updated = (editingChapter.scenes || []).filter(
                                    (_, i) => i !== scIdx
                                  );
                                  setEditingChapter({ ...editingChapter, scenes: updated });
                                }}
                              />
                            </HStack>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Text type="supporting" size="xsm" color="secondary">
                        No scenes attached to this chapter.
                      </Text>
                    )}

                    <VStack gap={2}>
                      <Text size="xsm" weight="bold" color="accent">
                        + Append New Scene
                      </Text>
                      <Grid columns={{ minWidth: 160, max: 2, repeat: 'fit' }} gap={2}>
                        <Selector
                          label="Scene Type"
                          options={SCENE_TYPE_OPTIONS}
                          value={newSceneType}
                          onChange={(val) => setNewSceneType(String(val))}
                        />
                        <TextInput
                          label="Scene Map ID"
                          value={newSceneMapId}
                          onChange={setNewSceneMapId}
                          placeholder="MD_PVE_C0S1"
                        />
                      </Grid>
                      <HStack gap={2} vAlign="end">
                        <div className="flex-1">
                          <TextInput
                            label="Scene Description"
                            value={newSceneDescription}
                            onChange={setNewSceneDescription}
                            placeholder="Encounter summary..."
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          label="Append Scene"
                          icon={<Plus className="w-3.5 h-3.5" />}
                          onClick={() => {
                            const currentScenes = editingChapter.scenes || [];
                            const nextSceneId =
                              currentScenes.reduce((max, s) => Math.max(max, s.sceneId), -1) + 1;
                            const addedScene: SceneConfig = {
                              sceneId: nextSceneId,
                              type: newSceneType,
                              description: newSceneDescription.trim() || `Scene #${nextSceneId}`,
                              mapId: newSceneMapId.trim() || editingChapter.mapId || 'MD_PVE_C0S1',
                              autoResume: false,
                              autoAdvance: false,
                            };
                            setEditingChapter({
                              ...editingChapter,
                              scenes: [...currentScenes, addedScene],
                            });
                            setNewSceneDescription('');
                          }}
                        />
                      </HStack>
                    </VStack>
                  </VStack>
                </Card>

                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onClick={() => setEditingChapter(null)}
                  />
                  <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* DIALOG: Edit Class */}
      <Dialog
        isOpen={editingClass !== null}
        onOpenChange={(open) => {
          if (!open) setEditingClass(null);
        }}
        purpose="form"
        width={460}
      >
        {editingClass && (
          <VStack gap={4}>
            <DialogHeader
              title={`Edit Class • ID #${editingClass.classId}`}
              startContent={<Layers className="w-5 h-5 text-indigo-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingClass(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateClass}>
              <VStack gap={3}>
                <TextInput
                  label="Class Archetype Name"
                  value={editingClass.name || ''}
                  onChange={(val) => setEditingClass({ ...editingClass, name: val })}
                  isRequired
                />
                <NumberInput
                  label="Movement Skill ID"
                  value={editingClass.movementSkillId ?? 1001}
                  onChange={(val) => setEditingClass({ ...editingClass, movementSkillId: val })}
                  isIntegerOnly
                />
                <NumberInput
                  label="Class Combat Skill ID"
                  value={editingClass.classSkillId ?? 3001}
                  onChange={(val) => setEditingClass({ ...editingClass, classSkillId: val })}
                  isIntegerOnly
                />
                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onClick={() => setEditingClass(null)}
                  />
                  <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* DIALOG: Edit Skill */}
      <Dialog
        isOpen={editingSkill !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSkill(null);
        }}
        purpose="form"
        width={400}
      >
        {editingSkill && (
          <VStack gap={4}>
            <DialogHeader
              title="Edit Skill ID"
              startContent={<Zap className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setEditingSkill(null);
              }}
            />

            {modalError && (
              <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
            )}

            <form onSubmit={handleUpdateSkill}>
              <VStack gap={3}>
                <NumberInput
                  label="Combat Skill ID"
                  value={Number(editingSkill.skillId ?? 1001)}
                  onChange={(val) => setEditingSkill({ ...editingSkill, skillId: val })}
                  isIntegerOnly
                />
                <HStack justify="end" gap={2} paddingBlockStart={2}>
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onClick={() => setEditingSkill(null)}
                  />
                  <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
                </HStack>
              </VStack>
            </form>
          </VStack>
        )}
      </Dialog>

      {/* ========================================================= */}
      {/* ADD DIALOGS                                               */}
      {/* ========================================================= */}

      {/* DIALOG: Add Hero Unit */}
      <Dialog
        isOpen={isAddingUnit}
        onOpenChange={(open) => {
          if (!open) setIsAddingUnit(false);
        }}
        purpose="form"
        width={460}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Hero Definition"
            subtitle="Registers a new playable Hero unit in MongoDB."
            startContent={<Shield className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingUnit(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddUnit}>
            <VStack gap={3}>
              <TextInput
                label="Hero Unit Name"
                value={newUnitName}
                onChange={setNewUnitName}
                placeholder="e.g. Paladin, Shadow Assassin"
                isRequired
              />
              <Selector
                label="Primary Class"
                options={classSelectorOptions}
                value={String(newUnitClassId)}
                onChange={(val) => setNewUnitClassId(Number(val))}
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button variant="secondary" label="Cancel" onClick={() => setIsAddingUnit(false)} />
                <Button type="submit" variant="primary" label="Save Hero" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Add Weapon (BR-04) */}
      <Dialog
        isOpen={isAddingWeapon}
        onOpenChange={(open) => {
          if (!open) setIsAddingWeapon(false);
        }}
        purpose="form"
        width={480}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Weapon Definition (BR-04)"
            subtitle="Configure weapon attributes and strict Class compatibility per BR-04."
            startContent={<Sword className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingWeapon(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddWeapon}>
            <VStack gap={3}>
              <TextInput
                label="Weapon Name"
                value={newWeaponName}
                onChange={setNewWeaponName}
                placeholder="e.g. Claymore of Judgment"
                isRequired
              />
              <Grid columns={{ minWidth: 170, max: 2, repeat: 'fit' }} gap={3}>
                <Selector
                  label="Target Class (BR-04)"
                  options={classSelectorOptions}
                  value={String(newWeaponClassId)}
                  onChange={(val) => setNewWeaponClassId(Number(val))}
                />
                <NumberInput
                  label="Weapon Skill ID"
                  value={newWeaponSkillId}
                  onChange={setNewWeaponSkillId}
                  isIntegerOnly
                />
              </Grid>
              <Grid columns={{ minWidth: 170, max: 2, repeat: 'fit' }} gap={3}>
                <NumberInput
                  label="Speed Modifier (+)"
                  value={newWeaponSpeedMod}
                  onChange={setNewWeaponSpeedMod}
                  isIntegerOnly
                />
                <NumberInput
                  label="Max HP Modifier (+)"
                  value={newWeaponHpMod}
                  onChange={setNewWeaponHpMod}
                  isIntegerOnly
                />
              </Grid>
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setIsAddingWeapon(false)}
                />
                <Button type="submit" variant="primary" label="Save Weapon" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Add Trinket */}
      <Dialog
        isOpen={isAddingTrinket}
        onOpenChange={(open) => {
          if (!open) setIsAddingTrinket(false);
        }}
        purpose="form"
        width={480}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Trinket Definition"
            subtitle="Configure accessory artifacts with passive skill triggers and stat boosts."
            startContent={<Gem className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingTrinket(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddTrinket}>
            <VStack gap={3}>
              <TextInput
                label="Trinket Name"
                value={newTrinketName}
                onChange={setNewTrinketName}
                placeholder="e.g. Amulet of the Sun"
                isRequired
              />
              <NumberInput
                label="Associated Skill ID"
                value={newTrinketSkillId}
                onChange={setNewTrinketSkillId}
                isIntegerOnly
              />
              <Grid columns={{ minWidth: 170, max: 2, repeat: 'fit' }} gap={3}>
                <NumberInput
                  label="Speed Modifier (+)"
                  value={newTrinketSpeedMod}
                  onChange={setNewTrinketSpeedMod}
                  isIntegerOnly
                />
                <NumberInput
                  label="Max HP Modifier (+)"
                  value={newTrinketHpMod}
                  onChange={setNewTrinketHpMod}
                  isIntegerOnly
                />
              </Grid>
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setIsAddingTrinket(false)}
                />
                <Button type="submit" variant="primary" label="Save Trinket" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Add Story Chapter */}
      <Dialog
        isOpen={isAddingChapter}
        onOpenChange={(open) => {
          if (!open) setIsAddingChapter(false);
        }}
        purpose="form"
        width={460}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Story Chapter Config"
            startContent={<BookOpen className="w-5 h-5 text-emerald-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingChapter(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddChapter}>
            <VStack gap={3}>
              <TextInput
                label="Chapter Title"
                value={newChapterTitle}
                onChange={setNewChapterTitle}
                placeholder="e.g. Chapter 4 - Trial of Ashes"
                isRequired
              />
              <TextInput
                label="Default Map Reference ID"
                value={newChapterMapId}
                onChange={setNewChapterMapId}
                placeholder="e.g. MD_PVE_C4S1"
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setIsAddingChapter(false)}
                />
                <Button type="submit" variant="primary" label="Save Chapter" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Add Class */}
      <Dialog
        isOpen={isAddingClass}
        onOpenChange={(open) => {
          if (!open) setIsAddingClass(false);
        }}
        purpose="form"
        width={460}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Class Definition"
            startContent={<Layers className="w-5 h-5 text-indigo-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingClass(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddClass}>
            <VStack gap={3}>
              <TextInput
                label="Class Archetype Name"
                value={newClassName}
                onChange={setNewClassName}
                placeholder="e.g. Berserker, Necromancer"
                isRequired
              />
              <Grid columns={{ minWidth: 170, max: 2, repeat: 'fit' }} gap={3}>
                <NumberInput
                  label="Movement Skill ID"
                  value={newClassMoveSkillId}
                  onChange={setNewClassMoveSkillId}
                  isIntegerOnly
                />
                <NumberInput
                  label="Class Combat Skill ID"
                  value={newClassSkillId}
                  onChange={setNewClassSkillId}
                  isIntegerOnly
                />
              </Grid>
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button variant="secondary" label="Cancel" onClick={() => setIsAddingClass(false)} />
                <Button type="submit" variant="primary" label="Save Class" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* DIALOG: Add Skill */}
      <Dialog
        isOpen={isAddingSkill}
        onOpenChange={(open) => {
          if (!open) setIsAddingSkill(false);
        }}
        purpose="form"
        width={380}
      >
        <VStack gap={4}>
          <DialogHeader
            title="Add Skill Definition"
            startContent={<Zap className="w-5 h-5 text-amber-500" />}
            onOpenChange={(open) => {
              if (!open) setIsAddingSkill(false);
            }}
          />

          {modalError && (
            <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
          )}

          <form onSubmit={handleAddSkill}>
            <VStack gap={3}>
              <NumberInput
                label="Combat Skill ID"
                value={newSkillId}
                onChange={setNewSkillId}
                isIntegerOnly
              />
              <HStack justify="end" gap={2} paddingBlockStart={2}>
                <Button variant="secondary" label="Cancel" onClick={() => setIsAddingSkill(false)} />
                <Button type="submit" variant="primary" label="Save Skill" isLoading={saving} />
              </HStack>
            </VStack>
          </form>
        </VStack>
      </Dialog>

      {/* Sensitive Action Delete Guard */}
      <SensitiveActionModal
        isOpen={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name || 'Game Definition'}`}
        description={`Permanently deletes this record from the ${pendingDelete?.endpoint || 'CMS'} MongoDB collection. This cannot be undone from the client portal.`}
        severity="HIGH"
        actionLabel="Confirm Delete"
        targetSummary={
          pendingDelete ? `${pendingDelete.endpoint} / ${pendingDelete.id}` : undefined
        }
        loading={deleteLoading}
        error={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={executePendingDelete}
      />
    </ConsolePage>
  );
};
