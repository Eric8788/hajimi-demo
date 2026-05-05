# AI Club Ecosystem - Master Architecture & Context Document

*This document is the "Master Manual" for AI coding assistants and developers. It explains the entire architecture, routing, and deployment strategy for the AI Club's decentralized projects, which have now been centralized under the **Hajimi** platform.*

> **Every AI agent MUST read this file before starting any work session.**

---

## 1. Ecosystem Topology

The AI Club ecosystem consists of three main pillars:

### A. Hajimi (The Central Nexus)
- **Directory:** `2_学生项目_Student_Projects/Hajimi-Dan`
- **GitHub Repository:** `https://github.com/Eric8788/hajimi-demo.git`
- **Primary Domain:** `https://hajimi.ericproject.xyz` ✅ (official)
- **Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vercel Postgres, raw SQL.
- **Role:** Primary entry point. Provides user auth, community forum ("The Hallway"), personalized dashboard, and the **Function Hall** (unified directory of all club projects).
- **Design:** Glassmorphism aesthetic. Custom CSS only. `backdrop-filter: blur`, `rgba(255,255,255,0.7)`.

### B. The Static Hub (The Game Server)
- **Directory:** `ai-club-hub`
- **GitHub Repository:** `https://github.com/Eric8788/ai-club.git`
- **Primary Domain:** `https://hub.ericproject.xyz` ✅ (official, custom domain)
- **Fallback Domain:** `https://ai-club-nine.vercel.app` ❌ DO NOT use in code
- **Tech Stack:** Vanilla HTML/CSS/JS.
- **Role:** Static file host for all Canvas/WebGL mini-games. Hajimi Function Hall links to these files.

### C. Independent Full-Stack Projects
- **Quant Panel:** `https://www.ericproject.xyz/`
- **Snake.io:** `https://snake-io-n197.onrender.com/` (Node.js + Socket.IO)
- **PROMETHEUS:** `https://prometheus-pzu9.onrender.com/` (narrative engine)

---

## 2. Official Domain Reference

| Service | Official URL | Notes |
|---|---|---|
| Hajimi (main portal) | `https://hajimi.ericproject.xyz` | Custom domain on Vercel |
| Static Hub (games) | `https://hub.ericproject.xyz` | Custom domain on Vercel |
| Quant Panel | `https://www.ericproject.xyz/` | Independent deployment |
| Snake.io | `https://snake-io-n197.onrender.com/` | Render deployment |
| PROMETHEUS | `https://prometheus-pzu9.onrender.com/` | Render deployment |

**Banned URLs (never write in code):**
- ❌ `ai-club-nine.vercel.app`
- ❌ `hajimi-demo-8aie.vercel.app` (or any Vercel preview URL)

---

## 3. Project Directory (The Function Hall)

All projects are cataloged in `Hajimi-Dan/src/data/projects.ts`.

### 🌐 Independently Deployed
- **Snake.io** — Real-time multiplayer Snake (Socket.IO)
- **PROMETHEUS** — Terminal-style narrative survival engine
- **Quant Panel** — Quantitative monitoring dashboard

### 🎮 Static Web Games (hosted at `hub.ericproject.xyz/projects/`)
- **Boxhead** — 3D survival action game (two-player local)
- **Climb 3D** — 3D parkour experiment
- **AI Tabletop** — Digital party game platform (Undercover, Werewolf)
- **Snake** — Simple moddable 2D snake
- **Sailer 3D / Sail Dodge** — Low-poly arcade sailing games
- **草原梦境 (Lucy Grass)** — Generative art experiment

### 🛠️ Tools & Simulations (hosted at `hub.ericproject.xyz/projects/`)
- **帆船倒计时** — Sailing race countdown
- **背单词** — Vocabulary flashcard app
- **CV 点名抽签** — Classroom random picker
- **Flight Radar** — Map/route template
- **Sailer 2D** *(coming soon)* — Serious sailing physics simulator

---

## 4. How to Add a New Static Game
1. Create `ai-club-hub/projects/<new-game>/index.html`
2. Push to `https://github.com/Eric8788/ai-club.git`
3. Add entry to `Hajimi-Dan/src/data/projects.ts` using URL: `https://hub.ericproject.xyz/projects/<new-game>/index.html`
4. Commit to `hajimi-demo` — Function Hall updates automatically

---

## 5. Hajimi Architecture Quick Reference

