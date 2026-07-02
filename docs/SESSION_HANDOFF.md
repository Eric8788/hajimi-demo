# Hajimi Session Handoff

*Last updated: 2026-06-08 (Asia/Shanghai)*

**Current version:** Hajimi Beta v0.2.0-beta.16 ? 2026-05-22

This file is the fast handoff note for any new AI window or fallback agent. Read this after `docs/AI_CLUB_ECOSYSTEM.md` and before making changes.

## 1. Current Status

- **Repo:** `hajimi-demo`
- **Directory:** `2_????_Student_Projects/Hajimi-Dan`
- **Primary domain:** `https://hajimi.ericproject.xyz`
- **Static hub domain:** `https://hub.ericproject.xyz`
- **Current phase:** Hajimi beta rollout for AI Club internal testing
- **Current version:** Hajimi Beta v0.2.0-beta.16
- **Latest stable branch:** `main`

## 2. What Is Already Done

- Static hub links were cleaned up to use `hub.ericproject.xyz` instead of old Vercel domains.
- Forum image uploads were migrated to Vercel Blob.
- Upload guardrails are live:
  - image only
  - `1 MB` max per image
  - `5` uploads per user per rolling 24 hours
  - `30` total uploads per user
- The composer auto-compresses oversized JPEG/PNG/WebP images before upload.
- Registration is open without invite codes for graduation ceremony promotion.
- Registration supports `student`, `teacher`, `parent`, and `visitor` identities.
- Student and teacher registration requires verification details up front. Student-permission applicants submit Name, G7-G13 / ??? identity, and optional student ID; teacher applicants submit Name and subject. Teacher applicants are not granted `teacher` staff permissions until admin approval.
- Registration is presented as a 3-step wizard: identity, account/verification details, then password plus optional avatar/profile.
- Parent/visitor accounts share the same read-only permissions: they can browse Hallway and open Function Hall projects, but cannot post, comment, like, bookmark, rate, tip, submit projects, check in, redeem tokens, or use Cyber Oracle.
- Password policy for new accounts is active:
  - at least `8` characters
  - uppercase
  - lowercase
  - number
- Forum permissions are live:
  - `admin`: can post announcements, delete any post/comment
  - `teacher`: can post announcements, delete only own post/comment
  - `student`: cannot post announcements, delete only own post/comment
- Staff role badges are visible in forum UI and profile UI.
- Production role note: `eric` has already been promoted to `admin` in the database.
- Announcement posts now behave like pinned posts in the main Hallway feed.
- The Hallway beta prompt sends testers to the pinned announcement; beta feedback should be left as comments there.
- Normal posts support custom hashtags. Starter suggestions include `????`, `?????`, `????`, and `????`; `announcement` remains staff-only.
- The Dashboard has a beta test mission card linking students to Function Hall and the pinned announcement flow.
- Forum buttons now use a unified hover language, and post likes, post saves, and comment likes have small animation feedback.
- The app has in-app notifications for post likes, post saves, and comment likes. Notifications are stored in the `notifications` table, created automatically if missing.
- `Hot` ranking combines discussion, likes, saves, and recency; `Top` remains pure likes.
- Welcome/auth polish is live: landing topbar/footer version markers, fixed logged-in sidebar labels, shared particle background, hover glow CTA, and the shipped cat logo asset.
- The UI review pass for `v0.2.0-beta.6` is live: the app logo and dashboard mascot now use Eric's supplied original PNG cat assets instead of the redrawn SVG version.
- `Sailer 2D` is now served from the Static Hub: `https://hub.ericproject.xyz/projects/sailer-2d/index.html`.
- Hajimi? v1 is implemented as an independent wallet/ledger system separate from XP:
  - `users.points` remains XP only.
  - legacy `project_tips` remains historical XP tip data for analytics.
  - new Function Hall tips use H? wallet transfers through `coin_wallets`, `coin_transactions`, and `coin_project_tips`.
  - `/wallet` shows H? balance, ledger, and token redemption requests.
  - `/admin/coins` supports manual H? grants, verified-user filtering, guarded batch H? grants, and token redemption review.

## 3. Required Environment Variables

Production and Preview should have:

```env
BLOB_READ_WRITE_TOKEN=...
DASHSCOPE_API_KEY=...      # optional, powers dashboard Cyber Oracle AI reading
SILICONFLOW_API_KEY=...    # optional fallback provider for Cyber Oracle
ZENMUX_API_KEY=...         # optional, AI Tabletop-aligned Oracle provider
TOKENDANCE_API_KEY=...     # optional, requires TOKENDANCE_BASE_URL
TOKENDANCE_BASE_URL=...    # optional Tokendance OpenAI-compatible base URL
HAJIMI_VERIFICATION_PEPPER=... # recommended, hashes optional student IDs for Hajimi verification
```

