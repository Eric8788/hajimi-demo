# Hajimi - AI Club Student Community
**Master Architecture & Context Document**

*This document is written for AI Coding Assistants (or new developers) to instantly understand the project's current state, architecture, and design philosophy. Do not delete this file.*

**Current version:** Hajimi Beta v0.2.0-beta.16 · 2026-05-22

## 1. Project Overview
Hajimi is a comprehensive, gamified student community and project hub built for a high school AI Club. It serves as a forum ("The Hallway"), a personalized dashboard, and a centralized hub for all student-developed games and tools ("Function Hall").

## 2. Tech Stack
- **Framework:** Next.js (App Router, Server & Client Components)
- **Language:** TypeScript
- **Database:** Vercel Postgres (Neon) using raw SQL queries (`@vercel/postgres`). *No Prisma/ORM is used.*
- **File Storage:** Vercel Blob (`@vercel/blob`) for public forum images and Function Hall project cover screenshots. Requires `BLOB_READ_WRITE_TOKEN` in production.
- **Authentication:** Custom JWT-based session auth using `jose` and `bcryptjs`. *NextAuth/Auth.js is NOT used.*
- **Styling:** Vanilla CSS (`src/app/globals.css`) emphasizing **Glassmorphism**. *Tailwind CSS is configured but minimally used in favor of custom glass classes.*
- **Animations:** `framer-motion` (used for layout transitions, tab highlights, and grid filtering).
- **Deployment:** Vercel.

## 3. Core Architecture & Routing
The app uses Next.js App Router (`src/app/`).
- `/` **(Landing Page):** Public, SEO-friendly marketing page. Shows trending posts and generic club info.
- `/login` **(Auth Page):** Custom login/register page. Uses `POST /api/auth`. Graduation ceremony registration is open without invite codes; users choose student, teacher, parent, or visitor identity through a 3-step wizard: identity, account/verification details, then password plus optional avatar/profile. Student/teacher registration requires verification details; teacher applicants remain non-staff until admin approval.
- `/dashboard` **(Protected):** The user's personalized homepage. Contains:
  - **Welcome Widget:** Daily insight and Check-in button.
  - **Beta Test Mission:** Quick entry points for trying Function Hall and opening the pinned feedback announcement.
  - **Timeline Dancer:** Static daily schedule visualization.
  - **Cyber Oracle (`<TarotGame />`):** A Tarot reflection widget backed by `/api/oracle`, with AI Tabletop-aligned provider routing, deeper Chinese interpretation, and a 3-successful-readings-per-user-per-day limit.
  - **Live Campus Presence:** Lightweight online count and avatar stack backed by `/api/presence`.
  - **Rec Room:** Displays the absolute latest posts directly from the database.
- `/resources` **(The Hallway - Hybrid Access):** 
  - The main forum. **Guest Mode is enabled.**
  - Announcement posts behave like pinned posts in the main feed; beta feedback is collected as comments under Eric's announcement.
  - Normal posts support custom hashtags; `announcement` is the only reserved staff-only tag.
  - Non-logged-in users can browse and read all posts.
  - Registered but unverified users can browse, but cannot post, comment, like, bookmark, or earn check-in points. Parent/visitor accounts share the same read-only permissions: they can browse and open projects, but cannot participate in forum/project interactions. Interaction requires `verification_status = 'verified'` and a non-read-only role.
  - Verified, non-read-only members can follow other users from their public profile. The `Following` Hall filter only returns normal posts by followed users; it excludes the viewer's own posts and announcement posts. There is no follow-count or follow-management page in v1.
  - Post cards retain the like button and total count while showing up to three most-recent liker avatar thumbnails. These thumbnails use the shared avatar hydration path, show the liker's username on hover/focus, and link to the corresponding profile.
  - **Action Interceptor Pattern:** Clicking "Like", "Comment", "Save", "Follow", or "New Post" without permission triggers a localized login/verification prompt instead of a hard redirect. The Follow control remains visible on an active public profile, while guests and read-only/unverified accounts receive the localized block message instead of a mutation.
- `/functions` **(Function Hall - Public):** 
  - Replaces the legacy "AI Club Hub".
  - Renders a dynamic, filterable grid of student projects (Games, Tools, AI apps).
  - Hub projects are open to play for guests, unverified users, parents, and visitors.
  - Verified users can submit project/new-version applications; admins approve/reject at `/admin/project-submissions` before live Hub updates.
  - The project application form supports pasted/uploaded cover screenshots, client-side 16:9 crop adjustment, and Blob-backed cover URL storage.
  - Published project owners can start an edit from their own project card; edits are submitted as `new_version` applications and are not applied until admin approval.
  - Verified users can privately save projects into a `Saved` filter. Project saves do not award XP and do not affect public Hub rankings.
  - Verified users can tip live projects with Hajimi币 (`1 / 3 / 5 / 10` quick amounts or a custom `1-100` amount). H币 tips are wallet transfers and never change XP or level. Users cannot tip their own projects.
  - Shows Hub project `热度榜` and `星级榜`: heat ranks selected-window verified unique players first, then rating and capped effective opens; rating ranks cumulative stars first while still showing selected-window play stats.
  - Live data comes from the `projects` table. External static HTML games are hosted on the Static Hub domain (`hub.ericproject.xyz`) and linked via absolute URLs.
