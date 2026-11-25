import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  EquipmentStatModifiers,
  SceneConfig,
  SceneType,
  SkillDefinition,
  TrinketDefinition,
  UnitDefinition,
  UnitGradeStats,
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
  warning?: string;
}

type SkillDomain = 'movement' | 'weapon' | 'class' | 'trinket' | 'passive' | 'other';

const SCENE_TYPE_OPTIONS: SelectorOptionData[] = [
  { value: 'Battle', label: 'Battle (PVE Grid)' },
  { value: 'Cutscene', label: 'Cutscene' },
  { value: 'Dialogue', label: 'Dialogue' },
];

const EMPTY_STAT_MODIFIERS: EquipmentStatModifiers = {
  maxHP: 0,
  speed: 0,
  maxSkillPoint: 0,
  damageMultiplier: 0,
  damageReduction: 0,
};

function createDefaultUnitGrades(): UnitGradeStats[] {
  return [
    {
      grade: 1,
      maxHP: 3,
      speed: 115,
      maxSkillPoint: 2,
      damageMultiplier: 100,
      damageReduction: 0,
    },
    {
      grade: 2,
      maxHP: 4,
      speed: 125,
      maxSkillPoint: 3,
      damageMultiplier: 100,
      damageReduction: 0,
    },
  ];
}

function createEmptyScene(sceneId = 0, type: SceneType | string = 'Battle', mapId = ''): SceneConfig {
  return {
    sceneId,
    type,
    autoResume: false,
    autoAdvance: true,
    description: '',
    mapId: type === 'Battle' ? mapId : '',
  };
}

function getSkillDomainInfo(skillId: number): {
  domain: SkillDomain;
  label: string;
  badgeVariant: 'info' | 'cyan' | 'purple' | 'warning' | 'success' | 'neutral';
} {
  if (skillId >= 1000 && skillId < 2000) {
    return { domain: 'movement', label: 'Movement (1xxx)', badgeVariant: 'info' };
  }
  if (skillId >= 2000 && skillId < 3000) {
    return { domain: 'weapon', label: 'Weapon (2xxx)', badgeVariant: 'cyan' };
  }
  if (skillId >= 3000 && skillId < 4000) {
    return { domain: 'class', label: 'Class (3xxx)', badgeVariant: 'purple' };
  }
  if (skillId >= 4000 && skillId < 5000) {
    return { domain: 'trinket', label: 'Trinket (4xxx)', badgeVariant: 'warning' };
  }
  if (skillId >= 5000 && skillId < 6000) {
    return { domain: 'passive', label: 'Passive (5xxx)', badgeVariant: 'success' };
  }
  return { domain: 'other', label: 'Custom', badgeVariant: 'neutral' };
}

function buildSkillSelectorOptions(
  skills: SkillDefinition[],
  domain: SkillDomain,
  includeNone = false
): SelectorOptionData[] {
  const matching = skills
    .filter((s) => getSkillDomainInfo(Number(s.skillId)).domain === domain)
    .sort((a, b) => Number(a.skillId) - Number(b.skillId));

  const source =
    matching.length > 0
      ? matching
      : [...skills].sort((a, b) => Number(a.skillId) - Number(b.skillId));

  const options: SelectorOptionData[] = source.map((s) => {
    const id = Number(s.skillId);
    const info = getSkillDomainInfo(id);
    return {
      value: String(id),
      label: `Skill #${id} • ${info.label}`,
    };
  });

  if (includeNone) {
    options.unshift({ value: '-1', label: 'None (-1)' });
  }

  return options;
}

function normalizeStatModifiers(raw?: Partial<EquipmentStatModifiers>): EquipmentStatModifiers {
  return {
    maxHP: Number(raw?.maxHP ?? 0),
    speed: Number(raw?.speed ?? 0),
    maxSkillPoint: Number(raw?.maxSkillPoint ?? 0),
    damageMultiplier: Number(raw?.damageMultiplier ?? 0),
    damageReduction: Number(raw?.damageReduction ?? 0),
  };
}

function extractApiError(err: unknown, fallback: string): string {
  const errObj = err as { response?: { data?: { message?: string } }; message?: string };
  return errObj?.response?.data?.message || errObj?.message || fallback;
}

function renderStatModifierBadges(
  modifiers: Partial<EquipmentStatModifiers> | undefined,
  emptyLabel: string
): React.ReactNode {
  const maxHP = modifiers?.maxHP ?? 0;
  const speed = modifiers?.speed ?? 0;
  const maxSP = modifiers?.maxSkillPoint ?? 0;
  const dmgMult = modifiers?.damageMultiplier ?? 0;
  const dmgRed = modifiers?.damageReduction ?? 0;

  if (!speed && !maxHP && !maxSP && !dmgMult && !dmgRed) {
    return (
      <Text type="supporting" size="xsm" color="secondary">
        {emptyLabel}
      </Text>
    );
  }

  const formatSigned = (val: number, suffix: string) =>
    `${val > 0 ? `+${val}` : val} ${suffix}`;

  return (
    <HStack gap={1.5} wrap="wrap">
      {maxHP !== 0 && <Badge variant="success" label={formatSigned(maxHP, 'MaxHP')} />}
      {speed !== 0 && <Badge variant="warning" label={formatSigned(speed, 'Speed')} />}
      {maxSP !== 0 && <Badge variant="cyan" label={formatSigned(maxSP, 'SP')} />}
      {dmgMult !== 0 && <Badge variant="purple" label={formatSigned(dmgMult, '% DMG')} />}
      {dmgRed !== 0 && <Badge variant="info" label={formatSigned(dmgRed, '% DR')} />}
    </HStack>
  );
}

interface StatModifiersFieldsProps {
  value: EquipmentStatModifiers;
  onChange: (next: EquipmentStatModifiers) => void;
}

