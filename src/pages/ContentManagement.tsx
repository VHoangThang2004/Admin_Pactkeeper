import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type {
  UnitDefinition,
  ChapterConfig,
  WeaponDefinition,
  TrinketDefinition,
  ClassDefinition,
  SkillDefinition,
} from '../types';
import { BookOpen, Shield, Sword, Layers, Plus, RefreshCw, Zap, Inbox, Gem, Sparkles } from 'lucide-react';

/**
 * ContentManagement Component
 * 
 * Re-architected to HoYoverse AAA Gaming Standards (RPG Armory & Archives):
 * Central archives interface for game designers and administrators to inspect,
 * configure, and manage core SRPG gameplay definitions stored in MongoDB.
 * 
 * Supports 6 core SRPG domain collections:
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

  // Modal State for adding a new skill definition
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillSpCost, setNewSkillSpCost] = useState(2);
  const [newSkillDesc, setNewSkillDesc] = useState('');

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
        statsByGrade: [],
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
        },
        givenAtRegister: false,
      };

      await adminClient.post('/WeaponDefinition', payload);
      await fetchContent();
    } catch {
      setWeapons((prev) => [
        ...prev,
        {
          weaponId: 200 + weapons.length + 1,
          name: newWeaponName.trim(),
          classId: newWeaponClassId,
          skillId: newWeaponSkillId,
          statModifiers: {
            speed: newWeaponSpeedMod,
            maxHP: newWeaponHpMod,
            maxSkillPoint: 0,
          },
          givenAtRegister: false,
        } as any,
      ]);
    } finally {
      setIsAddingWeapon(false);
      setNewWeaponName('');
      setNewWeaponSpeedMod(0);
      setNewWeaponHpMod(0);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    try {
      const maxSId = skills.reduce((max: number, s: any) => Math.max(max, s.skillId || 0), 0);
      const newSId = maxSId > 0 ? maxSId + 1 : 301;

      const payload = {
        skillId: newSId,
        skillName: newSkillName.trim(),
        spCost: newSkillSpCost,
        description: newSkillDesc.trim(),
      };

      await adminClient.post('/SkillDefinition', payload);
      await fetchContent();
    } catch {
      setSkills((prev) => [
        ...prev,
        {
          skillId: 300 + skills.length + 1,
          skillName: newSkillName.trim(),
          spCost: newSkillSpCost,
          description: newSkillDesc.trim(),
        },
      ]);
    } finally {
      setIsAddingSkill(false);
      setNewSkillName('');
      setNewSkillSpCost(2);
      setNewSkillDesc('');
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
                GAME DESIGN ARCHIVES • MONGODB
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">6 Core SRPG Domains</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wide font-cinzel uppercase gold-gradient-text">
              SRPG ARCHIVES & ARMORY DEFINITIONS
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Comprehensive Game Content, Stat Modifiers, Weapon Restrictions (BR-04) & Skill Invocation costs.
            </p>
          </div>

          <button
            onClick={fetchContent}
            disabled={loading}
            className="btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 self-start md:self-auto shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
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
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-400" /> HEROES ({units.length})
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'chapters'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" /> CHAPTERS ({chapters.length})
        </button>
        <button
          onClick={() => setActiveTab('weapons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'weapons'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Sword className="w-4 h-4 text-cyan-400" /> WEAPONS ({weapons.length})
        </button>
        <button
          onClick={() => setActiveTab('trinkets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'trinkets'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Gem className="w-4 h-4 text-amber-400" /> TRINKETS ({trinkets.length})
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'classes'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-400" /> CLASSES ({classes.length})
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'skills'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" /> SKILLS ({skills.length})
        </button>
      </div>

      {/* 1. Units Tab */}
      {activeTab === 'units' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                              const cls = classes.find((c) => c.classId === cId);
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
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] text-xs font-semibold text-slate-200 uppercase font-cinzel font-bold">
            STORY CHAPTERS & SCENARIO MAPS (/api/ChapterConfig)
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
                    <th className="py-3 px-4">Estimated Stamina</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {chapters.map((ch, idx) => (
                    <tr key={ch.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                        CH. #{ch.chapterId ?? idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 text-xs">
                        {ch.chapterName || ch.title || `Chapter #${ch.chapterId ?? idx + 1}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {ch.mapId || (ch.scenes?.[0]?.sceneName ?? 'Grid_Map_Default')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300 text-[11px]">
                        {ch.scenes ? `${ch.scenes.length} Scenes` : '1 Scene'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-300 text-[11px]">
                        {ch.scenes?.[0]?.staminaCost ? `${ch.scenes[0].staminaCost} SP` : '10 SP'}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200">
                  {weapons.map((w: any, idx) => (
                    <tr key={w.id || idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">#{w.weaponId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100 text-xs">{w.name}</td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const cls = classes.find((c) => c.classId === w.classId);
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
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] text-xs font-semibold text-slate-200 uppercase font-cinzel font-bold">
            TRINKET DEFINITIONS & STAT MODIFIERS (/api/TrinketDefinition)
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
          <h3 className="text-sm font-bold text-slate-100 font-cinzel flex items-center gap-2 border-b border-white/[0.08] pb-3 uppercase">
            <Layers className="w-4 h-4 text-indigo-400" />
            CLASS DEFINITIONS (/api/ClassDefinition)
          </h3>
          {classes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No class definitions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-4 rounded-xl glass-card space-y-2.5 border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-cinzel font-bold">
                    <span className="text-slate-100 text-sm">{c.name || `Class #${c.classId}`}</span>
                    <span className="text-amber-400 font-mono text-xs">ID: #{c.classId}</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400 font-mono">
                    <p>
                      Movement Skill: <strong className="text-cyan-300">#{c.movementSkillId}</strong>
                    </p>
                    <p>
                      Class Skill: <strong className="text-amber-300">#{c.classSkillId}</strong>
                    </p>
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
                  className="p-3.5 rounded-xl glass-card text-center space-y-2 border border-white/[0.08] hover:border-amber-400/40 transition-all"
                >
                  <div className="w-9 h-9 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="font-semibold text-slate-200 block text-xs truncate">
                    {s.skillName || 'Skill Invocation'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-black/60 text-amber-300 text-[10px] font-mono font-bold inline-block border border-white/[0.08]">
                    #{s.skillId} • {s.spCost ?? 2} SP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Hero Unit Definition */}
      {isAddingUnit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold font-cinzel text-slate-100">
              ADD HERO DEFINITION (MONGODB)
            </h3>
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
                <label className="font-semibold text-slate-300 block mb-1">Primary Class ID</label>
                <input
                  type="number"
                  value={newUnitClassId}
                  onChange={(e) => setNewUnitClassId(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
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
            <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Sword className="w-5 h-5 text-amber-400" />
              ADD WEAPON DEFINITION (BR-04)
            </h3>
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
                      <>
                        <option value={1} className="bg-slate-900 text-slate-100">Class 1 (Warrior)</option>
                        <option value={2} className="bg-slate-900 text-slate-100">Class 2 (Mage)</option>
                        <option value={3} className="bg-slate-900 text-slate-100">Class 3 (Archer)</option>
                      </>
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

      {/* Modal: Add Skill Definition */}
      {isAddingSkill && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.1] w-full max-w-md space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              ADD COMBAT SKILL DEFINITION
            </h3>
            <p className="text-xs text-slate-400">
              Define skill casting costs (SP) and tactical effects for SRPG timeline combat.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Skill Name</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Heavenly Smite"
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Skill Point (SP) Cost</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={newSkillSpCost}
                  onChange={(e) => setNewSkillSpCost(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Effect Description</label>
                <textarea
                  rows={3}
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="e.g. Unleashes a radiant blast dealing 150% damage in a 3-tile cross pattern."
                  className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none resize-none"
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
