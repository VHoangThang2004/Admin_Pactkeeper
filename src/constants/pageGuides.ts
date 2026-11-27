import type { BadgeVariant } from '@astryxdesign/core/Badge';

export interface PageGuideStep {
  badge: string;
  badgeVariant: BadgeVariant;
  title: string;
  description: string;
}

export interface PageGuideDefinition {
  heading: string;
  tag: string;
  tagVariant: BadgeVariant;
  steps: PageGuideStep[];
}

export const PAGE_GUIDES: Record<string, PageGuideDefinition> = {
  '/': {
    heading: 'How Dashboard Overview Works',
    tag: 'COMMAND OPERATIONS',
    tagVariant: 'yellow',
    steps: [
      {
        badge: 'STEP 1 · TELEMETRY',
        badgeVariant: 'neutral',
        title: 'Monitor Live Realm Health',
        description:
          'Track real-time CCU, active NGO game server nodes, matchmaking queue pressure, and backend responsiveness at a glance.',
      },
      {
        badge: 'STEP 2 · QUICK NAV',
        badgeVariant: 'cyan',
        title: 'Jump to Any Module',
        description:
          'Use KPI shortcuts or press Ctrl+K to open the Command Palette and jump straight to Players, Matches, Balance, or Content CMS.',
      },
      {
        badge: 'STEP 3 · KILLSWITCH',
        badgeVariant: 'error',
        title: 'Emergency Server Controls',
        description:
          'Admins and Technical Support with server.killswitch can toggle Login Block, Matchmaking Queue Block, or Force Stop All live matches.',
      },
      {
        badge: 'STEP 4 · AUDIT TRAIL',
        badgeVariant: 'purple',
        title: 'Accountability & Recovery',
        description:
          'Every emergency override requires confirmation and is permanently logged in Security & RBAC Audit Log for post-incident review.',
      },
    ],
  },
  '/players': {
    heading: 'How Player Management Works',
    tag: 'DIRECTORY & SANCTIONS',
    tagVariant: 'cyan',
    steps: [
      {
        badge: 'STEP 1 · SEARCH',
        badgeVariant: 'neutral',
        title: 'Find & Filter Players',
        description:
          'Search by Username, Player ID, or status (Online / Offline / Banned) to locate any traveler account in the unified directory.',
      },
      {
        badge: 'STEP 2 · INSPECT',
        badgeVariant: 'cyan',
        title: 'Inspect Full Profile',
        description:
          'Open the Player Inspector to check wallet balances (Gold/Gems), rank rating, owned Units/Weapons/Trinkets, and recent matches.',
      },
      {
        badge: 'STEP 3 · TREASURY',
        badgeVariant: 'yellow',
        title: 'Adjust Gold & Gems',
        description:
          'With treasury.adjust permission, credit or deduct currency for compensation or bug recovery with a mandatory audit rationale.',
      },
      {
        badge: 'STEP 4 · SANCTIONS',
        badgeVariant: 'error',
        title: 'Enforce Ban / Unban',
        description:
          'Suspend or restore accounts with a documented violation reason. All sanctions are tracked in Security Audit Log.',
      },
    ],
  },
  '/matches': {
    heading: 'How Match Supervision Works',
    tag: 'LIVEOPS & DIAGNOSTICS',
    tagVariant: 'blue',
    steps: [
      {
        badge: 'STEP 1 · SESSIONS',
        badgeVariant: 'neutral',
        title: 'Browse Live & Past Matches',
        description:
          'Filter PvP, Ranked, and Friendly match sessions by status (LIVE, COMPLETED, CANCELLED), mode, or Match GUID.',
      },
      {
        badge: 'STEP 2 · VPS LOGS',
        badgeVariant: 'purple',
        title: 'Inspect Dedicated Server Logs',
        description:
          'Open Dedicated Server Diagnostics to stream raw VPS NGO battle .log files, filter by WARN/ERROR, and diagnose crashes or desyncs.',
      },
      {
        badge: 'STEP 3 · EXPORT',
        badgeVariant: 'cyan',
        title: 'Copy or Download Logs',
        description:
          'Copy Match GUIDs or export full .log files locally before older files rotate off the VPS disk.',
      },
      {
        badge: 'STEP 4 · CROSS-CHECK',
        badgeVariant: 'yellow',
        title: 'Verify Combat Results',
        description:
          'Inspect per-match rosters, duration, and completion status — completed PvP/Ranked matches also feed Flow 5 Balance Telemetry.',
      },
    ],
  },
  '/support': {
    heading: 'How Live Support Desk Works',
    tag: 'REAL-TIME SUPPORT',
    tagVariant: 'cyan',
    steps: [
      {
        badge: 'STEP 1 · QUEUE',
        badgeVariant: 'neutral',
        title: 'Pick Incoming Player Tickets',
        description:
          'Incoming support conversations arrive live over /hubs/support. Select a player thread from the left queue to respond.',
      },
      {
        badge: 'STEP 2 · REPLY',
        badgeVariant: 'cyan',
        title: 'Chat & Share Attachments',
        description:
          'Reply in real time and attach screenshots or evidence images to resolve billing, account, or gameplay inquiries.',
      },
      {
        badge: 'STEP 3 · INVESTIGATE',
        badgeVariant: 'yellow',
        title: 'Verify Account Details',
        description:
          'Cross-check player inventory, match logs, or PayOS receipts in Player Management / PayOS Vault before issuing compensation.',
      },
      {
        badge: 'STEP 4 · RESOLVE',
        badgeVariant: 'success',
        title: 'Close & Document',
        description:
          'Confirm the player issue is resolved and ensure any currency adjustment or unban carries a clear ticket rationale.',
      },
    ],
  },
  '/balance': {
    heading: 'How Balance Analytics & Releases Works (Flow 5)',
    tag: 'END-TO-END LIVEOPS LOOP',
    tagVariant: 'purple',
    steps: [
      {
        badge: 'STEP 1 · TELEMETRY',
        badgeVariant: 'neutral',
        title: 'Review Match Stats Manually',
        description:
          'Inspect Winrate, Pickrate & Avg Damage from completed PvP/Ranked matches. Outliers (≥60% or ≤40%) are flagged automatically.',
      },
      {
        badge: 'STEP 2A · DB ONLY',
        badgeVariant: 'cyan',
        title: 'Hotfix in Content CMS',
        description:
          'For Unit / Weapon / Trinket stats, click "Edit CMS". Changes apply live in the next match — no Unity rebuild needed.',
      },
      {
        badge: 'STEP 2B · REBUILD',
        badgeVariant: 'yellow',
        title: 'Rebuild & Publish Version',
        description:
          'For Skill / Logic changes, rebuild Unity Client + Headless Server, deploy to VPS, then publish LatestVersion & DownloadUrl in Tab 2.',
      },
      {
        badge: 'OPTIONAL · AI',
        badgeVariant: 'purple',
        title: 'AI Balance Advisor (Later)',
        description:
          'Optional Tab 3 when you want automated AI nerf/buff suggestions. You can run the full balance cycle manually without it.',
      },
    ],
  },
  '/rewards': {
    heading: 'How Quests & Rewards Work',
    tag: 'LIVEOPS · QUESTS',
    tagVariant: 'purple',
    steps: [
      {
        badge: 'STEP 1 · ACTIVITY',
        badgeVariant: 'neutral',
        title: 'Choose Player Activity',
        description:
          'Link each quest to a live game activity: PvP/Ranked matches, Story chapters, Gacha summons, Top-Ups, or In-Game Shop purchases.',
      },
      {
        badge: 'STEP 2 · GOAL',
        badgeVariant: 'purple',
        title: 'Set Requirements & Goal',
        description:
          'Add optional criteria (e.g. Match Outcome is Victory, Surviving Heroes at least 3) and choose how many times or total units players must reach.',
      },
      {
        badge: 'STEP 3 · TEST',
        badgeVariant: 'cyan',
        title: 'Preview in Rule Tester',
        description:
          'Use the Rule Tester tab with quick scenarios to confirm your quest triggers and calculates progress as expected before promoting it.',
      },
      {
        badge: 'STEP 4 · CLAIM',
        badgeVariant: 'success',
        title: 'Players Claim Rewards',
        description:
          'When players reach the target goal, the quest is marked Ready to Claim. Gems, Heroes, Weapons, or Trinkets are granted upon claim.',
      },
    ],
  },
  '/gacha': {
    heading: 'How Gacha & Banners Works',
    tag: 'LIVEOPS ECONOMY',
    tagVariant: 'purple',
    steps: [
      {
        badge: 'STEP 1 · BANNERS',
        badgeVariant: 'neutral',
        title: 'Configure Summon Banners',
        description:
          'Create or edit gacha banners with featured Units/Weapons/Trinkets, banner currency cost, and active schedule windows.',
      },
      {
        badge: 'STEP 2 · RATES & PITY',
        badgeVariant: 'yellow',
        title: 'Tune Drop Rates & Pity',
        description:
          'Set drop probabilities and guaranteed featured pity thresholds so summon economies remain fair and predictable.',
      },
      {
        badge: 'STEP 3 · TOGGLE LIVE',
        badgeVariant: 'cyan',
        title: 'Activate or Pause Windows',
        description:
          'Enable or hide banners immediately without restarting the game server. Active banners sync directly to clients.',
      },
      {
        badge: 'STEP 4 · AUDIT',
        badgeVariant: 'error',
        title: 'Protected Changes',
        description:
          'Deleting or altering live banners triggers confirmation guards and records full before/after snapshots in Audit Log.',
      },
    ],
  },
  '/content': {
    heading: 'How Game Content Codex Works',
    tag: 'SRPG DEFINITIONS CMS',
    tagVariant: 'cyan',
    steps: [
      {
        badge: 'STEP 1 · SELECT TAB',
        badgeVariant: 'neutral',
        title: 'Choose Entity Category',
        description:
          'Switch between Units, Weapons, Trinkets, Chapters, Classes, and Skills, or jump directly here from Balance Analytics ("Edit CMS").',
      },
      {
        badge: 'STEP 2 · EDIT STATS',
        badgeVariant: 'cyan',
        title: 'Tune DB Parameters',
        description:
          'Edit Unit grade stats (HP, Speed, SP, Damage) or Weapon/Trinket stat modifiers directly in MongoDB.',
      },
      {
        badge: 'STEP 3 · LIVE APPLY',
        badgeVariant: 'success',
        title: 'Instant Next-Match Effect',
        description:
          'DB stat edits for Units, Weapons, and Trinkets take effect in the next match with zero Unity client rebuild required.',
      },
      {
        badge: 'STEP 4 · SAFE DELETE',
        badgeVariant: 'error',
        title: 'Guarded Deletions',
        description:
          'Destructive removals require explicit confirmation and rationale, and are recorded in Security & RBAC Audit Log.',
      },
    ],
  },
  '/payments': {
    heading: 'How PayOS & Top-Up Vault Works',
    tag: 'FINANCE & STOREFRONT',
    tagVariant: 'yellow',
    steps: [
      {
        badge: 'STEP 1 · REVENUE',
        badgeVariant: 'neutral',
        title: 'Monitor VND Revenue KPIs',
        description:
          'Review gross revenue, paid vs pending PayOS orders, and daily top-up trends across the storefront.',
      },
      {
        badge: 'STEP 2 · LEDGER',
        badgeVariant: 'cyan',
        title: 'Filter & Export Receipts',
        description:
          'Search orders by Order Code, Player ID, or status and export CSV ledgers for financial reconciliation.',
      },
      {
        badge: 'STEP 3 · PACKS',
        badgeVariant: 'yellow',
        title: 'Manage Crystal Packs',
        description:
          'With payments.manage permission, toggle storefront crystal packs and bundles on or off on the Web Top-Up Portal.',
      },
      {
        badge: 'STEP 4 · VERIFY',
        badgeVariant: 'success',
        title: 'Resolve Payment Tickets',
        description:
          'Cross-check order status here before crediting Gems in Player Management when assisting a player on Live Support.',
      },
    ],
  },
  '/security': {
    heading: 'How Security & RBAC Works',
    tag: 'GOVERNANCE & AUDIT',
    tagVariant: 'error',
    steps: [
      {
        badge: 'STEP 1 · ACCOUNTS',
        badgeVariant: 'neutral',
        title: 'Manage Staff Accounts',
        description:
          'Create Counsel Admin accounts, assign roles, lock/unlock compromised staff, reset passwords, or revoke active sessions.',
      },
      {
        badge: 'STEP 2 · RBAC MATRIX',
        badgeVariant: 'purple',
        title: 'Configure Role Permissions',
        description:
          'Define granular permissions (e.g. balance.view, balance.manage, content.manage, players.ban) per role to enforce least privilege.',
      },
      {
        badge: 'STEP 3 · AUDIT LOG',
        badgeVariant: 'yellow',
        title: 'Inspect Sensitive Actions',
        description:
          'Review every critical action (bans, currency edits, game version publishes, CMS changes) with before/after states and CSV export.',
      },
      {
        badge: 'STEP 4 · LOGIN TRAIL',
        badgeVariant: 'cyan',
        title: 'Track Authentication Events',
        description:
          'Monitor successful logins, failed attempts, and denied player access in Login History to spot suspicious activity early.',
      },
    ],
  },
};

export function resolvePageGuide(pathname: string): PageGuideDefinition | null {
  if (PAGE_GUIDES[pathname]) return PAGE_GUIDES[pathname];
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return PAGE_GUIDES[trimmed] ?? null;
}
