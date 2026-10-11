# PactKeeper Admin Portal (High Counsel) ⚔️👑

> **Central Administration, Governance & Live Operations System** for the Tactical Strategy Role-Playing Game **PactKeeper (SRPG)**.  
> Capstone Project | SEP490 — FPT University

---

## 📌 1. Project Overview & Vision

**PactKeeper Admin Portal (High Counsel)** is the command-and-control operations platform designed for Game Masters, System Administrators, and Customer Support Specialists. The dashboard adopts an immersive **Dark Fantasy / Medieval RPG** visual design (Cinzel typography, Mahogany framing, Parchment cards, and Crimson/Gold badges) while operating on enterprise-grade web architecture with 100% real backend telemetry and data synchronization via RESTful APIs (.NET 9) and SignalR WebSockets.

### Core Objectives:
- **Server Governance & Telemetry:** Real-time visibility into Concurrent Users (CCU), active battles, and server health with emergency fail-safes.
- **Role-Based Access Control (RBAC):** Strict operational segregation among Administrators, Game Moderators, and Technical Support personnel.
- **Economic & Content Management:** Live control over game items, heroes, story progression, gacha banners, and PayOS real-money top-ups.
- **Real-Time Player Assistance:** Low-latency two-way communication channel directly linking game operators to players in distress.

---

## 🛡️ 2. Role-Based Access Control (RBAC) Matrix

The portal strictly enforces the system's **Context Diagram** and **Use Case Specifications**, dynamically tailoring the navigation bar, actions, and data access based on the authenticated operator role:

| Module / Privilege | Admin (Full Counsel) | Moderator (Game Master) | Technical Support | Purpose & Guardrail |
| :--- | :---: | :---: | :---: | :--- |
| **System Status & Telemetry** | Full Access | View Only | Full Access | Live CCU, battle metrics, and emergency server switches |
| **Emergency Overrides** | ✅ Enabled | ❌ Forbidden | ✅ Enabled | Block login, halt matchmaking, system emergency stop |
| **Player Record Management** | Full Access | Full Access | View Only | Inspect player level, stats, and real-time presence |
| **Account Sanctions (Ban/Unban)** | ✅ Allowed | ✅ Allowed | ❌ Forbidden | Restrict delinquent accounts from server access |
| **Currency Adjustments** | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | Credit/Debit Gold and Gems for compensation/audits |
| **Gacha Banner Orchestration** | Full Access | Full Access | ❌ Forbidden | Schedule summons, configure pity rates & featured pools |
| **SRPG Game CMS (6 Catalogs)** | Full Access | Full Access | ❌ Forbidden | Heroes, Chapters/Scenes, Weapons, Trinkets, Classes, Skills |
| **PayOS Revenue Ledger** | Full Access | ❌ Forbidden | ❌ Forbidden | Inspect real-money order states (`PAID`, `PENDING`, `CANCELLED`) |
| **Live Support WebSocket Desk** | Full Access | ❌ Forbidden | Full Access | Real-time chat via SignalR (`/hubs/support`) |

---

## 🚀 3. Core Feature Walkthrough

### 🏰 1. Realm Telemetry & Emergency Command (`/`)
- **Live Presence Detection:** Real-time recognition of players categorizing them into `ONLINE`, `IN BATTLE`, and `OFFLINE` by cross-referencing match sessions and gateway pings.
- **Ongoing Battle Monitoring:** Direct visibility into active PvP duels, participating combatant IDs, and timeline state.
- **Emergency Overrides (Killswitches):**
  - **Block Player Logins:** Instantly prevent new client authentication sessions (`POST /api/admin/update-login-status`).
  - **Block Matchmaking:** Temporarily pause matchmaking queues during maintenance (`POST /api/admin/update-queue-status`).
  - **Emergency Halt (Force Stop All):** Sever all active match sessions and lock realm gateway (`POST /api/admin/force-stop-all`).
  - State persistence backed by `localStorage` to retain button states across page refreshes.

### 👥 2. Player Directory & Discipline (`/players`)
- **Multi-Source Aggregation:** Consolidates players dynamically from Google OAuth, Steam accounts, PayOS transactions, and support ticket queues.
- **Identity Sanitization:** Automatically resolves raw database ObjectIDs and UUIDs into human-readable player aliases (e.g., `Hero #3A1F`).
- **Disciplinary Enforcement:** Instant single-click Ban / Unban actions with persistent server-side status updates.
- **Treasury Adjustment Modal (Admin-Only):** Safely inject or deduct Gems and Gold with automatic numeric bounds verification.

