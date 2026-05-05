# Hajimi - AI Club Student Community
**Master Architecture & Context Document**

*This document is written for AI Coding Assistants (or new developers) to instantly understand the project's current state, architecture, and design philosophy. Do not delete this file.*

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
- `/login` **(Auth Page):** Custom login/register page. Uses `POST /api/auth`.
- `/dashboard` **(Protected):** The user's personalized homepage. Contains:
  - **Welcome Widget:** Daily insight and Check-in button.
  - **Timeline Dancer:** Static daily schedule visualization.
  - **Cyber Oracle (`<TarotGame />`):** A client-side Tarot card drawing game.
  - **Rec Room:** Displays the absolute latest posts directly from the database.
- `/resources` **(The Hallway - Hybrid Access):** 
  - The main forum. **Guest Mode is enabled.**
  - Non-logged-in users can browse and read all posts.
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
- **`users`:** `id`, `username`, `password_hash`, `points`, `level`, `role`, `avatar`, `bio`.
- **`posts`:** `id`, `author_id`, `title`, `content`, `type`, `likes`, `created_at`.
- **`comments`:** `id`, `post_id`, `author_id`, `content`, `created_at`.

*Note: Auth sessions are stateless JWTs stored in `HttpOnly` cookies (`session`), managed in `src/lib/auth.ts`.*

## 6. Important Workflows for AI Assistants
1. **Adding a new student project:** 
   - DO NOT edit `functions/page.tsx`. 
   - Simply add the project object to the `PROJECTS` array in `src/data/projects.ts`.
2. **Modifying Authenticated Routes:**
   - Always check session via `const session = await getSession();` at the top of the Server Component.
   - Redirect to `/login` if `!session`.
   - Wrap the page in `<Shell user={user}>` to render the sidebar navigation.
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
   - Only staff can publish posts tagged `announcement`.
   - Staff can delete any post or comment; students can delete only their own posts/comments.

## 7. Known Issues & Quirks
- **Turbopack Chinese Path Bug:** Local development (`npm run dev`) sometimes panics if the absolute path contains Chinese characters (e.g., `/学生项目/`). This is a known Next.js Turbopack bug on macOS. Standard Webpack builds and Vercel cloud deployments are unaffected.
- **Vercel Auth Interception:** If deploying to a Preview URL on Vercel with Protection enabled, API routes (like `/api/auth`) might return 500/HTML due to Vercel SSO walls. Always test auth on the primary Production Domain.
