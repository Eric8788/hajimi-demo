# AI Club Ecosystem - Master Architecture & Context Document

*This document is the "Master Manual" for AI coding assistants and developers. It explains the entire architecture, routing, and deployment strategy for the AI Club's decentralized projects, which have now been centralized under the **Hajimi** platform.*

> **Every AI agent MUST read this file before starting any work session.**

**Current Hajimi version:** Hajimi Beta v0.2.0-beta.16 · 2026-05-22
**Behavior notes updated:** 2026-08-21 (Asia/Shanghai)

---

## 1. Ecosystem Topology

The AI Club ecosystem consists of three main pillars:

### A. Hajimi (The Central Nexus)
- **Directory:** `2_学生项目_Student_Projects/Hajimi-Dan`
- **GitHub Repository:** `https://github.com/Eric8788/hajimi-demo.git`
- **Primary Domain:** `https://hajimi.ericproject.xyz` ✅ (official)
- **Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vercel Postgres, raw SQL.
- **Role:** Primary entry point. Provides user auth, community forum ("The Hallway"), personalized dashboard, and the **Function Hall** (unified directory of all club projects).
- **Domi / 朵米:** Hajimi's experimental digital cloud companion. It is mounted at the root for eligible members, follows the user's language, and uses adaptive context plus fixed server-side read-only tools to discuss the community and permitted platform data.
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
- **Sailer 2D** — Serious sailing physics simulator (`https://hub.ericproject.xyz/projects/sailer-2d/index.html`)

---

## 4. How to Add a New Static Game
1. Create or update the project build under the relevant student/project folder and static Hub path if needed.
2. Submit a Hub project/new-version application from `/functions` with project name, author, description, tags, URL, and version notes.
3. Eric/admin reviews it at `/admin/project-submissions`; only approved submissions are written into the live `projects` table.
4. For emergency/manual maintenance, admins may still edit the database directly, but students should not self-publish live Hub entries.

---

## 5. Hajimi Architecture Quick Reference

