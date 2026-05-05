# AI Club Ecosystem - Master Architecture & Context Document

*This document is the "Master Manual" for AI coding assistants and developers. It explains the entire architecture, routing, and deployment strategy for the AI Club's decentralized projects, which have now been centralized under the **Hajimi** platform.*

---

## 1. Ecosystem Topology

The AI Club ecosystem consists of three main pillars:

### A. Hajimi (The Central Nexus)
- **Directory:** `2_学生项目_Student_Projects/Hajimi-Dan`
- **GitHub Repository:** `https://github.com/Eric8788/hajimi-demo.git`
- **Primary Domain:** `https://hajimi.ericproject.xyz`
- **Tech Stack:** Next.js 14+ (App Router), React, TypeScript, Vercel Postgres, raw SQL.
- **Role:** The primary entry point for all students. It provides user authentication, the community forum ("The Hallway"), a personalized dashboard, and the **Function Hall** (the unified directory of all club projects).
- **Design:** Strict "Cyber Oracle / Glassmorphism" aesthetic. Heavy use of `.glass-panel`, `.glass-input`, and custom CSS.

### B. The Static Hub (The Game Server)
- **Directory:** `ai-club-hub`
- **GitHub Repository:** `https://github.com/Eric8788/ai-club.git`
- **Primary Domain:** `https://hub.ericproject.xyz` ✅ (official, custom domain)
- **Fallback Domain:** `https://ai-club-nine.vercel.app` (DO NOT use this in code, for fallback only)
- **Tech Stack:** Vanilla HTML/CSS/JS.
- **Role:** Static file host serving all Canvas/WebGL mini-games. Hajimi's Function Hall links directly to these hosted files.

### C. Independent Full-Stack Projects
Larger projects that require WebSockets or heavy backend logic are deployed independently and linked within Hajimi:
- **Quant Panel:** `https://www.ericproject.xyz/`
- **Snake.io:** `https://snake-io-n197.onrender.com/`
- **PROMETHEUS:** `https://prometheus-pzu9.onrender.com/`

---

## 2. Project Directory (The Function Hall)

All these projects are cataloged in `Hajimi-Dan/src/data/projects.ts`. 

### 🎮 Static Web Games (Hosted inside `ai-club-hub/projects/`)
*These run purely in the browser (Canvas/Three.js/Vanilla JS) and are served via the Static Hub Vercel deployment.*
- **Boxhead:** 3D survival action game with local two-player controls and wave shooting.
- **Climb 3D:** 3D parkour and climbing experiment.
- **AI Tabletop:** Digital tabletop platform for AI party games (Undercover, Werewolf).
- **Snake:** A simple, easily moddable 2D snake game.
- **Sail Dodge & Sailer 3D:** Polished, low-poly arcade sailing games with procedural waves.
- **Lucy Grass (草原梦境):** An interactive generative art experiment.

### 🛠️ Tools & Simulations (Hosted inside `ai-club-hub/projects/`)
- **Countdown (帆船倒计时):** Sailing race start countdown tool.
- **Vocabulary (背单词):** A minimal vocabulary flashcard web app.
- **CV Picker (CV 点名抽签):** A classroom random picker using a camera-inspired UI concept.
- **Flight Radar:** A map and route starter template for flight tracking.
- **Sailer 2D (Coming Soon):** A serious 2D sailing physics simulator.

---

## 3. Deployment & Integration Strategy

### How things are connected:
1. **The Static Hub** is deployed to Vercel. This makes every game accessible via URLs like `https://ai-club-nine.vercel.app/projects/snake/index.html`.
2. **Hajimi** is deployed to its own Vercel project (production domain bound to `hajimi.ericproject.xyz`).
3. In Hajimi's `/functions` route, the `projects.ts` data file holds the absolute URLs pointing to the Static Hub or Render deployments.
4. Users log into Hajimi, browse the Function Hall, click a project, and are routed seamlessly to the hosted game.

### How to add a NEW static game:
1. Create a new folder in `ai-club-hub/projects/new-game/` in the `ai-club` repo.
2. Place the `index.html`, `style.css`, and `script.js` inside.
3. Push `ai-club-hub` to GitHub (which triggers Vercel to update the Static Hub).
4. Go to `Hajimi-Dan/src/data/projects.ts` in the `hajimi-demo` repo and add a new entry to the `PROJECTS` array.
5. Hajimi will instantly render the new glass card in the Function Hall.

---

## 4. Hajimi Architecture Deep Dive
- **Database:** `src/lib/db.ts`. No ORMs used. Uses `@vercel/postgres` `sql` tagged templates.
- **Auth:** Stateless JWT stored in a secure cookie. `getSession()` extracts the `userId`. 
- **Guest Mode:** Non-logged-in users can browse `/resources` (The Hallway). Button clicks are intercepted by an `onGuestAction` callback which triggers a stylish Login Modal popup.
- **CSS Framework:** Custom CSS only (`src/app/globals.css`). Maintain the frosted glass aesthetic using `background: rgba(255,255,255,0.7)` and `backdrop-filter: blur(20px)`.
- **Image Upload Limitations (Vercel):** The current forum implementation attempts to upload images directly to the `public/uploads` directory. However, Vercel Serverless Functions have a read-only filesystem. Any attempt to write an image to the local disk will silently fail or throw an error. **To fix this in the future:** Uploads must be refactored to use a cloud storage provider (like Vercel Blob, AWS S3, or Cloudinary).

---

## 5. Multi-AI Git Collaboration Rules

> **This project is developed by multiple AI agents (Gemini/Antigravity, Codex, etc.) directed by Eric. The following rules are mandatory for all agents.**

### Pre-Work Checklist (run before every session)
```bash
git status --short --branch   # Confirm clean state
git pull --ff-only            # Pull latest changes
# Read: docs/AI_CLUB_ECOSYSTEM.md and HAJIMI_ARCHITECTURE.md
```

### Branch Strategy
- **Small changes** (single file, easily reversible): commit directly to `main`
- **Large changes** (new features, refactors, multi-file edits): use a feature branch:
  ```
  git checkout -b agent/<agent-name>/<task-slug>
  # e.g. agent/codex/blob-uploads, agent/gemini/function-hall-domains
  ```

### Commit Message Format
```
<type>(<scope>): <summary>

<body describing what and why>

Agent: Gemini   # or Codex, Claude, etc.
Test: npm run build
```
- `scope` = code area changed (e.g. `forum`, `dashboard`, `functions`, `ecosystem`, `auth`)
- AI identity goes in the **footer**, NOT the scope
- Example: `fix(forum): disable local file writes on vercel`

### Handoff Checklist (fill out when switching agents)
```
Repo: hajimi-demo
Write scope: src/data/projects.ts
Changed: replaced ai-club-nine.vercel.app with hub.ericproject.xyz across all project URLs
Verified: grep shows 0 occurrences of old domain
Next risk: none, static data file only
```

### Hard Rules
- ❌ Never use `ai-club-nine.vercel.app` in code — use `hub.ericproject.xyz`
- ❌ Never use Tailwind utility classes
- ❌ Never introduce an ORM (no Prisma, no Drizzle)
- ❌ Never modify the DB schema without documenting in `HAJIMI_ARCHITECTURE.md`
- ✅ Always keep the Glassmorphism aesthetic (`rgba(255,255,255,0.7)` + `backdrop-filter`)
- ✅ Always run `npm run build` locally before pushing, if possible