### ✨ 3. Gacha Banner Management (`/gacha`)
- **Active Summon Pools:** Displays ongoing banners, start/end schedules, summon costs, and currency types.
- **Pity & Featured Roster:** Visual inspection of rate-up Heroes and Weapons with guaranteed pity thresholds.
- **Banner Creation Modal:** Form-driven creation of new summoning events (`POST /api/gachabanner`).
- **Status Toggle:** Instantly toggle active banner availability via `PATCH /api/gachabanner/{id}`.

### 📜 4. SRPG Configuration Archives (`/content`)
Centralized CMS for game balance and asset definitions, organized into 6 interactive tabs:
1. **Heroes / Units (`/api/UnitDefinition`):** Base HP, ATK, DEF, Speed, rarity, class bindings, passive skills, and creation modal.
2. **Chapters & Scenes (`/api/ChapterConfig`):** Story progression, scene sequencing, stamina consumption, and recommended levels.
3. **Weapons (`/api/WeaponDefinition`):** Equipment types, base attack, rarity tiers, and stat modifiers (HP, SP, Speed).
4. **Trinkets (`/api/TrinketDefinition`):** Defensive accessories, passive skill triggers, and equipment stats.
5. **Classes (`/api/ClassDefinition`):** SRPG class archetypes, base movement ranges, and class skill IDs.
6. **Skills (`/api/SkillDefinition`):** Skill library, SP casting costs, and detailed combat effect descriptions.

### 💰 5. PayOS Treasury & Transaction Ledger (`/payments`)
- **Revenue Analytics:** Aggregated metrics for total gross revenue (VND), successful orders, and completion rates.
- **Real-Time Ledger:** Filterable order log showing PayOS `orderCode`, player ID, purchased pack, transaction amount, and status (`PAID`, `PENDING`, `CANCELLED`).
- **Top-Up Pack Catalog:** Live management of Gem packs and bundled hero gifts, with instant availability switches (`PATCH /api/topuppack/{id}/availability`).

### 📜 6. Logs & Alerts Command Board (`/support`)
- **Bidirectional WebSocket Engine (Support Desk):** Direct connection to the backend ASP.NET SignalR Hub (`/hubs/support`) displaying active hero assistance queues with instant operator replies.
- **Match Server Log Inspector (Dedicated Server Diagnostics):**
  - Direct live-ops telemetry and error investigation for Unity Headless Dedicated Server instances.
  - Console Terminal UI with line numbering, log level filtering (`ERROR`, `WARN`, `SYSTEM`, `INFO`), and syntax highlighting.
  - Real-time integration: Connects directly to backend VPS endpoint (`GET /api/Match/{matchId}/logs`) to stream and parse raw server log files.

---

## 🔒 4. Security Architecture & Environment Configuration

To prevent **Reconnaissance & Information Disclosure (CWE-200)**, the production repository is hardened against automated scrapers:
- Production backend hostnames, IP addresses, and private gateway ports are strictly decoupled from source control.
- Sensitive environment and deployment rewrite files (`.env`, `vercel.json`) are ignored by Git.

### 📄 How to Create Gitignored Files Locally

#### 1. Create `.env` (Local Development Proxy)
Create a file named `.env` in the root folder of `Admin_Pactkeeper`:

```env
# .env (Do NOT commit to Git)
VITE_BACKEND_TARGET=http://your-backend-host:5276
```
> **Why is this gitignored?**  
> `vite.config.ts` dynamically reads `VITE_BACKEND_TARGET` via `loadEnv()`. This allows developers to point the local proxy to the game server without leaking the server's IP/port to public GitHub repositories.

#### 2. Create `vercel.json` (Production Deployment Proxy)
Create a file named `vercel.json` in the root folder of `Admin_Pactkeeper`:

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
> **Why is this gitignored?**  
> Vercel rewrites forward `/api` and `/hubs` requests to the HTTP backend server, preventing browser Mixed Content errors. Keeping this file local ensures your production proxy destinations remain confidential.

---