- **Database:** `src/lib/db.ts` — `@vercel/postgres` with raw SQL. No ORM.
- **Auth:** Custom JWT via `jose` + `bcryptjs`. Stored in `HttpOnly` cookie `session`. No NextAuth.
- **Session helpers:** `getSession()` → extracts `userId`. `createSession()`, `logout()` in `src/lib/auth.ts`.
- **Guest Mode:** `/resources` (The Hallway) is publicly browsable. Action interceptors show a login modal on Like/Comment/Post.
- **CSS:** Custom only (`src/app/globals.css`). ❌ No Tailwind. Glassmorphism tokens: `--glass-bg`, `--glass-border`, `--blur-strength`.
- **Image Uploads:** `POST /api/posts` stores attachments in Vercel Blob and saves the public Blob URL in `posts.attachment_url`. Production requires `BLOB_READ_WRITE_TOKEN`.
- **Landing Page particles:** `src/components/ParticleBackground.tsx` — Canvas-based, `zIndex: -1`, free-floating with mouse repulsion.

### DB Schema
| Table | Key Columns |
|---|---|
| `users` | `id`, `username`, `password_hash`, `points`, `level`, `role`, `avatar`, `bio`, `grade`, `age` |
| `posts` | `id`, `author_id`, `title`, `content`, `type`, `tag`, `attachment_url`, `likes`, `created_at` |
| `comments` | `id`, `post_id`, `author_id`, `content`, `likes`, `created_at` |
| `checkins` | `user_id`, `checkin_date` |

### App Routes
| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with particle bg, project marquee |
| `/login` | Public | JWT auth (login + register) |
| `/dashboard` | Protected | Welcome widget, Timeline, Tarot, Rec Room |
| `/resources` | Hybrid (Guest OK) | Forum — The Hallway |
| `/functions` | Public | Function Hall — project grid |
| `/profile` | Protected | User profile editor |

---

## 6. Multi-AI Git Collaboration Rules

> **This project is co-developed by multiple AI agents directed by Eric (owner). These rules are mandatory for ALL agents.**

### Pre-Work Checklist
```bash
# Run before every session in the target repo:
git status --short --branch
git pull --ff-only
# Then read:
# - hajimi-demo/docs/AI_CLUB_ECOSYSTEM.md  (this file)
# - hajimi-demo/HAJIMI_ARCHITECTURE.md
# - /Users/eric/Desktop/AI/AI-CLUB/AI_COORDINATION.md  (discussion board)
```

### Agent Availability Model
- Codex is Eric's primary ongoing executor and may continue work across many updates.
- Antigravity/Gemini is a fallback or explicit handoff agent, usually used only when Codex context/tokens run out or Eric asks to switch.
- Do not assume every Codex update means Antigravity/Gemini should execute the next step.

### Branch Strategy
| Change size | Rule |
|---|---|
| Small (single file, easily reversible) | Commit directly to `main` |
| Large (new feature, multi-file refactor) | `git checkout -b agent/<agent>/<task-slug>` |

**Branch name examples:**
- `agent/codex/blob-uploads`
- `agent/gemini/function-hall-domains`
- `agent/claude/dashboard-layout`

### Commit Message Format
```
<type>(<scope>): <summary>

<body: what and why>

Agent: Gemini       ← AI identity here (footer only)
Test: npm run build ← verification evidence
```

**Scope = code area, NOT AI name.**
Examples:
```
fix(forum): disable local file writes on vercel
feat(functions): add new project entry for sailer-2d
docs(ecosystem): update hub domain to hub.ericproject.xyz
refactor(dashboard): convert widgets to full-width vertical layout
```

### Handoff Checklist
Every agent-to-agent handoff must include:
```
Repo: <repo-name>
Write scope: <files or directories changed>
Changed: <plain English summary>
Verified: <how you tested it>
Next risk: <what the next agent should watch out for>
```

### Hard Rules
- ❌ Never use `ai-club-nine.vercel.app` in code → use `hub.ericproject.xyz`
- ❌ Never use Vercel preview URLs in code → use official custom domains
- ❌ Never use Tailwind CSS classes
- ❌ Never introduce an ORM (no Prisma, no Drizzle, no Sequelize)
- ❌ Never modify DB schema without updating `HAJIMI_ARCHITECTURE.md`
- ✅ Always maintain Glassmorphism aesthetic
- ✅ Always run `npm run build` before pushing (when possible)
- ✅ Always write handoff checklist when switching agents

### Phase Discipline
- **Phase 2:** Domain cleanup + identity consolidation + docs
- **Phase 3 (current):** Image upload → Vercel Blob migration
- Do NOT mix phases in a single PR/commit

---

## 7. Known Issues & Quirks

- **Turbopack Chinese Path Bug:** Local `npm run dev` may panic if the absolute path contains Chinese characters. Vercel cloud builds are unaffected. Workaround: run dev from a path without Chinese characters.
- **Vercel Auth Interception:** On Preview URLs with Vercel Protection enabled, `/api/auth` may return 500/HTML. Always test auth on the Production Domain.
- **Vercel Blob token required:** File uploads return 503 if `BLOB_READ_WRITE_TOKEN` is missing. Text-only posts still work without Blob.
- **globals.css corruption (resolved):** A previous edit accidentally injected raw CSS inside a `.glass-input` rule block. Fixed in commit `1caab3a`.