- **Database:** `src/lib/db.ts` — `@vercel/postgres` with raw SQL. No ORM.
- **Auth:** Custom JWT via `jose` + `bcryptjs`. Stored in `HttpOnly` cookie `session`. No NextAuth. Registration is open for the graduation ceremony and no longer requires an invite code. New users choose `student`, `teacher`, `parent`, or `visitor`; student/teacher accounts must submit verification details during registration and remain pending until admin review. Teacher applicants are stored without staff permissions until approval promotes them to `teacher`. Parent/visitor accounts share the same read-only visitor permissions: they can browse and open projects but cannot post, comment, like, bookmark, rate, tip, submit projects, check in, redeem tokens, or use Cyber Oracle. New registration passwords must be 8+ chars with uppercase, lowercase, and a number.
- **Registration UX:** `/login` uses a 3-step registration wizard: choose identity, fill account/verification details, then set password plus optional avatar/profile. Role cards only select an identity; the user advances with the Next button.
- **Session helpers:** `getSession()` → extracts `userId`. `createSession()`, `logout()` in `src/lib/auth.ts`.
- **Guest / Visitor Mode:** `/resources` (The Hallway) is publicly browsable. `/functions` is public and Hub projects remain open to play. Parent/visitor accounts keep this browse/play access after login but remain read-only. Action interceptors show a login, verification, or read-only visitor prompt on Like/Comment/Save/Post/Project Submit.
- **Forum Moderation:** `teacher` and `admin` roles can publish `announcement` posts. Announcement posts are visually highlighted and sorted like pinned posts at the top of the main Hallway feed. Only `admin` can delete any post/comment; teachers and students can delete only their own posts/comments. Staff roles are shown with badges on forum posts/comments and profile pages.
- **Hajimi Verification:** Student and teacher registration must submit verification details for admin review; profile settings can submit verification later for older unverified accounts. The field label is `Name`, meaning school common name / English name / preferred name, not legal name. Student-permission applicants submit Name, G7-G13 / 毕业生 identity, and optional student ID; teachers submit Name and subject. Registration explains that, after approval, the verification name and reviewed student grade are visible only to active, verified, non-read-only Hajimi members on member profiles and remain hidden from external visitors. Student IDs are hashed server-side with `HAJIMI_VERIFICATION_PEPPER` and only the hash + last 4 are stored. `verification_status = 'verified'` plus a non-read-only role is required for forum posts, comments, likes, bookmarks, check-ins, project ratings/comments, project submissions, token redemption, Cyber Oracle, and leaderboard visibility. Student IDs, teacher subjects, and verification identity fields remain out of anonymous forum, avatar, leaderboard, notification, and presence payloads. Admin review shows strong conflicts for duplicate student ID hash and weak conflicts for duplicate Name + grade/subject.
- **Hub Project Flow:** Hub projects are open to play for guests/unverified users. Verified users can submit project/new-version applications from `/functions`; admins approve/reject at `/admin/project-submissions`. Approval creates or updates live `projects` rows and preserves old project/comment data. Published project owners can edit from their own project card, but the edit is submitted as a `new_version` application and does not change the live row until admin approval. Project opens are recorded in `project_opens` for Function Hall Hub rankings.
- **Hajimi币:** XP and H币 are independent. XP remains experience for levels, contribution, analytics, and leaderboards. H币 is a spendable budget currency for project tips and token redemption requests. Function Hall project tips now use H币 wallet transfers, not `users.points`. Legacy `project_tips` remains historical XP tip data only.
- **Leaderboard:** Leaderboard only returns verified users. `/leaderboard` focuses on XP contribution views: all-time, daily, weekly, and monthly. Function Hall has separate Hub project `热度榜` and `星级榜`: heat ranks selected-window verified unique players first, then rating and capped effective opens; rating ranks cumulative stars first, then rating count while still displaying the selected day/week/month play window. One verified user counts once per project per local day for unique players; effective opens are 30-minute sessions capped at 3 per user per day.
- **Hashtags:** Regular posts can use custom hashtags. The composer offers starter tags such as `升学雷达`, `课程补给站`, `健身广场`, and `情感树洞`, but users are not limited to a fixed list. The reserved `announcement` tag remains staff-only.
- **Beta Feedback:** `/resources` points beta testers to the pinned announcement post; feedback should be left as comments there instead of creating separate feedback posts.
- **Forum Ranking & Notifications:** `Hot` ranks by discussion, likes, saves, and freshness; `Top` ranks by likes. Post likes, post saves, and comment likes create in-app notifications for the content author. Verified, non-read-only members can follow other users through their public profile; a `Following` Hall filter returns only followed users' normal posts, excluding the viewer's own posts and announcements. New follows create `user_follow` notifications, and those notifications return to the recipient's own profile when clicked.
- **Forum Likes:** Post cards retain the like control and total count, and show up to three most-recent liker avatars. These public avatar thumbnails use the existing avatar hydration path, show the liker's username on hover/focus, and link to the corresponding public profile.
- **Forum Comments:** The Hallway feed returns the three newest comments inline for each post, ordered newest first. Expanding a post requests `GET /api/posts/interact?postId=...&page=...&limit=10`, which returns latest-first comments with page and total metadata. The actual hottest comment is selected by likes, direct reply count, creation time, and ID, and is marked with a small fire icon in its row; there is no independent featured-comment card. Notification links may include `commentId`; the API calculates the target page so the client can expand, load, and scroll to the target. This behavior does not change the database schema or comment IDs.
- **Live Presence:** `/api/presence` records one `user_presence` row per logged-in account and shows a lightweight online count/avatar stack for accounts seen in the last 5 minutes. Authenticated members also receive the limited `user_presence_daily` list for accounts seen today, sorted by each member's latest Shanghai-time heartbeat; guests receive counts only.
- **Domi Agent (local experiment):** `Domi / 朵米` is a digital cloud companion rather than a staff role or coding agent. The local intent router distinguishes casual chat, continuations, platform queries, page questions, visual questions, and sensitive routes. Casual greetings do not trigger page capture or a visible history-read step. The server selects a single primary conversation, adaptive recent-message depth, low-sensitivity memories, and fixed read-only platform tools. `POST /api/agent/chat` emits NDJSON status/delta/result/error events and falls back to a complete response when streaming is unavailable. Provider configuration remains server-only; no key, provider, model, or internal error is returned to clients.
- **Cyber Oracle AI:** `POST /api/oracle` powers the Dashboard tarot insight. It runs server-side only and can use AI Tabletop-aligned OpenAI-compatible providers: custom `HAJIMI_ORACLE_API_KEY` + `HAJIMI_ORACLE_API_URL` + `HAJIMI_ORACLE_MODEL`, then `ZENMUX_API_KEY`, `DASHSCOPE_API_KEY`, `SILICONFLOW_API_KEY`, and optional `TOKENDANCE_API_KEY` + `TOKENDANCE_BASE_URL`. Default models favor deeper reflective readings (`deepseek/deepseek-v3.2`, `qwen-max`, `deepseek-ai/DeepSeek-V3`) and can be overridden with provider-specific `HAJIMI_ORACLE_*_MODEL` variables. Readings are limited to 3 successful readings per user per day through the `oracle_readings` table. If no provider is configured or every provider fails, the server returns a deeper local fallback and still counts that successful reading.
- **CSS:** Custom only (`src/app/globals.css`). ❌ No Tailwind. Glassmorphism tokens: `--glass-bg`, `--glass-border`, `--blur-strength`.
- **Image Uploads:** `POST /api/posts` stores up to 3 public forum images in Vercel Blob and saves URLs in `posts.attachment_urls`, with the first URL mirrored in legacy `posts.attachment_url`. `POST /api/posts/interact` supports one optional Blob image per comment in `comments.attachment_url`. `POST /api/project-submissions/cover` stores cropped Function Hall project cover screenshots in Vercel Blob and saves the URL through `project_submissions.cover_url`. Production requires `BLOB_READ_WRITE_TOKEN`. Forum guardrails: JPEG/PNG/WebP/GIF only, 1 MB max per image, 5 image uploads per user per rolling 24 hours, 30 total image uploads per user, and deletion attempts to delete associated Blobs. The forum composer auto-compresses oversized JPEG/PNG/WebP files to WebP before upload; oversized animated GIFs are rejected because compression would remove animation. Project covers are cropped client-side to 16:9 WebP before upload.
- **Landing/Auth particles:** `src/components/ParticleBackground.tsx` — Canvas-based, `zIndex: 0`, free-floating with mouse repulsion.

