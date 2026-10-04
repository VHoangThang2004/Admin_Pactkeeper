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
  id: string;
  chapterNumber: number;
  chapterName: string;
  stages: StageConfig[];
}

export interface StageConfig {
  stageId: string;
  stageName: string;
  staminaCost: number;
  recommendedLevel: number;
  firstClearRewards: Reward[];
}

export interface Reward {
  rewardType: string;
  itemId?: string;
  amount: number;
}

export interface UnitDefinition {
  id: string;
  name: string;
  rarity: string;
  classId: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
  avatarUrl?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  message: string;
  sentAt: string;
  isFromAdmin: boolean;
}

export interface SupportTicket {
  id: string;
  playerId: string;
  playerUsername: string;
  subject: string;
  status: 'Open' | 'Pending' | 'Closed';
  createdAt: string;
  messages: SupportMessage[];
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
