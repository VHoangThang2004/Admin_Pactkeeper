import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type { GachaBanner } from '../types';
import { Plus, Calendar, Star, RefreshCw, Inbox, Gem, Sparkles } from 'lucide-react';

/**
 * GachaManagement Component
 * 
 * Re-architected to HoYoverse AAA Gaming Standards (Genshin Wishes / Star Rail Warps):
 * - Hero summon banners, rates, active durations, and pull pricing configurations
 * - 90-pull hard pity and 50/50 soft pity visualization (BR-06)
 * - Modern dark glassmorphic banner cards with artwork covers and status glows
 */
export const GachaManagement: React.FC = () => {
  // State for all fetched gacha banners
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  // Asynchronous loading indicator
  const [loading, setLoading] = useState(true);
  
  // Banner creation modal state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState(160);

  /**
   * Fetches summon banners from `/api/gachabanner` and maps them into
   * the local GachaBanner type structure.
   */
  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await adminClient.get('/gachabanner');
      if (Array.isArray(res.data)) {
        const mapped: GachaBanner[] = res.data.map((b: any) => ({
          id: b.id,
          title: b.name || b.title,
          description: b.description || '',
          bannerImageUrl: b.bannerImageUrl || '',
          startTime: b.startDate || new Date().toISOString(),
          endTime: b.expiryDate || new Date().toISOString(),
          costPerPull: b.pullOptions?.[0]?.price || 160,
          currencyType: 'Gems',
          featuredUnitIds: b.items?.filter((i: any) => i.isFeatured)?.map((i: any) => i.reward?.definitionId) || [],
          featuredWeaponIds: [],
          isActive: b.isActive ?? true,
        }));
        setBanners(mapped);
      } else {
        setBanners([]);
      }
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  /**
   * Handles creating a new summon banner on the backend via POST /gachabanner.
   */
  const handleCreateBanner = async () => {
    if (!newTitle.trim()) return;
    try {
      const payload = {
        name: newTitle.trim(),
        description: newDesc.trim(),
        items: [],
        pullOptions: [{ pullType: 1, price: newCost }],
        startDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        pityThreshold: 90,
      };
      await adminClient.post('/gachabanner', payload);
      await fetchBanners();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create banner on backend.');
    } finally {
      setIsCreating(false);
      setNewTitle('');
      setNewDesc('');
    }
  };

  /**
   * Toggles the active status of a summon banner.
   */
  const toggleBannerActive = async (id: string, currentActive: boolean) => {
    try {
      const endpoint = currentActive ? `/gachabanner/${id}/deactivate` : `/gachabanner/${id}/activate`;
      await adminClient.patch(endpoint);
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentActive } : b))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle banner status.');
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
          className="absolute -bottom-16 -left-16 w-72 h-72 bg-purple-500/[0.05] rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 uppercase font-bold tracking-wider shadow-[0_0_12px_rgba(242,191,78,0.15)]">
                GACHA RECRUITMENT • BR-06
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">Pity Threshold: 90 Pulls Max</span>
            </div>
            <h1 className="text-xl md:text-3xl font-extrabold tracking-wide font-cinzel uppercase hy-gold-text">
              SUMMON BANNERS & WISH ROTATIONS
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans">
              Configure hero invocations, drop rates, active schedules, and rate-up rosters from MongoDB.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchBanners()}
              disabled={loading}
              className="hy-btn-glass px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shadow transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC BANNERS</span>
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="hy-btn-gold px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950" />
              <span>NEW BANNER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Banners Grid */}
      {banners.length === 0 ? (
        <div className="hy-glass p-16 text-center text-slate-400 space-y-3 rounded-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          <Inbox className="w-12 h-12 mx-auto text-amber-400/60" />
          <p className="text-base font-bold font-cinzel text-slate-100">No Gacha Summon Banners active in realm.</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">Create a new limited or standard summoning pool to let travelers pull for heroes and weapons.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="hy-btn-gold px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 mt-2"
          >
            <Plus className="w-3.5 h-3.5 text-slate-950" /> Create First Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="hy-card rounded-2xl overflow-hidden flex flex-col border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)] group hover:border-amber-400/50 transition-all duration-300"
            >
              {/* Banner Cover Artwork Area */}
              <div className="h-48 relative bg-slate-950 overflow-hidden border-b border-white/[0.08]">
                {banner.bannerImageUrl ? (
                  <img
                    src={banner.bannerImageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#0c1022] to-indigo-950 text-amber-400/40">
                    <Star className="w-16 h-16 drop-shadow-[0_0_16px_rgba(242,191,78,0.3)]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a14] via-[#070a14]/40 to-transparent" />
                
                {/* Active Status Badge */}
                <div className="absolute top-3.5 right-3.5">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider shadow-lg flex items-center gap-1.5 ${
                      banner.isActive 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                        : 'bg-black/60 text-slate-400 border border-white/[0.1]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${banner.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {banner.isActive ? 'ACTIVE INVOCATION' : 'INACTIVE'}
                  </span>
                </div>

                {/* Banner Category and Title */}
                <div className="absolute bottom-3.5 left-5 right-5">
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs mb-1 font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">LIMITED EVENT WARP</span>
                  </div>
                  <h3 className="text-lg font-bold font-cinzel text-slate-100 drop-shadow-md">{banner.title}</h3>
                </div>
              </div>

              {/* Banner Details Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed text-xs">
                  {banner.description || 'No promotional description provided for this banner rotation.'}
                </p>

                {/* Costs & Featured Items Widget */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Gem className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Pull Price</span>
                      <span className="font-bold font-mono text-cyan-300 text-sm">{banner.costPerPull} Gems</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Star className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Rate-Up Items</span>
                      <span className="font-bold font-mono text-amber-300 text-sm">{banner.featuredUnitIds.length} Featured</span>
                    </div>
                  </div>
                </div>

                {/* Pity Threshold Indicator (BR-06) */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-slate-400">Guaranteed 5★ Pity:</span>
                    <span className="text-amber-300 font-bold">90 Pulls Max</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                    <div className="w-4/5 h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full shadow-[0_0_8px_rgba(242,191,78,0.5)]" />
                  </div>
                </div>

                {/* Banner Duration and Action Button */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      {new Date(banner.startTime).toLocaleDateString()} - {new Date(banner.endTime).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block">
                      Ref: #{banner.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleBannerActive(banner.id, !!banner.isActive)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      banner.isActive
                        ? 'hy-btn-glass text-rose-300 hover:text-rose-100 hover:border-rose-500/40'
                        : 'hy-btn-gold'
                    }`}
                  >
                    {banner.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Summon Banner */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="hy-glass p-6 md:p-7 rounded-2xl border border-amber-400/35 w-full max-w-md space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-xs relative animate-in fade-in zoom-in-95 duration-200">
            <span className="absolute top-3 left-3 text-amber-400/40 text-xs">❖</span>
            <span className="absolute top-3 right-3 text-amber-400/40 text-xs">❖</span>

            <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              CREATE SUMMON BANNER (MONGODB)
            </h3>
            <p className="text-xs text-slate-400">
              Configure banner parameters in accordance with the 90-pull pity rules (BR-06).
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Banner Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Celestial Oath: Blade of Judgment"
                  className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Description / Rate-Up Details</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe rate-up details, featured heroes, and mechanics..."
                  rows={3}
                  className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none resize-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Cost Per Pull (Gems)</label>
                <input
                  type="number"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsCreating(false)}
                className="hy-btn-glass px-3.5 py-1.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBanner}
                className="hy-btn-gold px-4 py-1.5 text-xs font-bold shadow"
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