const StatModifiersFields: React.FC<StatModifiersFieldsProps> = ({ value, onChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(
    () => value.damageMultiplier !== 0 || value.damageReduction !== 0
  );

  return (
    <VStack gap={2}>
      <HStack justify="between" vAlign="center">
        <Text size="sm" weight="medium" color="secondary">
          Equipment Stat Modifiers
        </Text>
        <Button
          size="sm"
          variant="secondary"
          label={showAdvanced ? 'Hide DMG/DR' : 'Advanced (DMG/DR)'}
          onClick={() => setShowAdvanced((prev) => !prev)}
        />
      </HStack>
      <Grid columns={{ minWidth: 130, max: 3, repeat: 'fit' }} gap={2}>
        <NumberInput
          label="Max HP"
          value={value.maxHP}
          onChange={(val) => onChange({ ...value, maxHP: val })}
          isIntegerOnly
        />
        <NumberInput
          label="Speed"
          value={value.speed}
          onChange={(val) => onChange({ ...value, speed: val })}
          isIntegerOnly
        />
        <NumberInput
          label="Max SP"
          value={value.maxSkillPoint}
          onChange={(val) => onChange({ ...value, maxSkillPoint: val })}
          isIntegerOnly
        />
        {showAdvanced && (
          <>
            <NumberInput
              label="Damage Multiplier (%)"
              value={value.damageMultiplier}
              onChange={(val) => onChange({ ...value, damageMultiplier: val })}
              isIntegerOnly
            />
            <NumberInput
              label="Damage Reduction (%)"
              value={value.damageReduction}
              onChange={(val) => onChange({ ...value, damageReduction: val })}
              isIntegerOnly
            />
          </>
        )}
      </Grid>
    </VStack>
  );
};

interface UnitGradesEditorProps {
  grades: UnitGradeStats[];
  onChange: (next: UnitGradeStats[]) => void;
}

const UnitGradesEditor: React.FC<UnitGradesEditorProps> = ({ grades, onChange }) => {
  const [showCombatMods, setShowCombatMods] = useState(() =>
    grades.some((g) => g.damageMultiplier !== 100 || g.damageReduction !== 0)
  );

  const handleGradeChange = (index: number, patch: Partial<UnitGradeStats>) => {
    onChange(grades.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const handleAddGrade = () => {
    const last = grades[grades.length - 1];
    const nextGrade = grades.length + 1;
    onChange([
      ...grades,
      {
        grade: nextGrade,
        maxHP: last ? last.maxHP + 1 : 3,
        speed: last ? last.speed + 10 : 115,
        maxSkillPoint: last ? last.maxSkillPoint + 1 : 2,
        damageMultiplier: last ? last.damageMultiplier : 100,
        damageReduction: last ? last.damageReduction : 0,
      },
    ]);
  };

  const handleRemoveGrade = (index: number) => {
    const remaining = grades
      .filter((_, i) => i !== index)
      .map((g, i) => ({ ...g, grade: i + 1 }));
    onChange(remaining);
  };

  return (
    <Card variant="muted" padding={3}>
      <VStack gap={2}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <VStack gap={0.5}>
            <Text size="sm" weight="bold" color="primary">
              Stats By Grade ({grades.length})
            </Text>
            <Text type="supporting" size="xsm" color="secondary">
              LocalDB scale: MaxHP 2–5, Speed 100–140, MaxSP 2–5.
            </Text>
          </VStack>
          <HStack gap={1.5}>
            <Button
              size="sm"
              variant="secondary"
              label={showCombatMods ? 'Hide DMG/DR' : 'DMG/DR'}
              onClick={() => setShowCombatMods((prev) => !prev)}
            />
            <Button
              size="sm"
              variant="secondary"
              label="Add Grade"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddGrade}
            />
          </HStack>
        </HStack>

        <div className="space-y-2">
          {grades.map((g, idx) => (
            <Card key={idx} variant="default" padding={2}>
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
                  <Badge variant="yellow" label={`Grade ${g.grade}`} />
                  {grades.length > 1 && (
                    <IconButton
                      size="sm"
                      variant="destructive"
                      label={`Remove Grade ${g.grade}`}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => handleRemoveGrade(idx)}
                    />
                  )}
                </HStack>
                <Grid columns={{ minWidth: 110, max: 3, repeat: 'fit' }} gap={2}>
                  <NumberInput
                    label="Max HP"
                    value={g.maxHP}
                    min={1}
                    onChange={(val) => handleGradeChange(idx, { maxHP: val })}
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Speed"
                    value={g.speed}
                    min={1}
                    onChange={(val) => handleGradeChange(idx, { speed: val })}
                    isIntegerOnly
                  />
                  <NumberInput
                    label="Max SP"
                    value={g.maxSkillPoint}
                    min={0}
                    onChange={(val) => handleGradeChange(idx, { maxSkillPoint: val })}
                    isIntegerOnly
                  />
                  {showCombatMods && (
                    <>
                      <NumberInput
                        label="DMG Mult (%)"
                        value={g.damageMultiplier}
                        min={0}
                        onChange={(val) => handleGradeChange(idx, { damageMultiplier: val })}
                        isIntegerOnly
                      />
                      <NumberInput
                        label="DMG Red (%)"
                        value={g.damageReduction}
                        min={0}
                        onChange={(val) => handleGradeChange(idx, { damageReduction: val })}
                        isIntegerOnly
                      />
                    </>
                  )}
                </Grid>
              </VStack>
            </Card>
          ))}
        </div>
      </VStack>
    </Card>
  );
};

interface ClassMultiSelectorProps {
  classes: ClassDefinition[];
  selectedIds: number[];
  onChange: (nextIds: number[]) => void;
}

const ClassMultiSelector: React.FC<ClassMultiSelectorProps> = ({
  classes,
  selectedIds,
  onChange,
}) => (
  <VStack gap={1.5}>
    <Text size="sm" weight="medium" color="secondary">
      Assigned SRPG Classes (at least 1 required)
    </Text>
    <Grid columns={{ minWidth: 150, max: 3, repeat: 'fit' }} gap={2}>
      {classes.map((c) => {
        const cId = Number(c.classId);
        const isChecked = selectedIds.includes(cId);
        return (
          <Card key={c.classId} variant="muted" padding={2}>
            <CheckboxInput
              label={c.name || c.className || `Class #${c.classId}`}
              value={isChecked}
              onChange={(checked) => {
                const updated = checked
                  ? isChecked
                    ? selectedIds
                    : [...selectedIds, cId]
                  : selectedIds.filter((id) => id !== cId);
                onChange(updated);
              }}
            />
          </Card>
        );
      })}
    </Grid>
  </VStack>
);

const VALID_CONTENT_TABS: ContentTab[] = [
  'units',
  'weapons',
  'trinkets',
  'chapters',
  'classes',
  'skills',
];

function parseContentTabParam(value: string | null): ContentTab | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase() as ContentTab;
  return VALID_CONTENT_TABS.includes(normalized) ? normalized : null;
}