## ⚙️ 5. Installation & Local Development Walkthrough

### Prerequisites
- **Node.js:** Version 18.x or later (LTS recommended)
- **NPM** (bundled with Node.js) or **PNPM / Yarn**
- Running instance of the PactKeeper ASP.NET Core Backend

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

3. **Configure the local environment:**
   Create the `.env` file as described in Section 4:
   ```bash
   # In Windows PowerShell:
   Set-Content -Path .env -Value "VITE_BACKEND_TARGET=http://localhost:5276"
   ```
   *(Replace `http://localhost:5276` with your actual backend gateway address).*

4. **Launch the development server:**
   ```bash
   npm run dev
   ```
   The application will boot at `http://localhost:3001` with automated proxying configured for `/api` and `/hubs`.

5. **Lint and compile checks:**
   ```bash
   # Run Oxlint static code analyzer
   npm run lint

   # Test TypeScript compilation and Vite production bundling
   npm run build
   ```

---

## 🚢 6. Operations & Deployment Guide (Vercel CLI)

Because `vercel.json` is withheld from the public Git repository for security, deployments are published directly via the **Vercel CLI**:

### Step 1: Ensure Local Configuration is Ready
Ensure your local `vercel.json` file is present in the project root with the correct production backend destination.

### Step 2: Install Vercel CLI (if not installed)
```bash
npm i -g vercel
```

### Step 3: Authenticate with Vercel
```bash
vercel login
```

### Step 4: Deploy to Production
Run the production deployment command:
```bash
vercel --prod
```
> **Deployment Note:**  
> The Vercel CLI reads your local `vercel.json` and uploads the proxy rewrites directly into the Vercel Edge routing layer. Any automatic Git builds triggered by pushes to GitHub will not have `vercel.json`, so always run `vercel --prod` whenever publishing a new release.

---

## 📖 7. User Guide & Live-Ops Runbook

### Accessing the Portal (`/login`)
1. Open the portal URL in your web browser.
2. Select your designated role badge (**Admin**, **Moderator**, or **Technical Support**).
3. Enter your administrative credentials (Username / Password).
4. Click **"ENTER HIGH COUNSEL"** to authenticate. Upon success, you are redirected to your role's primary operations dashboard.

### Performing Disciplinary Actions (Ban/Unban)
1. Navigate to the **Player Management** tab (`/players`).
2. Search for the target player by ID or Alias.
3. Click the **Ban Account** or **Unban Account** button.
4. The system sends an immediate update to the backend database; the player is barred from logging in or continuing active matchmaking.

### Compensating Players with Currency
1. Ensure you are signed in as **Admin**.
2. Navigate to **Player Management** (`/players`).
3. Locate the player and click the **Adjust Currency** action button.
4. Input the adjustment amount for **Gold** or **Gems** (positive to grant, negative to debit).
5. Confirm the transaction to update the player's wallet balance.

### Creating a Gacha Banner
1. Navigate to **Banner Management** (`/gacha`).
2. Click **"Create Banner"** in the top-right corner.
3. Specify the Banner Title, Banner Image URL, Currency Type (Gems/Gold), and Pull Cost.
4. Define the Start Date, End Date, and Pity Threshold.
5. Select the Featured Heroes and Weapons, then click **"Create Banner"** to publish.

### Responding to Live Support Tickets
1. Navigate to the **Live Support** desk (`/support`).
2. Inspect the **Active Hero Queue** on the left panel. Players with unread or recent messages will appear at the top.
3. Click on a player to load their complete chat history.
4. Type your resolution message in the chat input and click **Send**. The response is dispatched instantly to the player's client over SignalR.

### Handling Server Emergencies
1. Navigate to **Realm Overview** (`/`).
2. If unexpected bugs or vulnerabilities occur:
   - Click **"BLOCK LOGIN"** to halt new incoming player sessions.
   - Click **"BLOCK QUEUE"** to disable PvP matchmaking.
   - Click **"FORCE STOP ALL"** if the game servers must be killed immediately for emergency maintenance.

---

## 🛠️ 8. Tech Stack & Directory Structure

