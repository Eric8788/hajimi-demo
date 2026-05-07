# Hajimi Session Handoff

*Last updated: 2026-05-07 (Asia/Shanghai)*

**Current version:** Hajimi Beta v0.2.0-beta.2 · 2026-05-07

This file is the fast handoff note for any new AI window or fallback agent. Read this after `docs/AI_CLUB_ECOSYSTEM.md` and before making changes.

## 1. Current Status

- **Repo:** `hajimi-demo`
- **Directory:** `2_学生项目_Student_Projects/Hajimi-Dan`
- **Primary domain:** `https://hajimi.ericproject.xyz`
- **Static hub domain:** `https://hub.ericproject.xyz`
- **Current phase:** Hajimi beta rollout for AI Club internal testing
- **Current version:** Hajimi Beta v0.2.0-beta.2
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
- Registration is invite-gated.
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
- Normal posts support custom hashtags. Starter suggestions include `升学雷达`, `课程补给站`, `健身广场`, and `情感树洞`; `announcement` remains staff-only.
- The Dashboard has a beta test mission card linking students to Function Hall and the pinned announcement flow.
- Forum buttons now use a unified hover language, and post likes, post saves, and comment likes have small animation feedback.
- The app has in-app notifications for post likes, post saves, and comment likes. Notifications are stored in the `notifications` table, created automatically if missing.
- `Hot` ranking combines discussion, likes, saves, and recency; `Top` remains pure likes.
- Welcome/auth polish is live: landing topbar/footer version markers, fixed logged-in sidebar labels, shared particle background, hover glow CTA, and logo concept assets under `docs/design/`.

## 3. Required Environment Variables

Production and Preview should have:

```env
BLOB_READ_WRITE_TOKEN=...
HAJIMI_STUDENT_INVITE_CODE=...
HAJIMI_TEACHER_INVITE_CODE=...
```

Important:

- Invite codes are compared as exact strings.
- The code must be in the Vercel variable `Value`, not in `Note`.
- After changing invite codes, redeploy Production before testing registration again.

## 4. Known Live Quirks

- Vercel's environment variable UI is easy to misread. Users often put the invite code in `Note` instead of `Value`.
- `Invalid invite code` usually means one of these:
  - the typed code does not exactly match the configured code
  - the code was changed but Production was not redeployed yet
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

## 8. Suggested Prompt For A New Window

Use this in a fresh Codex window:

```text
We are continuing the Hajimi project in /Users/eric/Desktop/AI/AI-CLUB/2_学生项目_Student_Projects/Hajimi-Dan.

Please first read:
1. /Users/eric/Desktop/AI/AI-CLUB/2_学生项目_Student_Projects/Hajimi-Dan/docs/AI_CLUB_ECOSYSTEM.md
2. /Users/eric/Desktop/AI/AI-CLUB/2_学生项目_Student_Projects/Hajimi-Dan/docs/SESSION_HANDOFF.md
3. /Users/eric/Desktop/AI/AI-CLUB/2_学生项目_Student_Projects/Hajimi-Dan/HAJIMI_ARCHITECTURE.md
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
