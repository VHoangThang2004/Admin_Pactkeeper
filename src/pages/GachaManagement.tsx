import React, { useState, useEffect, useMemo } from 'react';
import { adminClient } from '../api/adminClient';
import { recordAuditEvent } from '../services/adminSecurityService';
import type { GachaBanner, GachaBannerItem, GachaPullOption } from '../types';
import {
  Plus,
  Calendar,
  Star,
  RefreshCw,
  Inbox,
  Gem,
  Sparkles,
  Search,
  Eye,
  Copy,
  Clock,
  ShieldAlert,
  CheckCircle2,
  X,
  Image as ImageIcon,
} from 'lucide-react';

interface ResolvedDefinition {
  name: string;
  kind: 'Hero' | 'Weapon';
}

type BannerFilterStatus = 'ALL' | 'LIVE' | 'UPCOMING' | 'EXPIRED' | 'INACTIVE';

const DEFAULT_PULL_COST = 160;
const DEFAULT_PITY_THRESHOLD = 90;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Formats an ISO timestamp or Date into a `YYYY-MM-DDTHH:mm` string for datetime-local inputs.
 */
function toLocalDatetimeInput(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Computes live schedule classification and elapsed percentage for a banner.
 */
function getBannerScheduleMeta(banner: GachaBanner, referenceTime: number) {
  const startMs = new Date(banner.startTime).getTime();
  const endMs = new Date(banner.endTime).getTime();
  const hasValidRange = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;

  let status: Exclude<BannerFilterStatus, 'ALL'> = 'LIVE';
  if (!banner.isActive) {
    status = 'INACTIVE';
  } else if (hasValidRange && referenceTime < startMs) {
    status = 'UPCOMING';
  } else if (hasValidRange && referenceTime > endMs) {
    status = 'EXPIRED';
  }

  let progressPct = 100;
  if (hasValidRange) {
    if (referenceTime <= startMs) progressPct = 0;
    else if (referenceTime >= endMs) progressPct = 100;
    else progressPct = Math.round(((referenceTime - startMs) / (endMs - startMs)) * 100);
  }

  let scheduleSummary = 'Schedule window active';
  if (status === 'INACTIVE') {
    scheduleSummary = 'Deactivated by Counsel';
  } else if (status === 'UPCOMING' && hasValidRange) {
    const hoursLeft = Math.max(1, Math.ceil((startMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary = hoursLeft >= 24 ? `Starts in ${Math.ceil(hoursLeft / 24)}d` : `Starts in ${hoursLeft}h`;
  } else if (status === 'EXPIRED') {
    scheduleSummary = 'Window ended';
  } else if (hasValidRange) {
    const hoursLeft = Math.max(1, Math.ceil((endMs - referenceTime) / (1000 * 60 * 60)));
    scheduleSummary = hoursLeft >= 24 ? `${Math.ceil(hoursLeft / 24)}d remaining` : `${hoursLeft}h remaining`;
  }

  return { status, progressPct, scheduleSummary };
}

/**
 * Builds lookup tables from UnitDefinition and WeaponDefinition catalogs
 * so banner item definitionIds resolve to human-readable hero/weapon names.
 */
function buildDefinitionLookup(units: any[], weapons: any[]): Map<string, ResolvedDefinition> {
  const map = new Map<string, ResolvedDefinition>();

  units.forEach((u) => {
    const name = (u.unitName || u.name || '').trim();
    if (!name) return;
    if (u.id) map.set(String(u.id), { name, kind: 'Hero' });
    if (u.uId !== undefined && u.uId !== null) map.set(String(u.uId), { name, kind: 'Hero' });
  });

  weapons.forEach((w) => {
    const name = (w.name || '').trim();
    if (!name) return;
    if (w.id) map.set(String(w.id), { name, kind: 'Weapon' });
    if (w.weaponId !== undefined && w.weaponId !== null) map.set(String(w.weaponId), { name, kind: 'Weapon' });
  });

  return map;
}

/**
 * Fetches banners alongside unit & weapon catalogs in parallel.
 */
async function loadGachaWorkspace() {
  const [bannerRes, unitRes, weaponRes] = await Promise.allSettled([
    adminClient.get('/gachabanner'),
    adminClient.get('/UnitDefinition'),
    adminClient.get('/WeaponDefinition'),
  ]);

  const units = unitRes.status === 'fulfilled' && Array.isArray(unitRes.value.data) ? unitRes.value.data : [];
  const weapons = weaponRes.status === 'fulfilled' && Array.isArray(weaponRes.value.data) ? weaponRes.value.data : [];
  const lookup = buildDefinitionLookup(units, weapons);

  const rawBanners = bannerRes.status === 'fulfilled' && Array.isArray(bannerRes.value.data) ? bannerRes.value.data : [];
  const mapped: GachaBanner[] = rawBanners.map((b: any) => {
    const items: GachaBannerItem[] = Array.isArray(b.items) ? b.items : [];
    const pullOptions: GachaPullOption[] = Array.isArray(b.pullOptions) ? b.pullOptions : [];
    const singleOption = pullOptions.find((opt) => Number(opt.pullType) === 1) || pullOptions[0];

    const featuredUnits: string[] = [];
    const featuredWeapons: string[] = [];

    items.forEach((item) => {
      if (!item?.isFeatured || !item.reward?.definitionId) return;
      const defId = String(item.reward.definitionId);
      const rewardType = String(item.reward.rewardType || '').toLowerCase();
      const resolved = lookup.get(defId);

      if (rewardType.includes('weapon') || resolved?.kind === 'Weapon') {
        featuredWeapons.push(defId);
      } else {
        featuredUnits.push(defId);
      }
    });

    return {
      id: String(b.id),
      title: b.name || b.title || 'Untitled Banner',
      description: b.description || '',
      bannerImageUrl: b.bannerImageUrl || '',
      startTime: b.startDate || new Date().toISOString(),
      endTime: b.expiryDate || new Date().toISOString(),
      costPerPull: singleOption?.price || DEFAULT_PULL_COST,
      pullOptions,
      pityThreshold: Number(b.pityThreshold) > 0 ? Number(b.pityThreshold) : DEFAULT_PITY_THRESHOLD,
      currencyType: 'Gems',
      featuredUnitIds: featuredUnits,
      featuredWeaponIds: featuredWeapons,
      items,
      isActive: b.isActive ?? true,
    };
  });

  return { banners: mapped, definitionLookup: lookup };
}

/**
 * GachaManagement Component
 *
 * Re-architected to HoYoverse AAA Gaming Standards (Genshin Wishes / Star Rail Warps):
 * - Hero summon banners, schedules, rates, pull pricing, and pity thresholds (BR-06)
 * - Pool inspection modal with Hero/Weapon catalog name resolution
 * - Rerun duplication and schedule-configured banner creation
 */
export const GachaManagement: React.FC = () => {
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [definitionLookup, setDefinitionLookup] = useState<Map<string, ResolvedDefinition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Search & Status Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BannerFilterStatus>('ALL');

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Banner Pool Detail Modal
  const [inspectingBanner, setInspectingBanner] = useState<GachaBanner | null>(null);

  // Banner creation modal state
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newStartDate, setNewStartDate] = useState(() => toLocalDatetimeInput(new Date()));
  const [newEndDate, setNewEndDate] = useState(() => toLocalDatetimeInput(new Date(Date.now() + FOURTEEN_DAYS_MS)));
  const [newCost, setNewCost] = useState(DEFAULT_PULL_COST);
  const [enableTenPull, setEnableTenPull] = useState(false);
  const [newTenCost, setNewTenCost] = useState(DEFAULT_PULL_COST * 10);
  const [newPity, setNewPity] = useState(DEFAULT_PITY_THRESHOLD);
  const [clonedItems, setClonedItems] = useState<GachaBannerItem[]>([]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const workspace = await loadGachaWorkspace();
      setBanners(workspace.banners);
      setDefinitionLookup(workspace.definitionLookup);
      setNowMs(Date.now());
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadGachaWorkspace()
      .then((workspace) => {
        if (!active) return;
        setBanners(workspace.banners);
        setDefinitionLookup(workspace.definitionLookup);
        setNowMs(Date.now());
      })
      .catch(() => {
        if (active) setBanners([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveDefinitionLabel = (defId?: string, fallbackName?: string): string => {
    if (!defId) return fallbackName || 'Unknown Item';
    const resolved = definitionLookup.get(String(defId));
    if (resolved) return `${resolved.name} (${resolved.kind})`;
    if (fallbackName) return fallbackName;
    return `#${String(defId).slice(-6).toUpperCase()}`;
  };

  const openCreateModal = (template?: GachaBanner) => {
    setModalError(null);
    if (template) {
      const tenOpt = template.pullOptions?.find((o) => Number(o.pullType) === 10);
      setNewTitle(`${template.title} (Rerun)`);
      setNewDesc(template.description);
      setNewImageUrl(template.bannerImageUrl || '');
      setNewCost(template.costPerPull || DEFAULT_PULL_COST);
      setEnableTenPull(Boolean(tenOpt));
      setNewTenCost(tenOpt?.price || (template.costPerPull || DEFAULT_PULL_COST) * 10);
      setNewPity(template.pityThreshold || DEFAULT_PITY_THRESHOLD);
      setClonedItems(template.items || []);
    } else {
      setNewTitle('');
      setNewDesc('');
      setNewImageUrl('');
      setNewCost(DEFAULT_PULL_COST);
      setEnableTenPull(false);
      setNewTenCost(DEFAULT_PULL_COST * 10);
      setNewPity(DEFAULT_PITY_THRESHOLD);
      setClonedItems([]);
    }
    const now = new Date();
    setNewStartDate(toLocalDatetimeInput(now));
    setNewEndDate(toLocalDatetimeInput(new Date(now.getTime() + FOURTEEN_DAYS_MS)));
    setIsCreating(true);
  };

  /**
   * Handles creating a new summon banner on the backend via POST /gachabanner.
   */
  const handleCreateBanner = async () => {
    if (!newTitle.trim()) {
      setModalError('Banner title is required.');
      return;
    }
    if (newCost <= 0) {
      setModalError('Single pull cost must be greater than 0 Gems.');
      return;
    }
    if (enableTenPull && newTenCost <= 0) {
      setModalError('10-Pull bundle cost must be greater than 0 Gems.');
      return;
    }
    if (newPity < 1) {
      setModalError('Hard pity threshold must be at least 1 pull.');
      return;
    }

    const startDateObj = new Date(newStartDate);
    const endDateObj = new Date(newEndDate);
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      setModalError('Valid start and expiry date/time values are required.');
      return;
    }
    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setModalError('Expiry date must be later than start date.');
      return;
    }

    setCreating(true);
    setModalError(null);
    try {
      const pullOptions: GachaPullOption[] = [{ pullType: 1, price: Number(newCost) }];
      if (enableTenPull) {
        pullOptions.push({ pullType: 10, price: Number(newTenCost) });
      }

      const payload: Record<string, unknown> = {
        name: newTitle.trim(),
        description: newDesc.trim(),
        items: clonedItems,
        pullOptions,
        startDate: startDateObj.toISOString(),
        expiryDate: endDateObj.toISOString(),
        pityThreshold: Number(newPity),
      };

      if (newImageUrl.trim()) {
        payload.bannerImageUrl = newImageUrl.trim();
      }

      await adminClient.post('/gachabanner', payload);
      void recordAuditEvent({
        action: 'GACHA_BANNER_CREATED',
        category: 'GACHA',
        severity: 'HIGH',
        targetType: 'GachaBanner',
        targetLabel: newTitle.trim(),
        afterState: {
          startDate: payload.startDate,
          expiryDate: payload.expiryDate,
          pityThreshold: payload.pityThreshold,
        },
      });
      await fetchBanners();
      setIsCreating(false);
      showToast(`Created summon banner "${newTitle.trim()}".`);
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create banner on backend.');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Toggles the active status of a summon banner.
   */
  const toggleBannerActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      const endpoint = currentActive ? `/gachabanner/${id}/deactivate` : `/gachabanner/${id}/activate`;
      await adminClient.patch(endpoint);
      void recordAuditEvent({
        action: currentActive ? 'GACHA_BANNER_DEACTIVATED' : 'GACHA_BANNER_ACTIVATED',
        category: 'GACHA',
        severity: 'HIGH',
        targetType: 'GachaBanner',
        targetId: id,
        beforeState: { isActive: currentActive },
        afterState: { isActive: !currentActive },
      });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentActive } : b))
      );
      showToast(`Banner ${!currentActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to toggle banner status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Summary counts computed from loaded banners
  const statusCounts = useMemo(() => {
    const counts = { ALL: banners.length, LIVE: 0, UPCOMING: 0, EXPIRED: 0, INACTIVE: 0 };
    banners.forEach((b) => {
      const { status } = getBannerScheduleMeta(b, nowMs);
      counts[status]++;
    });
    return counts;
  }, [banners, nowMs]);

  // Filtered banners based on status & search query
  const filteredBanners = useMemo(() => {
    return banners.filter((banner) => {
      const { status } = getBannerScheduleMeta(banner, nowMs);
      if (statusFilter !== 'ALL' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = banner.title.toLowerCase().includes(q);
        const descMatch = banner.description.toLowerCase().includes(q);
        const idMatch = banner.id.toLowerCase().includes(q);
        const featuredMatch = [...banner.featuredUnitIds, ...banner.featuredWeaponIds].some((defId) => {
          const resolved = definitionLookup.get(defId);
          return defId.toLowerCase().includes(q) || (resolved?.name || '').toLowerCase().includes(q);
        });
        if (!titleMatch && !descMatch && !idMatch && !featuredMatch) {
          return false;
        }
      }

      return true;
    });
  }, [banners, statusFilter, searchQuery, nowMs, definitionLookup]);

  return (
    <div className="space-y-6 pb-8 font-sans select-none">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-8 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.8)] flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/45 text-rose-200'
              : 'bg-[#12182e] border-amber-400/40 text-amber-200'
          }`}
        >
          {toast.type === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Astral Header Banner */}
      <div className="hy-glass p-6 md:p-8 rounded-2xl relative overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
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
              <span className="text-xs text-slate-400 font-mono">90-Pull Hard Pity Rules</span>
            </div>
            <h1 className="text-xl md:text-3xl font-extrabold tracking-wide font-cinzel uppercase hy-gold-text">
              SUMMON BANNERS & WISH ROTATIONS
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans">
              Configure hero invocations, summon windows, pull pricing, pity thresholds, and inspect rate-up pools from MongoDB.
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
              onClick={() => openCreateModal()}
              className="hy-btn-gold px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950" />
              <span>NEW BANNER</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="hy-card p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Total Banners</span>
            <span className="text-2xl font-extrabold font-mono text-slate-100">{banners.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="hy-card p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Live Now</span>
            <span className="text-2xl font-extrabold font-mono text-emerald-300">{statusCounts.LIVE}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="hy-card p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Upcoming / Expired</span>
            <span className="text-2xl font-extrabold font-mono text-cyan-300">
              {statusCounts.UPCOMING} <span className="text-sm text-slate-400 font-normal">/ {statusCounts.EXPIRED}</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="hy-card p-4 rounded-2xl border border-purple-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Inactive Pools</span>
            <span className="text-2xl font-extrabold font-mono text-slate-300">{statusCounts.INACTIVE}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Star className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="hy-glass p-3.5 rounded-2xl border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0c1022] border border-white/[0.08]">
          {(['ALL', 'LIVE', 'UPCOMING', 'EXPIRED', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === st ? 'hy-tab-active' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st} ({statusCounts[st]})
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] lg:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search banner title, hero, or ID..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0c1022] border border-white/[0.08] text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      {/* Banners Grid */}
      {filteredBanners.length === 0 ? (
        <div className="hy-glass p-16 text-center text-slate-400 space-y-3 rounded-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          <Inbox className="w-12 h-12 mx-auto text-amber-400/60" />
          <p className="text-base font-bold font-cinzel text-slate-100">
            {banners.length === 0
              ? 'No Gacha Summon Banners active in realm.'
              : 'No summon banners match your current filter.'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {banners.length === 0
              ? 'Create a new limited or standard summoning pool to let travelers pull for heroes and weapons.'
              : 'Adjust the status filter or clear your search query to inspect other banner rotations.'}
          </p>
          {banners.length === 0 && (
            <button
              onClick={() => openCreateModal()}
              className="hy-btn-gold px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 mt-2"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950" /> Create First Banner
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBanners.map((banner) => {
            const schedule = getBannerScheduleMeta(banner, nowMs);
            const featuredIds = [...banner.featuredUnitIds, ...banner.featuredWeaponIds];
            const tenPullOption = banner.pullOptions?.find((opt) => Number(opt.pullType) === 10);
            const hasValidImg = Boolean(banner.bannerImageUrl) && !failedImages[banner.id];

            const badgeStyles =
              schedule.status === 'LIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : schedule.status === 'UPCOMING'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : schedule.status === 'EXPIRED'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-black/60 text-slate-400 border-white/[0.1]';

            const badgeLabel =
              schedule.status === 'LIVE'
                ? 'ACTIVE INVOCATION'
                : schedule.status === 'UPCOMING'
                ? 'SCHEDULED UPCOMING'
                : schedule.status === 'EXPIRED'
                ? 'WINDOW EXPIRED'
                : 'INACTIVE';

            return (
              <div
                key={banner.id}
                className="hy-card rounded-2xl overflow-hidden flex flex-col border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.65)] group hover:border-amber-400/50 transition-all duration-300"
              >
                {/* Banner Cover Artwork Area */}
                <div className="h-48 relative bg-slate-950 overflow-hidden border-b border-white/[0.08]">
                  {hasValidImg ? (
                    <img
                      src={banner.bannerImageUrl}
                      alt={banner.title}
                      onError={() => setFailedImages((prev) => ({ ...prev, [banner.id]: true }))}
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
                      className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider shadow-lg border flex items-center gap-1.5 ${badgeStyles}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          schedule.status === 'LIVE'
                            ? 'bg-emerald-400 animate-pulse'
                            : schedule.status === 'UPCOMING'
                            ? 'bg-cyan-400'
                            : schedule.status === 'EXPIRED'
                            ? 'bg-amber-400'
                            : 'bg-slate-500'
                        }`}
                      />
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Banner Category and Title */}
                  <div className="absolute bottom-3.5 left-5 right-5">
                    <div className="flex items-center gap-1.5 text-amber-300 text-xs mb-1 font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {banner.items && banner.items.length > 0 ? `${banner.items.length} POOL ENTRIES` : 'LIMITED EVENT WARP'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold font-cinzel text-slate-100 drop-shadow-md truncate">
                      {banner.title}
                    </h3>
                  </div>
                </div>

                {/* Banner Details Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-xs">
                  <p className="text-slate-300 leading-relaxed text-xs line-clamp-2">
                    {banner.description || 'No promotional description provided for this banner rotation.'}
                  </p>

                  {/* Costs & Featured Items Widget */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Gem className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Pull Pricing</span>
                        <span className="font-bold font-mono text-cyan-300 text-sm">
                          {banner.costPerPull} Gems
                        </span>
                        {tenPullOption && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            10x: {tenPullOption.price} Gems
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Star className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Rate-Up Items</span>
                        <span className="font-bold font-mono text-amber-300 text-sm">{featuredIds.length} Featured</span>
                      </div>
                    </div>
                  </div>

                  {/* Featured Roster Pills (resolved against Hero & Weapon catalogs) */}
                  {featuredIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {featuredIds.slice(0, 4).map((defId) => (
                        <span
                          key={defId}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/25"
                        >
                          ★ {resolveDefinitionLabel(defId)}
                        </span>
                      ))}
                      {featuredIds.length > 4 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                          +{featuredIds.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Real Schedule Timeline & Hard Pity Indicator (BR-06) */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-slate-400">
                        Hard Pity: <strong className="text-amber-300">{banner.pityThreshold ?? 90} Pulls Max</strong>
                      </span>
                      <span className="text-cyan-300 font-semibold">{schedule.scheduleSummary}</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full shadow-[0_0_8px_rgba(242,191,78,0.5)] transition-all duration-500"
                        style={{ width: `${schedule.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Banner Duration and Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.08]">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        {new Date(banner.startTime).toLocaleDateString()} - {new Date(banner.endTime).toLocaleDateString()}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 block">
                        Ref: #{banner.id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingBanner(banner)}
                        className="hy-btn-glass px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 text-cyan-300 hover:text-white"
                        title="Inspect Pool & Schedule Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pool</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openCreateModal(banner)}
                        className="hy-btn-glass px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 text-slate-300 hover:text-amber-200"
                        title="Duplicate banner settings as a new Rerun"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Rerun</span>
                      </button>

                      <button
                        type="button"
                        disabled={togglingId === banner.id}
                        onClick={() => toggleBannerActive(banner.id, !!banner.isActive)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                          banner.isActive
                            ? 'hy-btn-glass text-rose-300 hover:text-rose-100 hover:border-rose-500/40'
                            : 'hy-btn-gold'
                        }`}
                      >
                        {togglingId === banner.id
                          ? 'Updating...'
                          : banner.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Inspect Banner Pool & Metadata */}
      {inspectingBanner && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setInspectingBanner(null)}
        >
          <div
            className="hy-glass p-6 md:p-7 rounded-2xl border border-amber-400/35 w-full max-w-2xl space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-xs relative max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold">
                  BANNER POOL & SCHEDULE AUDIT
                </span>
                <h3 className="text-base md:text-lg font-bold font-cinzel text-slate-100 mt-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{inspectingBanner.title}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingBanner(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                <div className="p-3 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="text-amber-300 font-bold">
                    {getBannerScheduleMeta(inspectingBanner, nowMs).status}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 block">Hard Pity</span>
                  <span className="text-slate-100 font-bold">{inspectingBanner.pityThreshold ?? 90} Pulls</span>
                </div>
                <div className="p-3 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 block">Start Date</span>
                  <span className="text-slate-200">{new Date(inspectingBanner.startTime).toLocaleDateString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#090d1a] border border-white/[0.08]">
                  <span className="text-[10px] text-slate-400 block">Expiry Date</span>
                  <span className="text-slate-200">{new Date(inspectingBanner.endTime).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090d1a] border border-white/[0.08] space-y-2">
                <span className="text-[11px] font-cinzel font-bold uppercase text-amber-300 block">
                  Configured Pull Options
                </span>
                <div className="flex flex-wrap gap-2 font-mono">
                  {(inspectingBanner.pullOptions && inspectingBanner.pullOptions.length > 0
                    ? inspectingBanner.pullOptions
                    : [{ pullType: 1, price: inspectingBanner.costPerPull }]
                  ).map((opt, i) => (
                    <span
                      key={`${opt.pullType}-${i}`}
                      className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200"
                    >
                      {opt.pullType}x Pull: <strong>{opt.price} Gems</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090d1a] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-cinzel font-bold uppercase text-amber-300">
                    Banner Reward Pool ({inspectingBanner.items?.length || 0} Entries)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ID: {inspectingBanner.id}</span>
                </div>

                {!inspectingBanner.items || inspectingBanner.items.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">
                    No explicit pool items attached to this banner record in MongoDB.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] max-h-60 overflow-y-auto">
                    {inspectingBanner.items.map((item, idx) => {
                      const defId = item.reward?.definitionId;
                      return (
                        <div key={`${defId || 'item'}-${idx}`} className="py-2 flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.isFeatured
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                                  : 'bg-white/[0.05] text-slate-400'
                              }`}
                            >
                              {item.isFeatured ? 'RATE-UP' : 'POOL'}
                            </span>
                            <span className="text-slate-100 truncate">
                              {resolveDefinitionLabel(defId, item.reward?.name)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                            {item.rarity && <span>{item.rarity}</span>}
                            {item.dropRate !== undefined && <span className="text-cyan-300">{item.dropRate}%</span>}
                            {item.weight !== undefined && <span>Weight: {item.weight}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => {
                  const banner = inspectingBanner;
                  setInspectingBanner(null);
                  openCreateModal(banner);
                }}
                className="hy-btn-glass px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-amber-200"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate as Rerun</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectingBanner(null)}
                className="hy-btn-gold px-4 py-1.5 text-xs font-bold shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Summon Banner */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="hy-glass p-6 md:p-7 rounded-2xl border border-amber-400/35 w-full max-w-lg space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-xs relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <span className="absolute top-3 left-3 text-amber-400/40 text-xs">❖</span>
            <span className="absolute top-3 right-3 text-amber-400/40 text-xs">❖</span>

            <h3 className="text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              CREATE SUMMON BANNER (MONGODB)
            </h3>
            <p className="text-xs text-slate-400">
              Configure banner schedule, pricing, and hard pity parameters in accordance with BR-06 rules.
            </p>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {clonedItems.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-2">
                <span>
                  Carrying over <strong>{clonedItems.length}</strong> pool entries from template banner.
                </span>
                <button
                  type="button"
                  onClick={() => setClonedItems([])}
                  className="text-[11px] underline text-amber-300 hover:text-white shrink-0"
                >
                  Clear Pool
                </button>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Banner Title *</label>
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
                  rows={2}
                  className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Banner Artwork URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Expiry Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Cost Per Pull (Gems)</label>
                  <input
                    type="number"
                    min={1}
                    value={newCost}
                    onChange={(e) => setNewCost(Number(e.target.value))}
                    className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Hard Pity Threshold (Pulls)</label>
                  <input
                    type="number"
                    min={1}
                    value={newPity}
                    onChange={(e) => setNewPity(Number(e.target.value))}
                    className="w-full bg-[#090d1a] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#090d1a] border border-white/[0.08] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-semibold">
                  <input
                    type="checkbox"
                    checked={enableTenPull}
                    onChange={(e) => setEnableTenPull(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>Include 10x Multi-Pull Option</span>
                </label>
                {enableTenPull && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">10-Pull Bundle Price (Gems)</label>
                    <input
                      type="number"
                      min={1}
                      value={newTenCost}
                      onChange={(e) => setNewTenCost(Number(e.target.value))}
                      className="w-full bg-[#0c1022] border border-white/[0.1] focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                disabled={creating}
                onClick={() => setIsCreating(false)}
                className="hy-btn-glass px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateBanner}
                className="hy-btn-gold px-4 py-1.5 text-xs font-bold shadow disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
