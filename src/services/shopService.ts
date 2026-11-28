import axios from 'axios';
import { adminClient } from '../api/adminClient';
import type {
  GachaRewardType,
  RewardItemDto,
  ShopDto,
  ShopItemDto,
  ShopResetPeriod,
  UpsertShopPayload,
} from '../types';

export type ShopLiveStatus =
  | 'OPEN'
  | 'OUTSIDE_HOURS'
  | 'SCHEDULED'
  | 'EXPIRED'
  | 'PAUSED';

export interface ShopLiveStatusInfo {
  status: ShopLiveStatus;
  label: string;
  detail: string;
}

function normalizeRewardType(raw: unknown): GachaRewardType {
  if (typeof raw === 'number') {
    if (raw === 0) return 'Unit';
    if (raw === 1) return 'Weapon';
    if (raw === 2) return 'Trinket';
    return 'Gems';
  }
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'unit') return 'Unit';
  if (s === 'weapon') return 'Weapon';
  if (s === 'trinket') return 'Trinket';
  return 'Gems';
}

function normalizeReward(raw: Record<string, unknown> | undefined | null): RewardItemDto {
  const type = normalizeRewardType(raw?.type ?? raw?.Type);
  const definitionId = Number(raw?.definitionId ?? raw?.DefinitionId ?? 0) || 0;
  const classId = Number(raw?.classId ?? raw?.ClassId ?? 0) || 0;
  const amount = Math.max(1, Number(raw?.amount ?? raw?.Amount ?? 1) || 1);
  return {
    type,
    definitionId: type === 'Gems' ? 0 : definitionId,
    classId: type === 'Unit' ? classId : 0,
    amount: type === 'Gems' ? amount : 1,
  };
}

function normalizeResetPeriod(raw: unknown): ShopResetPeriod {
  if (typeof raw === 'number') {
    if (raw === 1) return 'Daily';
    if (raw === 2) return 'Weekly';
    return 'Lifetime';
  }
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'daily') return 'Daily';
  if (s === 'weekly') return 'Weekly';
  return 'Lifetime';
}

function normalizeTier(raw: unknown): 1 | 2 | 3 {
  const n = Number(raw);
  if (n === 3) return 3;
  if (n === 2) return 2;
  return 1;
}

/**
 * Normalizes a .NET TimeSpan string ("18:00:00" or "18:00") into "HH:mm:ss" or null.
 */
export function normalizeTimeSpanString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hh = Math.min(23, Math.max(0, Number(match[1])));
  const mm = Math.min(59, Math.max(0, Number(match[2])));
  const ss = Math.min(59, Math.max(0, Number(match[3] ?? '0')));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Formats "HH:mm:ss" into "HH:mm" for HTML time inputs and readable badges.
 */
export function formatTimeShort(raw: string | null | undefined): string {
  const normalized = normalizeTimeSpanString(raw);
  if (!normalized) return '';
  return normalized.slice(0, 5);
}

/**
 * Converts "HH:mm" or "HH:mm:ss" to seconds since UTC midnight, or null if invalid.
 */
function parseTimeSpanToSeconds(raw: string | null | undefined): number | null {
  const normalized = normalizeTimeSpanString(raw);
  if (!normalized) return null;
  const [h, m, s] = normalized.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function normalizeShopItem(raw: Record<string, unknown>): ShopItemDto {
  const rawLimit = raw.purchaseLimit ?? raw.PurchaseLimit;
  const parsedLimit =
    rawLimit === null || rawLimit === undefined || rawLimit === ''
      ? null
      : Math.max(1, Number(rawLimit) || 1);

  return {
    id: String(raw.id ?? raw.Id ?? ''),
    reward: normalizeReward((raw.reward ?? raw.Reward) as Record<string, unknown> | undefined),
    rewardTier: normalizeTier(raw.rewardTier ?? raw.RewardTier),
    price: Math.max(0, Number(raw.price ?? raw.Price ?? 0) || 0),
    purchaseLimit: parsedLimit,
  };
}

export function normalizeShop(raw: Record<string, unknown>): ShopDto {
  const rawItems = Array.isArray(raw.items ?? raw.Items)
    ? ((raw.items ?? raw.Items) as Array<Record<string, unknown>>)
    : [];

  const startDate = raw.startDate ?? raw.StartDate;
  const expiryDate = raw.expiryDate ?? raw.ExpiryDate;

  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? '').trim(),
    description: String(raw.description ?? raw.Description ?? '').trim(),
    displayOrder: Number(raw.displayOrder ?? raw.DisplayOrder ?? 0) || 0,
    items: rawItems.map(normalizeShopItem),
    resetPeriod: normalizeResetPeriod(raw.resetPeriod ?? raw.ResetPeriod),
    isActive: Boolean(raw.isActive ?? raw.IsActive ?? false),
    startDate: typeof startDate === 'string' && startDate.trim() ? startDate : null,
    expiryDate: typeof expiryDate === 'string' && expiryDate.trim() ? expiryDate : null,
    dailyStartTime: normalizeTimeSpanString(raw.dailyStartTime ?? raw.DailyStartTime),
    dailyEndTime: normalizeTimeSpanString(raw.dailyEndTime ?? raw.DailyEndTime),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
  };
}

