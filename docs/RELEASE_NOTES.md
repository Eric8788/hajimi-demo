# Hajimi Release Notes

## Hajimi Beta v0.2.0-beta.13 · 2026-05-22

- Split Function Hall Hub Rankings into `热度榜` and `星级榜`, each with `今日 / 本周 / 本月` windows.
- Updated heat ranking to sort by verified unique players first, then star rating, effective opens, rating count, and title.
- Added a rating leaderboard sorted by cumulative star rating, with windowed play stats shown alongside each project.
- Made the ranking info tooltip change with the selected leaderboard mode.

## Hajimi Beta v0.2.0-beta.12 · 2026-05-22

- Restored Function Hall filter rows to single-line horizontal scrolling instead of wrapping category chips.

## Hajimi Beta v0.2.0-beta.11 · 2026-05-22

- Updated Hub heat ranking fallback so projects with no experience data in the selected time window are ordered by star rating first.
- Clarified the Hub ranking info tooltip with the zero-experience fallback rule.

## Hajimi Beta v0.2.0-beta.10 · 2026-05-22

- Changed Function Hall project heat ranking to prioritize verified unique players, with effective opens counted as capped 30-minute sessions.
- Added an information icon beside the Hub heat ranking title; hover or focus reveals the ranking rules.
- Updated Hub ranking cards to show players, effective opens, and star rating instead of raw open count.

## Hajimi Beta v0.2.0-beta.9 · 2026-05-21

- Restored uploaded/custom avatars in the Hall of Fame leaderboard.
- Kept Hall of Fame focused on XP daily/weekly/monthly rankings and moved Hub project heat ranking into Function Hall.
- Added project open tracking for Hub rankings, combining ratings, review count, and play activity.
- Refined Function Hall creator filters, sort hover states, submission actions, and promo carousel hover switching.
- Corrected Hub project attribution for Boxhead, Sail Dodge, and 草原梦境.

## Hajimi Beta v0.2.0-beta.8 · 2026-05-20

- Reworked the profile page editor so homepage content is edited inline on the actual profile instead of an abstract preview screen.
- Moved public profile avatar, intro, banner, and badge editing into the hero area while keeping account and verification controls in private settings.
- Added a no-change save shortcut so profile edit mode exits immediately without sending an update.
- Refined the dashboard promo carousel with Hajimi verification as the first slide and clearer manual switch controls.
- Tightened the sidebar Hajimi logo spacing.

## Hajimi Beta v0.2.0-beta.7 · 2026-05-11

- Bound `Sailer 2D` in Function Hall and the landing project data to the existing Vercel deployment:
  - `https://sailer-ashy.vercel.app/`
- Marked `Sailer 2D` as live and tagged it as `Game`, `Simulation`, and `Sailing`.

## Hajimi Beta v0.2.0-beta.6 · 2026-05-11

- Replaced the redrawn SVG Hajimi logo and dashboard mascot with the supplied original PNG assets:
  - `ChatGPT Image 2026年5月8日 17_15_07.png` for the app logo.
  - `ChatGPT Image 2026年5月8日 17_14_56.png` for the dashboard mascot/background accent.

## Hajimi Beta v0.2.0-beta.5 · 2026-05-08

- Fixed like/save burst labels so `+1` and `saved` float away and disappear automatically.
- Made post hashtag badges adapt to their text length instead of using one oversized fixed width.
- Reworked profile image cropping with direct drag repositioning, keeping only zoom plus use/cancel controls.
- Added a visible XP progress bar and updated point awards to advance stored levels automatically.
- Renamed the self profile page to `My Profile` and refreshed the Hajimi logo/dashboard mascot artwork.

## Hajimi Beta v0.2.0-beta.4 · 2026-05-08

- Added hover polish to the notification bell and made notification rows compact with single-line message truncation.
- Reworked dashboard check-in so success/error feedback stays inside the button instead of using a system alert.
- Simplified sidebar active states with local transitions, avoiding the pasted-card feel during page switching.
- Added read-only member profile pages and made forum author/comment avatars clickable for logged-in users.
- Updated app and documentation version markers for this deployment.

## Hajimi Beta v0.2.0-beta.3 · 2026-05-08

- Polished the fixed app sidebar with a narrower layout, emoji module icons, unread Hallway badges, and a new shipped cat logo asset.
- Changed Function Hall filters into a horizontal scrolling glass panel with hover feedback so dense categories no longer crowd the row.
- Improved forum cards: stable hashtag/announcement badge alignment, fixed circular avatars across responsive sizes, and rounded image attachments without gray letterbox backgrounds.
- Extended profile avatars with uploaded image crop support so students can use custom pictures.
- Simplified the login background by removing the large decorative orbs while keeping the shared blurred particle style.

## Hajimi Beta v0.2.0-beta.2 · 2026-05-07

- Refined the public welcome page with a structured topbar, version pill, footer links, and the `Built with 💜 by AI Club and Eric.` credit.
- Fixed the hero title spacing and added a dynamic glow hover state to the primary CTA.
- Updated the login page to share the welcome page's particle background, glass blur, and button hover language.
- Changed the logged-in sidebar from a floating module to a fixed left rail with aligned branding and visible module labels.
- Added simple Hajimi cat logo concept assets in `docs/design/`.

## Hajimi Beta v0.2.0-beta.1 · 2026-05-07

- Prepared the AI Club beta rollout version with centralized version labels across the app and documentation.
