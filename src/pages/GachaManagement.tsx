import React, { useState } from 'react';
import type { GachaBanner } from '../types';
import { Sparkles, Plus, Calendar, DollarSign, Star } from 'lucide-react';

const mockBanners: GachaBanner[] = [
  {
    id: 'BAN_001',
    title: 'Divine Knight Awakening Banner',
    description: 'Increased rate for SSR Unit [Arthur - Sovereign Blade] and SR Weapon [Excalibur].',
    bannerImageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=60',
    startTime: '2026-08-01T00:00:00Z',
    endTime: '2026-08-31T23:59:59Z',
    costPerPull: 160,
    currencyType: 'Gems',
    featuredUnitIds: ['UNT_ARTHUR_SSR', 'UNT_MERLIN_SR'],
    featuredWeaponIds: ['WPN_EXCALIBUR_SSR'],
    isActive: true,
  },
  {
    id: 'BAN_002',
    title: 'Shadow Assassin Festival',
    description: 'Special rate up for Ninja & Assassin classes.',
    bannerImageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=60',
    startTime: '2026-08-15T00:00:00Z',
    endTime: '2026-09-15T23:59:59Z',
    costPerPull: 150,
    currencyType: 'Gems',
    featuredUnitIds: ['UNT_KAGE_SSR'],
    featuredWeaponIds: ['WPN_KUNAI_SSR'],
    isActive: true,
  },
];

export const GachaManagement: React.FC = () => {
  const [banners, setBanners] = useState<GachaBanner[]>(mockBanners);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState(160);

  const handleCreateBanner = () => {
    if (!newTitle) return;
    const newBanner: GachaBanner = {
      id: `BAN_${Date.now()}`,
      title: newTitle,
      description: newDesc,
      bannerImageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=60',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      costPerPull: newCost,
      currencyType: 'Gems',
      featuredUnitIds: [],
      featuredWeaponIds: [],
      isActive: true,
    };
    setBanners([newBanner, ...banners]);
    setIsCreating(false);
    setNewTitle('');
    setNewDesc('');
  };

  const toggleBannerActive = (id: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Gacha Banners & Rates
          </h2>
          <p className="text-sm text-slate-400">Configure gacha summoning pools, featured rates, and event banners.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Banner
        </button>
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner) => (
          <div key={banner.id} className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="h-44 relative bg-slate-900 overflow-hidden">
              <img
                src={banner.bannerImageUrl}
                alt={banner.title}
                className="w-full h-full object-cover opacity-80 hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent" />
              <div className="absolute top-3 right-3">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    banner.isActive
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {banner.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-[10px] font-mono text-indigo-400 font-semibold">{banner.id}</span>
                <h3 className="text-lg font-bold text-white">{banner.title}</h3>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">{banner.description}</p>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-slate-400">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cost: <strong className="text-white">{banner.costPerPull} Gems</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Star className="w-3.5 h-3.5 text-purple-400" />
                  <span>Featured: <strong className="text-white">{banner.featuredUnitIds.length} SSRs</strong></span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {new Date(banner.startTime).toLocaleDateString()} - {new Date(banner.endTime).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBannerActive(banner.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    {banner.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal create */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Create Gacha Banner</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Banner Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Legendary Hero Summon"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe rate-ups and featured characters..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Cost Per Pull (Gems)</label>
                <input
                  type="number"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreateBanner}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Create Banner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
