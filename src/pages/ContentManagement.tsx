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
 * Central archives interface for game designers and administrators to inspect,
 * configure, and manage core SRPG gameplay definitions stored in MongoDB.
 * 
 * Supports 6 core SRPG domain collections:
 * 1. Hero Unit Definitions (`/api/UnitDefinition`)
 * 2. Story Chapters & Battle Scenes (`/api/ChapterConfig`)
 * 3. Weapons & Stat Modifiers (`/api/WeaponDefinition`)
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

  /**
   * Fetches all 6 game definition collections in parallel using Promise.allSettled
   * so a failure in one collection does not crash or block the others.
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

  /**
   * Submits a new unit definition payload to POST /api/UnitDefinition
   */
  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      const nextUId = units.length + 10;
      const payload = {
        uId: nextUId,
        unitName: newUnitName.trim(),
        passiveSkillId: -1,
        classIds: [newUnitClassId],
        givenAtRegister: false,
        statsByGrade: [
          { grade: 1, maxHP: 3, maxSkillPoint: 3, speed: 120, damageMultiplier: 100, damageReduction: 0 },
        ],
      };
      await adminClient.post('/UnitDefinition', payload);
      await fetchContent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add hero definition on backend.');
    } finally {
      setIsAddingUnit(false);
      setNewUnitName('');
    }
  };

  return (
    <div className="space-y-6 pb-8 font-serif">
      {/* Header Banner */}
      <div className="mahogany-banner p-5 text-center rounded-lg relative shadow-md">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          SRPG ARCHIVES & BASE DEFINITIONS
        </h1>
        <p className="text-xs md:text-sm text-[#c4b49e] font-serif mt-1">
          Comprehensive Game Content, Stat Modifiers & Base API Configurations from MongoDB
        </p>
        <button
          onClick={fetchContent}
          className="absolute right-4 top-4 px-3.5 py-2 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> SYNC ARCHIVES
        </button>
      </div>

      {/* Medieval Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#c89b3c] pb-2">
        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'units'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <Shield className="w-4 h-4 text-[#c89b3c]" /> HEROES ({units.length})
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'chapters'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#c89b3c]" /> CHAPTERS ({chapters.length})
        </button>
        <button
          onClick={() => setActiveTab('weapons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'weapons'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <Sword className="w-4 h-4 text-[#c89b3c]" /> WEAPONS ({weapons.length})
        </button>
        <button
          onClick={() => setActiveTab('trinkets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'trinkets'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <Gem className="w-4 h-4 text-[#d97706]" /> TRINKETS ({trinkets.length})
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'classes'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <Layers className="w-4 h-4 text-[#c89b3c]" /> CLASSES ({classes.length})
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold font-cinzel transition-all ${
            activeTab === 'skills'
              ? 'bg-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] border-b-0 shadow-md'
              : 'text-[#78644e] hover:text-[#3a2518]'
          }`}
        >
          <Zap className="w-4 h-4 text-[#d97706]" /> SKILLS ({skills.length})
        </button>
      </div>

      {/* 1. Units Tab */}
      {activeTab === 'units' && (
        <div className="parchment-card rounded-lg overflow-hidden shadow-md">
          <div className="p-4 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] flex items-center justify-between font-cinzel font-bold text-sm">
            <span>SRPG HERO DEFINITIONS (/api/UnitDefinition)</span>
            <button
              onClick={() => setIsAddingUnit(true)}
              className="px-3.5 py-1.5 rounded crimson-badge text-xs font-bold flex items-center gap-1.5 font-cinzel shadow"
            >
              <Plus className="w-3.5 h-3.5" /> ADD HERO
            </button>
          </div>
          {units.length === 0 ? (
            <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
              <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
              <p className="text-sm font-bold font-cinzel">No hero definitions recorded in archives.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-serif">
              <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold border-b border-[#c89b3c] uppercase">
                <tr>
                  <th className="py-3 px-4">Hero UID</th>
                  <th className="py-3 px-4">Hero Name</th>
                  <th className="py-3 px-4">Passive Skill</th>
                  <th className="py-3 px-4">Class Designation</th>
                  <th className="py-3 px-4">Initial Hero</th>
                  <th className="py-3 px-4">Stats By Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
                {units.map((u, idx) => (
                  <tr key={u.id || idx} className="hover:bg-[#efe5cd] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#b45309]">UID #{u.uId}</td>
                    <td className="py-3.5 px-4 font-bold font-cinzel text-[#3a2518] flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#3a2518] text-[#ffe082] flex items-center justify-center text-xs font-bold shadow-inner">
                        {u.unitName?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm">{u.unitName}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.passiveSkillId && u.passiveSkillId !== -1 ? (
                        <span className="px-2.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] text-xs font-mono font-semibold border border-[#f59e0b]/40 inline-flex items-center gap-1">
                          <Zap className="w-3 h-3 text-[#d97706]" /> Skill #{u.passiveSkillId}
                        </span>
                      ) : (
                        <span className="text-[#8c7456] italic">None</span>
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
                                className="px-2.5 py-0.5 rounded bg-[#e8dcbf] text-[#3a2518] text-xs font-bold font-cinzel border border-[#c89b3c]/50 shadow-sm"
                              >
                                {cls?.name || `Class #${cId}`}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[#8c7456] italic">Novice</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      {u.givenAtRegister ? (
                        <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] text-xs font-bold">
                          INITIAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded bg-[#3a2518] text-[#c4b49e] text-xs font-bold border border-[#593d29]">
                          GACHA
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#78644e]">
                      {u.statsByGrade && u.statsByGrade.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          {u.statsByGrade.map((g: any, gIdx: number) => (
                            <span
                              key={gIdx}
                              className="px-2 py-0.5 rounded bg-[#e8dcbf] border border-[#c89b3c]/50 text-[#3a2518]"
                            >
                              G{g.grade}: HP {g.maxHP} | SP {g.maxSkillPoint} | Spd {g.speed}
                            </span>
                          ))}
                        </div>
                      ) : (
                        'Standard Grade Stats'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 2. Chapters Tab */}
      {activeTab === 'chapters' && (
        <div className="space-y-4">
          {chapters.length === 0 ? (
            <div className="parchment-card p-12 text-center text-[#8c7456] space-y-2 rounded-lg font-serif shadow-md">
              <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
              <p className="text-sm font-bold font-cinzel">No story chapters found in archives.</p>
            </div>
          ) : (
            chapters.map((ch, idx) => (
              <div key={ch.id || idx} className="parchment-card p-5 rounded-lg space-y-3 shadow-md border border-[#c89b3c]/50">
                <div className="flex items-center justify-between border-b border-[#c89b3c] pb-3">
                  <h3 className="text-base font-bold font-cinzel text-[#3a2518]">{ch.title || `Chapter ${ch.chapterId}`}</h3>
                  <span className="text-xs font-mono font-bold text-[#b45309]">Map ID: {ch.mapId}</span>
                </div>
                <div className="space-y-2">
                  {ch.scenes?.map((stg, sIdx) => (
                    <div
                      key={stg.sceneId || sIdx}
                      className="p-3 rounded bg-[#f4ecd8] border border-[#c89b3c]/50 flex items-center justify-between text-xs font-serif"
                    >
                      <div>
                        <span className="font-bold text-[#3a2518] text-sm block">{stg.description || `Scene ${stg.sceneId}`}</span>
                        <span className="text-[#78644e] block text-xs mt-0.5">
                          Scene ID: #{stg.sceneId} | Type: {stg.type || 'Battle'}
                        </span>
                      </div>
                      <span className="text-[#b45309] font-bold font-cinzel text-xs">{stg.autoNext ? 'AUTO NEXT' : 'MANUAL'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. Weapons Tab */}
      {activeTab === 'weapons' && (
        <div className="parchment-card rounded-lg overflow-hidden shadow-md">
          <div className="p-4 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] font-cinzel font-bold text-sm">
            WEAPON DEFINITIONS & STAT MODIFIERS (/api/WeaponDefinition)
          </div>
          {weapons.length === 0 ? (
            <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
              <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
              <p className="text-sm font-bold font-cinzel">No weapon definitions found in archives.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-serif">
              <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold border-b border-[#c89b3c] uppercase">
                <tr>
                  <th className="py-3 px-4">Weapon ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Class Requirement</th>
                  <th className="py-3 px-4">Weapon Skill</th>
                  <th className="py-3 px-4">Stat Modifiers</th>
                  <th className="py-3 px-4">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
                {weapons.map((w: any, idx) => (
                  <tr key={w.id || idx} className="hover:bg-[#efe5cd] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#b45309]">#{w.weaponId}</td>
                    <td className="py-3.5 px-4 font-bold font-cinzel text-[#3a2518] text-sm">{w.name}</td>
                    <td className="py-3.5 px-4">
                      {(() => {
                        const cls = classes.find((c) => c.classId === w.classId);
                        return (
                          <span className="px-2.5 py-0.5 rounded bg-[#e8dcbf] text-[#3a2518] text-xs font-bold font-cinzel border border-[#c89b3c]/50 inline-flex items-center gap-1 shadow-sm">
                            <Shield className="w-3 h-3 text-[#c89b3c]" />
                            {cls?.name || (w.classId ? `Class #${w.classId}` : 'All Classes')}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] text-xs font-mono font-semibold border border-[#f59e0b]/40 inline-flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[#d97706]" /> Skill #{w.skillId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#15803d] font-bold">
                      {w.statModifiers && (w.statModifiers.speed || w.statModifiers.maxHP || w.statModifiers.maxSkillPoint) ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {w.statModifiers.speed > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#fef08a] border border-[#d97706] text-[#b45309] text-xs">
                              +{w.statModifiers.speed} Speed
                            </span>
                          )}
                          {w.statModifiers.maxHP > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#dcfce7] border border-[#16a34a] text-[#15803d] text-xs">
                              +{w.statModifiers.maxHP} MaxHP
                            </span>
                          )}
                          {w.statModifiers.maxSkillPoint > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#e0f2fe] border border-[#0284c7] text-[#0369a1] text-xs">
                              +{w.statModifiers.maxSkillPoint} SP
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#8c7456] italic">None (Base Weapon)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {w.givenAtRegister ? (
                        <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] text-xs font-bold">
                          INITIAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded bg-[#3a2518] text-[#c4b49e] text-xs font-bold border border-[#593d29]">
                          GACHA ONLY
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 4. Trinkets Tab */}
      {activeTab === 'trinkets' && (
        <div className="parchment-card rounded-lg overflow-hidden shadow-md">
          <div className="p-4 bg-[#3a2518] text-[#ffe082] border-b-2 border-[#c89b3c] font-cinzel font-bold text-sm">
            TRINKET DEFINITIONS & STAT MODIFIERS (/api/TrinketDefinition)
          </div>
          {trinkets.length === 0 ? (
            <div className="p-12 text-center text-[#8c7456] space-y-2 font-serif">
              <Inbox className="w-8 h-8 mx-auto text-[#c89b3c]" />
              <p className="text-sm font-bold font-cinzel">No trinket definitions found in archives.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-serif">
              <thead className="bg-[#e8dcbf] text-[#3a2518] font-cinzel font-bold border-b border-[#c89b3c] uppercase">
                <tr>
                  <th className="py-3 px-4">Trinket ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Associated Skill</th>
                  <th className="py-3 px-4">Stat Modifiers</th>
                  <th className="py-3 px-4">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dcd1b5] text-[#2b1b11]">
                {trinkets.map((t: any, idx) => (
                  <tr key={t.id || idx} className="hover:bg-[#efe5cd] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#b45309]">#{t.trinketId}</td>
                    <td className="py-3.5 px-4 font-bold font-cinzel text-[#3a2518] text-sm">{t.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] text-xs font-mono font-semibold border border-[#f59e0b]/40 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#d97706]" /> Skill #{t.skillId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#15803d] font-bold">
                      {t.statModifiers && (t.statModifiers.speed || t.statModifiers.maxHP || t.statModifiers.maxSkillPoint) ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.statModifiers.speed > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#fef08a] border border-[#d97706] text-[#b45309] text-xs">
                              +{t.statModifiers.speed} Speed
                            </span>
                          )}
                          {t.statModifiers.maxHP > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#dcfce7] border border-[#16a34a] text-[#15803d] text-xs">
                              +{t.statModifiers.maxHP} MaxHP
                            </span>
                          )}
                          {t.statModifiers.maxSkillPoint > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#e0f2fe] border border-[#0284c7] text-[#0369a1] text-xs">
                              +{t.statModifiers.maxSkillPoint} SP
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#8c7456] italic">None (Base Trinket)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {t.givenAtRegister ? (
                        <span className="px-2.5 py-0.5 rounded bg-[#166534] text-[#86efac] text-xs font-bold">
                          INITIAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded bg-[#3a2518] text-[#c4b49e] text-xs font-bold border border-[#593d29]">
                          GACHA ONLY
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 5. Classes Tab */}
      {activeTab === 'classes' && (
        <div className="parchment-card p-5 rounded-lg space-y-3 shadow-md">
          <h3 className="text-sm font-bold text-[#3a2518] font-cinzel flex items-center gap-2 border-b border-[#c89b3c] pb-2">
            <Layers className="w-4 h-4 text-[#c89b3c]" />
            CLASS DEFINITIONS (/api/ClassDefinition)
          </h3>
          {classes.length === 0 ? (
            <p className="text-xs text-[#8c7456] font-serif text-center py-6">No class definitions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-4 rounded bg-[#f4ecd8] border border-[#c89b3c] text-xs font-serif space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-[#dcd1b5] pb-2 font-cinzel font-bold">
                    <span className="text-[#3a2518] text-sm">{c.name || `Class #${c.classId}`}</span>
                    <span className="text-[#b45309] font-mono">Class ID: #{c.classId}</span>
                  </div>
                  <div className="space-y-1 text-[#6b5842]">
                    <p>
                      Movement Skill: <strong className="font-mono text-[#b45309]">#{c.movementSkillId}</strong>
                    </p>
                    <p>
                      Class Skill: <strong className="font-mono text-[#b45309]">#{c.classSkillId}</strong>
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
        <div className="parchment-card p-5 rounded-lg space-y-3 shadow-md">
          <h3 className="text-sm font-bold text-[#3a2518] font-cinzel flex items-center gap-2 border-b border-[#c89b3c] pb-2">
            <Zap className="w-4 h-4 text-[#d97706]" />
            SKILL DEFINITIONS (/api/SkillDefinition)
          </h3>
          {skills.length === 0 ? (
            <p className="text-xs text-[#8c7456] font-serif text-center py-6">No skill definitions found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {skills.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3.5 rounded bg-[#f4ecd8] border border-[#c89b3c]/50 text-xs font-serif text-center space-y-1.5 shadow-sm hover:border-[#c89b3c] transition-all"
                >
                  <div className="w-8 h-8 mx-auto rounded-full bg-[#e8dcbf] border border-[#c89b3c] flex items-center justify-center shadow-inner">
                    <Sparkles className="w-4 h-4 text-[#d97706]" />
                  </div>
                  <span className="font-bold font-cinzel text-[#3a2518] block text-xs">
                    Skill Invocation
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#3a2518] text-[#ffe082] text-xs font-mono font-bold inline-block border border-[#c89b3c]/40">
                    #{s.skillId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Hero Unit Definition */}
      {isAddingUnit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="mahogany-banner p-6 rounded-lg border-2 border-[#c89b3c] w-full max-w-md space-y-4 font-serif text-xs shadow-xl">
            <h3 className="text-lg font-bold font-cinzel text-[#ffe082]">
              ADD HERO DEFINITION (MONGODB)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Hero Unit Name</label>
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. Paladin"
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Primary Class ID</label>
                <input
                  type="number"
                  value={newUnitClassId}
                  onChange={(e) => setNewUnitClassId(Number(e.target.value))}
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#593d29]">
              <button
                onClick={() => setIsAddingUnit(false)}
                className="px-3.5 py-1.5 text-xs text-[#c4b49e] hover:text-[#f7f1e1] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUnit}
                className="px-4 py-1.5 rounded crimson-badge text-xs font-bold font-cinzel shadow"
              >
                Save Hero Definition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
