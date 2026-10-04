import React, { useState } from 'react';
import type { UnitDefinition, ChapterConfig } from '../types';
import { Database, BookOpen, Shield, Sword, Layers, Plus } from 'lucide-react';

const mockUnits: UnitDefinition[] = [
  { id: 'UNT_001', name: 'Arthur Pendragon', rarity: 'SSR', classId: 'CLASS_PALADIN', baseHp: 1200, baseAtk: 240, baseDef: 180, baseSpeed: 105 },
  { id: 'UNT_002', name: 'Merlin Ambrosius', rarity: 'SSR', classId: 'CLASS_ARCHMAGE', baseHp: 850, baseAtk: 380, baseDef: 90, baseSpeed: 115 },
  { id: 'UNT_003', name: 'Lancelot du Lac', rarity: 'SR', classId: 'CLASS_KNIGHT', baseHp: 1050, baseAtk: 210, baseDef: 160, baseSpeed: 110 },
  { id: 'UNT_004', name: 'Guinevere', rarity: 'SR', classId: 'CLASS_CLERIC', baseHp: 900, baseAtk: 120, baseDef: 110, baseSpeed: 100 },
];

const mockChapters: ChapterConfig[] = [
  {
    id: 'CHP_001',
    chapterNumber: 1,
    chapterName: 'Chapter 1: The Fallen Kingdom',
    stages: [
      { stageId: 'STG_1_1', stageName: 'Stage 1-1: Outpost Assault', staminaCost: 6, recommendedLevel: 1, firstClearRewards: [{ rewardType: 'Gem', amount: 50 }] },
      { stageId: 'STG_1_2', stageName: 'Stage 1-2: Dark Forest Siege', staminaCost: 6, recommendedLevel: 3, firstClearRewards: [{ rewardType: 'Gem', amount: 50 }] },
    ],
  },
  {
    id: 'CHP_002',
    chapterNumber: 2,
    chapterName: 'Chapter 2: Whispers of the Void',
    stages: [
      { stageId: 'STG_2_1', stageName: 'Stage 2-1: Cavern Entrance', staminaCost: 8, recommendedLevel: 10, firstClearRewards: [{ rewardType: 'Gem', amount: 100 }] },
    ],
  },
];

export const ContentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'units' | 'chapters' | 'weapons' | 'skills'>('units');
  const [units] = useState<UnitDefinition[]>(mockUnits);
  const [chapters] = useState<ChapterConfig[]>(mockChapters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-400" />
          Game Content & Definitions CMS
        </h2>
        <p className="text-sm text-slate-400">Configure SRPG unit stats, story chapters, stage rewards, and skill definitions.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'units' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" /> Units & Stats ({units.length})
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'chapters' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Story Chapters ({chapters.length})
        </button>
        <button
          onClick={() => setActiveTab('weapons')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'weapons' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sword className="w-4 h-4" /> Weapons & Trinkets
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'skills' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" /> Class & Skills
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'units' && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">SRPG Unit Definitions</h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add New Unit
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Unit ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Rarity</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Base HP</th>
                <th className="py-3 px-4">Base ATK</th>
                <th className="py-3 px-4">Base DEF</th>
                <th className="py-3 px-4">Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-mono text-indigo-400">{u.id}</td>
                  <td className="py-3.5 px-4 font-bold text-white">{u.name}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.rarity === 'SSR'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {u.rarity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{u.classId}</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-semibold">{u.baseHp}</td>
                  <td className="py-3.5 px-4 text-rose-400 font-semibold">{u.baseAtk}</td>
                  <td className="py-3.5 px-4 text-blue-400 font-semibold">{u.baseDef}</td>
                  <td className="py-3.5 px-4 text-slate-300">{u.baseSpeed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'chapters' && (
        <div className="space-y-4">
          {chapters.map((ch) => (
            <div key={ch.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">{ch.chapterName}</h3>
                <span className="text-xs font-mono text-indigo-400">{ch.id}</span>
              </div>
              <div className="space-y-2">
                {ch.stages.map((stg) => (
                  <div key={stg.stageId} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-200">{stg.stageName}</span>
                      <span className="text-slate-500 block">Stamina: {stg.staminaCost} | Rec Lvl: {stg.recommendedLevel}</span>
                    </div>
                    <span className="text-amber-300 font-medium">Reward: +{stg.firstClearRewards[0]?.amount} Gems</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(activeTab === 'weapons' || activeTab === 'skills') && (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
          <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">Class & Equipment Configuration Module</p>
          <p className="text-xs text-slate-500 mt-1">Ready to manage Weapons, Trinkets, and Skill tree multipliers.</p>
        </div>
      )}
    </div>
  );
};