### DB Schema
| Table | Key Columns |
|---|---|
| `users` | `id`, `username`, `password_hash`, `points`, `level`, `role` (`student` / `teacher` / `admin` / `parent` / `visitor`), `avatar`, `bio`, `grade`, `age`, `verification_status`, `verification_type`, `verified_name`, `verified_grade`, `verified_subject`, `student_id_hash`, `student_id_last4`, `account_status`, `disabled_at`, `disabled_by`, `disabled_reason` |
| `posts` | `id`, `author_id`, `title`, `content`, `type`, `tag`, `attachment_url`, `attachment_urls`, `likes`, `created_at` |
| `comments` | `id`, `post_id`, `author_id`, `content`, `attachment_url`, `likes`, `created_at` |
| `post_likes` / `comment_likes` / `bookmarks` | forum interaction rows with `created_at`; verified accounts only; `post_likes` has a recent-liker lookup index |
| `user_follows` | one-way follow relationships: `follower_id`, `following_id`, `created_at`; unique pair with indexes for both directions; initialize before production reads |
| `checkins` | `user_id`, `checkin_date` |
| `projects` | `id`, `author_id`, `title`, `description`, `emoji`, `url`, `tags`, `cover_url`, `rating`, `rating_count`, `created_at` |
| `project_likes` / `project_comments` | Hub ratings and comments; verified accounts only |
| `project_opens` | `project_id`, `user_id`, `opened_at`; raw open log used to derive verified unique players and capped effective opens for Hub rankings |
| `project_tips` | legacy XP tip log; kept for historical XP analytics only |
| `coin_wallets` | `user_id`, `balance`, `earned_total`, `spent_total`, timestamps; independent H币 wallet |
| `coin_transactions` | H币 ledger rows with `amount`, `balance_after`, `type`, `source_type`, counterparty, note, and creator |
| `coin_project_tips` | live H币 project tip log linking sender/recipient wallet transactions |
| `coin_redemption_requests` | token redemption requests with `pending`, `approved`, `rejected`, `completed` statuses |
| `notifications` | `recipient_id`, `actor_id`, `type`, `post_id`, `comment_id`, `read_at`, `created_at` |
| `user_presence` | `user_id`, `last_seen_at`; lightweight online presence, 5-minute active window |
| `user_presence_daily` | `user_id`, `presence_date`, `last_seen_at`; latest authenticated heartbeat per account and Shanghai calendar day |
| `oracle_readings` | `user_id`, `reading_date`, `cards`, `created_at` |
| `agent_conversations` | one primary Domi conversation per user, incremental summary checkpoint, cascades on user deletion |
| `agent_messages` | user/assistant conversation records; raw messages retained for 90 days, then cleaned up |
| `agent_memories` | deduplicated low-sensitivity facts/preferences/goals extracted server-side; cascades on user deletion |
| `project_submissions` | `author_id`, `submission_type`, `project_id`, `title`, `description`, `url`, `tags`, `status`, `reviewed_by`, `reviewed_at` |
| `admin_audit_events` | `actor_id`, `target_user_id`, `target_type`, `target_id`, `event_type`, `summary`, `details`, `created_at` |

