# PactKeeper Admin Portal (High Counsel) ⚔️👑

> **Central Administration, Governance & Live Operations System** for the Tactical Strategy Role-Playing Game **PactKeeper (SRPG)**.  
> Capstone Project | SEP490 — FPT University | Release: **v2.4.0**

---

## 📌 1. Project Overview & Vision

**PactKeeper Admin Portal (High Counsel)** is the command-and-control operations platform designed for Game Masters, System Administrators, and Technical Support Specialists managing the live service of **PactKeeper**. 

The dashboard adopts a **HoYoverse AAA Gaming Portal** aesthetic (Cosmic Obsidian glassmorphism, Cinzel typography, glowing Gold/Cyan/Emerald accents, and SVG crystalline shaders) while operating on an enterprise web architecture with 100% real backend telemetry and data synchronization via RESTful APIs (.NET 9) and SignalR WebSockets.

### 🌟 Core Architectural Pillars:
1. **Server Governance & Telemetry:** Real-time visibility into Concurrent Users (CCU), active PvP matches, Netcode for GameObjects (NGO) headless dedicated servers (ports 7777–7800), and instantaneous emergency killswitches.
2. **Unified Player Presence Engine:** Cross-service aggregation linking database records (`/player/all`), active combat sessions (`/Match/history`), Google OAuth support accounts (`/support/admin/players`), and PayOS transactions (`/payment/history`).
3. **Role-Based Access Control (RBAC):** Strict operational segregation aligned with SRS Report 3, Context Diagrams, and Use Case specifications for **Administrators**, **Moderators**, and **Technical Support**.
4. **Dedicated Server Diagnostics & Match Supervision:** Turn-by-turn combat replay, anti-cheat audit trails, and raw Ubuntu VPS log streaming with syntax highlighting and dynamic pagination.
5. **Full Game Definition CMS:** In-browser CRUD manipulation for 6 core SRPG game catalogs (Heroes, Chapters/Scenes, Weapons, Trinkets, Classes, and Skills).
6. **PayOS Financial Ledger:** Complete monetization tracking with HMAC-SHA256 signature auditing and 6-tier prismatic crystal graphics (`GemArt`).
7. **Bidirectional SignalR Support Desk:** Real-time player ticket resolution over WebSocket connections with instant operator messaging.

---

## 🛡️ 2. Role-Based Access Control (RBAC) Matrix

The portal strictly enforces privileges defined in the project's **Context Diagram** and **SRS Report 3**, dynamically shaping the navigation sidebar, available routes, and interactive controls:

| Module / Privilege | Route | Admin (High Counsel) | Moderator (Game Master) | Technical Support | Primary Purpose & Guardrails |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Command Overview / Telemetry** | `/` | Full Access | ❌ Forbidden | Full Access | Live CCU, match counts, cluster status, and emergency killswitches |
| **Emergency Overrides** | `/` | ✅ Allowed | ❌ Forbidden | ✅ Allowed | Block logins, halt matchmaking queues, force stop all instances |
| **User Directory & Sanctions** | `/players` | Full Access | Full Access | ❌ Forbidden | Inspect player level, stats, wallet balances, and issue Ban/Unban |
| **Treasury Balance Adjustments** | `/players` | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | Credit/Debit Gold and Gems for player compensation and audits |
| **Match Supervision & Combat Logs** | `/matches` | Full Access | Full Access | Full Access | Inspect live battles, NGO server logs, anti-cheat audit trails |
| **Gacha Banner Orchestration** | `/gacha` | Full Access | Full Access | ❌ Forbidden | Schedule summons, pity rates (90 hard / 50-50 soft), featured pools |
| **SRPG Game CMS (6 Catalogs)** | `/content` | Full Access | Full Access | ❌ Forbidden | Full CRUD for Heroes, Chapters/Scenes, Weapons, Trinkets, Classes, Skills |
| **PayOS Revenue Ledger** | `/payments` | Full Access | ❌ Forbidden | ❌ Forbidden | Financial metrics, verified receipts (`PAID`, `PENDING`), pack availability |
| **Player Support Desk (SignalR)** | `/support` | Full Access | ❌ Forbidden | Full Access | Real-time chat via `/hubs/support` with active player queues |

---

## 🚀 3. Deep Feature Walkthrough

