import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type {
  UnitDefinition,
  ChapterConfig,
  SceneConfig,
  WeaponDefinition,
  TrinketDefinition,
  ClassDefinition,
  SkillDefinition,
} from '../types';
import {
  BookOpen,
  Shield,
  Sword,
  Layers,
  Plus,
  RefreshCw,
  Zap,
  Inbox,
  Gem,
  Sparkles,
  Edit2,
  Trash2,
  X,
  MapPin,
} from 'lucide-react';

/**
 * ContentManagement Component
 * 
 * Re-architected to HoYoverse AAA Gaming Standards (RPG Armory & Archives):
 * Central archives interface for game designers and administrators to inspect,
 * configure, and manage core SRPG gameplay definitions stored in MongoDB.
 * 
 * Supports 6 core SRPG domain collections with full CRUD (Create, Read, Update, Delete):
 * 1. Hero Unit Definitions (`/api/UnitDefinition`)
 * 2. Story Chapters & Battle Scenes (`/api/ChapterConfig`)
 * 3. Weapons & Stat Modifiers with BR-04 class restrictions (`/api/WeaponDefinition`)
 * 4. Trinkets & Relics (`/api/TrinketDefinition`)
 * 5. Character Classes (`/api/ClassDefinition`)
 * 6. Combat Skills (`/api/SkillDefinition`)
 */