### App Routes
| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with particle bg, project marquee |
| `/login` | Public | JWT auth (login + register) |
| `/dashboard` | Protected | Welcome widget, live presence, Timeline, Tarot, Rec Room |
| `/api/agent/chat` | Eligible authenticated members | Domi conversation history (`GET`) and streaming chat (`POST`); server-side permission and tool enforcement |
| `/resources` | Hybrid (Guest OK) | Forum — The Hallway, including pinned announcements, custom hashtags, saved posts, and the verified-member-only Following filter |
| `/api/follows` | Protected interaction API | Query, create, or remove one-way user follows; creates `user_follow` notifications on new follows |
| `/functions` | Public | Function Hall — project grid, open project play, verified project submission, owner new-version edits, pasted/uploaded project cover crop |
| `/wallet` | Protected | H币 wallet, transaction ledger, and token redemption request form |
| `/profile` | Protected | User profile editor with Data Studio analytics for XP, project opens, post interactions, 7-day chart, and 28-day participation heatmap |
| `/admin` | Admin | Admin console with review summary and recent history |
| `/admin/users` | Admin | Member management, admin-only identity detail maintenance, account disable/restore |
| `/admin/project-submissions` | Admin | Hub project/new-version application review |
| `/admin/coins` | Admin | Manual H币 grants and token redemption review |

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
# - hajimi-demo/docs/SESSION_HANDOFF.md
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
- **Phase 3 (current):** Image upload → Vercel Blob migration + storage guardrails
- Do NOT mix phases in a single PR/commit

---

## 7. Known Issues & Quirks

- **Turbopack Chinese Path Bug:** Local `npm run dev` may panic if the absolute path contains Chinese characters. Vercel cloud builds are unaffected. Workaround: run dev from a path without Chinese characters.
- **Vercel Auth Interception:** On Preview URLs with Vercel Protection enabled, `/api/auth` may return 500/HTML. Always test auth on the Production Domain.
- **Graduation ceremony registration:** Registration is currently open without invite codes. Keep any legacy invite-code env vars harmlessly configured if desired, but `POST /api/auth` no longer validates them. There is no admin invite code; promote trusted users to `admin` directly in the database.
- **Vercel Blob token required:** File uploads return 503 if `BLOB_READ_WRITE_TOKEN` is missing. Text-only posts still work without Blob.
- **Blob cleanup:** Run `npm run blob:cleanup` for a dry run and `npm run blob:cleanup -- --delete` to remove forum blobs that are no longer referenced by post or comment image fields.
- **globals.css corruption (resolved):** A previous edit accidentally injected raw CSS inside a `.glass-input` rule block. Fixed in commit `1caab3a`.