- `/wallet` **(Protected):**
  - Shows the user's H币 wallet balance, recent ledger entries, and token redemption requests.
  - Users can submit token redemption requests with a minimum of 50 H币. Submitted requests immediately freeze the requested H币 through a `redemption_hold` ledger entry.
- `/hasdaq` **(Public browse / Verified trading):**
  - Student simulation company exchange plus the `Hajimi Platform / HJM` official demo stock. `hasdaq_companies.company_type` is `student` by default; `official_demo` companies are shown separately, excluded from student rankings/monthly awards, and keep founder shares permanently locked.
- `/admin/coins` **(Admin):**
  - Admins manually grant H币 with a required note and source type, and review token redemption requests.
  - Approving a request marks it ready for token issuance; rejecting refunds frozen H币; completing records that token has been issued.
- `/admin/hasdaq` **(Admin):**
  - Admins review Hasdaq IPO applications, open IPO subscription, and use the checklist-backed "敲钟上市" flow.
- `/profile` **(Protected):**
  - Shows the public profile editor plus a Data Studio card after the featured content. The default overview focuses on the monthly participation heatmap; the detail view shows range tabs, KPIs, trend chart, contribution pie, project performance, and post interactions.
  - Active, verified, non-read-only members can see a target member's existing school-preferred/English verification name on the profile; verified students also show the reviewed grade. Guests, parents, visitors, unverified viewers, and disabled accounts never receive these identity fields.
  - First verified forum post awards `+100 XP`; later posts continue to use normal post XP.

## 4. Design Philosophy & CSS
The UI strictly adheres to a "Cyber Oracle / Glassmorphism" aesthetic. **Do not use flat colors or generic UI components.** 
- **Global Background:** Dynamic, shifting gradient meshes.
- **Glass Panels (`.glass-panel`, `.glass-card`):** Translucent white/transparent backgrounds (`rgba(255,255,255,0.7)`), heavy backdrop-blur (`backdrop-filter: blur(20px)`), and subtle white borders.
- **Inputs (`.glass-input`):** Semi-transparent inputs that turn solid white on focus.
- **Typography:** Google Fonts (Inter). High contrast headings with gradient text (`WebkitBackgroundClip: 'text'`).