### 🏰 1. Realm Telemetry & Emergency Command (`/`)
- **Unified Presence Telemetry:** Categorizes active players into `ONLINE`, `IN BATTLE` (cross-referenced to match IDs and dedicated server ports), and `OFFLINE`.
- **Live Battle Monitoring:** Instant visibility into active PvP duels, combatant IDs, game modes, and host server allocations.
- **Emergency Overrides (Killswitches):**
  - **Block Player Logins:** Prevents incoming player authentication sessions (`POST /api/admin/update-login-status`).
  - **Block Matchmaking:** Halts match finding queues while preserving active combat sessions (`POST /api/admin/update-queue-status`).
  - **Force Stop All:** Terminates all active match servers and locks the gateway for critical maintenance (`POST /api/admin/force-stop-all`).
  - State persistence backed by `sessionStorage` and `localStorage` to preserve override toggle states across page reloads.

### ⚔️ 2. Match Supervision & Server Diagnostics (`/matches`) — Screens 33 & 34
- **Dedicated Esports & Telemetry Console:** Centralized hub for reviewing ongoing and archived PvP battles hosted on Netcode for GameObjects (NGO) instances (ports 7777–7800).
- **Match Telemetry Quick Badges:** Live counters for Active Battles, Total Recorded Matches, Log Archives, and Dedicated VPS Status.
- **Match Log Inspector (`MatchLogInspector.tsx`):**
  - Direct connection to backend VPS endpoint (`GET /api/Match/{matchId}/logs`).
  - **Dual Source Modes:** Browse logs by raw server log files (`GET /api/Match/logs/files`) or completed match history (`GET /api/Match/history`).
  - **Chronological Sorting:** Automatic date-descending sort (newest logs at the top).
  - **Dynamic Pagination:** Flexible display limits (50, 100, 150, 200, ... ALL) scaled to total log volume.
  - **Syntax Parsing & Highlighting:** Color-coded classification for `ERROR` (Crimson), `WARN` (Amber), `SYSTEM` (Indigo), and `INFO` (Cyan).
  - **Productivity Tools:** Instant substring search, level filtering, auto-refresh polling, auto-scroll to latest entry, and one-click clipboard copy.

### 👥 3. User Directory & Account Discipline (`/players`) — Screens 29 & 30
- **Multi-Source Aggregation Engine (`playerPresenceService.ts`):** Combines database player records, active NGO match participants, support chat sessions, and PayOS orders.
- **Display Name Resolution:** Automatically enriches database UUIDs with Google OAuth display names or sanitized traveler aliases (e.g., `Traveler #A3F9`).
- **Disciplinary Enforcement:** One-click Ban / Unban actions with modal justification inputs (`PERMANENT`, `TEMPORARY_24H`, `TEMPORARY_7D`).
- **Treasury Adjustment Modal (Admin-Only):** Safely grant or deduct Gold and Gems with numeric bounds checking and audit trail justification.
- **Manual Player Lookup:** Instant ID-based query to inspect unlisted accounts directly from the database.

### ✨ 4. Gacha Banner Management (`/gacha`)
- **Active Summon Pools:** Displays live banners, schedule windows, summon costs, and currency types.
- **Pity & Featured Roster:** Visual inspection of rate-up Heroes and Weapons with guaranteed pity thresholds (90 hard pity, 50/50 soft pity).
- **Banner Creation Modal:** Form-driven creation of summoning events (`POST /api/gachabanner`).
- **Status Toggle:** Instantly activate or deactivate banners via `PATCH /api/gachabanner/{id}/activate` and `/deactivate`.

### 📜 5. SRPG Game Content Archives (`/content`)
Centralized CMS for game balance and asset definitions, organized into 6 interactive catalogs with complete in-browser CRUD (Create, Read, Update, Delete) and interactive edit modals:
1. **Heroes / Units (`/api/UnitDefinition`):** Base HP, ATK, DEF, Speed, rarity, class bindings, passive skills, and creation/edit modals.
2. **Chapters & Scenes (`/api/ChapterConfig`):** Story progression, scene sequencing, stamina consumption, and recommended levels.
3. **Weapons (`/api/WeaponDefinition`):** Weapon archetypes, base attack, rarity tiers, and stat modifiers (HP, SP, Speed) respecting BR-04 class restrictions.
4. **Trinkets (`/api/TrinketDefinition`):** Defensive accessories, passive skill triggers, and equipment stats.
5. **Classes (`/api/ClassDefinition`):** SRPG class archetypes, base movement ranges, and class skill IDs.
6. **Skills (`/api/SkillDefinition`):** Skill library, SP casting costs, and combat effect descriptions.

