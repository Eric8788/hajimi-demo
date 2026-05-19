# Hajimi - AI Club Student Community
**Master Architecture & Context Document**

*This document is written for AI Coding Assistants (or new developers) to instantly understand the project's current state, architecture, and design philosophy. Do not delete this file.*

**Current version:** Hajimi Beta v0.2.0-beta.7 · 2026-05-11

## 1. Project Overview
Hajimi is a comprehensive, gamified student community and project hub built for a high school AI Club. It serves as a forum ("The Hallway"), a personalized dashboard, and a centralized hub for all student-developed games and tools ("Function Hall").

## 2. Tech Stack
- **Framework:** Next.js (App Router, Server & Client Components)
- **Language:** TypeScript
- **Database:** Vercel Postgres (Neon) using raw SQL queries (`@vercel/postgres`). *No Prisma/ORM is used.*
- **File Storage:** Vercel Blob (`@vercel/blob`) for public forum images. Requires `BLOB_READ_WRITE_TOKEN` in production.
- **Authentication:** Custom JWT-based session auth using `jose` and `bcryptjs`. *NextAuth/Auth.js is NOT used.*
- **Styling:** Vanilla CSS (`src/app/globals.css`) emphasizing **Glassmorphism**. *Tailwind CSS is configured but minimally used in favor of custom glass classes.*
- **Animations:** `framer-motion` (used for layout transitions, tab highlights, and grid filtering).
- **Deployment:** Vercel.

## 3. Core Architecture & Routing
The app uses Next.js App Router (`src/app/`).
- `/` **(Landing Page):** Public, SEO-friendly marketing page. Shows trending posts and generic club info.
- `/login` **(Auth Page):** Custom login/register page. Uses `POST /api/auth`. Registration requires an invite code.
- `/dashboard` **(Protected):** The user's personalized homepage. Contains:
  - **Welcome Widget:** Daily insight and Check-in button.
  - **Beta Test Mission:** Quick entry points for trying Function Hall and opening the pinned feedback announcement.
  - **Timeline Dancer:** Static daily schedule visualization.
  - **Cyber Oracle (`<TarotGame />`):** A Tarot reflection widget backed by `/api/oracle`, with deeper Chinese interpretation and a 3-successful-readings-per-user-per-day limit.
  - **Rec Room:** Displays the absolute latest posts directly from the database.
- `/resources` **(The Hallway - Hybrid Access):** 
  - The main forum. **Guest Mode is enabled.**
  - Announcement posts behave like pinned posts in the main feed; beta feedback is collected as comments under Eric's announcement.
  - Normal posts support custom hashtags; `announcement` is the only reserved staff-only tag.
  - Non-logged-in users can browse and read all posts.
  - Logged-in users can comment, like, bookmark, and browse before verification. Creating posts requires `verification_status = 'verified'`.
  - **Action Interceptor Pattern:** Clicking "Like", "Comment", or "New Post" without a session triggers a localized Login Modal instead of a hard redirect.
- `/functions` **(Function Hall - Public):** 
  - Replaces the legacy "AI Club Hub".
  - Renders a dynamic, filterable grid of student projects (Games, Tools, AI apps).
  - Data is driven by `src/data/projects.ts`. External static HTML games are hosted on the Static Hub domain (`hub.ericproject.xyz`) and linked via absolute URLs.

## 4. Design Philosophy & CSS
The UI strictly adheres to a "Cyber Oracle / Glassmorphism" aesthetic. **Do not use flat colors or generic UI components.** 
- **Global Background:** Dynamic, shifting gradient meshes.
- **Glass Panels (`.glass-panel`, `.glass-card`):** Translucent white/transparent backgrounds (`rgba(255,255,255,0.7)`), heavy backdrop-blur (`backdrop-filter: blur(20px)`), and subtle white borders.
- **Inputs (`.glass-input`):** Semi-transparent inputs that turn solid white on focus.
- **Typography:** Google Fonts (Inter). High contrast headings with gradient text (`WebkitBackgroundClip: 'text'`).