## 5. Database Schema (`src/lib/db.ts`)
Database interactions are handled via standard SQL functions.
- **`users`:** `id`, `username`, `password_hash`, `points`, `level`, `role` (`student`, `teacher`, `admin`, `parent`, `visitor`), `avatar`, `bio`, `verification_status`, `verification_type`, `verified_name`, `verified_grade`, `verified_subject`, `student_id_hash`, `student_id_last4`, `verification_submitted_at`, `verified_at`, `verification_reviewed_by`, `verification_note`, `account_status`, `disabled_at`, `disabled_by`, `disabled_reason`.
- **`posts`:** `id`, `author_id`, `title`, `content`, `type`, `attachment_url`, `attachment_urls`, `likes`, `created_at`.
- **`comments`:** `id`, `post_id`, `author_id`, `content`, `attachment_url`, `likes`, `created_at`.
- **`post_likes` / `comment_likes` / `bookmarks`:** Forum interaction tables with `created_at`, used for notifications and leaderboard contribution windows. `post_likes` also has a `(post_id, created_at DESC, user_id DESC)` index for recent-liker feed queries.
- **`user_follows`:** `follower_id`, `following_id`, `created_at`; one-way follow relationships with a unique `(follower_id, following_id)` pair and indexes for both query directions. `initDB` (or an equivalent controlled release migration) must create this table and its indexes before production traffic; production feed reads do not run follow-table DDL.
- **`projects`:** `id`, `author_id`, `title`, `description`, `emoji`, `url`, `tags`, `accent_color`, `cover_url`, `status`, `rating`, `rating_count`, `created_at`.
- **`project_likes` / `project_comments`:** Hub ratings and comments, verified-only interaction data for project contribution rankings.
- **`project_opens`:** `id`, `project_id`, `user_id`, `opened_at`; raw play/open log. Hub rankings derive verified unique players and capped effective opens from this table.
- **`project_bookmarks`:** `user_id`, `project_id`, `created_at`; private Function Hall saved-project filter. No XP and no public ranking effect.
- **`project_tips`:** legacy Hub XP tip transfer log. Kept for historical XP analytics and windowed leaderboards only; new project tips no longer write here.
- **`coin_wallets`:** `user_id`, `balance`, `earned_total`, `spent_total`, `created_at`, `updated_at`; independent Hajimi币 wallet. Does not affect XP.
- **`coin_transactions`:** `id`, `user_id`, `amount`, `balance_after`, `type`, `source_type`, `source_id`, `counterparty_user_id`, `note`, `created_by`, `created_at`; H币 ledger for grants, tips, redemption holds, and refunds.
- **`coin_project_tips`:** `id`, `project_id`, `sender_id`, `recipient_id`, `amount`, `sender_transaction_id`, `recipient_transaction_id`, `created_at`; live H币 project tip log.
- **`coin_redemption_requests`:** `id`, `user_id`, `amount`, `status`, `requested_note`, `review_note`, `reviewed_by`, `reviewed_at`, `completed_at`, `created_at`; token redemption requests. Minimum amount is 50 H币.
- **`hasdaq_companies`:** Hasdaq company/stock records with founder, ticker, `company_type` (`student` / `official_demo`), IPO/listing status, total/founder/public shares, price, trading pool H币, listing time, and lockup metadata.
- **`hasdaq_positions` / `hasdaq_trades`:** Per-user public/locked share positions and filled IPO/buy/sell trade log. Official demo founder shares are permanently locked; ordinary public shares remain tradable.
- **`project_submissions`:** `id`, `author_id`, `submission_type`, `project_id`, `title`, `description`, `emoji`, `url`, `tags`, `accent_color`, `version_notes`, `cover_url`, `status`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`.
- **`notifications`:** `id`, `recipient_id`, `actor_id`, `type`, `post_id`, `comment_id`, `read_at`, `created_at`.
- **`user_presence`:** `user_id`, `last_seen_at`; one row per logged-in account for the approximate 5-minute online window.
- **`user_presence_daily`:** `user_id`, `presence_date`, `last_seen_at`; one row per account per calendar day, updated by the authenticated presence heartbeat. `/api/presence` returns the current online count/avatar stack and a limited “today visited” list with each member's latest login time only to logged-in users; guests receive counts only.
- **`admin_audit_events`:** `id`, `actor_id`, `target_user_id`, `target_type`, `target_id`, `event_type`, `summary`, `details`, `created_at`. Stores admin review and maintenance history for verification, project submissions, and member account changes.
- **`oracle_readings`:** `id`, `user_id`, `reading_date`, `cards`, `created_at`.

*Note: Auth sessions are stateless JWTs stored in `HttpOnly` cookies (`session`), managed in `src/lib/auth.ts`. Registration is currently open without invite codes for the graduation ceremony. Parent and visitor accounts are stored in `users.role` and remain read-only even if logged in. New registration passwords must be 8+ chars with uppercase, lowercase, and a number. Hajimi verification is required during student/teacher registration and can still be submitted from profile settings for older unverified accounts. Student-permission applicants submit Name, G7-G13 / 毕业生 identity, and optional student ID; teachers submit Name and subject. Teacher applicants are stored without staff permissions until admin approval promotes them to `teacher`. The `Name` field is school common/preferred name, not legal name. After approval, the verification name and reviewed student grade are visible only to active, verified, non-read-only Hajimi members on member profile pages; they are never included in anonymous feed, avatar, leaderboard, notification, or forum payloads. Student IDs are never stored raw; only `student_id_hash` and `student_id_last4` are saved. Set `HAJIMI_VERIFICATION_PEPPER` in production to stabilize student ID hashing across deployments.*

## 6. Important Workflows for AI Assistants
1. **Adding or updating a student project:**
   - Prefer the Hub application flow: verified user submits from `/functions`, admin approves at `/admin/project-submissions`.
   - Do not let students directly self-publish live Hub rows. Manual database edits are admin-only maintenance.
2. **Modifying Authenticated Routes:**
   - Always check session via `const session = await getSession();` at the top of the Server Component.
   - Redirect to `/login` if `!session`.
   - Wrap the page in `<Shell user={user}>` to render the sidebar navigation.
   - Keep the `student` / `teacher` / `parent` / `visitor` registration identities and read-only guardrails in `src/lib/access.ts` aligned with API checks.
3. **Adding new APIs:**
   - Put them in `src/app/api/.../route.ts`. 
   - Parse session cookies securely using `getSession()`.
   - `/api/follows` supports `GET` follow status, `POST` follow, and `DELETE` unfollow. Only verified, non-read-only members can mutate relationships; a new follow creates a `user_follow` notification.
4. **Handling forum and project cover attachments:**
   - Use Vercel Blob for uploads; do not write to `public/uploads` or any local filesystem path.
   - Forum posts can store up to 3 public Blob URLs in `posts.attachment_urls`; the first URL is mirrored in legacy `posts.attachment_url` for compatibility.
   - Forum comments can store one optional public Blob URL in `comments.attachment_url`.
   - Accept only JPEG/PNG/WebP/GIF images, 1 MB max per image, 5 image uploads per user per rolling 24 hours, 30 total image uploads per user.
   - The forum composer auto-compresses oversized JPEG/PNG/WebP files to WebP before upload; oversized animated GIFs are rejected because compression would remove animation.
   - Delete associated Blobs when a post or image comment is deleted. Use `npm run blob:cleanup` to find orphaned forum blobs and `npm run blob:cleanup -- --delete` to remove them.
   - Function Hall project covers upload through `POST /api/project-submissions/cover`; the browser crops screenshots to 16:9 WebP before upload, and the resulting URL is stored on `project_submissions.cover_url` for review/approval.
5. **Forum comments:**
   - The Hallway post list returns `recent_comments` (the latest three comments ordered by `created_at DESC, id DESC`) and `hot_comment_id`. There is no standalone featured-comment card.
   - `hot_comment_id` is selected by comment likes, then direct reply count, then creation time, then comment ID. The UI marks only that comment row with a small fire icon.
   - `GET /api/posts/interact?postId=...&page=1&limit=10` returns the latest-first page, `page`, `limit`, `total`, `totalPages`, and `hasMore`. `commentId` can be added to calculate and return the page containing a notification target.
   - `PostCard` shows the latest three comments before expansion. Expanding loads ten comments per page and keeps comment likes, replies, deletion, avatar/profile navigation, and image viewing on the same comment row. A missing notification target is shown as a non-fatal state.
   - Comment pagination is a read/query behavior only. Do not change the database schema, reorder existing comment IDs, or add a migration for it.
   - The Hall feed also supports `/api/posts?filter=following`; this requires a verified, non-read-only session and excludes the viewer's own posts and announcements. Post list responses include `recent_likers` (up to three users ordered by recent `post_likes.created_at`).
6. **Forum moderation:**
   - `users.role` controls staff capabilities. `teacher` and `admin` are staff roles.
   - `teacher` and `admin` can publish posts tagged `announcement`; these are shown first in the unfiltered Hallway feed.
   - Only `admin` can delete any post or comment; teachers and students can delete only their own posts/comments.
   - Staff roles are visually marked with badges on posts, comments, and profile pages.
   - Hajimi verified accounts receive a compact verified badge and can create posts/interact/submit Hub applications. The main leaderboard only includes verified accounts and supports XP total/day/week/month views. Hub project rankings live in Function Hall and use verified unique players, capped effective opens, and project ratings across heat/rating modes.
   - Admins review pending verification requests at `/admin/verifications`. Verification names and reviewed student grades may appear only in the member-only profile view described above; subjects and student ID metadata remain admin-only and all identity fields stay out of public/anonymous forum payloads.
   - Admins can access `/admin` and `/admin/users` to view review history, maintain member verification details, and disable/restore accounts. Sensitive identity fields are shown only in admin-only detail views. Full student IDs are never stored or displayed; updating a student ID means entering a new value server-side, hashing it, and retaining only the hash plus last four characters.
7. **Hashtag and beta feedback workflow:**
   - Students can create posts with custom hashtags. Suggested examples include `升学雷达`, `课程补给站`, `健身广场`, and `情感树洞`.
   - Beta feedback should be left as comments under the pinned announcement post, not as a separate feedback module.
8. **Ranking and notifications:**
   - `Hot` combines comments, likes, bookmarks, and recency. `Top` is strictly most-liked.
   - Post likes, post bookmarks, and comment likes create in-app notifications for the author.
   - New follows create `user_follow` notifications. Clicking one marks the notification through the existing notification flow and returns to the recipient's own `/profile` route; unfollows do not notify.
9. **Online presence:**
   - Presence is lightweight HTTP polling, not WebSocket-based. Logged-in clients POST `/api/presence` roughly every 90 seconds while visible; hidden tabs pause until visible again.
   - Online membership is approximate and expires after 5 minutes. The daily table stores only the latest heartbeat per account/date so members can see who has visited today and their last online time. Do not expose member lists to guests or private verification fields through presence payloads.

## 7. Known Issues & Quirks
- **Turbopack Chinese Path Bug:** Local development (`npm run dev`) sometimes panics if the absolute path contains Chinese characters (e.g., `/学生项目/`). This is a known Next.js Turbopack bug on macOS. Standard Webpack builds and Vercel cloud deployments are unaffected.
- **Vercel Auth Interception:** If deploying to a Preview URL on Vercel with Protection enabled, API routes (like `/api/auth`) might return 500/HTML due to Vercel SSO walls. Always test auth on the primary Production Domain.