/**
 * Mirrors Backend_Pactkeeper/Services/ShopService.cs IsShopOpenNow() 1-to-1
 * so Admin live status matches what players see in-game.
 */
export function computeShopLiveStatus(shop: ShopDto, now: Date = new Date()): ShopLiveStatusInfo {
  if (!shop.isActive) {
    return {
      status: 'PAUSED',
      label: 'Paused',
      detail: 'Hidden from players until activated',
    };
  }

  const nowMs = now.getTime();
  if (shop.startDate) {
    const startMs = new Date(shop.startDate).getTime();
    if (Number.isFinite(startMs) && startMs > nowMs) {
      return {
        status: 'SCHEDULED',
        label: 'Scheduled',
        detail: `Opens ${new Date(startMs).toLocaleString()}`,
      };
    }
  }

  if (shop.expiryDate) {
    const endMs = new Date(shop.expiryDate).getTime();
    if (Number.isFinite(endMs) && endMs <= nowMs) {
      return {
        status: 'EXPIRED',
        label: 'Expired',
        detail: `Ended ${new Date(endMs).toLocaleString()}`,
      };
    }
  }

  const startSec = parseTimeSpanToSeconds(shop.dailyStartTime);
  const endSec = parseTimeSpanToSeconds(shop.dailyEndTime);
  if (startSec !== null && endSec !== null) {
    const utcNowSec =
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    const inWindow =
      startSec <= endSec
        ? utcNowSec >= startSec && utcNowSec < endSec
        : utcNowSec >= startSec || utcNowSec < endSec;

    if (!inWindow) {
      return {
        status: 'OUTSIDE_HOURS',
        label: 'Closed (Daily Hours)',
        detail: `Opens daily ${formatTimeShort(shop.dailyStartTime)}–${formatTimeShort(shop.dailyEndTime)} UTC`,
      };
    }
  }

  return {
    status: 'OPEN',
    label: 'Open Now',
    detail: shop.expiryDate
      ? `Open until ${new Date(shop.expiryDate).toLocaleString()}`
      : 'Open in player storefront',
  };
}

export function formatResetPeriodHuman(resetPeriod: ShopResetPeriod): string {
  switch (resetPeriod) {
    case 'Daily':
      return 'Resets Daily (00:00 UTC)';
    case 'Weekly':
      return 'Resets Weekly (Mon UTC)';
    default:
      return 'One-Time / Lifetime Limit';
  }
}

export function formatShopScheduleSummary(shop: Pick<ShopDto, 'startDate' | 'expiryDate' | 'dailyStartTime' | 'dailyEndTime' | 'resetPeriod'>): string {
  const parts: string[] = [];

  if (shop.startDate && shop.expiryDate) {
    parts.push(
      `${new Date(shop.startDate).toLocaleDateString()} → ${new Date(shop.expiryDate).toLocaleDateString()}`
    );
  } else if (shop.startDate) {
    parts.push(`Starts ${new Date(shop.startDate).toLocaleDateString()}`);
  } else if (shop.expiryDate) {
    parts.push(`Ends ${new Date(shop.expiryDate).toLocaleDateString()}`);
  } else {
    parts.push('Permanent');
  }

  if (shop.dailyStartTime && shop.dailyEndTime) {
    parts.push(
      `Daily ${formatTimeShort(shop.dailyStartTime)}–${formatTimeShort(shop.dailyEndTime)} UTC`
    );
  } else {
    parts.push('Open 24h');
  }

  parts.push(formatResetPeriodHuman(shop.resetPeriod));
  return parts.join(' · ');
}

export function extractShopApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; title?: string }
      | string
      | undefined;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object') {
      return data.message || data.error || data.title || err.message || fallback;
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function fetchAllShopsAdmin(): Promise<ShopDto[]> {
  const res = await adminClient.get('/shop/admin');
  const rows = Array.isArray(res.data) ? (res.data as Array<Record<string, unknown>>) : [];
  return rows.map(normalizeShop);
}

export async function createShop(payload: UpsertShopPayload): Promise<ShopDto> {
  const res = await adminClient.post('/shop', payload);
  return normalizeShop((res.data || {}) as Record<string, unknown>);
}

export async function updateShop(id: string, payload: UpsertShopPayload): Promise<void> {
  await adminClient.put(`/shop/${encodeURIComponent(id)}`, payload);
}

export async function setShopActive(id: string, active: boolean): Promise<void> {
  const action = active ? 'activate' : 'deactivate';
  await adminClient.patch(`/shop/${encodeURIComponent(id)}/${action}`);
}

export async function deleteShop(id: string): Promise<void> {
  await adminClient.delete(`/shop/${encodeURIComponent(id)}`);
}