### Technology Stack
| Layer | Framework / Library | Version | Role in Architecture |
| :--- | :--- | :---: | :--- |
| **Runtime & Core** | React | `^19.2.8` | UI Component rendering |
| **Language** | TypeScript | `~6.0.2` | Static typing and contract interfaces |
| **Build Engine** | Vite | `^8.2.0` | Development server and module bundler |
| **Styling** | Tailwind CSS v4 | `^4.3.3` | Utility-first RPG design system |
| **Routing** | React Router DOM | `^7.18.2` | Client-side SPA routing and guards |
| **HTTP Transport** | Axios | `^1.19.0` | REST API client with JWT interceptors |
| **Realtime WebSockets** | Microsoft SignalR | `^10.0.11` | Bidirectional Live Support messaging |
| **Visual Analytics** | Recharts | `^3.10.1` | Financial analytics and chart rendering |
| **Icons** | Lucide React | `^1.33.0` | High-fidelity vector iconography |
| **Linter** | Oxlint | `^1.75.0` | High-performance JavaScript/TypeScript linter |

### Folder Organization
```text
Admin_Pactkeeper/
├── public/                 # Static public assets (Favicon, logos)
├── src/
│   ├── api/
│   │   └── adminClient.ts  # Axios instance, baseURL resolution, and JWT auth interceptors
│   ├── assets/             # Medieval RPG texture overlays and graphical elements
│   ├── components/
│   │   ├── Header.tsx      # Global header with active operator role, realm indicator, and logout
│   │   ├── Layout.tsx      # Structural layout container (Sidebar + Content + Header)
│   │   └── Sidebar.tsx     # Role-filtered navigation menu enforcing RBAC permissions
│   ├── pages/
│   │   ├── ContentManagement.tsx   # Game CMS for 6 SRPG definition catalogs
│   │   ├── DashboardOverview.tsx   # Real-time CCU, battle metrics, and emergency controls
│   │   ├── GachaManagement.tsx     # Summon banner scheduling and rate configurations
│   │   ├── LiveSupport.tsx         # Real-time player support chat over SignalR
│   │   ├── Login.tsx               # High Counsel authentication and interactive role selection
│   │   ├── PaymentManagement.tsx   # PayOS order ledger and top-up package availability
│   │   └── PlayerManagement.tsx    # Multi-source player roster, sanctions, and currency audits
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces, DTOs, and CounselRole union types
│   ├── utils/
│   │   └── presence.ts     # Player presence analyzer (Online / In-Battle / Offline)
│   ├── App.css
│   ├── App.tsx             # Root routing configuration, role persistence, and auth guards
│   ├── index.css           # Tailwind CSS directives, typography, and RPG parchment styling
│   └── main.tsx            # React application entry point
├── .gitignore              # Protects .env, vercel.json, and node_modules from Git
├── index.html              # HTML shell with Cinzel / Serif font integrations
├── package.json            # Scripts, project metadata, and dependency declarations
├── tsconfig.json           # TypeScript compilation configuration
└── vite.config.ts          # Vite configuration with dynamic environment proxy loading
```

---

## 🗺️ 9. Project Milestones & Future Roadmap

### ✅ Completed Milestones
- [x] **Role-Based Access Control (RBAC):** Complete operational segregation aligned with Context and Use Case Diagrams.
- [x] **Telemetry & Real-Time Presence:** Live detection of active player sessions (`ONLINE`, `IN BATTLE`, `OFFLINE`).
- [x] **SignalR Live Support:** Bidirectional WebSocket messaging directly connecting support operators to game clients.
- [x] **Identity Sanitization & Alias Mapping:** Resolution of database identifiers into human-friendly operator names.
- [x] **Security Hardening:** Total removal of sensitive backend domains and ports from commit history via BFG Repo-Cleaner.

### 🔮 Upcoming Features
- [ ] **Interactive Definition Editing:** In-browser CRUD capabilities for weapons, trinkets, skills, and map chapters.
- [ ] **Global Server Mail & Compensation Engine:** Mass broadcast system for distributing apologems, gold, and gift units.
- [ ] **Advanced Revenue Analytics:** Customizable date-range filtering and CSV export for PayOS transaction logs.
- [ ] **Automated Testing Suite:** End-to-end integration tests using Vitest and Playwright.

---

## 📜 License & Acknowledgments

This project is developed as an academic capstone project for **SEP490 — Software Engineering Capstone Project** at **FPT University**. All rights reserved by the PactKeeper Development Team.