### 💰 6. PayOS Treasury & Transaction Ledger (`/payments`) — Screen 32
- **Revenue Analytics:** Aggregated KPI metrics for total gross revenue (VND), successful orders, and completion percentages.
- **Real-Time Transaction Ledger:** Searchable and filterable order log (`ALL`, `PAID`, `PENDING`, `CANCELLED`) with PayOS `orderCode`, player ID, and transaction values.
- **Screen 32 Transaction Details Modal:** Comprehensive inspection modal featuring HMAC-SHA256 webhook signature verification badge.
- **Top-Up Pack Catalog:** Live management of Gem packs and bundled hero gifts with instant availability toggles (`PATCH /api/topuppack/{id}/availability`).
- **High-Fidelity GemArt:** Custom 6-tier SVG crystal art component inspired by Genshin Impact Genesis Crystals and Honkai: Star Rail Oneiric Shards.
- **Direct Portal Shortcut:** Quick navigation link to the player-facing Web Top-Up portal (`/profile/topup`).

### 💬 7. Player Support Desk (`/support`) — Screens 45 & 46
- **Bidirectional WebSocket Engine:** Direct connection to backend ASP.NET SignalR Hub (`/hubs/support`) delivering low-latency two-way communication between players and support agents.
- **Active Player Queue:** Prioritized roster displaying player aliases, latest message snippets, and relative timestamps.
- **Combat Ticket Cross-Linking:** Deep link directly to `/matches?matchId=...` for instant investigation of in-battle disconnects or gameplay disputes.

---

## 🔒 4. Security Architecture & Environment Configuration

To prevent **Reconnaissance & Information Disclosure (CWE-200)**, the production repository is hardened against credential leaks:
- Production backend hostnames, IP addresses, and private gateway ports are decoupled from source control.
- Sensitive environment files (`.env`) and deployment rewrites (`vercel.json`) are strictly ignored by Git.
- Administrative authentication uses scoped session tokens stored in `sessionStorage` (automatically cleared on tab closure).

### 📄 Local Environment Setup

#### 1. Create `.env` (Development Proxy)
Create `.env` in the root folder of `Admin_Pactkeeper`:
```env
# .env (Do NOT commit to Git)
VITE_BACKEND_TARGET=http://your-backend-host:5276
```
> `vite.config.ts` dynamically loads `VITE_BACKEND_TARGET` via `loadEnv()`, forwarding `/api` and `/hubs` traffic to your backend without hardcoded IP addresses.