Important:

- Invite codes are not required by `POST /api/auth` in the graduation ceremony mode.
- Legacy invite-code environment variables may remain set, but they are not used by the current registration flow.
- Hajimi verification is required during student/teacher registration and remains required for interactions: posting, commenting, liking, bookmarking, check-in points, project comments/ratings, project submissions, token redemption, Cyber Oracle, and leaderboard visibility. Parent/visitor roles remain read-only regardless of verification status.
- Verification `Name` means school common/preferred name, not legal name. Public pages never show Name, student ID, or subject.
- Hub projects stay open to play. Verified users submit project/new-version applications from `/functions`; admins review them at `/admin/project-submissions`. Function Hall records project opens in `project_opens` and shows Hub `???` / `???` views based on capped effective opens, verified unique players, and ratings.
- Cyber Oracle readings are counted server-side in `oracle_readings` and limited to 3 successful readings per user per day. Provider order is custom `HAJIMI_ORACLE_API_*`, then ZenMux, DashScope, SiliconFlow, and optional Tokendance; provider failures try the next configured provider, then use a server fallback and still count once a reading is returned.

## 4. Known Live Quirks

- Parent/visitor accounts intentionally cannot interact. If a parent reports that comments, ratings, saved projects, or H? features are blocked, that is expected behavior.
- Vercel "Visit" from a deployment page may open a Vercel deployment URL; the official public domain is still `https://hajimi.ericproject.xyz`.
- Local `npm run dev` can still be affected by Chinese-path issues noted in the ecosystem doc.

## 5. Beta Context

Hajimi is now at the stage where AI Club students are being invited to beta test the site. The current beta focus is:

- registration and login flow
- forum posting and comments
- image upload reliability
- Function Hall usability
- collecting product feedback from students

Eric is also using a Hallway thread as the main feedback post for beta comments.

## 6. Recommended Next Work

If no new user instruction overrides this, the most valuable next areas are:

1. make announcement comments easier for Eric/admins to triage
2. polish dashboard usefulness beyond the forum and Function Hall
3. improve onboarding for new student users
4. add stronger moderation and admin tooling if beta usage increases

Note: the beta feedback entry point is intentionally comment-based under Eric's announcement, not a separate `feedback` tag/module.

## 7. Read Before Editing

Open these first:

1. `docs/AI_CLUB_ECOSYSTEM.md`
2. `docs/SESSION_HANDOFF.md`
3. `HAJIMI_ARCHITECTURE.md`
4. `/Users/eric/Desktop/AI/AI-CLUB/AI_COORDINATION.md`
5. `git log --oneline -10`

Before ending a task, especially for restored features or high-risk areas such as H?, auth, permissions, or data changes, confirm the work is traceable in Git: committed locally at minimum, and pushed to a branch/PR before deployment. Do not leave important behavior only in a temporary worktree or uncommitted Codex window state.

## 8. Suggested Prompt For A New Window

Use this in a fresh Codex window:

```text
We are continuing the Hajimi project in /Users/eric/Desktop/AI/AI-CLUB/2_????_Student_Projects/Hajimi-Dan.

Please first read:
1. /Users/eric/Desktop/AI/AI-CLUB/2_????_Student_Projects/Hajimi-Dan/docs/AI_CLUB_ECOSYSTEM.md
2. /Users/eric/Desktop/AI/AI-CLUB/2_????_Student_Projects/Hajimi-Dan/docs/SESSION_HANDOFF.md
3. /Users/eric/Desktop/AI/AI-CLUB/2_????_Student_Projects/Hajimi-Dan/HAJIMI_ARCHITECTURE.md
4. /Users/eric/Desktop/AI/AI-CLUB/AI_COORDINATION.md
5. the recent git log

Then continue from the current state without redoing completed work.
```

## 9. Last Major Commits

- `bef4730` fix(auth): tighten role permissions and password rules
- `c873dfd` feat(forum): show staff role badges
- `5947724` feat(auth): gate registration with invite codes
- `9c3d1a5` feat(forum): add staff moderation controls
- `923b965` feat(forum): optimize image upload experience
- `c5d124b` chore(forum): tune image quotas for school scale
- `dda7dbb` feat(forum): add blob upload guardrails
- `733802d` feat(forum): store attachments in vercel blob
