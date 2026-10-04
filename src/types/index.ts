export interface User {
  id: string;
  username: string;
  email: string;
  role: 'Player' | 'Admin';
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
  playerId?: string;
}

export interface ServerState {
  loginBlocked: boolean;
  matchmakingBlocked: boolean;
}

export interface PlayerProfile {
  id?: string;
  playerId: string;
  username: string;
  level: number;
  experience: number;
  gold?: number;
  gems?: number;
  gachaTickets?: number;
  stamina?: number;
  lastLogin?: string;
  isBanned?: boolean;
}

export interface GachaBanner {
  id: string;
  title: string;
  description: string;
  bannerImageUrl: string;
  startTime: string;
  endTime: string;
  costPerPull: number;
  currencyType: string;
  featuredUnitIds: string[];
  featuredWeaponIds: string[];
  isActive?: boolean;
}

export interface ChapterConfig {
  id?: string;
  chapterId: number;
  title?: string;
  chapterName?: string;
  mapId?: string;
  scenes?: SceneConfig[];
}

export interface SceneConfig {
  sceneId: number;
  sceneName?: string;
  description?: string;
  staminaCost?: number;
  recommendedLevel?: number;
  type?: string;
  autoNext?: boolean;
}

export interface UnitDefinition {
  id?: string;
  uId?: number;
  unitName?: string;
  name?: string;
  rarity?: string;
  classId?: string | number;
  classIds?: number[];
  passiveSkillId?: number;
  givenAtRegister?: boolean;
  statsByGrade?: any[];
  baseHp?: number;
  baseAtk?: number;
  baseDef?: number;
  baseSpeed?: number;
  avatarUrl?: string;
}

export interface WeaponDefinition {
  id?: string;
  weaponId?: number;
  name?: string;
  weaponType?: string;
  baseAtk?: number;
  rarity?: string;
  classId?: number;
  skillId?: number;
  givenAtRegister?: boolean;
  statModifiers?: {
    maxHP?: number;
    maxSkillPoint?: number;
    speed?: number;
  };
}

export interface TrinketDefinition {
  id?: string;
  trinketId?: number;
  name?: string;
  skillId?: number;
  baseHp?: number;
  baseDef?: number;
  rarity?: string;
  givenAtRegister?: boolean;
  statModifiers?: {
    maxHP?: number;
    maxSkillPoint?: number;
    speed?: number;
  };
}

export interface ClassDefinition {
  id?: string;
  classId?: number | string;
  className?: string;
  name?: string;
  description?: string;
  movementSkillId?: number;
  classSkillId?: number;
}

export interface SkillDefinition {
  id?: string;
  skillId?: number | string;
  skillName?: string;
  description?: string;
  spCost?: number;
}

export interface TopUpPackDto {
  id: string;
  name: string;
  priceVnd: number;
  gemsAmount: number;
  isAvailable: boolean;
  unitNames?: string[];
  weaponNames?: string[];
  trinketNames?: string[];
}

export interface ActiveChatPlayerDto {
  playerId: string;
  username: string;
  lastMessage: string;
  lastMessageAt: string;
}

export interface SupportMessageDto {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderCode: number;
  playerId: string;
  amount: number;
  packId: string;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  createdAt: string;
}