## 5. Database Schema (`src/lib/db.ts`)
Database interactions are handled via standard SQL functions.
- **`users`:** `id`, `username`, `password_hash`, `points`, `level`, `role`, `avatar`, `bio`, `verification_status`, `verification_type`, `verified_name`, `verified_grade`, `verified_subject`, `student_id_hash`, `student_id_last4`, `verification_submitted_at`, `verified_at`, `verification_reviewed_by`, `verification_note`.
- **`posts`:** `id`, `author_id`, `title`, `content`, `type`, `likes`, `created_at`.
- **`comments`:** `id`, `post_id`, `author_id`, `content`, `created_at`.
- **`notifications`:** `id`, `recipient_id`, `actor_id`, `type`, `post_id`, `comment_id`, `read_at`, `created_at`.
- **`oracle_readings`:** `id`, `user_id`, `reading_date`, `cards`, `created_at`.

*Note: Auth sessions are stateless JWTs stored in `HttpOnly` cookies (`session`), managed in `src/lib/auth.ts`. Registration is invite-gated through `HAJIMI_STUDENT_INVITE_CODE` and optional `HAJIMI_TEACHER_INVITE_CODE`. Invite codes are set in Vercel environment variables and shared manually. If neither invite code is configured, registration is closed but existing logins still work. New registration passwords must be 8+ chars with uppercase, lowercase, and a number. Hajimi verification uses optional registration/profile forms and admin review. Student IDs are never stored raw; only `student_id_hash` and `student_id_last4` are saved. Set `HAJIMI_VERIFICATION_PEPPER` in production to stabilize student ID hashing across deployments.*

## 6. Important Workflows for AI Assistants
1. **Adding a new student project:** 
   - DO NOT edit `functions/page.tsx`. 
   - Simply add the project object to the `PROJECTS` array in `src/data/projects.ts`.
2. **Modifying Authenticated Routes:**
   - Always check session via `const session = await getSession();` at the top of the Server Component.
   - Redirect to `/login` if `!session`.
   - Wrap the page in `<Shell user={user}>` to render the sidebar navigation.
   - Do not bypass invite-gated registration in `src/app/api/auth/route.ts`.
3. **Adding new APIs:**
   - Put them in `src/app/api/.../route.ts`. 
   - Parse session cookies securely using `getSession()`.
4. **Handling forum attachments:**
   - Use Vercel Blob for uploads; do not write to `public/uploads` or any local filesystem path.
   - Store only the public Blob URL in `posts.attachment_url`.
   - Accept only JPEG/PNG/WebP/GIF images, 1 MB max per image, 5 image uploads per user per rolling 24 hours, 30 total image uploads per user.
   - The forum composer auto-compresses oversized JPEG/PNG/WebP files to WebP before upload; oversized animated GIFs are rejected because compression would remove animation.
   - Delete the associated Blob when a post is deleted. Use `npm run blob:cleanup` to find orphaned forum blobs and `npm run blob:cleanup -- --delete` to remove them.
5. **Forum moderation:**
   - `users.role` controls staff capabilities. `teacher` and `admin` are staff roles.
   - `teacher` and `admin` can publish posts tagged `announcement`; these are shown first in the unfiltered Hallway feed.
   - Only `admin` can delete any post or comment; teachers and students can delete only their own posts/comments.
   - Staff roles are visually marked with badges on posts, comments, and profile pages.
   - Hajimi verified accounts receive a compact verified badge and can create posts. The leaderboard only includes verified accounts.
   - Admins review pending verification requests at `/admin/verifications`. Real names, subjects, and student ID metadata must stay out of public profile/forum UI.
6. **Hashtag and beta feedback workflow:**
   - Students can create posts with custom hashtags. Suggested examples include `升学雷达`, `课程补给站`, `健身广场`, and `情感树洞`.
   - Beta feedback should be left as comments under the pinned announcement post, not as a separate feedback module.
7. **Ranking and notifications:**
   - `Hot` combines comments, likes, bookmarks, and recency. `Top` is strictly most-liked.
   - Post likes, post bookmarks, and comment likes create in-app notifications for the author.

## 7. Known Issues & Quirks
- **Turbopack Chinese Path Bug:** Local development (`npm run dev`) sometimes panics if the absolute path contains Chinese characters (e.g., `/学生项目/`). This is a known Next.js Turbopack bug on macOS. Standard Webpack builds and Vercel cloud deployments are unaffected.
- **Vercel Auth Interception:** If deploying to a Preview URL on Vercel with Protection enabled, API routes (like `/api/auth`) might return 500/HTML due to Vercel SSO walls. Always test auth on the primary Production Domain.