export const ContentManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryTab = parseContentTabParam(searchParams.get('tab'));
  const querySearch = searchParams.get('search') || '';
  const [prevQueryKey, setPrevQueryKey] = useState(`${queryTab ?? ''}|${querySearch}`);

  const [activeTab, setActiveTab] = useState<ContentTab>(queryTab ?? 'units');
  const [searchTerm, setSearchTerm] = useState(querySearch);

  const currentQueryKey = `${queryTab ?? ''}|${querySearch}`;
  if (currentQueryKey !== prevQueryKey) {
    setPrevQueryKey(currentQueryKey);
    if (queryTab) {
      setActiveTab(queryTab);
    }
    if (querySearch) {
      setSearchTerm(querySearch);
    }
  }
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

  // Add Unit State
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitClassIds, setNewUnitClassIds] = useState<number[]>([1]);
  const [newUnitPassiveSkillId, setNewUnitPassiveSkillId] = useState(-1);
  const [newUnitGivenAtRegister, setNewUnitGivenAtRegister] = useState(false);
  const [newUnitGrades, setNewUnitGrades] = useState<UnitGradeStats[]>(createDefaultUnitGrades);

  // Add Weapon State
  const [isAddingWeapon, setIsAddingWeapon] = useState(false);
  const [newWeaponName, setNewWeaponName] = useState('');
  const [newWeaponClassId, setNewWeaponClassId] = useState(1);
  const [newWeaponSkillId, setNewWeaponSkillId] = useState(2001);
  const [newWeaponModifiers, setNewWeaponModifiers] = useState<EquipmentStatModifiers>({
    ...EMPTY_STAT_MODIFIERS,
  });
  const [newWeaponGivenAtRegister, setNewWeaponGivenAtRegister] = useState(false);

  // Add Trinket State
  const [isAddingTrinket, setIsAddingTrinket] = useState(false);
  const [newTrinketName, setNewTrinketName] = useState('');
  const [newTrinketSkillId, setNewTrinketSkillId] = useState(4001);
  const [newTrinketModifiers, setNewTrinketModifiers] = useState<EquipmentStatModifiers>({
    ...EMPTY_STAT_MODIFIERS,
  });
  const [newTrinketGivenAtRegister, setNewTrinketGivenAtRegister] = useState(false);

  // Add Chapter State
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterMapId, setNewChapterMapId] = useState('MD_PVE_C0S1');
  const [newChapterInitialScene, setNewChapterInitialScene] = useState<SceneConfig>(() =>
    createEmptyScene(1, 'Battle', 'MD_PVE_C0S1')
  );

  // Add Class State
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassMoveSkillId, setNewClassMoveSkillId] = useState(1001);
  const [newClassSkillId, setNewClassSkillId] = useState(3001);

  // Add Skill State
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillId, setNewSkillId] = useState(1001);

  // Chapter Scene Editor Subform State (used for both Add & Edit scene inside Chapter modal)
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [sceneDraft, setSceneDraft] = useState<SceneConfig>(() =>
    createEmptyScene(0, 'Battle', 'MD_PVE_C0S1')
  );

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
      label: `${c.name || c.className || `Class #${c.classId}`} (#${c.classId})`,
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

  const movementSkillOptions = useMemo(
    () => buildSkillSelectorOptions(skills, 'movement'),
    [skills]
  );
  const weaponSkillOptions = useMemo(
    () => buildSkillSelectorOptions(skills, 'weapon'),
    [skills]
  );
  const classCombatSkillOptions = useMemo(
    () => buildSkillSelectorOptions(skills, 'class'),
    [skills]
  );
  const trinketSkillOptions = useMemo(
    () => buildSkillSelectorOptions(skills, 'trinket'),
    [skills]
  );
  const passiveSkillOptions = useMemo(
    () => buildSkillSelectorOptions(skills, 'passive', true),
    [skills]
  );

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

  const classUsageMap = useMemo(() => {
    const map = new Map<number, string[]>();
    const addRef = (classId: unknown, refLabel: string) => {
      const idNum = Number(classId);
      if (!Number.isFinite(idNum) || idNum <= 0) return;
      const list = map.get(idNum) ?? [];
      list.push(refLabel);
      map.set(idNum, list);
    };
    for (const u of units) {
      for (const cid of u.classIds || []) {
        addRef(cid, `Hero: ${u.unitName || u.name || `#${u.uId}`}`);
      }
    }
    for (const w of weapons) {
      addRef(w.classId, `Weapon: ${w.name || `#${w.weaponId}`}`);
    }
    return map;
  }, [units, weapons]);

  // Shared Delete Handler
  const handleDelete = useCallback(
    (endpoint: string, id: string | undefined, name: string, warning?: string) => {
      if (!id) {
        setFeedback({
          status: 'error',
          title: 'Cannot Delete Record',
          detail: `Cannot delete ${name}: Missing database ObjectId.`,
        });
        return;
      }
      setDeleteError(null);
      setPendingDelete({ endpoint, id, name, warning });
    },
    []
  );

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

  const validateUnitPayload = (name: string, classIds: number[], grades: UnitGradeStats[]) => {
    if (!name.trim()) return 'Hero Unit Name is required.';
    if (classIds.length === 0) return 'Hero Unit must be assigned to at least 1 Class.';
    if (grades.length === 0) return 'Hero Unit must define at least 1 Grade stat tier.';
    const seenGrades = new Set<number>();
    for (const g of grades) {
      if (g.grade <= 0) return 'Grade number must be >= 1.';
      if (seenGrades.has(g.grade)) return `Duplicate Grade #${g.grade} in StatsByGrade.`;
      seenGrades.add(g.grade);
      if (g.maxHP <= 0 || g.speed <= 0) {
        return `Grade #${g.grade}: MaxHP and Speed must be greater than 0.`;
      }
    }
    return null;
  };

  // HERO UNIT HANDLERS
  const openAddUnitModal = useCallback(() => {
    setModalError(null);
    setNewUnitName('');
    setNewUnitClassIds([Number(classes[0]?.classId ?? 1)]);
    const firstPassive = skills.find((s) => getSkillDomainInfo(Number(s.skillId)).domain === 'passive');
    setNewUnitPassiveSkillId(firstPassive ? Number(firstPassive.skillId) : -1);
    setNewUnitGivenAtRegister(false);
    setNewUnitGrades(createDefaultUnitGrades());
    setIsAddingUnit(true);
  }, [classes, skills]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitName.trim();
    const validationErr = validateUnitPayload(trimmed, newUnitClassIds, newUnitGrades);
    if (validationErr) {
      setModalError(validationErr);
      return;
    }
    const maxUid = units.reduce((max, u) => Math.max(max, Number(u.uId) || 0), 0);
    const newUid = maxUid > 0 ? maxUid + 1 : 1;
    const payload: Omit<UnitDefinition, 'id' | 'name'> = {
      uId: newUid,
      unitName: trimmed,
      passiveSkillId: newUnitPassiveSkillId,
      classIds: newUnitClassIds,
      givenAtRegister: newUnitGivenAtRegister,
      statsByGrade: [...newUnitGrades].sort((a, b) => a.grade - b.grade),
    };

    await runContentMutation({
      execute: () => adminClient.post('/UnitDefinition', payload).then(() => undefined),
      auditAction: 'UNIT_DEFINITION_CREATED',
      targetType: 'UnitDefinition',
      targetLabel: trimmed,
      successTitle: 'Hero Definition Created',
      successDetail: `Created Hero "${trimmed}" (UID #${newUid}).`,
      errorFallback: 'Failed to add hero definition.',
      onSuccess: () => setIsAddingUnit(false),
    });
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit?.id) return;
    const trimmed = (editingUnit.unitName || '').trim();
    const grades =
      editingUnit.statsByGrade && editingUnit.statsByGrade.length > 0
        ? editingUnit.statsByGrade
        : createDefaultUnitGrades();
    const validationErr = validateUnitPayload(trimmed, editingUnit.classIds || [], grades);
    if (validationErr) {
      setModalError(validationErr);
      return;
    }

    const payload: UnitDefinition = {
      id: editingUnit.id,
      uId: editingUnit.uId,
      unitName: trimmed,
      passiveSkillId: Number(editingUnit.passiveSkillId ?? -1),
      classIds: editingUnit.classIds,
      givenAtRegister: Boolean(editingUnit.givenAtRegister),
      statsByGrade: [...grades].sort((a, b) => a.grade - b.grade),
    };

    await runContentMutation({
      execute: () => adminClient.put(`/UnitDefinition/${editingUnit.id}`, payload).then(() => undefined),
      auditAction: 'UNIT_DEFINITION_UPDATED',
      targetType: 'UnitDefinition',
      targetId: editingUnit.id,
      targetLabel: trimmed,
      successTitle: 'Hero Definition Updated',
      successDetail: `Saved changes to "${trimmed}" (UID #${editingUnit.uId}).`,
      errorFallback: 'Failed to update hero definition.',
      onSuccess: () => setEditingUnit(null),
    });
  };

  // WEAPON HANDLERS
  const openAddWeaponModal = useCallback(() => {
    setModalError(null);
    setNewWeaponName('');
    setNewWeaponClassId(Number(classes[0]?.classId ?? 1));
    const firstWeaponSkill = skills.find(
      (s) => getSkillDomainInfo(Number(s.skillId)).domain === 'weapon'
    );
    setNewWeaponSkillId(firstWeaponSkill ? Number(firstWeaponSkill.skillId) : 2001);
    setNewWeaponModifiers({ ...EMPTY_STAT_MODIFIERS });
    setNewWeaponGivenAtRegister(false);
    setIsAddingWeapon(true);
  }, [classes, skills]);

  const handleAddWeapon = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWeaponName.trim();
    if (!trimmed) {
      setModalError('Weapon Name is required.');
      return;
    }
    const maxWId = weapons.reduce((max, w) => Math.max(max, Number(w.weaponId) || 0), 0);
    const newWId = maxWId > 0 ? maxWId + 1 : 1;
    const payload: Omit<WeaponDefinition, 'id'> = {
      weaponId: newWId,
      name: trimmed,
      classId: newWeaponClassId,
      skillId: newWeaponSkillId,
      statModifiers: normalizeStatModifiers(newWeaponModifiers),
      givenAtRegister: newWeaponGivenAtRegister,
    };

    await runContentMutation({
      execute: () => adminClient.post('/WeaponDefinition', payload).then(() => undefined),
      auditAction: 'WEAPON_DEFINITION_CREATED',
      targetType: 'WeaponDefinition',
      targetLabel: trimmed,
      successTitle: 'Weapon Created',
      successDetail: `Added weapon "${trimmed}" (#${newWId}).`,
      errorFallback: 'Failed to add weapon definition.',
      onSuccess: () => setIsAddingWeapon(false),
    });
  };

  const handleUpdateWeapon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWeapon?.id) return;
    const trimmed = (editingWeapon.name || '').trim();
    if (!trimmed) {
      setModalError('Weapon Name is required.');
      return;
    }
    const payload: WeaponDefinition = {
      id: editingWeapon.id,
      weaponId: editingWeapon.weaponId,
      name: trimmed,
      classId: Number(editingWeapon.classId),
      skillId: Number(editingWeapon.skillId),
      statModifiers: normalizeStatModifiers(editingWeapon.statModifiers),
      givenAtRegister: Boolean(editingWeapon.givenAtRegister),
    };
    await runContentMutation({
      execute: () =>
        adminClient.put(`/WeaponDefinition/${editingWeapon.id}`, payload).then(() => undefined),
      auditAction: 'WEAPON_DEFINITION_UPDATED',
      targetType: 'WeaponDefinition',
      targetId: editingWeapon.id,
      targetLabel: trimmed,
      successTitle: 'Weapon Updated',
      successDetail: `Saved changes to weapon "${trimmed}" (#${editingWeapon.weaponId}).`,
      errorFallback: 'Failed to update weapon definition.',
      onSuccess: () => setEditingWeapon(null),
    });
  };

  // TRINKET HANDLERS
  const openAddTrinketModal = useCallback(() => {
    setModalError(null);
    setNewTrinketName('');
    const firstTrinketSkill = skills.find(
      (s) => getSkillDomainInfo(Number(s.skillId)).domain === 'trinket'
    );
    setNewTrinketSkillId(firstTrinketSkill ? Number(firstTrinketSkill.skillId) : 4001);
    setNewTrinketModifiers({ ...EMPTY_STAT_MODIFIERS });
    setNewTrinketGivenAtRegister(false);
    setIsAddingTrinket(true);
  }, [skills]);

  const handleAddTrinket = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTrinketName.trim();
    if (!trimmed) {
      setModalError('Trinket Name is required.');
      return;
    }
    const maxTId = trinkets.reduce((max, t) => Math.max(max, Number(t.trinketId) || 0), 0);
    const newTId = maxTId > 0 ? maxTId + 1 : 1;
    const payload: Omit<TrinketDefinition, 'id'> = {
      trinketId: newTId,
      name: trimmed,
      skillId: newTrinketSkillId,
      statModifiers: normalizeStatModifiers(newTrinketModifiers),
      givenAtRegister: newTrinketGivenAtRegister,
    };

    await runContentMutation({
      execute: () => adminClient.post('/TrinketDefinition', payload).then(() => undefined),
      auditAction: 'TRINKET_DEFINITION_CREATED',
      targetType: 'TrinketDefinition',
      targetLabel: trimmed,
      successTitle: 'Trinket Created',
      successDetail: `Added trinket "${trimmed}" (#${newTId}).`,
      errorFallback: 'Failed to add trinket definition.',
      onSuccess: () => setIsAddingTrinket(false),
    });
  };

  const handleUpdateTrinket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrinket?.id) return;
    const trimmed = (editingTrinket.name || '').trim();
    if (!trimmed) {
      setModalError('Trinket Name is required.');
      return;
    }
    const payload: TrinketDefinition = {
      id: editingTrinket.id,
      trinketId: editingTrinket.trinketId,
      name: trimmed,
      skillId: Number(editingTrinket.skillId),
      statModifiers: normalizeStatModifiers(editingTrinket.statModifiers),
      givenAtRegister: Boolean(editingTrinket.givenAtRegister),
    };
    await runContentMutation({
      execute: () =>
        adminClient.put(`/TrinketDefinition/${editingTrinket.id}`, payload).then(() => undefined),
      auditAction: 'TRINKET_DEFINITION_UPDATED',
      targetType: 'TrinketDefinition',
      targetId: editingTrinket.id,
      targetLabel: trimmed,
      successTitle: 'Trinket Updated',
      successDetail: `Saved changes to trinket "${trimmed}" (#${editingTrinket.trinketId}).`,
      errorFallback: 'Failed to update trinket definition.',
      onSuccess: () => setEditingTrinket(null),
    });
  };

  // CHAPTER HANDLERS
  const openAddChapterModal = useCallback(() => {
    setModalError(null);
    const maxCId = chapters.reduce((max, c) => Math.max(max, c.chapterId ?? -1), -1);
    const nextCId = maxCId >= 0 ? maxCId + 1 : 0;
    const defaultMapId = `MD_PVE_C${nextCId}S1`;
    setNewChapterTitle('');
    setNewChapterMapId(defaultMapId);
    setNewChapterInitialScene({
      sceneId: 1,
      type: 'Battle',
      autoResume: false,
      autoAdvance: true,
      description: `${nextCId}.1 - Opening Encounter`,
      mapId: defaultMapId,
    });
    setIsAddingChapter(true);
  }, [chapters]);

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChapterTitle.trim();
    if (!trimmed) {
      setModalError('Chapter Title is required.');
      return;
    }
    const maxCId = chapters.reduce((max, c) => Math.max(max, c.chapterId ?? -1), -1);
    const newCId = maxCId >= 0 ? maxCId + 1 : 0;
    const mapId = newChapterMapId.trim() || `MD_PVE_C${newCId}S1`;
    const initialScene: SceneConfig = {
      ...newChapterInitialScene,
      description: newChapterInitialScene.description.trim() || `${trimmed} - Scene #${newChapterInitialScene.sceneId}`,
      mapId:
        newChapterInitialScene.type === 'Battle'
          ? newChapterInitialScene.mapId.trim() || mapId
          : '',
    };

    const payload: Omit<ChapterConfig, 'id'> = {
      chapterId: newCId,
      title: trimmed,
      mapId,
      scenes: [initialScene],
    };

    await runContentMutation({
      execute: () => adminClient.post('/ChapterConfig', payload).then(() => undefined),
      auditAction: 'CHAPTER_CONFIG_CREATED',
      targetType: 'ChapterConfig',
      targetLabel: trimmed,
      successTitle: 'Chapter Created',
      successDetail: `Created Chapter #${newCId}: "${trimmed}".`,
      errorFallback: 'Failed to add chapter configuration.',
      onSuccess: () => setIsAddingChapter(false),
    });
  };

  const handleUpdateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter?.id) return;
    const trimmed = (editingChapter.title || '').trim();
    if (!trimmed) {
      setModalError('Chapter Title is required.');
      return;
    }
    const payload: ChapterConfig = {
      id: editingChapter.id,
      chapterId: editingChapter.chapterId,
      title: trimmed,
      mapId: (editingChapter.mapId || '').trim(),
      scenes: (editingChapter.scenes || []).map((sc) => ({
        sceneId: Number(sc.sceneId),
        type: sc.type || 'Battle',
        autoResume: Boolean(sc.autoResume),
        autoAdvance: Boolean(sc.autoAdvance),
        description: sc.description || '',
        mapId: sc.type === 'Battle' ? (sc.mapId || '').trim() : '',
      })),
    };
    await runContentMutation({
      execute: () =>
        adminClient.put(`/ChapterConfig/${editingChapter.id}`, payload).then(() => undefined),
      auditAction: 'CHAPTER_CONFIG_UPDATED',
      targetType: 'ChapterConfig',
      targetId: editingChapter.id,
      targetLabel: trimmed,
      successTitle: 'Chapter Updated',
      successDetail: `Updated Chapter #${editingChapter.chapterId}.`,
      errorFallback: 'Failed to update chapter configuration.',
      onSuccess: () => {
        setEditingChapter(null);
        setEditingSceneIndex(null);
      },
    });
  };

  // CLASS HANDLERS
  const openAddClassModal = useCallback(() => {
    setModalError(null);
    setNewClassName('');
    const firstMove = skills.find((s) => getSkillDomainInfo(Number(s.skillId)).domain === 'movement');
    const firstClassSkill = skills.find(
      (s) => getSkillDomainInfo(Number(s.skillId)).domain === 'class'
    );
    setNewClassMoveSkillId(firstMove ? Number(firstMove.skillId) : 1001);
    setNewClassSkillId(firstClassSkill ? Number(firstClassSkill.skillId) : 3001);
    setIsAddingClass(true);
  }, [skills]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) {
      setModalError('Class Archetype Name is required.');
      return;
    }
    const maxClId = classes.reduce((max, c) => Math.max(max, Number(c.classId) || 0), 0);
    const newClId = maxClId > 0 ? maxClId + 1 : 1;
    const payload: Omit<ClassDefinition, 'id' | 'className'> = {
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
      onSuccess: () => setIsAddingClass(false),
    });
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass?.id) return;
    const trimmed = (editingClass.name || editingClass.className || '').trim();
    if (!trimmed) {
      setModalError('Class Archetype Name is required.');
      return;
    }
    const payload: ClassDefinition = {
      id: editingClass.id,
      classId: Number(editingClass.classId),
      name: trimmed,
      movementSkillId: Number(editingClass.movementSkillId),
      classSkillId: Number(editingClass.classSkillId),
    };
    await runContentMutation({
      execute: () =>
        adminClient.put(`/ClassDefinition/${editingClass.id}`, payload).then(() => undefined),
      auditAction: 'CLASS_DEFINITION_UPDATED',
      targetType: 'ClassDefinition',
      targetId: editingClass.id,
      targetLabel: trimmed,
      successTitle: 'Class Definition Updated',
      successDetail: `Updated Class "${trimmed}" (#${editingClass.classId}).`,
      errorFallback: 'Failed to update class definition.',
      onSuccess: () => setEditingClass(null),
    });
  };

  // SKILL HANDLERS
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillNum = Number(newSkillId);
    if (!Number.isInteger(skillNum) || skillNum <= 0) {
      setModalError('Skill ID must be a positive integer.');
      return;
    }
    if (skills.some((s) => Number(s.skillId) === skillNum)) {
      setModalError(`Skill #${skillNum} already exists.`);
      return;
    }
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
    const skillNum = Number(editingSkill.skillId);
    if (!Number.isInteger(skillNum) || skillNum <= 0) {
      setModalError('Skill ID must be a positive integer.');
      return;
    }
    if (skills.some((s) => s.id !== editingSkill.id && Number(s.skillId) === skillNum)) {
      setModalError(`Skill #${skillNum} already exists.`);
      return;
    }
    const payload: SkillDefinition = {
      id: editingSkill.id,
      skillId: skillNum,
    };
    await runContentMutation({
      execute: () =>
        adminClient.put(`/SkillDefinition/${editingSkill.id}`, payload).then(() => undefined),
      auditAction: 'SKILL_DEFINITION_UPDATED',
      targetType: 'SkillDefinition',
      targetId: editingSkill.id,
      targetLabel: `Skill #${skillNum}`,
      successTitle: 'Skill Definition Updated',
      successDetail: `Updated Skill #${skillNum}.`,
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
              variant="success"
              label={`Skill #${u.passiveSkillId}`}
              icon={<Zap className="w-3 h-3" />}
            />
          ) : (
            <Text type="supporting" size="xsm" color="secondary">
              None (-1)
            </Text>
          ),
      },
      {
        key: 'classIds',
        header: 'Class Designation',
        width: proportional(1.4, { minWidth: 185 }),
        renderCell: (u) => {
          const ids = u.classIds && u.classIds.length > 0 ? u.classIds : [];
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
        header: 'Grade Stats',
        width: pixel(210),
        renderCell: (u) => {
          const g1 = Array.isArray(u.statsByGrade) ? u.statsByGrade[0] : undefined;
          return g1 ? (
            <Text type="code" size="xsm" color="secondary">
              HP {g1.maxHP} • SPD {g1.speed} • SP {g1.maxSkillPoint} • {u.statsByGrade.length} tier
              {u.statsByGrade.length === 1 ? '' : 's'}
            </Text>
          ) : (
            <Text type="supporting" size="xsm" color="secondary">
              No grades
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
                setEditingUnit({
                  ...u,
                  unitName: u.unitName || u.name || '',
                  classIds: Array.isArray(u.classIds) ? [...u.classIds] : [],
                  statsByGrade:
                    Array.isArray(u.statsByGrade) && u.statsByGrade.length > 0
                      ? u.statsByGrade.map((g) => ({ ...g }))
                      : createDefaultUnitGrades(),
                });
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
            {ch.title || `Chapter #${ch.chapterId}`}
          </Text>
        ),
      },
      {
        key: 'mapId',
        header: 'Map Reference',
        width: pixel(165),
        renderCell: (ch) => (
          <Text type="code" size="xsm" color="secondary">
            {ch.mapId || '—'}
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
          );
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
                setEditingSceneIndex(null);
                const nextSceneId =
                  (ch.scenes || []).reduce((max, s) => Math.max(max, s.sceneId), -1) + 1;
                setSceneDraft(createEmptyScene(nextSceneId, 'Battle', ch.mapId || 'MD_PVE_C0S1'));
                setEditingChapter({
                  ...ch,
                  scenes: (ch.scenes || []).map((sc) => ({ ...sc })),
                });
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
                  ch.title || `Chapter #${ch.chapterId}`
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
        width: pixel(230),
        renderCell: (w) => (
          <Badge
            variant="cyan"
            icon={<Shield className="w-3 h-3" />}
            label={
              w.classId !== undefined
                ? classLabelById.get(Number(w.classId)) || `Class #${w.classId}`
                : 'Unassigned'
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
            variant="cyan"
            icon={<Zap className="w-3 h-3" />}
            label={`Skill #${w.skillId ?? '—'}`}
          />
        ),
      },
      {
        key: 'statModifiers',
        header: 'Stat Modifiers',
        width: proportional(1.6, { minWidth: 180 }),
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
                setEditingWeapon({
                  ...w,
                  statModifiers: normalizeStatModifiers(w.statModifiers),
                });
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
        header: 'Trinket Skill',
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
        width: proportional(1.6, { minWidth: 180 }),
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
                setEditingTrinket({
                  ...t,
                  statModifiers: normalizeStatModifiers(t.statModifiers),
                });
              }}
            />
            <IconButton
              size="sm"
              variant="destructive"
              label={`Delete ${t.name || `Trinket #${t.trinketId}`}`}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() =>
                handleDelete('TrinketDefinition', t.id, t.name || `Trinket #${t.trinketId}`)
              }
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
          String(c.title || '')
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
        const idNum = Number(s.skillId);
        const refs = skillUsageMap.get(idNum) ?? [];
        const domainInfo = getSkillDomainInfo(idNum);
        return (
          String(s.skillId ?? '').toLowerCase().includes(normalizedQuery) ||
          domainInfo.label.toLowerCase().includes(normalizedQuery) ||
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
          onAdd: openAddUnitModal,
        };
      case 'chapters':
        return {
          endpoint: '/api/ChapterConfig',
          addLabel: 'Add Chapter',
          shown: filteredChapterRows.length,
          total: chapters.length,
          onAdd: openAddChapterModal,
        };
      case 'weapons':
        return {
          endpoint: '/api/WeaponDefinition',
          addLabel: 'Add Weapon',
          shown: filteredWeaponRows.length,
          total: weapons.length,
          onAdd: openAddWeaponModal,
        };
      case 'trinkets':
        return {
          endpoint: '/api/TrinketDefinition',
          addLabel: 'Add Trinket',
          shown: filteredTrinketRows.length,
          total: trinkets.length,
          onAdd: openAddTrinketModal,
        };
      case 'classes':
        return {
          endpoint: '/api/ClassDefinition',
          addLabel: 'Add Class',
          shown: filteredClasses.length,
          total: classes.length,
          onAdd: openAddClassModal,
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
    openAddUnitModal,
    openAddChapterModal,
    openAddWeaponModal,
    openAddTrinketModal,
    openAddClassModal,
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
          <div key="panel-units" role="tabpanel" id="panel-units" className="pk-tab-panel">
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
                      onClick={openAddUnitModal}
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="pk-table-scroll rounded-lg border border-[var(--color-border-subtle)]">
                <Table
                  columns={unitColumns}
                  data={filteredUnitRows}
                  idKey="id"
                  density="balanced"
                  hasHover
                  aria-label="SRPG Hero Definitions"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. CHAPTERS TAB */}
        {activeTab === 'chapters' && (
          <div key="panel-chapters" role="tabpanel" id="panel-chapters" className="pk-tab-panel">
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
                      onClick={openAddChapterModal}
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="pk-table-scroll rounded-lg border border-[var(--color-border-subtle)]">
                <Table
                  columns={chapterColumns}
                  data={filteredChapterRows}
                  idKey="id"
                  density="balanced"
                  hasHover
                  aria-label="Story Chapters"
                />
              </div>
            )}
          </div>
        )}

        {/* 3. WEAPONS TAB */}
        {activeTab === 'weapons' && (
          <div key="panel-weapons" role="tabpanel" id="panel-weapons" className="pk-tab-panel">
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
                      onClick={openAddWeaponModal}
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="pk-table-scroll rounded-lg border border-[var(--color-border-subtle)]">
                <Table
                  columns={weaponColumns}
                  data={filteredWeaponRows}
                  idKey="id"
                  density="balanced"
                  hasHover
                  aria-label="Weapon Definitions"
                />
              </div>
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
                      onClick={openAddTrinketModal}
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="pk-table-scroll rounded-lg border border-[var(--color-border-subtle)]">
                <Table
                  columns={trinketColumns}
                  data={filteredTrinketRows}
                  idKey="id"
                  density="balanced"
                  hasHover
                  aria-label="Trinket Definitions"
                />
              </div>
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
                      onClick={openAddClassModal}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Grid columns={{ minWidth: 250, max: 3, repeat: 'fit' }} gap={3}>
                {filteredClasses.map((c, idx) => {
                  const classRefs = classUsageMap.get(Number(c.classId)) ?? [];
                  return (
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
                              setEditingClass({ ...c });
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
                                c.name || c.className || `Class #${c.classId}`,
                                classRefs.length > 0
                                  ? `Warning: Still referenced by ${classRefs.length} record(s): ${classRefs.slice(0, 4).join(', ')}${classRefs.length > 4 ? '...' : ''}.`
                                  : undefined
                              )
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
                      onClick={() => {
                        setModalError(null);
                        setIsAddingSkill(true);
                      }}
                    />
                  ) : undefined
                }
              />
            ) : (
              <Grid columns={{ minWidth: 195, max: 5, repeat: 'fit' }} gap={3}>
                {filteredSkills.map((s, idx) => {
                  const idNum = Number(s.skillId);
                  const refs = skillUsageMap.get(idNum) ?? [];
                  const domainInfo = getSkillDomainInfo(idNum);
                  return (
                    <Card key={s.id || idx} variant="muted" padding={3}>
                      <VStack gap={2} hAlign="center">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <Badge variant="yellow" label={`Skill #${s.skillId}`} />
                        <Badge variant={domainInfo.badgeVariant} label={domainInfo.label} />
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
                              setEditingSkill({ ...s });
                            }}
                          />
                          <IconButton
                            size="sm"
                            variant="destructive"
                            label={`Delete Skill #${s.skillId}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDelete(
                                'SkillDefinition',
                                s.id,
                                `Skill #${s.skillId}`,
                                refs.length > 0
                                  ? `Warning: Still referenced by ${refs.length} record(s): ${refs.slice(0, 4).join(', ')}${refs.length > 4 ? '...' : ''}.`
                                  : undefined
                              )
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
        width={620}
        maxHeight="90dvh"
      >
        {editingUnit && (
          <form onSubmit={handleUpdateUnit} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={`Edit Hero • UID #${editingUnit.uId}`}
                startContent={<Shield className="w-5 h-5 text-amber-500" />}
                onOpenChange={(open) => {
                  if (!open) setEditingUnit(null);
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

                <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={3}>
                  <TextInput
                    label="Hero Unit Name"
                    value={editingUnit.unitName || ''}
                    onChange={(val) => setEditingUnit({ ...editingUnit, unitName: val })}
                    isRequired
                  />
                  <Selector
                    label="Passive Skill (5xxx)"
                    options={passiveSkillOptions}
                    value={String(editingUnit.passiveSkillId ?? -1)}
                    onChange={(val) =>
                      setEditingUnit({ ...editingUnit, passiveSkillId: Number(val) })
                    }
                  />
                </Grid>

                <ClassMultiSelector
                  classes={classes}
                  selectedIds={editingUnit.classIds || []}
                  onChange={(nextIds) => setEditingUnit({ ...editingUnit, classIds: nextIds })}
                />

                <UnitGradesEditor
                  grades={editingUnit.statsByGrade || []}
                  onChange={(nextGrades) =>
                    setEditingUnit({ ...editingUnit, statsByGrade: nextGrades })
                  }
                />

                <CheckboxInput
                  label="Initial Starter Hero"
                  description="Grant this hero automatically to newly registered accounts without gacha summoning."
                  value={editingUnit.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingUnit({ ...editingUnit, givenAtRegister: checked })
                  }
                />
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button variant="secondary" label="Cancel" onClick={() => setEditingUnit(null)} />
                <Button
                  type="submit"
                  variant="primary"
                  label="Save Changes"
                  isLoading={saving}
                />
              </HStack>
            </div>
          </form>
        )}
      </Dialog>

      {/* DIALOG: Edit Weapon (BR-04) */}
      <Dialog
        isOpen={editingWeapon !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWeapon(null);
        }}
        purpose="form"
        width={560}
        maxHeight="90dvh"
      >
        {editingWeapon && (
          <form onSubmit={handleUpdateWeapon} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={`Edit Weapon • #${editingWeapon.weaponId}`}
                startContent={<Sword className="w-5 h-5 text-amber-500" />}
                onOpenChange={(open) => {
                  if (!open) setEditingWeapon(null);
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

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
                  <Selector
                    label="Weapon Skill (2xxx)"
                    options={weaponSkillOptions}
                    value={String(editingWeapon.skillId ?? 2001)}
                    onChange={(val) =>
                      setEditingWeapon({ ...editingWeapon, skillId: Number(val) })
                    }
                  />
                </Grid>

                <StatModifiersFields
                  value={normalizeStatModifiers(editingWeapon.statModifiers)}
                  onChange={(nextMods) =>
                    setEditingWeapon({ ...editingWeapon, statModifiers: nextMods })
                  }
                />

                <CheckboxInput
                  label="Starter Weapon"
                  description="Grant this weapon to newly created player inventories."
                  value={editingWeapon.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingWeapon({ ...editingWeapon, givenAtRegister: checked })
                  }
                />
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setEditingWeapon(null)}
                />
                <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
              </HStack>
            </div>
          </form>
        )}
      </Dialog>

      {/* DIALOG: Edit Trinket */}
      <Dialog
        isOpen={editingTrinket !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTrinket(null);
        }}
        purpose="form"
        width={560}
        maxHeight="90dvh"
      >
        {editingTrinket && (
          <form onSubmit={handleUpdateTrinket} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={`Edit Trinket • #${editingTrinket.trinketId}`}
                startContent={<Gem className="w-5 h-5 text-amber-500" />}
                onOpenChange={(open) => {
                  if (!open) setEditingTrinket(null);
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

                <TextInput
                  label="Trinket Name"
                  value={editingTrinket.name || ''}
                  onChange={(val) => setEditingTrinket({ ...editingTrinket, name: val })}
                  isRequired
                />
                <Selector
                  label="Trinket Skill (4xxx)"
                  options={trinketSkillOptions}
                  value={String(editingTrinket.skillId ?? 4001)}
                  onChange={(val) =>
                    setEditingTrinket({ ...editingTrinket, skillId: Number(val) })
                  }
                />

                <StatModifiersFields
                  value={normalizeStatModifiers(editingTrinket.statModifiers)}
                  onChange={(nextMods) =>
                    setEditingTrinket({ ...editingTrinket, statModifiers: nextMods })
                  }
                />

                <CheckboxInput
                  label="Starter Trinket"
                  description="Grant this trinket immediately upon registration."
                  value={editingTrinket.givenAtRegister ?? false}
                  onChange={(checked) =>
                    setEditingTrinket({ ...editingTrinket, givenAtRegister: checked })
                  }
                />
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setEditingTrinket(null)}
                />
                <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
              </HStack>
            </div>
          </form>
        )}
      </Dialog>

      {/* DIALOG: Edit Chapter & Scenes */}
      <Dialog
        isOpen={editingChapter !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingChapter(null);
            setEditingSceneIndex(null);
          }
        }}
        purpose="form"
        width={640}
        maxHeight="90dvh"
      >
        {editingChapter && (
          <form onSubmit={handleUpdateChapter} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={`Edit Chapter • CH #${editingChapter.chapterId}`}
                startContent={<BookOpen className="w-5 h-5 text-emerald-500" />}
                onOpenChange={(open) => {
                  if (!open) {
                    setEditingChapter(null);
                    setEditingSceneIndex(null);
                  }
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

                <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={3}>
                      <TextInput
                        label="Chapter Title"
                        value={editingChapter.title || ''}
                        onChange={(val) => setEditingChapter({ ...editingChapter, title: val })}
                        isRequired
                      />
                      <TextInput
                        label="Default Map Reference ID"
                        value={editingChapter.mapId || ''}
                        onChange={(val) => setEditingChapter({ ...editingChapter, mapId: val })}
                        placeholder="MD_PVE_C0S1"
                      />
                    </Grid>

                    <Card variant="muted" padding={3}>
                      <VStack gap={2}>
                        <HStack justify="between" vAlign="center">
                          <Text size="sm" weight="bold" color="primary">
                            Scenes Sequence ({editingChapter.scenes?.length || 0})
                          </Text>
                        </HStack>

                        {editingChapter.scenes && editingChapter.scenes.length > 0 ? (
                          <div className="space-y-2">
                        {editingChapter.scenes.map((sc, scIdx) => (
                          <Card key={scIdx} variant="default" padding={2}>
                            <HStack justify="between" vAlign="center" gap={2}>
                              <VStack gap={0.5}>
                                <HStack gap={1.5} vAlign="center" wrap="wrap">
                                  <Badge variant="yellow" label={`Scene #${sc.sceneId}`} />
                                  <Badge variant="purple" label={sc.type || 'Battle'} />
                                  {sc.autoResume && <Badge variant="info" label="AutoResume" />}
                                  {sc.autoAdvance && <Badge variant="success" label="AutoAdvance" />}
                                  <Text type="code" size="xsm" color="secondary">
                                    Map: {sc.mapId || '—'}
                                  </Text>
                                </HStack>
                                <Text size="xsm" color="secondary">
                                  {sc.description || 'No description'}
                                </Text>
                              </VStack>
                              <HStack gap={1}>
                                <IconButton
                                  size="sm"
                                  variant="secondary"
                                  label={`Edit Scene #${sc.sceneId}`}
                                  icon={<Edit2 className="w-3.5 h-3.5" />}
                                  onClick={() => {
                                    setEditingSceneIndex(scIdx);
                                    setSceneDraft({ ...sc });
                                  }}
                                />
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
                                    if (editingSceneIndex === scIdx) {
                                      setEditingSceneIndex(null);
                                    }
                                  }}
                                />
                              </HStack>
                            </HStack>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Text type="supporting" size="xsm" color="secondary">
                        No scenes attached to this chapter.
                      </Text>
                    )}

                    <Card variant="default" padding={2}>
                      <VStack gap={2}>
                        <HStack justify="between" vAlign="center">
                          <Text size="xsm" weight="bold" color="accent">
                            {editingSceneIndex !== null
                              ? `Editing Scene #${sceneDraft.sceneId}`
                              : '+ Append New Scene'}
                          </Text>
                          {editingSceneIndex !== null && (
                            <Button
                              size="sm"
                              variant="secondary"
                              label="Cancel Edit"
                              onClick={() => {
                                setEditingSceneIndex(null);
                                const nextSceneId =
                                  (editingChapter.scenes || []).reduce(
                                    (max, s) => Math.max(max, s.sceneId),
                                    -1
                                  ) + 1;
                                setSceneDraft(
                                  createEmptyScene(
                                    nextSceneId,
                                    'Battle',
                                    editingChapter.mapId || 'MD_PVE_C0S1'
                                  )
                                );
                              }}
                            />
                          )}
                        </HStack>

                        <Grid columns={{ minWidth: 140, max: 3, repeat: 'fit' }} gap={2}>
                          <NumberInput
                            label="Scene ID"
                            value={sceneDraft.sceneId}
                            min={0}
                            onChange={(val) => setSceneDraft({ ...sceneDraft, sceneId: val })}
                            isIntegerOnly
                          />
                          <Selector
                            label="Scene Type"
                            options={SCENE_TYPE_OPTIONS}
                            value={sceneDraft.type}
                            onChange={(val) => {
                              const nextType = String(val);
                              setSceneDraft({
                                ...sceneDraft,
                                type: nextType,
                                mapId:
                                  nextType === 'Battle'
                                    ? sceneDraft.mapId || editingChapter.mapId || 'MD_PVE_C0S1'
                                    : '',
                              });
                            }}
                          />
                          <TextInput
                            label={
                              sceneDraft.type === 'Battle'
                                ? 'Scene Map ID'
                                : 'Map ID (empty for non-Battle)'
                            }
                            value={sceneDraft.mapId}
                            onChange={(val) => setSceneDraft({ ...sceneDraft, mapId: val })}
                            placeholder={sceneDraft.type === 'Battle' ? 'MD_PVE_C0S1' : ''}
                          />
                        </Grid>

                        <TextInput
                          label="Scene Description"
                          value={sceneDraft.description}
                          onChange={(val) => setSceneDraft({ ...sceneDraft, description: val })}
                          placeholder="e.g. 1.1 - Shield of the Vanguard"
                        />

                        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                          <HStack gap={4} wrap="wrap">
                            <CheckboxInput
                              label="AutoResume"
                              value={sceneDraft.autoResume}
                              onChange={(checked) =>
                                setSceneDraft({ ...sceneDraft, autoResume: checked })
                              }
                            />
                            <CheckboxInput
                              label="AutoAdvance"
                              value={sceneDraft.autoAdvance}
                              onChange={(checked) =>
                                setSceneDraft({ ...sceneDraft, autoAdvance: checked })
                              }
                            />
                          </HStack>

                          <Button
                            size="sm"
                            variant="secondary"
                            label={editingSceneIndex !== null ? 'Update Scene' : 'Append Scene'}
                            icon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => {
                              const currentScenes = editingChapter.scenes || [];
                              const normalizedScene: SceneConfig = {
                                sceneId: sceneDraft.sceneId,
                                type: sceneDraft.type || 'Battle',
                                autoResume: Boolean(sceneDraft.autoResume),
                                autoAdvance: Boolean(sceneDraft.autoAdvance),
                                description:
                                  sceneDraft.description.trim() || `Scene #${sceneDraft.sceneId}`,
                                mapId:
                                  sceneDraft.type === 'Battle'
                                    ? sceneDraft.mapId.trim() || editingChapter.mapId || 'MD_PVE_C0S1'
                                    : '',
                              };

                              if (editingSceneIndex !== null) {
                                const updated = currentScenes.map((item, idx) =>
                                  idx === editingSceneIndex ? normalizedScene : item
                                );
                                setEditingChapter({ ...editingChapter, scenes: updated });
                                setEditingSceneIndex(null);
                              } else {
                                const updated = [...currentScenes, normalizedScene];
                                setEditingChapter({ ...editingChapter, scenes: updated });
                                const nextId =
                                  updated.reduce((max, s) => Math.max(max, s.sceneId), -1) + 1;
                                setSceneDraft(
                                  createEmptyScene(
                                    nextId,
                                    'Battle',
                                    editingChapter.mapId || 'MD_PVE_C0S1'
                                  )
                                );
                              }
                            }}
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  </VStack>
                </Card>
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => {
                    setEditingChapter(null);
                    setEditingSceneIndex(null);
                  }}
                />
                <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
              </HStack>
            </div>
          </form>
        )}
      </Dialog>

      {/* DIALOG: Edit Class */}
      <Dialog
        isOpen={editingClass !== null}
        onOpenChange={(open) => {
          if (!open) setEditingClass(null);
        }}
        purpose="form"
        width={480}
        maxHeight="90dvh"
      >
        {editingClass && (
          <form onSubmit={handleUpdateClass} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title={`Edit Class • ID #${editingClass.classId}`}
                startContent={<Layers className="w-5 h-5 text-indigo-500" />}
                onOpenChange={(open) => {
                  if (!open) setEditingClass(null);
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

                <TextInput
                  label="Class Archetype Name"
                  value={editingClass.name || editingClass.className || ''}
                  onChange={(val) => setEditingClass({ ...editingClass, name: val })}
                  isRequired
                />
                <Selector
                  label="Movement Skill (1xxx)"
                  options={movementSkillOptions}
                  value={String(editingClass.movementSkillId ?? 1001)}
                  onChange={(val) =>
                    setEditingClass({ ...editingClass, movementSkillId: Number(val) })
                  }
                />
                <Selector
                  label="Class Combat Skill (3xxx)"
                  options={classCombatSkillOptions}
                  value={String(editingClass.classSkillId ?? 3001)}
                  onChange={(val) =>
                    setEditingClass({ ...editingClass, classSkillId: Number(val) })
                  }
                />
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setEditingClass(null)}
                />
                <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
              </HStack>
            </div>
          </form>
        )}
      </Dialog>

      {/* DIALOG: Edit Skill */}
      <Dialog
        isOpen={editingSkill !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSkill(null);
        }}
        purpose="form"
        width={420}
        maxHeight="90dvh"
      >
        {editingSkill && (
          <form onSubmit={handleUpdateSkill} className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="shrink-0">
              <DialogHeader
                title="Edit Skill ID"
                subtitle="Skill ID ranges: 1xxx Move, 2xxx Weapon, 3xxx Class, 4xxx Trinket, 5xxx Passive."
                startContent={<Zap className="w-5 h-5 text-amber-500" />}
                onOpenChange={(open) => {
                  if (!open) setEditingSkill(null);
                }}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <VStack gap={3}>
                {modalError && (
                  <Banner status="error" title="Update Failed" description={modalError} collapsible={false} />
                )}

                <NumberInput
                  label="Combat Skill ID"
                  value={Number(editingSkill.skillId ?? 1001)}
                  min={1}
                  onChange={(val) => setEditingSkill({ ...editingSkill, skillId: val })}
                  isIntegerOnly
                />
              </VStack>
            </div>

            <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
              <HStack justify="end" gap={2} wrap="wrap">
                <Button
                  variant="secondary"
                  label="Cancel"
                  onClick={() => setEditingSkill(null)}
                />
                <Button type="submit" variant="primary" label="Save Changes" isLoading={saving} />
              </HStack>
            </div>
          </form>
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
        width={620}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddUnit} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Hero Definition"
              subtitle="Registers a new playable Hero unit in MongoDB."
              startContent={<Shield className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingUnit(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

              <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={3}>
                <TextInput
                  label="Hero Unit Name"
                  value={newUnitName}
                  onChange={setNewUnitName}
                  placeholder="e.g. Paladin, Shadow Assassin"
                  isRequired
                />
                <Selector
                  label="Passive Skill (5xxx)"
                  options={passiveSkillOptions}
                  value={String(newUnitPassiveSkillId)}
                  onChange={(val) => setNewUnitPassiveSkillId(Number(val))}
                />
              </Grid>

              <ClassMultiSelector
                classes={classes}
                selectedIds={newUnitClassIds}
                onChange={setNewUnitClassIds}
              />

              <UnitGradesEditor grades={newUnitGrades} onChange={setNewUnitGrades} />

              <CheckboxInput
                label="Initial Starter Hero"
                description="Grant this hero automatically to newly registered accounts without gacha summoning."
                value={newUnitGivenAtRegister}
                onChange={setNewUnitGivenAtRegister}
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button variant="secondary" label="Cancel" onClick={() => setIsAddingUnit(false)} />
              <Button type="submit" variant="primary" label="Save Hero" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add Weapon (BR-04) */}
      <Dialog
        isOpen={isAddingWeapon}
        onOpenChange={(open) => {
          if (!open) setIsAddingWeapon(false);
        }}
        purpose="form"
        width={560}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddWeapon} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Weapon Definition (BR-04)"
              subtitle="Configure weapon attributes and strict Class compatibility per BR-04."
              startContent={<Sword className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingWeapon(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

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
                <Selector
                  label="Weapon Skill (2xxx)"
                  options={weaponSkillOptions}
                  value={String(newWeaponSkillId)}
                  onChange={(val) => setNewWeaponSkillId(Number(val))}
                />
              </Grid>

              <StatModifiersFields
                value={newWeaponModifiers}
                onChange={setNewWeaponModifiers}
              />

              <CheckboxInput
                label="Starter Weapon"
                description="Grant this weapon to newly created player inventories."
                value={newWeaponGivenAtRegister}
                onChange={setNewWeaponGivenAtRegister}
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                onClick={() => setIsAddingWeapon(false)}
              />
              <Button type="submit" variant="primary" label="Save Weapon" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add Trinket */}
      <Dialog
        isOpen={isAddingTrinket}
        onOpenChange={(open) => {
          if (!open) setIsAddingTrinket(false);
        }}
        purpose="form"
        width={560}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddTrinket} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Trinket Definition"
              subtitle="Configure accessory artifacts with passive skill triggers and stat boosts."
              startContent={<Gem className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingTrinket(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

              <TextInput
                label="Trinket Name"
                value={newTrinketName}
                onChange={setNewTrinketName}
                placeholder="e.g. Amulet of the Sun"
                isRequired
              />
              <Selector
                label="Trinket Skill (4xxx)"
                options={trinketSkillOptions}
                value={String(newTrinketSkillId)}
                onChange={(val) => setNewTrinketSkillId(Number(val))}
              />

              <StatModifiersFields
                value={newTrinketModifiers}
                onChange={setNewTrinketModifiers}
              />

              <CheckboxInput
                label="Starter Trinket"
                description="Grant this trinket immediately upon registration."
                value={newTrinketGivenAtRegister}
                onChange={setNewTrinketGivenAtRegister}
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                onClick={() => setIsAddingTrinket(false)}
              />
              <Button type="submit" variant="primary" label="Save Trinket" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add Story Chapter */}
      <Dialog
        isOpen={isAddingChapter}
        onOpenChange={(open) => {
          if (!open) setIsAddingChapter(false);
        }}
        purpose="form"
        width={540}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddChapter} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Story Chapter Config"
              startContent={<BookOpen className="w-5 h-5 text-emerald-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingChapter(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

              <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={3}>
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
              </Grid>

              <Card variant="muted" padding={3}>
                <VStack gap={2}>
                  <Text size="sm" weight="bold" color="primary">
                    Initial Scene Config
                  </Text>
                  <Grid columns={{ minWidth: 140, max: 3, repeat: 'fit' }} gap={2}>
                    <NumberInput
                      label="Scene ID"
                      value={newChapterInitialScene.sceneId}
                      min={0}
                      onChange={(val) =>
                        setNewChapterInitialScene({ ...newChapterInitialScene, sceneId: val })
                      }
                      isIntegerOnly
                    />
                    <Selector
                      label="Scene Type"
                      options={SCENE_TYPE_OPTIONS}
                      value={newChapterInitialScene.type}
                      onChange={(val) => {
                        const nextType = String(val);
                        setNewChapterInitialScene({
                          ...newChapterInitialScene,
                          type: nextType,
                          mapId:
                            nextType === 'Battle'
                              ? newChapterInitialScene.mapId || newChapterMapId
                              : '',
                        });
                      }}
                    />
                    <TextInput
                      label="Scene Map ID"
                      value={newChapterInitialScene.mapId}
                      onChange={(val) =>
                        setNewChapterInitialScene({ ...newChapterInitialScene, mapId: val })
                      }
                      placeholder={newChapterInitialScene.type === 'Battle' ? 'MD_PVE_C4S1' : ''}
                    />
                  </Grid>
                  <TextInput
                    label="Scene Description"
                    value={newChapterInitialScene.description}
                    onChange={(val) =>
                      setNewChapterInitialScene({ ...newChapterInitialScene, description: val })
                    }
                    placeholder="e.g. 4.1 - Opening Battle"
                  />
                  <HStack gap={4} wrap="wrap">
                    <CheckboxInput
                      label="AutoResume"
                      value={newChapterInitialScene.autoResume}
                      onChange={(checked) =>
                        setNewChapterInitialScene({ ...newChapterInitialScene, autoResume: checked })
                      }
                    />
                    <CheckboxInput
                      label="AutoAdvance"
                      value={newChapterInitialScene.autoAdvance}
                      onChange={(checked) =>
                        setNewChapterInitialScene({ ...newChapterInitialScene, autoAdvance: checked })
                      }
                    />
                  </HStack>
                </VStack>
              </Card>
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button
                variant="secondary"
                label="Cancel"
                onClick={() => setIsAddingChapter(false)}
              />
              <Button type="submit" variant="primary" label="Save Chapter" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add Class */}
      <Dialog
        isOpen={isAddingClass}
        onOpenChange={(open) => {
          if (!open) setIsAddingClass(false);
        }}
        purpose="form"
        width={480}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddClass} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Class Definition"
              startContent={<Layers className="w-5 h-5 text-indigo-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingClass(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

              <TextInput
                label="Class Archetype Name"
                value={newClassName}
                onChange={setNewClassName}
                placeholder="e.g. Berserker, Necromancer"
                isRequired
              />
              <Selector
                label="Movement Skill (1xxx)"
                options={movementSkillOptions}
                value={String(newClassMoveSkillId)}
                onChange={(val) => setNewClassMoveSkillId(Number(val))}
              />
              <Selector
                label="Class Combat Skill (3xxx)"
                options={classCombatSkillOptions}
                value={String(newClassSkillId)}
                onChange={(val) => setNewClassSkillId(Number(val))}
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button variant="secondary" label="Cancel" onClick={() => setIsAddingClass(false)} />
              <Button type="submit" variant="primary" label="Save Class" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add Skill */}
      <Dialog
        isOpen={isAddingSkill}
        onOpenChange={(open) => {
          if (!open) setIsAddingSkill(false);
        }}
        purpose="form"
        width={420}
        maxHeight="90dvh"
      >
        <form onSubmit={handleAddSkill} className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="shrink-0">
            <DialogHeader
              title="Add Skill Definition"
              subtitle="Skill ID ranges: 1xxx Move, 2xxx Weapon, 3xxx Class, 4xxx Trinket, 5xxx Passive."
              startContent={<Zap className="w-5 h-5 text-amber-500" />}
              onOpenChange={(open) => {
                if (!open) setIsAddingSkill(false);
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <VStack gap={3}>
              {modalError && (
                <Banner status="error" title="Save Failed" description={modalError} collapsible={false} />
              )}

              <NumberInput
                label="Combat Skill ID"
                value={newSkillId}
                min={1}
                onChange={setNewSkillId}
                isIntegerOnly
              />
            </VStack>
          </div>

          <div className="shrink-0 pt-3 pb-1 border-t border-[var(--color-border-subtle)]">
            <HStack justify="end" gap={2} wrap="wrap">
              <Button variant="secondary" label="Cancel" onClick={() => setIsAddingSkill(false)} />
              <Button type="submit" variant="primary" label="Save Skill" isLoading={saving} />
            </HStack>
          </div>
        </form>
      </Dialog>

      {/* Sensitive Action Delete Guard */}
      <SensitiveActionModal
        isOpen={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name || 'Game Definition'}`}
        description={
          pendingDelete?.warning
            ? `${pendingDelete.warning} Deleting this record from ${pendingDelete.endpoint} cannot be undone from the client portal.`
            : `Permanently deletes this record from the ${pendingDelete?.endpoint || 'CMS'} MongoDB collection. This cannot be undone from the client portal.`
        }
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