export const ContentManagement: React.FC = () => {
  // Navigation tab across the 6 SRPG definition categories
  const [activeTab, setActiveTab] = useState<'units' | 'chapters' | 'weapons' | 'trinkets' | 'classes' | 'skills'>('units');

  // Core Game Definition States
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [chapters, setChapters] = useState<ChapterConfig[]>([]);
  const [weapons, setWeapons] = useState<WeaponDefinition[]>([]);
  const [trinkets, setTrinkets] = useState<TrinketDefinition[]>([]);
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);

  // Synchronization loading state
  const [loading, setLoading] = useState(true);

  // Edit Modal States (for all 6 definitions)
  const [editingUnit, setEditingUnit] = useState<UnitDefinition | null>(null);
  const [editingWeapon, setEditingWeapon] = useState<WeaponDefinition | null>(null);
  const [editingTrinket, setEditingTrinket] = useState<TrinketDefinition | null>(null);
  const [editingChapter, setEditingChapter] = useState<ChapterConfig | null>(null);
  const [editingClass, setEditingClass] = useState<ClassDefinition | null>(null);
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);

  // Modal State for adding a new hero unit definition
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitClassId, setNewUnitClassId] = useState(1);

  // Modal State for adding a new weapon definition (BR-04)
  const [isAddingWeapon, setIsAddingWeapon] = useState(false);
  const [newWeaponName, setNewWeaponName] = useState('');
  const [newWeaponClassId, setNewWeaponClassId] = useState(1);
  const [newWeaponSkillId, setNewWeaponSkillId] = useState(101);
  const [newWeaponSpeedMod, setNewWeaponSpeedMod] = useState(0);
  const [newWeaponHpMod, setNewWeaponHpMod] = useState(0);

  // Modal State for adding a new trinket definition
  const [isAddingTrinket, setIsAddingTrinket] = useState(false);
  const [newTrinketName, setNewTrinketName] = useState('');
  const [newTrinketSkillId, setNewTrinketSkillId] = useState(4001);
  const [newTrinketSpeedMod, setNewTrinketSpeedMod] = useState(0);
  const [newTrinketHpMod, setNewTrinketHpMod] = useState(0);

  // Modal State for adding a new story chapter
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterMapId, setNewChapterMapId] = useState('MD_PVE_C0S1');

  // Modal State for adding a new class definition
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassMoveSkillId, setNewClassMoveSkillId] = useState(1001);
  const [newClassSkillId, setNewClassSkillId] = useState(3001);

  // Modal State for adding a new skill definition
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillId, setNewSkillId] = useState(1001);

  // Helper State for adding a scene into editingChapter
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [newSceneType, setNewSceneType] = useState<'Cutscene' | 'Dialogue' | 'Battle'>('Battle');
  const [newSceneMapId, setNewSceneMapId] = useState('MD_PVE_C0S1');

  /**
   * Fetches all 6 game definition collections in parallel using Promise.allSettled.
   */
  const fetchContent = async () => {
    setLoading(true);
    try {
      const [uRes, cRes, wRes, tRes, clRes, sRes] = await Promise.allSettled([
        adminClient.get('/UnitDefinition'),
        adminClient.get('/ChapterConfig'),
        adminClient.get('/WeaponDefinition'),
        adminClient.get('/TrinketDefinition'),
        adminClient.get('/ClassDefinition'),
        adminClient.get('/SkillDefinition'),
      ]);

      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value.data)) setUnits(uRes.value.data);
      else setUnits([]);

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value.data)) setChapters(cRes.value.data);
      else setChapters([]);

      if (wRes.status === 'fulfilled' && Array.isArray(wRes.value.data)) setWeapons(wRes.value.data);
      else setWeapons([]);

      if (tRes.status === 'fulfilled' && Array.isArray(tRes.value.data)) setTrinkets(tRes.value.data);
      else setTrinkets([]);

      if (clRes.status === 'fulfilled' && Array.isArray(clRes.value.data)) setClasses(clRes.value.data);
      else setClasses([]);

      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value.data)) setSkills(sRes.value.data);
      else setSkills([]);
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
  };

  useEffect(() => {
    fetchContent();
  }, []);

  // ==========================================
  // DELETE HANDLER (Shared)
  // ==========================================
  const handleDelete = async (endpoint: string, id: string | undefined, name: string) => {
    if (!id) {
      alert(`Cannot delete ${name}: Missing database ObjectId.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${name}" from ${endpoint} archives? This action cannot be undone.`)) {
      return;
    }
    try {
      await adminClient.delete(`/${endpoint}/${id}`);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to delete ${name}.`);
    }
  };

  // ==========================================
  // HERO UNIT HANDLERS
  // ==========================================
  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      const maxUid = units.reduce((max, u) => Math.max(max, u.uId || 0), 0);
      const newUid = maxUid > 0 ? maxUid + 1 : 101;
      const payload: Partial<UnitDefinition> = {
        uId: newUid,
        unitName: newUnitName.trim(),
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

      await adminClient.post('/UnitDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add hero definition.');
    } finally {
      setIsAddingUnit(false);
      setNewUnitName('');
      setNewUnitClassId(1);
    }
  };

  const handleUpdateUnit = async () => {
    if (!editingUnit || !editingUnit.id) return;
    try {
      await adminClient.put(`/UnitDefinition/${editingUnit.id}`, editingUnit);
      await fetchContent();
      setEditingUnit(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update hero definition.');
    }
  };

  // ==========================================
  // WEAPON HANDLERS
  // ==========================================
  const handleAddWeapon = async () => {
    if (!newWeaponName.trim()) return;
    try {
      const maxWId = weapons.reduce((max: number, w: any) => Math.max(max, w.weaponId || 0), 0);
      const newWId = maxWId > 0 ? maxWId + 1 : 201;

      const payload = {
        weaponId: newWId,
        name: newWeaponName.trim(),
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

      await adminClient.post('/WeaponDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add weapon definition.');
    } finally {
      setIsAddingWeapon(false);
      setNewWeaponName('');
      setNewWeaponSpeedMod(0);
      setNewWeaponHpMod(0);
    }
  };

  const handleUpdateWeapon = async () => {
    if (!editingWeapon || !editingWeapon.id) return;
    try {
      await adminClient.put(`/WeaponDefinition/${editingWeapon.id}`, editingWeapon);
      await fetchContent();
      setEditingWeapon(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update weapon definition.');
    }
  };

  // ==========================================
  // TRINKET HANDLERS
  // ==========================================
  const handleAddTrinket = async () => {
    if (!newTrinketName.trim()) return;
    try {
      const maxTId = trinkets.reduce((max: number, t: any) => Math.max(max, t.trinketId || 0), 0);
      const newTId = maxTId > 0 ? maxTId + 1 : 401;

      const payload = {
        trinketId: newTId,
        name: newTrinketName.trim(),
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

      await adminClient.post('/TrinketDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add trinket definition.');
    } finally {
      setIsAddingTrinket(false);
      setNewTrinketName('');
      setNewTrinketSpeedMod(0);
      setNewTrinketHpMod(0);
    }
  };

  const handleUpdateTrinket = async () => {
    if (!editingTrinket || !editingTrinket.id) return;
    try {
      await adminClient.put(`/TrinketDefinition/${editingTrinket.id}`, editingTrinket);
      await fetchContent();
      setEditingTrinket(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update trinket definition.');
    }
  };

  // ==========================================
  // CHAPTER HANDLERS
  // ==========================================
  const handleAddChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      const maxCId = chapters.reduce((max: number, c: any) => Math.max(max, c.chapterId ?? -1), -1);
      const newCId = maxCId >= 0 ? maxCId + 1 : 1;

      const payload = {
        chapterId: newCId,
        title: newChapterTitle.trim(),
        mapId: newChapterMapId.trim() || 'MD_PVE_C0S1',
        scenes: [
          {
            sceneId: 0,
            type: 'Battle',
            autoResume: false,
            autoAdvance: false,
            description: `${newChapterTitle} - Prologue Battle`,
            mapId: newChapterMapId.trim() || 'MD_PVE_C0S1',
          },
        ],
      };

      await adminClient.post('/ChapterConfig', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add chapter configuration.');
    } finally {
      setIsAddingChapter(false);
      setNewChapterTitle('');
      setNewChapterMapId('MD_PVE_C0S1');
    }
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter || !editingChapter.id) return;
    try {
      await adminClient.put(`/ChapterConfig/${editingChapter.id}`, editingChapter);
      await fetchContent();
      setEditingChapter(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update chapter configuration.');
    }
  };

  // ==========================================
  // CLASS HANDLERS
  // ==========================================
  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const maxClId = classes.reduce((max: number, c: any) => Math.max(max, Number(c.classId) || 0), 0);
      const newClId = maxClId > 0 ? maxClId + 1 : 1;

      const payload = {
        classId: newClId,
        name: newClassName.trim(),
        movementSkillId: newClassMoveSkillId,
        classSkillId: newClassSkillId,
      };

      await adminClient.post('/ClassDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add class definition.');
    } finally {
      setIsAddingClass(false);
      setNewClassName('');
      setNewClassMoveSkillId(1001);
      setNewClassSkillId(3001);
    }
  };

  const handleUpdateClass = async () => {
    if (!editingClass || !editingClass.id) return;
    try {
      await adminClient.put(`/ClassDefinition/${editingClass.id}`, editingClass);
      await fetchContent();
      setEditingClass(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update class definition.');
    }
  };

  // ==========================================
  // SKILL HANDLERS
  // ==========================================
  const handleAddSkill = async () => {
    try {
      const payload = {
        skillId: Number(newSkillId),
      };

      await adminClient.post('/SkillDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add skill definition.');
    } finally {
      setIsAddingSkill(false);
      setNewSkillId(1001);
    }
  };

  const handleUpdateSkill = async () => {
    if (!editingSkill || !editingSkill.id) return;
    try {
      await adminClient.put(`/SkillDefinition/${editingSkill.id}`, editingSkill);
      await fetchContent();
      setEditingSkill(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update skill definition.');
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans select-none">
      {/* Astral Header Banner */}
      <div className="hy-glass p-6 md:p-8 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
        {/* Ornate Corner Marks */}
        <span className="absolute top-3 left-3 text-amber-400/40 text-xs">❖</span>
        <span className="absolute top-3 right-3 text-amber-400/40 text-xs">❖</span>

        <div 
          className="absolute -top-16 -right-16 w-80 h-80 bg-amber-500/[0.08] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />
        <div 
          className="absolute -bottom-16 -left-16 w-72 h-72 bg-cyan-500/[0.05] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 uppercase font-bold tracking-wider shadow-[0_0_12px_rgba(242,191,78,0.15)]">
                GAME DESIGN ARCHIVES • MONGODB
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">6 Core SRPG Domains with Full CRUD</span>
            </div>
            <h1 className="text-xl md:text-3xl font-extrabold tracking-wide font-cinzel uppercase hy-gold-text">
              SRPG ARCHIVES & ARMORY DEFINITIONS
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans">
              Live Game Content CMS: In-browser Create, Edit & Delete for Weapons, Heroes, Trinkets, Classes, Chapters & Skills.
            </p>
          </div>

          <button
            onClick={fetchContent}
            disabled={loading}
            className="hy-btn-gold px-4 py-2 text-xs font-bold flex items-center gap-2 self-start md:self-auto shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC ARCHIVES</span>
          </button>
        </div>
      </div>

      {/* Modern Game Inventory Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-2">
        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'units'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-400" /> HEROES ({units.length})
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'chapters'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" /> CHAPTERS ({chapters.length})
        </button>
        <button
          onClick={() => setActiveTab('weapons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'weapons'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Sword className="w-4 h-4 text-cyan-400" /> WEAPONS ({weapons.length})
        </button>
        <button
          onClick={() => setActiveTab('trinkets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'trinkets'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Gem className="w-4 h-4 text-amber-400" /> TRINKETS ({trinkets.length})
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'classes'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-400" /> CLASSES ({classes.length})
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'skills'
              ? 'hy-tab-active'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" /> SKILLS ({skills.length})
        </button>
      </div>

      {/* 1. Units Tab */}
      {activeTab === 'units' && (
        <div className="hy-glass rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200 uppercase font-cinzel font-bold">SRPG HERO DEFINITIONS (/api/UnitDefinition)</span>
            <button
              onClick={() => setIsAddingUnit(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD HERO
            </button>
          </div>
          {units.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
              <p className="text-sm font-bold font-cinzel text-slate-200">No hero definitions recorded in archives.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Hero UID</th>
                    <th className="py-3 px-4">Hero Name</th>
                    <th className="py-3 px-4">Passive Skill</th>
                    <th className="py-3 px-4">Class Designation</th>
                    <th className="py-3 px-4">Initial Hero</th>
                    <th className="py-3 px-4">Stats By Grade</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {units.map((u, idx) => (
                    <tr key={u.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">UID #{u.uId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-slate-900 border border-white/[0.1] text-amber-400 flex items-center justify-center text-xs font-bold font-cinzel shadow-inner">
                          {u.unitName?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs">{u.unitName}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.passiveSkillId && u.passiveSkillId !== -1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-mono font-semibold border border-amber-500/30 inline-flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" /> Skill #{u.passiveSkillId}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.classIds && u.classIds.length > 0 ? (
                            u.classIds.map((cId) => {
                              const cls = classes.find((c) => Number(c.classId) === Number(cId));
                              return (
                                <span
                                  key={cId}
                                  className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30"
                                >
                                  {cls?.name || `Class #${cId}`}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-slate-500">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.givenAtRegister ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            STARTER HERO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 text-[10px] border border-white/[0.06]">
                            GACHA ONLY
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {u.statsByGrade && u.statsByGrade.length > 0 ? (
                          <span className="text-slate-300">{u.statsByGrade.length} Tiers Defined</span>
                        ) : (
                          <span className="text-slate-500">Base</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingUnit(u)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                            title="Edit Hero Definition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('UnitDefinition', u.id, u.unitName || `Hero #${u.uId}`)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                            title="Delete Hero Definition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. Chapters Tab */}
      {activeTab === 'chapters' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200 uppercase font-cinzel font-bold">STORY CHAPTERS & SCENARIO MAPS (/api/ChapterConfig)</span>
            <button
              onClick={() => setIsAddingChapter(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD CHAPTER
            </button>
          </div>
          {chapters.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
              <p className="text-sm font-bold font-cinzel text-slate-200">No story chapter configurations found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Chapter ID</th>
                    <th className="py-3 px-4">Chapter Title</th>
                    <th className="py-3 px-4">Map Reference</th>
                    <th className="py-3 px-4">Scenes Count</th>
                    <th className="py-3 px-4">Scene Types</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {chapters.map((ch, idx) => (
                    <tr key={ch.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                        CH. #{ch.chapterId ?? idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 text-xs">
                        {ch.title || ch.chapterName || `Chapter #${ch.chapterId ?? idx + 1}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>{ch.mapId || (ch.scenes?.[0]?.mapId ?? 'MD_PVP_001')}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300 text-[11px]">
                        {ch.scenes ? `${ch.scenes.length} Scenes` : '0 Scenes'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ch.scenes && ch.scenes.length > 0 ? (
                            Array.from(new Set(ch.scenes.map((s) => s.type))).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">None</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingChapter(ch)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                            title="Edit Chapter & Scenes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('ChapterConfig', ch.id, ch.title || `Chapter #${ch.chapterId}`)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                            title="Delete Chapter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Weapons Tab (BR-04 Class Restrictions) */}
      {activeTab === 'weapons' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200 uppercase font-cinzel font-bold">WEAPON DEFINITIONS & CLASS ASSIGNMENTS (BR-04)</span>
            <button
              onClick={() => setIsAddingWeapon(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD WEAPON
            </button>
          </div>
          {weapons.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
              <p className="text-sm font-bold font-cinzel text-slate-200">No weapon definitions found in archives.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Weapon ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Class Requirement (BR-04)</th>
                    <th className="py-3 px-4">Weapon Skill</th>
                    <th className="py-3 px-4">Stat Modifiers</th>
                    <th className="py-3 px-4">Availability</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {weapons.map((w: any, idx) => (
                    <tr key={w.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">#{w.weaponId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 text-xs">{w.name}</td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const cls = classes.find((c) => Number(c.classId) === Number(w.classId));
                          return (
                            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold border border-cyan-500/30 inline-flex items-center gap-1">
                              <Shield className="w-3 h-3 text-cyan-400" />
                              {cls?.name || (w.classId ? `Class #${w.classId}` : 'All Classes')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-mono font-semibold border border-amber-500/30 inline-flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> Skill #{w.skillId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-300 font-bold">
                        {w.statModifiers && (w.statModifiers.speed || w.statModifiers.maxHP || w.statModifiers.maxSkillPoint) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {w.statModifiers.speed > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px]">
                                +{w.statModifiers.speed} Speed
                              </span>
                            )}
                            {w.statModifiers.maxHP > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px]">
                                +{w.statModifiers.maxHP} MaxHP
                              </span>
                            )}
                            {w.statModifiers.maxSkillPoint > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px]">
                                +{w.statModifiers.maxSkillPoint} SP
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">None (Base Weapon)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {w.givenAtRegister ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            STARTER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 text-[10px] border border-white/[0.06]">
                            GACHA ONLY
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingWeapon(w)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                            title="Edit Weapon Definition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('WeaponDefinition', w.id, w.name || `Weapon #${w.weaponId}`)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                            title="Delete Weapon Definition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Trinkets Tab */}
      {activeTab === 'trinkets' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200 uppercase font-cinzel font-bold">TRINKET DEFINITIONS & STAT MODIFIERS (/api/TrinketDefinition)</span>
            <button
              onClick={() => setIsAddingTrinket(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD TRINKET
            </button>
          </div>
          {trinkets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-amber-400/60" />
              <p className="text-sm font-bold font-cinzel text-slate-200">No trinket definitions found in archives.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950/80 text-slate-400 font-cinzel font-bold text-[11px] border-b border-white/[0.08] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Trinket ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Associated Skill</th>
                    <th className="py-3 px-4">Stat Modifiers</th>
                    <th className="py-3 px-4">Availability</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {trinkets.map((t: any, idx) => (
                    <tr key={t.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">#{t.trinketId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 text-xs">{t.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-mono font-semibold border border-amber-500/30 inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" /> Skill #{t.skillId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-300 font-bold">
                        {t.statModifiers && (t.statModifiers.speed || t.statModifiers.maxHP || t.statModifiers.maxSkillPoint) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {t.statModifiers.speed > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px]">
                                +{t.statModifiers.speed} Speed
                              </span>
                            )}
                            {t.statModifiers.maxHP > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px]">
                                +{t.statModifiers.maxHP} MaxHP
                              </span>
                            )}
                            {t.statModifiers.maxSkillPoint > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px]">
                                +{t.statModifiers.maxSkillPoint} SP
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">None (Base Trinket)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {t.givenAtRegister ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            STARTER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 text-[10px] border border-white/[0.06]">
                            GACHA ONLY
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingTrinket(t)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                            title="Edit Trinket Definition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('TrinketDefinition', t.id, t.name || `Trinket #${t.trinketId}`)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                            title="Delete Trinket Definition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Classes Tab */}
      {activeTab === 'classes' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-slate-100 font-cinzel flex items-center gap-2 uppercase">
              <Layers className="w-4 h-4 text-indigo-400" />
              CLASS DEFINITIONS (/api/ClassDefinition)
            </h3>
            <button
              onClick={() => setIsAddingClass(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD CLASS
            </button>
          </div>
          {classes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No class definitions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-4 rounded-xl glass-card space-y-3 border border-white/[0.08] hover:border-amber-400/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-cinzel font-bold">
                      <span className="text-slate-100 text-sm">{c.name || `Class #${c.classId}`}</span>
                      <span className="text-amber-400 font-mono text-xs">ID: #{c.classId}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400 font-mono mt-2.5">
                      <p>
                        Movement Skill: <strong className="text-cyan-300">#{c.movementSkillId}</strong>
                      </p>
                      <p>
                        Class Skill: <strong className="text-amber-300">#{c.classSkillId}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-white/[0.06]">
                    <button
                      onClick={() => setEditingClass(c)}
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                      title="Edit Class Definition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete('ClassDefinition', c.id, c.name || `Class #${c.classId}`)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                      title="Delete Class Definition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Skills Tab */}
      {activeTab === 'skills' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-slate-100 font-cinzel flex items-center gap-2 uppercase">
              <Zap className="w-4 h-4 text-amber-400" />
              SKILL DEFINITIONS (/api/SkillDefinition)
            </h3>
            <button
              onClick={() => setIsAddingSkill(true)}
              className="btn-primary-gold px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD SKILL
            </button>
          </div>
          {skills.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No skill definitions found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {skills.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3.5 rounded-xl glass-card text-center space-y-2 border border-white/[0.08] hover:border-amber-400/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-9 h-9 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="px-2 py-0.5 mt-2 rounded-full bg-black/60 text-amber-300 text-[11px] font-mono font-bold inline-block border border-white/[0.08]">
                      Skill #{s.skillId}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setEditingSkill(s)}
                      className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                      title="Edit Skill ID"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete('SkillDefinition', s.id, `Skill #${s.skillId}`)}
                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                      title="Delete Skill Definition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT MODALS                                               */}
      {/* ========================================================= */}

      {/* Modal: Edit Hero Unit Definition */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                EDIT HERO DEFINITION • UID #{editingUnit.uId}
              </h3>
              <button
                onClick={() => setEditingUnit(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Hero Unit Name</label>
                <input
                  type="text"
                  value={editingUnit.unitName || ''}
                  onChange={(e) => setEditingUnit({ ...editingUnit, unitName: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Passive Skill ID (-1 for None)</label>
                <input
                  type="number"
                  value={editingUnit.passiveSkillId ?? -1}
                  onChange={(e) => setEditingUnit({ ...editingUnit, passiveSkillId: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1.5">Assigned SRPG Classes</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {classes.map((c) => {
                    const cId = Number(c.classId);
                    const isChecked = (editingUnit.classIds || []).includes(cId);
                    return (
                      <label
                        key={c.classId}
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                            : 'bg-white/[0.02] border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const prev = editingUnit.classIds || [];
                            const updated = e.target.checked
                              ? [...prev, cId]
                              : prev.filter((id) => id !== cId);
                            setEditingUnit({ ...editingUnit, classIds: updated });
                          }}
                          className="accent-amber-400 rounded"
                        />
                        <span className="text-[11px] truncate">{c.name || `Class #${c.classId}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUnit.givenAtRegister ?? false}
                    onChange={(e) => setEditingUnit({ ...editingUnit, givenAtRegister: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">Initial Starter Hero</span>
                    <span className="text-[11px] text-slate-400 block">
                      Grant this hero automatically to newly registered accounts without gacha summoning.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setEditingUnit(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUnit}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Weapon Definition (BR-04) */}
      {editingWeapon && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                EDIT WEAPON DEFINITION • #{editingWeapon.weaponId}
              </h3>
              <button
                onClick={() => setEditingWeapon(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Weapon Name</label>
                <input
                  type="text"
                  value={editingWeapon.name || ''}
                  onChange={(e) => setEditingWeapon({ ...editingWeapon, name: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Class Requirement (BR-04)</label>
                  <select
                    value={editingWeapon.classId ?? 1}
                    onChange={(e) => setEditingWeapon({ ...editingWeapon, classId: Number(e.target.value) })}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId} className="bg-slate-900 text-slate-100">
                        {c.name || `Class #${c.classId}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Weapon Skill ID</label>
                  <input
                    type="number"
                    value={editingWeapon.skillId ?? 101}
                    onChange={(e) => setEditingWeapon({ ...editingWeapon, skillId: Number(e.target.value) })}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Speed Modifier (+)</label>
                  <input
                    type="number"
                    value={editingWeapon.statModifiers?.speed ?? 0}
                    onChange={(e) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: {
                          ...editingWeapon.statModifiers,
                          speed: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max HP Modifier (+)</label>
                  <input
                    type="number"
                    value={editingWeapon.statModifiers?.maxHP ?? 0}
                    onChange={(e) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: {
                          ...editingWeapon.statModifiers,
                          maxHP: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max SP Modifier (+)</label>
                  <input
                    type="number"
                    value={editingWeapon.statModifiers?.maxSkillPoint ?? 0}
                    onChange={(e) =>
                      setEditingWeapon({
                        ...editingWeapon,
                        statModifiers: {
                          ...editingWeapon.statModifiers,
                          maxSkillPoint: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWeapon.givenAtRegister ?? false}
                    onChange={(e) => setEditingWeapon({ ...editingWeapon, givenAtRegister: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">Starter Weapon</span>
                    <span className="text-[11px] text-slate-400 block">
                      Grant this weapon immediately upon registration.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setEditingWeapon(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWeapon}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Trinket Definition */}
      {editingTrinket && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Gem className="w-5 h-5 text-amber-400" />
                EDIT TRINKET DEFINITION • #{editingTrinket.trinketId}
              </h3>
              <button
                onClick={() => setEditingTrinket(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Trinket Name</label>
                <input
                  type="text"
                  value={editingTrinket.name || ''}
                  onChange={(e) => setEditingTrinket({ ...editingTrinket, name: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Associated Skill ID</label>
                <input
                  type="number"
                  value={editingTrinket.skillId ?? 4001}
                  onChange={(e) => setEditingTrinket({ ...editingTrinket, skillId: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Speed Modifier (+)</label>
                  <input
                    type="number"
                    value={editingTrinket.statModifiers?.speed ?? 0}
                    onChange={(e) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: {
                          ...editingTrinket.statModifiers,
                          speed: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max HP Modifier (+)</label>
                  <input
                    type="number"
                    value={editingTrinket.statModifiers?.maxHP ?? 0}
                    onChange={(e) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: {
                          ...editingTrinket.statModifiers,
                          maxHP: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max SP Modifier (+)</label>
                  <input
                    type="number"
                    value={editingTrinket.statModifiers?.maxSkillPoint ?? 0}
                    onChange={(e) =>
                      setEditingTrinket({
                        ...editingTrinket,
                        statModifiers: {
                          ...editingTrinket.statModifiers,
                          maxSkillPoint: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTrinket.givenAtRegister ?? false}
                    onChange={(e) => setEditingTrinket({ ...editingTrinket, givenAtRegister: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">Starter Trinket</span>
                    <span className="text-[11px] text-slate-400 block">
                      Grant this trinket immediately upon registration.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setEditingTrinket(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTrinket}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Story Chapter & Scenes */}
      {editingChapter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-xl space-y-4 text-xs shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                EDIT CHAPTER • CH #{editingChapter.chapterId}
              </h3>
              <button
                onClick={() => setEditingChapter(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Chapter Title</label>
                <input
                  type="text"
                  value={editingChapter.title || editingChapter.chapterName || ''}
                  onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Default Map Reference ID</label>
                <input
                  type="text"
                  value={editingChapter.mapId || 'MD_PVE_C0S1'}
                  onChange={(e) => setEditingChapter({ ...editingChapter, mapId: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              {/* Scenes Manager */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 uppercase font-cinzel">
                    SCENES SEQUENCE ({editingChapter.scenes?.length || 0})
                  </span>
                </div>

                {editingChapter.scenes && editingChapter.scenes.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editingChapter.scenes.map((sc, scIdx) => (
                      <div
                        key={scIdx}
                        className="p-2.5 rounded-xl bg-slate-950/80 border border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-amber-300 font-bold">
                              Scene #{sc.sceneId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                              {sc.type}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Map: {sc.mapId || editingChapter.mapId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 truncate mt-0.5">
                            {sc.description || sc.sceneName || 'Battle encounter sequence'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editingChapter.scenes!.filter((_, i) => i !== scIdx);
                            setEditingChapter({ ...editingChapter, scenes: updated });
                          }}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          title="Remove Scene"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic py-2">No scenes attached to this chapter.</p>
                )}

                {/* Add Scene Subform */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 mt-2">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    + Append New Scene
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newSceneType}
                      onChange={(e: any) => setNewSceneType(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="Battle">Battle (PVE Grid)</option>
                      <option value="Cutscene">Cutscene</option>
                      <option value="Dialogue">Dialogue</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Scene Map ID"
                      value={newSceneMapId}
                      onChange={(e) => setNewSceneMapId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Scene Description"
                      value={newSceneDescription}
                      onChange={(e) => setNewSceneDescription(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const currentScenes = editingChapter.scenes || [];
                        const nextSceneId = currentScenes.reduce((max, s) => Math.max(max, s.sceneId), -1) + 1;
                        const addedScene: SceneConfig = {
                          sceneId: nextSceneId,
                          type: newSceneType,
                          description: newSceneDescription.trim() || `Scene #${nextSceneId}`,
                          mapId: newSceneMapId.trim() || editingChapter.mapId || 'MD_PVE_C0S1',
                          autoResume: false,
                          autoAdvance: false,
                        };
                        setEditingChapter({ ...editingChapter, scenes: [...currentScenes, addedScene] });
                        setNewSceneDescription('');
                      }}
                      className="btn-glass px-3 py-1.5 text-xs font-bold text-amber-300"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] shrink-0">
              <button
                onClick={() => setEditingChapter(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateChapter}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Class Definition */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                EDIT CLASS • ID #{editingClass.classId}
              </h3>
              <button
                onClick={() => setEditingClass(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Class Archetype Name</label>
                <input
                  type="text"
                  value={editingClass.name || ''}
                  onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Movement Skill ID</label>
                <input
                  type="number"
                  value={editingClass.movementSkillId ?? 1001}
                  onChange={(e) => setEditingClass({ ...editingClass, movementSkillId: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Class Combat Skill ID</label>
                <input
                  type="number"
                  value={editingClass.classSkillId ?? 3001}
                  onChange={(e) => setEditingClass({ ...editingClass, classSkillId: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setEditingClass(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateClass}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Skill Definition */}
      {editingSkill && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-sm space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                EDIT SKILL ID
              </h3>
              <button
                onClick={() => setEditingSkill(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Combat Skill ID</label>
                <input
                  type="number"
                  value={editingSkill.skillId ?? 1001}
                  onChange={(e) => setEditingSkill({ ...editingSkill, skillId: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setEditingSkill(null)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSkill}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD MODALS                                                */}
      {/* ========================================================= */}

      {/* Modal: Add Hero Unit Definition */}
      {isAddingUnit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                ADD HERO DEFINITION (MONGODB)
              </h3>
              <button
                onClick={() => setIsAddingUnit(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Hero Unit Name</label>
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. Paladin, Shadow Assassin"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Primary Class</label>
                <select
                  value={newUnitClassId}
                  onChange={(e) => setNewUnitClassId(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.classId} value={c.classId} className="bg-slate-900 text-slate-100">
                      {c.name || `Class #${c.classId}`}
                    </option>
                  ))}
                  {classes.length === 0 && (
                    <option value={1} className="bg-slate-900 text-slate-100">Class 1</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingUnit(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUnit}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Hero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Weapon Definition (BR-04) */}
      {isAddingWeapon && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                ADD WEAPON DEFINITION (BR-04)
              </h3>
              <button
                onClick={() => setIsAddingWeapon(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Configure weapon attributes and assign strict Class compatibility per Business Rule BR-04.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Weapon Name</label>
                <input
                  type="text"
                  value={newWeaponName}
                  onChange={(e) => setNewWeaponName(e.target.value)}
                  placeholder="e.g. Claymore of Judgment"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Target Class (BR-04)</label>
                  <select
                    value={newWeaponClassId}
                    onChange={(e) => setNewWeaponClassId(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId} className="bg-slate-900 text-slate-100">
                        {c.name || `Class #${c.classId}`}
                      </option>
                    ))}
                    {classes.length === 0 && (
                      <option value={1} className="bg-slate-900 text-slate-100">Class 1</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Weapon Skill ID</label>
                  <input
                    type="number"
                    value={newWeaponSkillId}
                    onChange={(e) => setNewWeaponSkillId(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Speed Modifier (+)</label>
                  <input
                    type="number"
                    value={newWeaponSpeedMod}
                    onChange={(e) => setNewWeaponSpeedMod(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max HP Modifier (+)</label>
                  <input
                    type="number"
                    value={newWeaponHpMod}
                    onChange={(e) => setNewWeaponHpMod(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingWeapon(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWeapon}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Weapon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Trinket Definition */}
      {isAddingTrinket && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Gem className="w-5 h-5 text-amber-400" />
                ADD TRINKET DEFINITION
              </h3>
              <button
                onClick={() => setIsAddingTrinket(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Configure accessory artifacts with passive skill triggers and stat boosts.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Trinket Name</label>
                <input
                  type="text"
                  value={newTrinketName}
                  onChange={(e) => setNewTrinketName(e.target.value)}
                  placeholder="e.g. Amulet of the Sun"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Associated Skill ID</label>
                <input
                  type="number"
                  value={newTrinketSkillId}
                  onChange={(e) => setNewTrinketSkillId(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Speed Modifier (+)</label>
                  <input
                    type="number"
                    value={newTrinketSpeedMod}
                    onChange={(e) => setNewTrinketSpeedMod(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Max HP Modifier (+)</label>
                  <input
                    type="number"
                    value={newTrinketHpMod}
                    onChange={(e) => setNewTrinketHpMod(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingTrinket(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTrinket}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Trinket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Story Chapter */}
      {isAddingChapter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                ADD STORY CHAPTER CONFIG
              </h3>
              <button
                onClick={() => setIsAddingChapter(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Chapter Title</label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 - Trial of Ashes"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Default Map Reference ID</label>
                <input
                  type="text"
                  value={newChapterMapId}
                  onChange={(e) => setNewChapterMapId(e.target.value)}
                  placeholder="e.g. MD_PVE_C4S1"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingChapter(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChapter}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Class Definition */}
      {isAddingClass && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                ADD CLASS DEFINITION
              </h3>
              <button
                onClick={() => setIsAddingClass(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Class Archetype Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Berserker, Necromancer"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Movement Skill ID</label>
                  <input
                    type="number"
                    value={newClassMoveSkillId}
                    onChange={(e) => setNewClassMoveSkillId(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Class Combat Skill ID</label>
                  <input
                    type="number"
                    value={newClassSkillId}
                    onChange={(e) => setNewClassSkillId(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingClass(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClass}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Skill Definition */}
      {isAddingSkill && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-sm space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                ADD SKILL DEFINITION
              </h3>
              <button
                onClick={() => setIsAddingSkill(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Combat Skill ID</label>
                <input
                  type="number"
                  value={newSkillId}
                  onChange={(e) => setNewSkillId(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingSkill(false)}
                className="btn-glass px-3.5 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSkill}
                className="btn-primary-gold px-4 py-1.5 text-xs font-bold"
              >
                Save Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