#### 2. Create `vercel.json` (Production Deployment Proxy)
Create `vercel.json` in the root folder of `Admin_Pactkeeper`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://your-backend-host:5276/api/:path*"
    },
    {
      "source": "/hubs/:path*",
      "destination": "http://your-backend-host:5276/hubs/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
> Vercel Edge rewrites route API calls and SignalR WebSocket requests directly to the HTTP backend server, preventing Mixed Content blocking over HTTPS.

---

## ⚙️ 5. Installation & Local Development Walkthrough

### Prerequisites
- **Node.js:** Version 18.x or later (LTS recommended)
- **NPM** (bundled with Node.js) or **PNPM / Yarn**
- Running instance of the PactKeeper ASP.NET Core Backend (.NET 9)

### Step-by-Step Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/VHoangThang2004/Admin_Pactkeeper.git
   cd Admin_Pactkeeper
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure local environment:**
   ```bash
   # Windows PowerShell:
   Set-Content -Path .env -Value "VITE_BACKEND_TARGET=http://localhost:5276"
   ```

4. **Launch development server:**
   ```bash
   npm run dev
   ```
   The portal boots at `http://localhost:3001` with automated proxying configured for `/api` and `/hubs`.

5. **Code validation and build verification:**
   ```bash
   # Static analysis with Oxlint
   npm run lint

   # TypeScript compilation & production bundling
   npm run build
   ```

---

## 🚢 6. Operations & Deployment Guide (Vercel CLI)

Because `vercel.json` is withheld from source control for security, deployments are published directly via the **Vercel CLI**:

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Authenticate
vercel login

# 3. Deploy to production with local proxy rewrites
vercel --prod
```

---

## 📖 7. User Guide & Live-Ops Runbook

### Authenticating via High Counsel Gateway (`/login`)
1. Open the portal URL in your browser.
2. Select your designated role badge (**Admin**, **Moderator**, or **Technical Support**).
3. Use the **1-Click Sample Credentials** buttons for rapid local verification or enter administrative credentials.
4. Click **"ENTER HIGH COUNSEL"** to authenticate and land on your role's primary operations dashboard.

### Supervising Live Matches & Investigating Logs (`/matches`)
1. Navigate to **Match Supervision** (`/matches`).
2. Review active battles in the telemetry banner.
3. Switch between **Server Log Files** (raw `.log` files from the Ubuntu VPS) or **Match History** (completed PvP sessions).
4. Use the dynamic limit selector (50, 100, 150, 200, ... ALL) and level filter (`ERROR`, `WARN`, `SYSTEM`, `INFO`) to isolate game server anomalies.
5. Enable **Auto-Scroll** or **Auto-Refresh** to monitor live turns in real time.

### Modifying Game Content Definitions (`/content`)
1. Navigate to **Item & Reward Config** (`/content`).
2. Select any of the 6 tabs (**Heroes**, **Chapters**, **Weapons**, **Trinkets**, **Classes**, **Skills**).
3. Click **"New [Item]"** to open the creation modal, or click the **Edit** pencil icon on any existing item.
4. Modify stats, equipment bindings, or skill attributes, then confirm to commit updates directly to the database.

### Auditing PayOS Orders & Managing Top-Up Packs (`/payments`)
1. Navigate to **PayOS Revenue Ledger** (`/payments`).
2. Inspect the gross revenue, paid orders, and completion percentage.
3. Filter orders by status (`PAID`, `PENDING`, `CANCELLED`) or search by player ID / PayOS `orderCode`.
4. Click any order row to inspect full receipt metadata and HMAC-SHA256 signature verification in the **Screen 32 Modal**.
5. Toggle Top-Up pack availability switches to instantly enable/disable store packages.

---

## 🛠️ 8. Tech Stack & Directory Structure

### Technology Stack
| Layer | Framework / Library | Version | Role in Architecture |
| :--- | :--- | :---: | :--- |
| **Runtime & Core** | React | `^19.2.8` | High-performance UI rendering |
| **Language** | TypeScript | `~6.0.2` | Static typing and interface contracts |
| **Build Engine** | Vite | `^8.2.0` | Development server and bundling pipeline |
| **Styling** | Tailwind CSS v4 | `^4.3.3` | Custom HoYoverse obsidian glassmorphism design system |
| **Routing** | React Router DOM | `^7.18.2` | Client-side SPA routing and RBAC route guards |
| **HTTP Transport** | Axios | `^1.19.0` | REST API client with JWT interceptors |
| **Realtime WebSockets** | Microsoft SignalR | `^10.0.11` | Bidirectional Support chat & Lobby presence |
| **Visual Analytics** | Recharts | `^3.10.1` | Financial analytics and performance charts |
| **Iconography** | Lucide React | `^1.33.0` | Vector iconography |
| **Linter** | Oxlint | `^1.75.0` | High-speed JavaScript/TypeScript linter |

### Folder Organization
```text
Admin_Pactkeeper/
├── public/                     # Static public assets (Favicon, emblems)
├── src/
│   ├── api/
│   │   ├── adminClient.ts      # Axios client, baseURL resolution, and JWT auth interceptors
│   │   └── matchLogApi.ts      # Dedicated server log retrieval, parsing, and syntax tagging
│   ├── assets/                 # Brand assets, illustrations, and textures
│   ├── components/
│   │   ├── GemArt.tsx          # 6-tier custom SVG prismatic crystal graphics
│   │   ├── Header.tsx          # Floating cosmic glass bar, server clock, role badges
│   │   ├── Layout.tsx          # Master layout container (Sidebar + Content + Header)
│   │   ├── MatchLogInspector.tsx # Terminal console for VPS dedicated server logs & filters
│   │   └── Sidebar.tsx         # Role-filtered navigation menu enforcing RBAC permissions
│   ├── hooks/
│   │   └── useRealtimePresence.ts # Custom hook for live player presence subscriptions
│   ├── pages/
│   │   ├── ContentManagement.tsx   # Game CMS with full CRUD for 6 SRPG definition catalogs
│   │   ├── DashboardOverview.tsx   # Real-time CCU, battle metrics, and emergency switches
│   │   ├── GachaManagement.tsx     # Summon banner scheduling and rate configurations
│   │   ├── LiveSupport.tsx         # Real-time player support chat over SignalR
│   │   ├── Login.tsx               # Role authority selection and 1-click sample credentials
│   │   ├── MatchSupervision.tsx    # Screen 33 & 34: Tactical esports and NGO diagnostics
│   │   ├── PaymentManagement.tsx   # Screen 32: PayOS ledger, HMAC-SHA256 seal, GemArt packs
│   │   └── PlayerManagement.tsx    # Screen 29 & 30: Multi-source player roster, bans, audits
│   ├── services/
│   │   └── playerPresenceService.ts # Unified multi-source presence aggregation engine
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces, DTOs, and CounselRole union types
│   ├── utils/
│   │   └── presence.ts         # Presence state analyzer (Online / In-Battle / Offline)
│   ├── App.css
│   ├── App.tsx                 # Root routing configuration, role persistence, and auth guards
│   ├── index.css               # Tailwind CSS directives, typography, and HoYoverse styling
│   └── main.tsx                # React application entry point
├── .gitignore                  # Protects .env, vercel.json, and node_modules from Git
├── index.html                  # HTML shell with Cinzel / Serif font integrations
├── package.json                # Scripts, project metadata, and dependency declarations
├── tsconfig.json               # TypeScript compilation configuration
└── vite.config.ts              # Vite configuration with dynamic environment proxy loading
```

---

## 🗺️ 9. Project Progress & Milestone Assessment

### 📊 Implementation Status by Module:

| Module / Requirement | Specification | Status | Evidence in Codebase |
| :--- | :--- | :---: | :--- |
| **Authentication & RBAC** | Admin, Moderator, Tech Support roles | **100% Complete** | `src/pages/Login.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx` |
| **Realm Overview & Telemetry** | Real-time CCU, active matches, killswitches | **100% Complete** | `src/pages/DashboardOverview.tsx` |
| **User Directory & Sanctions** | Multi-source aggregation, Ban/Unban, Wallets | **100% Complete** | `src/pages/PlayerManagement.tsx`, `src/services/playerPresenceService.ts` |
| **Match Supervision & Diagnostics** | Screen 33 & 34: NGO logs, combat replay, limits | **100% Complete** | `src/pages/MatchSupervision.tsx`, `src/components/MatchLogInspector.tsx` |
| **Gacha Banner Orchestration** | 90 hard pity, 50-50 soft pity, activations | **100% Complete** | `src/pages/GachaManagement.tsx` |
| **SRPG Game Definition CMS** | 6 catalogs, full interactive CRUD modals | **100% Complete** | `src/pages/ContentManagement.tsx` |
| **PayOS Revenue & Ledger** | Screen 32: HMAC-SHA256 receipt modal, GemArt | **100% Complete** | `src/pages/PaymentManagement.tsx`, `src/components/GemArt.tsx` |
| **Player Support Desk** | Real-time SignalR WebSocket chat, ticket queue | **100% Complete** | `src/pages/LiveSupport.tsx` |
| **Security Hardening** | CWE-200 prevention, gitignored secrets, session auth | **100% Complete** | `src/api/adminClient.ts`, `.gitignore`, `sessionStorage` |
| **UI/UX Aesthetics** | HoYoverse AAA Cosmic Obsidian glassmorphism | **100% Complete** | `src/index.css`, `src/components/Header.tsx`, `src/components/Sidebar.tsx` |

### 🔮 Remaining / Future Enhancements
- [ ] **Global Server Mail & Mass Compensation:** Mass distribution engine for broadcasting apologems and gifts directly to player inboxes.
- [ ] **Advanced Revenue Analytics Export:** Date range picker and CSV export for PayOS transaction logs.
- [ ] **Automated E2E Testing:** End-to-end integration test suite using Playwright.

---

## 📜 License & Acknowledgments

This project is developed as an academic capstone project for **SEP490 — Software Engineering Capstone Project** at **FPT University**. All rights reserved by the PactKeeper Development Team.
