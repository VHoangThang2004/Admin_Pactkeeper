import React, { useState, useEffect } from 'react';
import { adminClient } from '../api/adminClient';
import type { GachaBanner } from '../types';
import { Plus, Calendar, Star, RefreshCw, Inbox, Gem } from 'lucide-react';

/**
 * GachaManagement Component
 * 
 * Provides an administrative dashboard interface to manage hero summon banners,
 * rates, active durations, and pull pricing configurations from MongoDB.
 * 
 * Features:
 * - Real-time listing of all active and past summon banners
 * - Banner activation and deactivation toggle via backend PATCH endpoints
 * - Creation of new summoning banners with pity threshold and pull cost
 * - Standardized medieval typography and accessible font sizes (min 12px)
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
   * Calls `/gachabanner/{id}/deactivate` or `/gachabanner/{id}/activate`.
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
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="mahogany-banner p-5 text-center rounded-lg relative shadow-md">
        <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#ffe082] uppercase font-cinzel">
          SUMMON BANNERS & RATES
        </h1>
        <p className="text-xs md:text-sm text-[#c4b49e] font-serif mt-1">
          Manage live PactKeeper Hero Summon banners from MongoDB
        </p>
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            onClick={() => fetchBanners()}
            className="px-3 py-1.5 rounded mahogany-button text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c89b3c] ${loading ? 'animate-spin' : ''}`} /> REFRESH
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-1.5 rounded crimson-badge text-xs font-cinzel font-bold flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" /> NEW BANNER
          </button>
        </div>
      </div>

      {/* Banners Grid */}
      {banners.length === 0 ? (
        <div className="parchment-card p-12 text-center text-[#8c7456] space-y-3 rounded-lg font-serif shadow-md">
          <Inbox className="w-10 h-10 mx-auto text-[#c89b3c]" />
          <p className="text-sm font-bold font-cinzel text-[#3a2518]">No Gacha Summon Banners active in realm.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-2 px-4 py-2 rounded crimson-badge text-xs font-bold inline-flex items-center gap-1.5 font-cinzel"
          >
            <Plus className="w-3.5 h-3.5" /> Create First Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="parchment-card rounded-lg overflow-hidden flex flex-col shadow-md border border-[#c89b3c]/50"
            >
              {/* Banner Cover Artwork Area */}
              <div className="h-44 relative bg-[#2b1b11] overflow-hidden border-b-2 border-[#c89b3c]">
                {banner.bannerImageUrl ? (
                  <img
                    src={banner.bannerImageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#26170d] text-[#c89b3c]/60">
                    <Star className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2b1b11] via-transparent to-transparent" />
                
                {/* Active Status Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold font-cinzel shadow ${
                      banner.isActive ? 'crimson-badge' : 'bg-[#3a2518] text-[#c4b49e] border border-[#593d29]'
                    }`}
                  >
                    {banner.isActive ? 'ACTIVE BANNER' : 'DISABLED'}
                  </span>
                </div>

                {/* Banner ID and Title */}
                <div className="absolute bottom-3 left-4 right-4">
                  <span className="text-xs font-mono text-[#c89b3c] font-bold block">{banner.id}</span>
                  <h3 className="text-lg font-bold font-cinzel text-[#ffe082] drop-shadow-sm">{banner.title}</h3>
                </div>
              </div>

              {/* Banner Details Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4 font-serif text-xs">
                <p className="text-[#3a2518] leading-relaxed">
                  {banner.description || 'No description provided.'}
                </p>

                {/* Costs & Featured Items Widget */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#f4ecd8] border border-[#c89b3c]/50">
                  <div className="flex items-center gap-2 text-[#3a2518]">
                    <Gem className="w-4 h-4 text-[#d97706]" />
                    <span>
                      Cost: <strong className="font-bold font-mono text-[#b45309]">{banner.costPerPull} Gems</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#3a2518]">
                    <Star className="w-4 h-4 text-[#8b5cf6]" />
                    <span>
                      Featured: <strong className="font-bold text-[#3a2518]">{banner.featuredUnitIds.length} Items</strong>
                    </span>
                  </div>
                </div>

                {/* Banner Duration and Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[#dcd1b5]">
                  <span className="text-xs text-[#78644e] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#c89b3c]" />
                    {new Date(banner.startTime).toLocaleDateString()} - {new Date(banner.endTime).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => toggleBannerActive(banner.id, !!banner.isActive)}
                    className="px-3.5 py-1.5 rounded mahogany-button text-xs font-bold font-cinzel shadow"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="mahogany-banner p-6 rounded-lg border-2 border-[#c89b3c] w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold font-cinzel text-[#ffe082]">
              CREATE SUMMON BANNER (MONGODB)
            </h3>
            <div className="space-y-3 font-serif text-xs">
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Banner Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Divine Hero Summon"
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe rate-up details..."
                  rows={3}
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
              <div>
                <label className="font-cinzel font-bold text-[#ffe082] block mb-1">Cost Per Pull (Gems)</label>
                <input
                  type="number"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-full bg-[#26170d] border border-[#c89b3c] rounded px-3 py-2 text-xs text-[#f7f1e1] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#593d29]">
              <button
                onClick={() => setIsCreating(false)}
                className="px-3.5 py-1.5 text-xs text-[#c4b49e] hover:text-[#f7f1e1] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBanner}
                className="px-4 py-1.5 rounded crimson-badge text-xs font-bold font-cinzel shadow"
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
