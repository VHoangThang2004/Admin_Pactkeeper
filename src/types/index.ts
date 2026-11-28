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

export interface OwnedUnitRecord {
  ownedUnitId: string;
  unitDefinitionUId: number;
  grade: number;
  unlockedClassIds: number[];
  equippedMovementSkillId: number;
  equippedOwnedWeaponId: string;
  equippedOwnedTrinketId: string;
  equippedClassSkillId: number;
}

export interface OwnedWeaponRecord {
  ownedWeaponId: string;
  weaponDefinitionId: number;
}

export interface OwnedTrinketRecord {
  ownedTrinketId: string;
  trinketDefinitionId: number;
}

export interface GachaPityStateRecord {
  pullsSinceRare: number;
  guaranteedFeatured: boolean;
}

export interface StoryProgressRecord {
  chapterId: number;
  sceneId: number;
  isCompleted: boolean;
  isChapterCompleted: boolean;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface RewardProgressRecord {
  id: string;
  ruleId: string;
  ruleTitle?: string;
  currentCount: number;
  targetCount?: number;
  isCompleted: boolean;
  completedAt?: string | null;
  isReceived: boolean;
  receivedAt?: string | null;
}

export interface PlayerAdminDetails extends PlayerProfile {
  rating?: number;
  rankTier?: number;
  rankWins?: number;
  rankLosses?: number;
  banDuration?: string | null;
  ownedUnitsCount?: number;
  ownedWeaponsCount?: number;
  ownedTrinketsCount?: number;
  ownedUnits?: OwnedUnitRecord[];
  ownedWeapons?: OwnedWeaponRecord[];
  ownedTrinkets?: OwnedTrinketRecord[];
  gachaPityByBanner?: Record<string, GachaPityStateRecord>;
  storyProgress?: StoryProgressRecord[];
  currentStoryChapterId?: number;
  currentStorySceneId?: number;
  teamLoadoutUIds?: number[];
  rewardProgress?: RewardProgressRecord[];
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

export type SceneType = 'Cutscene' | 'Dialogue' | 'Battle';

export interface ChapterConfig {
  id?: string;
  chapterId: number;
  title: string;
  mapId: string;
  scenes: SceneConfig[];
}

export interface SceneConfig {
  sceneId: number;
  type: SceneType | string;
  autoResume: boolean;
  autoAdvance: boolean;
  description: string;
  mapId: string;
}

export interface UnitGradeStats {
  grade: number;
  maxHP: number;
  speed: number;
  maxSkillPoint: number;
  damageMultiplier: number;
  damageReduction: number;
}

export interface EquipmentStatModifiers {
  maxHP: number;
  speed: number;
  maxSkillPoint: number;
  damageMultiplier: number;
  damageReduction: number;
}

export interface UnitDefinition {
  id?: string;
  uId: number;
  unitName: string;
  name?: string;
  passiveSkillId: number;
  classIds: number[];
  givenAtRegister: boolean;
  statsByGrade: UnitGradeStats[];
}

export interface WeaponDefinition {
  id?: string;
  weaponId: number;
  name: string;
  classId: number;
  skillId: number;
  statModifiers: EquipmentStatModifiers;
  givenAtRegister: boolean;
}

export interface TrinketDefinition {
  id?: string;
  trinketId: number;
  name: string;
  skillId: number;
  statModifiers: EquipmentStatModifiers;
  givenAtRegister: boolean;
}

export interface ClassDefinition {
  id?: string;
  classId: number;
  name: string;
  className?: string;
  movementSkillId: number;
  classSkillId: number;
}

export interface SkillDefinition {
  id?: string;
  skillId: number;
}

export interface TopUpPackDto {
  id: string;
  name: string;
  priceVnd: number;
  gemsAmount: number;
  isAvailable: boolean;
  unitDefinitionIds?: number[];
  weaponDefinitionIds?: number[];
  trinketDefinitionIds?: number[];
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
  | 'balance.view'
  | 'balance.manage'
  | 'rewards.view'
  | 'rewards.manage'
  | 'shops.manage'
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
    | 'REWARD'
    | 'SHOP'
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

export type BalanceEntityType = 'unit' | 'weapon' | 'trinket' | 'skill';

export type BalanceModeFilter = 'ALL' | 'PVP' | 'RANKED' | 'FRIENDLY';

export interface BalanceTelemetryMetric {
  entityType: BalanceEntityType;
  entityId: string;
  name: string;
  pickCount: number;
  pickRate: number;
  winCount: number;
  winRate: number;
  avgDamage: number;
  avgDamageTaken?: number;
  avgHealing?: number;
  survivalRate?: number;
  avgKills?: number;
  isOutlier?: boolean;
  sampleMatches: number;
}

export interface BalanceTelemetryResponse {
  patchVersion: string;
  availablePatchVersions: string[];
  mode: string;
  totalMatches: number;
  generatedAt: string;
  units: BalanceTelemetryMetric[];
  weapons: BalanceTelemetryMetric[];
  trinkets: BalanceTelemetryMetric[];
  skills: BalanceTelemetryMetric[];
}

export type AiBalanceChangeType = 'DB_ONLY' | 'REBUILD_REQUIRED';
export type AiBalanceAction = 'BUFF' | 'NERF' | 'ADJUST' | 'MONITOR';
export type AiBalancePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AiBalanceSuggestion {
  id: string;
  entityType: BalanceEntityType;
  entityId?: string;
  entityName: string;
  action: AiBalanceAction;
  changeType: AiBalanceChangeType;
  priority: AiBalancePriority;
  currentWinRate?: number;
  currentPickRate?: number;
  issueDescription?: string;
  rationale: string;
  suggestedChanges: string;
}

export interface AiBalanceAnalysisResponse {
  reportId?: string;
  model?: string;
  generatedAt: string;
  createdByUsername?: string;
  totalMatchesAnalyzed?: number;
  outliersCount?: number;
  patchVersion?: string;
  mode?: string;
  summary: string;
  suggestions: AiBalanceSuggestion[];
}

export interface GameVersionConfig {
  latestVersion: string;
  minSupportedVersion: string;
  downloadUrl: string;
  patchNotes: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UpdateGameVersionPayload {
  latestVersion: string;
  minSupportedVersion: string;
  downloadUrl: string;
  patchNotes: string;
}

export type RewardActionType =
  | 'MatchResult'
  | 'StoryProgress'
  | 'GachaPull'
  | 'Purchase'
  | 'ShopPurchase'
  | string;

export type RewardConditionOp = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface RewardConditionDto {
  field: string;
  op: RewardConditionOp | string;
  value: string;
}

export interface RewardItemDto {
  type: GachaRewardType;
  definitionId: number;
  classId: number;
  amount: number;
}

export interface RewardRuleDto {
  id: string;
  actionType: RewardActionType;
  conditions: RewardConditionDto[];
  accumulateField: string | null;
  targetCount: number;
  reward: RewardItemDto;
  isActive: boolean;
  title: string;
  description: string;
}

export interface UpsertRewardRulePayload {
  actionType: RewardActionType;
  conditions: RewardConditionDto[];
  accumulateField: string | null;
  targetCount: number;
  reward: RewardItemDto;
  title: string;
  description: string;
}

export interface RewardRuleStatsDto {
  ruleId: string;
  totalPlayers: number;
  inProgressCount: number;
  completedCount: number;
  readyToClaimCount: number;
  claimedCount: number;
}

export interface PlayerActionLogDto {
  id: string;
  playerId: string;
  actionType: RewardActionType;
  referenceId: string;
  facts: Record<string, unknown>;
  timestamp: string;
}

export type ShopResetPeriod = 'Lifetime' | 'Daily' | 'Weekly';

export interface ShopItemDto {
  id: string;
  reward: RewardItemDto;
  rewardTier: 1 | 2 | 3;
  price: number;
  purchaseLimit: number | null;
}

export interface ShopDto {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  items: ShopItemDto[];
  resetPeriod: ShopResetPeriod;
  isActive: boolean;
  startDate: string | null;
  expiryDate: string | null;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  createdAt: string;
}

export interface UpsertShopPayload {
  name: string;
  description: string;
  displayOrder: number;
  items: ShopItemDto[];
  resetPeriod: ShopResetPeriod;
  startDate: string | null;
  expiryDate: string | null;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
}



