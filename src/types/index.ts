export type CounselRole = 'Admin' | 'Server' | 'Moderator' | 'Technical Support' | 'Support';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'Player' | CounselRole;
}

export interface AuthResponse {
  token: string;
  username: string;
  role: CounselRole | string;
  playerId?: string;
}

export interface ServerState {
  loginBlocked: boolean;
  matchmakingBlocked: boolean;
}

export type PlayerPresenceState = 'Online' | 'InBattle' | 'Offline';

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
  banReason?: string | null;
  isOnline?: boolean;
  presenceStatus?: string;
  presence?: PlayerPresenceState;
  presenceDetails?: string;
  presenceInfo?: any;
  lastActiveTime?: string;
  lastSeen?: string;
  activeMatch?: { matchId: string; mode?: string; serverIp?: string; serverPort?: number };
}

export type GachaPullType = 'Single' | 'Five' | 'Ten';
export type GachaRewardType = 'Unit' | 'Weapon' | 'Trinket' | 'Gems';

export interface GachaPullOption {
  pullType: GachaPullType;
  price: number;
}

export interface GachaRewardDto {
  type: GachaRewardType;
  definitionId: number;
  classId: number;
  amount: number;
}

export interface GachaBannerItem {
  reward: GachaRewardDto;
  weight: number;
  isFeatured: boolean;
  rewardTier: 1 | 2 | 3;
}

export interface GachaBanner {
  id: string;
  title: string;
  description: string;
  bannerImageUrl?: string;
  startTime: string | null;
  endTime: string | null;
  isPermanent: boolean;
  costPerPull: number;
  pullOptions: GachaPullOption[];
  pityThreshold: number | null;
  currencyType: 'Gems';
  featuredUnitIds: number[];
  featuredWeaponIds: number[];
  items: GachaBannerItem[];
  isActive: boolean;
  createdAt?: string;
}

export interface GachaBannerStats {
  bannerId: string;
  bannerName: string;
  totalPullTransactions: number;
  totalDraws: number;
  totalGemsSpent: number;
  uniquePlayers: number;
  duplicateDraws: number;
  compensationGemsAwarded: number;
  drawsByTier: Record<string, number>;
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
  autoResume?: boolean;
  autoAdvance?: boolean;
  mapId?: string;
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
  username?: string;
  playerName?: string;
  latestMessageText?: string;
  latestMessageTime?: string;
  lastMessage?: string;
  lastMessageAt?: string;
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
  webhookSignature?: string;
  signature?: string;
}

export type MatchLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';

export interface MatchLogLine {
  lineNumber: number;
  raw: string;
  level: MatchLogLevel;
  tag?: string;
  timestamp?: string;
  message: string;
}

export interface MatchLogResponse {
  matchId: string;
  logPath?: string;
  source?: string;
  lines: MatchLogLine[];
  rawText: string;
  retrievedAt: string;
  serverStatus?: 'active' | 'completed' | 'crashed' | 'terminated';
}

export interface MatchHistoryItem {
  matchId: string;
  id?: string;
  mode?: string;
  status?: string | number;
  player1Id?: string;
  player2Id?: string;
  player1Name?: string;
  player2Name?: string;
  createdAt?: string;
  winnerPlayerId?: string;
  serverIp?: string;
  serverPort?: number;
}

export interface LogFileInfo {
  matchId: string;
  fileName: string;
  fileSizeBytes: number;
  lastModifiedUtc: string;
  createdAtUtc: string;
}

export type AdminPermissionKey =
  | 'dashboard.view'
  | 'server.killswitch'
  | 'players.view'
  | 'players.ban'
  | 'treasury.adjust'
  | 'matches.view'
  | 'matches.logs'
  | 'gacha.manage'
  | 'content.manage'
  | 'payments.view'
  | 'payments.manage'
  | 'support.chat'
  | 'security.accounts'
  | 'security.roles'
  | 'security.audit';

export type AuditLogSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DataSourceOrigin =
  | 'BACKEND_API'
  | 'LOCAL_SESSION_BUFFER'
  | 'SYSTEM_DEFAULT';

export type AdminAccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

export interface AdminAccountSummary {
  id: string;
  username: string;
  email?: string;
  role: CounselRole | string;
  status: AdminAccountStatus;
  createdAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  customPermissions?: AdminPermissionKey[];
  source?: DataSourceOrigin;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermissionKey[];
  isSystemDefault?: boolean;
  accountCount?: number;
  updatedAt?: string;
  source?: DataSourceOrigin;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUsername: string;
  actorRole: CounselRole | string;
  action: string;
  category:
    | 'AUTH'
    | 'SERVER'
    | 'PLAYER'
    | 'TREASURY'
    | 'GACHA'
    | 'CONTENT'
    | 'PAYMENT'
    | 'SECURITY';
  severity: AuditLogSeverity;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  rationale?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  source: DataSourceOrigin;
}

export type LoginHistoryStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'DENIED_PLAYER'
  | 'LOGOUT'
  | 'SESSION_EXPIRED';

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  username: string;
  attemptedRole?: string;
  resolvedRole?: string;
  status: LoginHistoryStatus;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  source: DataSourceOrigin;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAdminAccountRequest {
  username: string;
  password: string;
  email?: string;
  role: string;
}


