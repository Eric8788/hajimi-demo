import { db, sql } from '@vercel/postgres';
import type { VerificationStatus, VerificationType, VerificationDraft } from './verification';
import { isAvatarThemeId, normalizeAvatarEmoji, pickRandomAvatarThemeId } from './avatarThemes';

// --- Interfaces ---

export interface User {
    id: number;
    username: string;
    points: number;
    level: number;
    role: string;
    password_hash?: string;
    bio?: string;
    avatar?: string;
    avatar_emoji?: string;
    avatar_theme?: string;
    profile_image?: string;
    grade?: string;
    age?: number;
    ethnicity?: string;
    is_creator?: boolean;
    badge_preferences?: string[] | null;
    verification_status?: VerificationStatus;
    verification_type?: VerificationType | null;
    streak_count: number;
    last_checkin_at?: string;
    daily_likes_count: number;
    last_like_at?: string;
    created_at: string;
}

export type LeaderboardWindow = 'all' | 'day' | 'week' | 'month';
export type LeaderboardCategory = 'all' | 'community' | 'project';

export interface VerificationRequest {
    id: number;
    username: string;
    role: string;
    avatar?: string;
    avatar_emoji?: string | null;
    avatar_theme?: string | null;
    verification_status: VerificationStatus;
    verification_type: VerificationType | null;
    verified_name: string | null;
    verified_grade: string | null;
    verified_subject: string | null;
    student_id_last4: string | null;
    has_verified_student_id_conflict: boolean;
    has_name_identity_conflict: boolean;
    verification_submitted_at?: string;
    verified_at?: string;
    verification_note?: string;
}

export interface Project {
    id: number;
    author_id: number;
    author_name?: string;
    title: string;
    description: string;
    emoji: string;
    url: string | null;
    tags: string[];
    accent_color: string;
    status: 'live' | 'coming_soon';
    likes: number; // Keeping for backward compatibility temporarily if needed
    rating: number;
    rating_count: number;
    user_score?: number; // Score given by the current user, fetched dynamically
    open_count_today?: number;
    open_count_week?: number;
    open_count_month?: number;
    open_count_total?: number;
    unique_open_count_today?: number;
    unique_open_count_week?: number;
    unique_open_count_month?: number;
    unique_open_count_total?: number;
    effective_open_count_today?: number;
    effective_open_count_week?: number;
    effective_open_count_month?: number;
    effective_open_count_total?: number;
    hub_score?: number;
    created_at: string;
}

export interface ProjectComment {
    id: number;
    project_id: number;
    author_id: number;
    author_name?: string;
    author_avatar?: string;
    author_avatar_theme?: string | null;
    content: string;
    created_at: string;
}

export type ProjectSubmissionType = 'new_project' | 'new_version';
export type ProjectSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ProjectSubmission {
    id: number;
    author_id: number;
    author_name?: string;
    submission_type: ProjectSubmissionType;
    project_id: number | null;
    project_title?: string | null;
    title: string;
    description: string;
    emoji: string;
    url: string | null;
    tags: string[];
    accent_color: string;
    version_notes: string | null;
    cover_url: string | null;
    status: ProjectSubmissionStatus;
    reviewed_by: number | null;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
}

export type ProjectSubmissionInput = {
    author_id: number;
    submission_type: ProjectSubmissionType;
    project_id?: number | null;
    title: string;
    description: string;
    emoji: string;
    url?: string | null;
    tags: string[];
    accent_color?: string | null;
    version_notes?: string | null;
    cover_url?: string | null;
};

export interface Post {
    id: number;
    author_id: number;
    title: string;
    content: string;
    type: string;
    tag: string;
    attachment_url?: string;
    likes: number;
    created_at: Date;
    updated_at?: Date;
    author_name?: string;
    author_avatar?: string;
    author_avatar_theme?: string | null;
    author_role?: string;
    author_is_creator?: boolean;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
    comment_count?: number;
    is_bookmarked?: boolean;
    has_liked?: boolean;
}

export interface Comment {
    id: number;
    post_id: number;
    author_id: number;
    content: string;
    likes: number;
    created_at: Date;
    parent_comment_id?: number | null;
    reply_author_name?: string | null;
    reply_content?: string | null;
    author_name?: string;
    author_avatar?: string;
    author_avatar_theme?: string | null;
    author_role?: string;
    author_is_creator?: boolean;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
    has_liked?: boolean;
}

export interface Notification {
    id: number;
    recipient_id: number;
    actor_id: number;
    type: 'post_like' | 'post_bookmark' | 'comment_like';
    post_id?: number | null;
    comment_id?: number | null;
    read_at?: Date | null;
    created_at: Date;
    actor_name?: string;
    actor_avatar?: string;
    actor_avatar_theme?: string | null;
    post_title?: string;
}

// --- User Helpers ---

let userProfileEnhancementsReady: Promise<void> | null = null;

async function ensureUserProfileEnhancements() {
    if (!userProfileEnhancementsReady) {
        userProfileEnhancementsReady = (async () => {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_preferences JSONB DEFAULT '[]'::jsonb`;
            await sql`ALTER TABLE users ALTER COLUMN badge_preferences TYPE JSONB USING COALESCE(to_jsonb(badge_preferences), '[]'::jsonb)`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '😊'`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_theme TEXT DEFAULT 'lavender'`;
            await sql`UPDATE users SET bio = 'New member at Hajimi High!' WHERE bio = 'New student at Hajimi High!'`;
            await ensureVerificationColumns();
        })().catch(error => {
            userProfileEnhancementsReady = null;
            throw error;
        });
    }

    return userProfileEnhancementsReady;
}

async function ensureVerificationColumns() {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_type TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_name TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_grade TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_subject TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_hash TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_last4 TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reviewed_by INTEGER`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_note TEXT`;
    await sql`UPDATE users SET verification_status = 'verified', verification_type = COALESCE(verification_type, CASE WHEN role = 'teacher' THEN 'teacher' ELSE 'student' END), verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP) WHERE lower(username) = 'eric' AND verification_status IS DISTINCT FROM 'verified'`;
    await sql`UPDATE users SET verification_status = 'unverified' WHERE verification_status IS NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_student_id_hash ON users(student_id_hash) WHERE student_id_hash IS NOT NULL`;
}

export async function getUser(username: string) {
    await ensureUserProfileEnhancements();

    const { rows } = await sql<User>`
      SELECT
        id, username, password_hash, points, level, role, bio, avatar, avatar_emoji, avatar_theme, profile_image,
        grade, age, ethnicity, badge_preferences, verification_status, verification_type,
        streak_count, last_checkin_at, daily_likes_count, last_like_at, created_at
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;
    return rows[0];
}

export async function getUserById(id: number): Promise<User | null> {
    await ensureUserProfileEnhancements();

    const { rows } = await sql<User>`
      SELECT
        users.id,
        users.username,
        users.points,
        users.level,
        users.role,
        users.bio,
        users.avatar,
        users.avatar_emoji,
        users.avatar_theme,
        users.profile_image,
        users.grade,
        users.age,
        users.ethnicity,
        users.badge_preferences,
        users.verification_status,
        users.verification_type,
        users.streak_count,
        users.last_checkin_at,
        users.daily_likes_count,
        users.last_like_at,
        users.created_at,
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM users 
      WHERE id = ${id} 
      LIMIT 1
    `;
    return rows[0] || null;
}

export async function createUser(
    username: string,
    passwordHash: string,
    role = 'student',
    verification?: VerificationDraft | null,
    avatar?: { emoji?: string | null; theme?: string | null } | null,
    profile?: { bio?: string | null } | null
) {
    await ensureUserProfileEnhancements();
    const avatarEmoji = normalizeAvatarEmoji(avatar?.emoji || undefined);
    const avatarTheme = avatar?.theme && isAvatarThemeId(avatar.theme) ? avatar.theme : pickRandomAvatarThemeId();
    const bio = String(profile?.bio || '').trim().slice(0, 180) || 'New member at Hajimi High!';

    // Use RETURNING id to get the ID immediately
    const { rows } = await sql`
    INSERT INTO users (
      username,
      password_hash,
      points,
      role,
      bio,
      avatar,
      avatar_emoji,
      avatar_theme,
      verification_status,
      verification_type,
      verified_name,
      verified_grade,
      verified_subject,
      student_id_hash,
      student_id_last4,
      verification_submitted_at
    )
    VALUES (
      ${username},
      ${passwordHash},
      0,
      ${role},
      ${bio},
      ${avatarEmoji},
      ${avatarEmoji},
      ${avatarTheme},
      ${verification ? 'pending' : 'unverified'},
      ${verification?.verification_type ?? null},
      ${verification?.verified_name ?? null},
      ${verification?.verified_grade ?? null},
      ${verification?.verified_subject ?? null},
      ${verification?.student_id_hash ?? null},
      ${verification?.student_id_last4 ?? null},
      ${verification ? new Date().toISOString() : null}
    )
    RETURNING id
  `;
    return rows[0].id;
}

export async function submitUserVerification(userId: number, verification: VerificationDraft) {
    await ensureUserProfileEnhancements();

    await sql`
      UPDATE users
      SET
        verification_status = 'pending',
        verification_type = ${verification.verification_type},
        verified_name = ${verification.verified_name},
        verified_grade = ${verification.verified_grade},
        verified_subject = ${verification.verified_subject},
        student_id_hash = ${verification.student_id_hash},
        student_id_last4 = ${verification.student_id_last4},
        verification_submitted_at = CURRENT_TIMESTAMP,
        verified_at = NULL,
        verification_reviewed_by = NULL,
        verification_note = NULL
      WHERE id = ${userId}
    `;
}

export async function getPendingVerificationRequests(): Promise<VerificationRequest[]> {
    await ensureUserProfileEnhancements();

    const { rows } = await sql<VerificationRequest>`
      SELECT
        users.id,
        users.username,
        users.role,
        users.avatar,
        users.verification_status,
        users.verification_type,
        users.verified_name,
        users.verified_grade,
        users.verified_subject,
        users.student_id_last4,
        users.verification_submitted_at,
        users.verified_at,
        users.verification_note,
        CASE
          WHEN users.student_id_hash IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM users verified_users
            WHERE verified_users.student_id_hash = users.student_id_hash
              AND verified_users.verification_status = 'verified'
              AND verified_users.id != users.id
            )
        END as has_verified_student_id_conflict
        ,
        CASE
          WHEN users.verified_name IS NULL OR btrim(users.verified_name) = '' THEN false
          WHEN users.verification_type = 'student' THEN EXISTS (
            SELECT 1
            FROM users possible_matches
            WHERE possible_matches.id != users.id
              AND possible_matches.verification_type = 'student'
              AND possible_matches.verification_status IN ('pending', 'verified')
              AND lower(btrim(possible_matches.verified_name)) = lower(btrim(users.verified_name))
              AND possible_matches.verified_grade IS NOT DISTINCT FROM users.verified_grade
          )
          WHEN users.verification_type = 'teacher' THEN EXISTS (
            SELECT 1
            FROM users possible_matches
            WHERE possible_matches.id != users.id
              AND possible_matches.verification_type = 'teacher'
              AND possible_matches.verification_status IN ('pending', 'verified')
              AND lower(btrim(possible_matches.verified_name)) = lower(btrim(users.verified_name))
              AND lower(btrim(COALESCE(possible_matches.verified_subject, ''))) = lower(btrim(COALESCE(users.verified_subject, '')))
          )
          ELSE false
        END as has_name_identity_conflict
      FROM users
      WHERE users.verification_status = 'pending'
      ORDER BY users.verification_submitted_at ASC NULLS LAST, users.id ASC
    `;

    return rows;
}

export async function reviewUserVerification(targetUserId: number, reviewerId: number, status: 'verified' | 'rejected', note = '') {
    await ensureUserProfileEnhancements();

    if (status === 'verified') {
        const { rows: conflictRows } = await sql<{ has_conflict: boolean }>`
          SELECT CASE
            WHEN target.student_id_hash IS NULL THEN false
            ELSE EXISTS (
              SELECT 1
              FROM users verified_users
              WHERE verified_users.student_id_hash = target.student_id_hash
                AND verified_users.verification_status = 'verified'
                AND verified_users.id != target.id
            )
          END as has_conflict
          FROM users target
          WHERE target.id = ${targetUserId}
          LIMIT 1
        `;

        if (conflictRows[0]?.has_conflict) {
            throw new Error('Student ID already verified');
        }
    }

    await sql`
      UPDATE users
      SET
        verification_status = ${status},
        role = CASE
          WHEN ${status} = 'verified' AND role != 'admin' AND verification_type = 'teacher' THEN 'teacher'
          WHEN ${status} = 'verified' AND role != 'admin' AND verification_type = 'student' THEN 'student'
          ELSE role
        END,
        verified_at = CASE WHEN ${status} = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
        verification_reviewed_by = ${reviewerId},
        verification_note = ${note.trim() || null}
      WHERE id = ${targetUserId}
        AND verification_status = 'pending'
    `;
}

export async function updateUserProfile(id: number, updates: { bio?: string; avatar?: string; avatar_emoji?: string; avatar_theme?: string; profile_image?: string; badge_preferences?: string[] }) {
    await ensureUserProfileEnhancements();

    const badgePreferencesJson = Array.isArray(updates.badge_preferences) ? JSON.stringify(updates.badge_preferences) : null;

    // Construct dynamic query carefully or just update all fields?
    // Updating individually is safer with COALESCE but sql template tag needs careful handling for dynamic columns.
    // Easiest verified way: use separate updates or smart COALESCE with all params passed.
    await sql`
    UPDATE users 
    SET 
      bio = COALESCE(${updates.bio ?? null}, bio), 
      avatar = COALESCE(${updates.avatar ?? null}, avatar), 
      avatar_emoji = COALESCE(${updates.avatar_emoji ?? updates.avatar ?? null}, avatar_emoji),
      avatar_theme = COALESCE(${updates.avatar_theme ?? null}, avatar_theme),
      profile_image = COALESCE(${updates.profile_image ?? null}, profile_image),
      badge_preferences = COALESCE(${badgePreferencesJson}::jsonb, badge_preferences)
    WHERE id = ${id}
  `;
}

export async function updateUserAuth(id: number, updates: { username?: string; passwordHash?: string }) {
    if (updates.username) {
        // Check if username already exists
        const { rows } = await sql`SELECT id FROM users WHERE username = ${updates.username} AND id != ${id} LIMIT 1`;
        if (rows[0]) throw new Error('Username already taken');
    }

    await sql`
    UPDATE users 
    SET 
      username = COALESCE(${updates.username ?? null}, username), 
      password_hash = COALESCE(${updates.passwordHash ?? null}, password_hash)
    WHERE id = ${id}
  `;
}

export async function deleteUser(id: number) {
    // Manual cleanup since ON DELETE CASCADE might not be set for all
    await sql`DELETE FROM notifications WHERE recipient_id = ${id} OR actor_id = ${id}`;
    await sql`DELETE FROM comment_likes WHERE user_id = ${id}`;
    await sql`DELETE FROM post_likes WHERE user_id = ${id}`;
    await sql`DELETE FROM bookmarks WHERE user_id = ${id}`;
    await sql`DELETE FROM comments WHERE author_id = ${id}`;
    
    // For posts, we also need to delete associated comments and likes
    const { rows: postRows } = await sql`SELECT id FROM posts WHERE author_id = ${id}`;
    for (const post of postRows) {
        await sql`DELETE FROM comments WHERE post_id = ${post.id}`;
        await sql`DELETE FROM post_likes WHERE post_id = ${post.id}`;
        await sql`DELETE FROM bookmarks WHERE post_id = ${post.id}`;
    }
    await sql`DELETE FROM posts WHERE author_id = ${id}`;
    await sql`DELETE FROM checkins WHERE user_id = ${id}`;
    
    // Finally delete user
    await sql`DELETE FROM users WHERE id = ${id}`;
}

export async function addPoints(userId: number, amount: number) {
    // New Quadratic Leveling: Level = floor(sqrt(points / 50)) + 1
    // L1: 0, L2: 50, L3: 200, L4: 450, L5: 800, L10: 4050
    await sql`
    UPDATE users
    SET
      points = points + ${amount},
      level = GREATEST(level, FLOOR(SQRT((points + ${amount}) / 50.0))::int + 1)
    WHERE id = ${userId}
  `;
}

let pointAwardsTableReady: Promise<void> | null = null;

async function ensurePointAwardsTable() {
    if (!pointAwardsTableReady) {
        pointAwardsTableReady = sql`
          CREATE TABLE IF NOT EXISTS point_awards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            award_key TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, award_key)
          );
        `.then(() => undefined).catch(error => {
            pointAwardsTableReady = null;
            throw error;
        });
    }

    return pointAwardsTableReady;
}

async function addAwardPointsOnce(userId: number, awardKey: string, amount: number) {
    await ensurePointAwardsTable();

    const { rows } = await sql<{ id: number }>`
      INSERT INTO point_awards (user_id, award_key, amount)
      VALUES (${userId}, ${awardKey}, ${amount})
      ON CONFLICT (user_id, award_key) DO NOTHING
      RETURNING id
    `;

    if (rows[0]) {
        await addPoints(userId, amount);
        return true;
    }

    return false;
}

// --- Check-in Helpers ---

export async function hasCheckedInToday(userId: number) {
    // Postgres date comparison
    const { rows } = await sql`
    SELECT id FROM checkins 
    WHERE user_id = ${userId} 
    AND checkin_date = CURRENT_DATE
  `;
    return !!rows[0];
}

export async function doCheckIn(userId: number) {
    try {
        // Get current streak and last checkin
        const { rows: userRows } = await sql`SELECT streak_count, last_checkin_at FROM users WHERE id = ${userId}`;
        const user = userRows[0];
        
        let newStreak = 1;
        if (user && user.last_checkin_at) {
            const lastCheckin = new Date(user.last_checkin_at);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Check if last checkin was yesterday (ignoring time)
            const isYesterday = lastCheckin.toDateString() === yesterday.toDateString();
            if (isYesterday) {
                newStreak = (user.streak_count || 0) + 1;
            }
        }

        await sql`
          INSERT INTO checkins (user_id, checkin_date) 
          VALUES (${userId}, CURRENT_DATE)
        `;
        
        // Update user streak and points
        // Rewards: 1-2 days: 10XP, 3-6 days: 15XP, 7+ days: 25XP
        let bonusXp = 10;
        if (newStreak >= 7) bonusXp = 25;
        else if (newStreak >= 3) bonusXp = 15;

        await sql`
          UPDATE users 
          SET streak_count = ${newStreak}, last_checkin_at = CURRENT_TIMESTAMP
          WHERE id = ${userId}
        `;
        
        await addPoints(userId, bonusXp);
        return { success: true, pointsAdded: bonusXp, streak: newStreak };
    } catch (error) {
        console.error("Checkin Error:", error);
        return { success: false };
    }
}

// --- Forum Helpers ---

let forumEnhancementsReady: Promise<void> | null = null;
let bookmarksTableReady: Promise<void> | null = null;

async function ensureForumEnhancements() {
    if (!forumEnhancementsReady) {
        forumEnhancementsReady = (async () => {
            await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL`;
            await ensureBookmarksTable();
        })().catch(error => {
            forumEnhancementsReady = null;
            throw error;
        });
    }

    return forumEnhancementsReady;
}

async function ensureBookmarksTable() {
    if (!bookmarksTableReady) {
        bookmarksTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS bookmarks (
                user_id INTEGER NOT NULL REFERENCES users(id),
                post_id INTEGER NOT NULL REFERENCES posts(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, post_id)
              );
            `;
            await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
        })().catch(error => {
            bookmarksTableReady = null;
            throw error;
        });
    }

    return bookmarksTableReady;
}

export async function getPosts(sort: 'time' | 'heat' | 'likes' = 'time', userId?: number, filter: 'all' | 'saved' = 'all', tag?: string) {
    await ensureUserProfileEnhancements();
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT posts.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as is_bookmarked,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as has_liked
      FROM posts 
      JOIN users ON posts.author_id = users.id 
      WHERE 
        (${filter} != 'saved' OR EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id))
        AND (${tag ?? 'all'} = 'all' OR posts.tag = ${tag ?? ''})
      ORDER BY 
        CASE WHEN ${tag ?? 'all'} = 'all' AND posts.tag = 'announcement' THEN 0 ELSE 1 END ASC,
        CASE WHEN ${sort} = 'likes' THEN posts.likes END DESC,
        CASE WHEN ${sort} = 'heat' THEN (
          (
            posts.likes * 2
            + (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) * 3
            + (SELECT COUNT(*) FROM bookmarks WHERE post_id = posts.id) * 2
          ) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - posts.created_at)) / 3600 + 2, 2), 0.35)
        ) END DESC,
        posts.created_at DESC
      LIMIT 50
  `;

    return rows as Post[];
}

export async function getPostsByAuthor(authorId: number, viewerId?: number, limit = 12) {
    await ensureUserProfileEnhancements();
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT posts.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count,
      CASE WHEN ${viewerId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${viewerId ?? null}::int AND post_id = posts.id)
      ELSE false END as is_bookmarked,
      CASE WHEN ${viewerId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${viewerId ?? null}::int AND post_id = posts.id)
      ELSE false END as has_liked
      FROM posts
      JOIN users ON posts.author_id = users.id
      WHERE posts.author_id = ${authorId}
      ORDER BY posts.created_at DESC
      LIMIT ${limit}
    `;

    return rows as Post[];
}

export async function getComments(postId: number, userId?: number) {
    await ensureUserProfileEnhancements();
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT comments.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      parent_users.username as reply_author_name,
      parent_comments.content as reply_content,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM comment_likes WHERE user_id = ${userId ?? null}::int AND comment_id = comments.id)
      ELSE false END as has_liked
      FROM comments
      JOIN users ON comments.author_id = users.id
      LEFT JOIN comments parent_comments ON comments.parent_comment_id = parent_comments.id
      LEFT JOIN users parent_users ON parent_comments.author_id = parent_users.id
      WHERE comments.post_id = ${postId}
      ORDER BY comments.likes DESC, comments.created_at DESC
  `;
    return rows as Comment[];
}

export async function createPost(authorId: number, title: string, content: string, type: string = 'text', attachmentUrl: string = '', tag: string = 'general') {
    const { rows } = await sql`
    INSERT INTO posts (author_id, title, content, type, attachment_url, tag) 
    VALUES (${authorId}, ${title}, ${content}, ${type}, ${attachmentUrl}, ${tag})
    RETURNING id
  `;
    const { rows: postCountRows } = await sql<{ post_count: number }>`
      SELECT COUNT(*)::int as post_count
      FROM posts
      WHERE author_id = ${authorId}
    `;
    const isFirstPost = (postCountRows[0]?.post_count ?? 0) === 1;

    if (isFirstPost) {
        await addAwardPointsOnce(authorId, 'first_post_bonus', 100);
    } else {
        await addPoints(authorId, 10);
    }

    return rows[0]?.id;
}

export async function updatePost(userId: number, postId: number, title: string, content: string, tag: string, canModerate = false): Promise<boolean> {
    await ensureForumEnhancements();

    const { rows } = await sql<{ author_id: number }>`
      SELECT author_id
      FROM posts
      WHERE id = ${postId}
      LIMIT 1
    `;

    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    await sql`
      UPDATE posts
      SET title = ${title}, content = ${content}, tag = ${tag}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${postId}
    `;

    return true;
}

export async function countRecentAttachmentsByUser(userId: number) {
    const { rows } = await sql<{ upload_count: number }>`
      SELECT COUNT(*)::int as upload_count
      FROM posts
      WHERE author_id = ${userId}
        AND attachment_url IS NOT NULL
        AND attachment_url != ''
        AND created_at >= NOW() - INTERVAL '24 hours'
  `;

    return rows[0]?.upload_count ?? 0;
}

export async function countAttachmentsByUser(userId: number) {
    const { rows } = await sql<{ upload_count: number }>`
      SELECT COUNT(*)::int as upload_count
      FROM posts
      WHERE author_id = ${userId}
        AND attachment_url IS NOT NULL
        AND attachment_url != ''
  `;

    return rows[0]?.upload_count ?? 0;
}

export async function createComment(authorId: number, postId: number, content: string, parentCommentId?: number | null) {
    await ensureForumEnhancements();

    let replyToId: number | null = null;
    if (parentCommentId) {
        const { rows } = await sql<{ id: number }>`
          SELECT id
          FROM comments
          WHERE id = ${parentCommentId} AND post_id = ${postId}
          LIMIT 1
        `;
        replyToId = rows[0]?.id ?? null;
    }

    await sql`
    INSERT INTO comments (author_id, post_id, content, parent_comment_id)
    VALUES (${authorId}, ${postId}, ${content}, ${replyToId})
  `;
    await addPoints(authorId, 5);
}

export async function togglePostLike(userId: number, postId: number): Promise<boolean> {
    // Transaction implicit or check-then-act?
    // Upsert is tricky for toggle.
    const { rows } = await sql`SELECT 1 FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId}`;
        await sql`UPDATE posts SET likes = likes - 1 WHERE id = ${postId}`;
        return false;
    } else {
        await sql`INSERT INTO post_likes (user_id, post_id) VALUES (${userId}, ${postId})`;
        await sql`UPDATE posts SET likes = likes + 1 WHERE id = ${postId}`;

        // XP to author
        const { rows: postRows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
        if (postRows[0] && postRows[0].author_id !== userId) {
            await addPoints(postRows[0].author_id, 1);
        }

        // XP to liker (Daily limit: 5)
        const { rows: userRows } = await sql`SELECT daily_likes_count, last_like_at FROM users WHERE id = ${userId}`;
        const user = userRows[0];
        const now = new Date();
        const lastLikeDate = user?.last_like_at ? new Date(user.last_like_at).toDateString() : '';
        const isToday = lastLikeDate === now.toDateString();

        let dailyCount = isToday ? (user?.daily_likes_count || 0) : 0;
        if (dailyCount < 5) {
            await addPoints(userId, 1);
            await sql`UPDATE users SET daily_likes_count = ${dailyCount + 1}, last_like_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;
        }

        return true;
    }
}

export async function toggleCommentLike(userId: number, commentId: number): Promise<boolean> {
    const { rows } = await sql`SELECT 1 FROM comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        await sql`UPDATE comments SET likes = likes - 1 WHERE id = ${commentId}`;
        return false;
    } else {
        await sql`INSERT INTO comment_likes (user_id, comment_id) VALUES (${userId}, ${commentId})`;
        await sql`UPDATE comments SET likes = likes + 1 WHERE id = ${commentId}`;
        return true;
    }
}

export async function toggleBookmark(userId: number, postId: number) {
    const { rows } = await sql`SELECT 1 FROM bookmarks WHERE user_id = ${userId} AND post_id = ${postId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM bookmarks WHERE user_id = ${userId} AND post_id = ${postId}`;
        return false;
    } else {
        await sql`INSERT INTO bookmarks (user_id, post_id) VALUES (${userId}, ${postId})`;
        
        // XP to author for bookmark (Saved) - more valuable than like
        const { rows: postRows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
        if (postRows[0] && postRows[0].author_id !== userId) {
            await addPoints(postRows[0].author_id, 3);
        }
        
        return true;
    }
}

export async function getLeaderboard(limit = 10, window: LeaderboardWindow = 'all', category: LeaderboardCategory = 'all'): Promise<User[]> {
    await ensureUserProfileEnhancements();
    await ensureForumEnhancements();
    await ensureProjectEnhancements();

    if (window === 'all' && category === 'all') {
        const { rows } = await sql<User>`
          SELECT id, username, avatar, avatar_emoji, avatar_theme, points, level, role, badge_preferences, verification_status,
            (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
          FROM users
          WHERE verification_status = 'verified'
          ORDER BY points DESC
          LIMIT ${limit}
        `;
        return rows;
    }

    const sinceInterval = window === 'month' ? '30 days' : window === 'week' ? '7 days' : window === 'day' ? '1 day' : '36500 days';
    const { rows } = await sql<User>`
      WITH score_events AS (
        SELECT posts.author_id as user_id, 10 as points, 'community' as category, posts.created_at
        FROM posts
        UNION ALL
        SELECT comments.author_id as user_id, 5 as points, 'community' as category, comments.created_at
        FROM comments
        UNION ALL
        SELECT post_likes.user_id as user_id, 1 as points, 'community' as category, post_likes.created_at
        FROM post_likes
        UNION ALL
        SELECT bookmarks.user_id as user_id, 3 as points, 'community' as category, bookmarks.created_at
        FROM bookmarks
        UNION ALL
        SELECT project_likes.user_id as user_id, 5 as points, 'project' as category, project_likes.created_at
        FROM project_likes
        UNION ALL
        SELECT project_comments.author_id as user_id, 2 as points, 'project' as category, project_comments.created_at
        FROM project_comments
        UNION ALL
        SELECT projects.author_id as user_id, 100 as points, 'project' as category, projects.created_at
        FROM projects
      ),
      ranked AS (
        SELECT user_id, SUM(points)::int as points
        FROM score_events
        WHERE created_at >= NOW() - (${sinceInterval}::interval)
          AND (${category} = 'all' OR category = ${category})
        GROUP BY user_id
      )
      SELECT users.id, users.username, users.avatar, users.avatar_emoji, users.avatar_theme, ranked.points,
        GREATEST(1, FLOOR(SQRT(ranked.points / 50.0))::int + 1) as level,
        users.role, users.badge_preferences, users.verification_status,
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM ranked
      JOIN users ON users.id = ranked.user_id
      WHERE users.verification_status = 'verified'
      ORDER BY ranked.points DESC, users.points DESC
      LIMIT ${limit}
    `;

    return rows;
}

// --- Project Functions ---

let projectEnhancementsReady: Promise<void> | null = null;
let projectSubmissionsTableReady: Promise<void> | null = null;
let projectOpenEventsReady: Promise<void> | null = null;

async function ensureProjectEnhancements() {
    if (!projectEnhancementsReady) {
        projectEnhancementsReady = (async () => {
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0`;
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0`;
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live'`;
            await sql`ALTER TABLE IF EXISTS project_likes ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 5`;
            await ensureProjectOpenEventsTable();
            await applyProjectAttributionCorrections();
        })().catch(error => {
            projectEnhancementsReady = null;
            throw error;
        });
    }

    return projectEnhancementsReady;
}

async function ensureProjectOpenEventsTable() {
    if (!projectOpenEventsReady) {
        projectOpenEventsReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_opens (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_project_opened ON project_opens(project_id, opened_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_project_user_opened ON project_opens(project_id, user_id, opened_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_opened ON project_opens(opened_at DESC)`;
        })().catch(error => {
            projectOpenEventsReady = null;
            throw error;
        });
    }

    return projectOpenEventsReady;
}

async function applyProjectAttributionCorrections() {
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = 'Boxhead'
        AND lower(users.username) = 'eric'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = 'Sail Dodge'
        AND lower(users.username) = 'jessi'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = '草原梦境'
        AND lower(users.username) = 'luna1919810'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET url = 'https://hub.ericproject.xyz/projects/sailer-2d/index.html',
          status = 'live'
      WHERE projects.title = 'Sailer 2D'
        AND (
          projects.url IS DISTINCT FROM 'https://hub.ericproject.xyz/projects/sailer-2d/index.html'
          OR projects.status IS DISTINCT FROM 'live'
        )
    `;
}

async function ensureProjectSubmissionsTable() {
    if (!projectSubmissionsTableReady) {
        projectSubmissionsTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_submissions (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id),
                submission_type TEXT NOT NULL DEFAULT 'new_project',
                project_id INTEGER REFERENCES projects(id),
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                emoji TEXT NOT NULL DEFAULT '🚀',
                url TEXT,
                tags JSONB DEFAULT '[]'::jsonb,
                accent_color TEXT,
                version_notes TEXT,
                cover_url TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by INTEGER REFERENCES users(id),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                review_note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_submissions_status_created ON project_submissions(status, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_submissions_author_created ON project_submissions(author_id, created_at DESC)`;
        })().catch(error => {
            projectSubmissionsTableReady = null;
            throw error;
        });
    }

    return projectSubmissionsTableReady;
}

export async function getProjects(): Promise<Project[]> {
    await ensureProjectEnhancements();

    const { rows } = await sql<Project>`
      SELECT projects.*, users.username as author_name,
        COALESCE(projects.rating, 0.0) as rating,
        COALESCE(projects.rating_count, 0) as rating_count,
        (SELECT COUNT(*)::int FROM project_comments WHERE project_id = projects.id) as "commentCount",
        COALESCE(opens.effective_open_count_today, 0)::int as open_count_today,
        COALESCE(opens.effective_open_count_week, 0)::int as open_count_week,
        COALESCE(opens.effective_open_count_month, 0)::int as open_count_month,
        COALESCE(opens.effective_open_count_total, 0)::int as open_count_total,
        COALESCE(opens.unique_open_count_today, 0)::int as unique_open_count_today,
        COALESCE(opens.unique_open_count_week, 0)::int as unique_open_count_week,
        COALESCE(opens.unique_open_count_month, 0)::int as unique_open_count_month,
        COALESCE(opens.unique_open_count_total, 0)::int as unique_open_count_total,
        COALESCE(opens.effective_open_count_today, 0)::int as effective_open_count_today,
        COALESCE(opens.effective_open_count_week, 0)::int as effective_open_count_week,
        COALESCE(opens.effective_open_count_month, 0)::int as effective_open_count_month,
        COALESCE(opens.effective_open_count_total, 0)::int as effective_open_count_total,
        ROUND((
          COALESCE(opens.unique_open_count_today, 0) * 10
          + COALESCE(opens.effective_open_count_today, 0) * 2
          + CASE
              WHEN COALESCE(projects.rating_count, 0) > 0
              THEN (((COALESCE(projects.rating, 0) * COALESCE(projects.rating_count, 0)) + 4.2 * 3) / (COALESCE(projects.rating_count, 0) + 3)) * 8
              ELSE 0
            END
          + COALESCE(projects.rating_count, 0) * 1.5
        )::numeric, 1) as hub_score
      FROM projects
      JOIN users ON projects.author_id = users.id
      LEFT JOIN LATERAL (
        WITH verified_opens AS (
          SELECT
            project_opens.user_id,
            project_opens.opened_at,
            (project_opens.opened_at AT TIME ZONE 'Asia/Shanghai')::date as local_day
          FROM project_opens
          JOIN users open_users ON open_users.id = project_opens.user_id
          WHERE project_opens.project_id = projects.id
            AND project_opens.user_id IS NOT NULL
            AND open_users.verification_status = 'verified'
        ),
        ordered_opens AS (
          SELECT
            user_id,
            opened_at,
            local_day,
            LAG(opened_at) OVER (PARTITION BY user_id, local_day ORDER BY opened_at) as previous_opened_at
          FROM verified_opens
        ),
        session_opens AS (
          SELECT user_id, opened_at, local_day
          FROM ordered_opens
          WHERE previous_opened_at IS NULL OR opened_at - previous_opened_at >= INTERVAL '30 minutes'
        ),
        daily_effective AS (
          SELECT
            user_id,
            local_day,
            LEAST(COUNT(*)::int, 3) as effective_sessions
          FROM session_opens
          GROUP BY user_id, local_day
        ),
        boundaries AS (
          SELECT
            (NOW() AT TIME ZONE 'Asia/Shanghai')::date as today,
            ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 6) as week_start,
            ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 29) as month_start
        )
        SELECT
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day = today) as unique_open_count_today,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day >= week_start) as unique_open_count_week,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day >= month_start) as unique_open_count_month,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens) as unique_open_count_total,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day = today) as effective_open_count_today,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day >= week_start) as effective_open_count_week,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day >= month_start) as effective_open_count_month,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective) as effective_open_count_total
      ) opens ON true
      ORDER BY created_at DESC
    `;
    return rows;
}

export async function getProjectsByAuthor(authorId: number): Promise<Project[]> {
    await ensureProjectEnhancements();

    const { rows } = await sql<Project>`
      SELECT projects.*, users.username as author_name,
        COALESCE(projects.rating, 0.0) as rating,
        COALESCE(projects.rating_count, 0) as rating_count,
        (SELECT COUNT(*)::int FROM project_comments WHERE project_id = projects.id) as "commentCount",
        0::int as open_count_today,
        0::int as open_count_week,
        0::int as open_count_month,
        0::int as open_count_total,
        0::int as unique_open_count_today,
        0::int as unique_open_count_week,
        0::int as unique_open_count_month,
        0::int as unique_open_count_total,
        0::int as effective_open_count_today,
        0::int as effective_open_count_week,
        0::int as effective_open_count_month,
        0::int as effective_open_count_total,
        0::numeric as hub_score
      FROM projects
      JOIN users ON projects.author_id = users.id
      WHERE projects.author_id = ${authorId}
      ORDER BY created_at DESC
    `;

    return rows;
}

export async function createProject(data: Omit<Project, 'id' | 'likes' | 'created_at'>) {
    await ensureProjectEnhancements();

    const { rows } = await sql`
      INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
      VALUES (${data.author_id}, ${data.title}, ${data.description}, ${data.emoji}, ${data.url}, ${JSON.stringify(data.tags)}, ${data.accent_color}, ${data.status})
      RETURNING id
    `;

    await addAwardPointsOnce(data.author_id, 'hub_project_bonus', 100);

    return rows[0].id;
}

export async function trackProjectOpen(projectId: number, userId?: number | null) {
    await ensureProjectEnhancements();

    const { rowCount } = await sql`
      INSERT INTO project_opens (project_id, user_id)
      SELECT projects.id, ${userId || null}
      FROM projects
      WHERE projects.id = ${projectId}
    `;

    return (rowCount ?? 0) > 0;
}

export async function rateProject(userId: number, projectId: number, score: number) {
    await ensureProjectEnhancements();

    const { rows: existing } = await sql`
      SELECT score FROM project_likes WHERE user_id = ${userId} AND project_id = ${projectId}
    `;

    if (existing[0]) {
        const oldScore = existing[0].score || 5.0;
        await sql`UPDATE project_likes SET score = ${score} WHERE user_id = ${userId} AND project_id = ${projectId}`;
        const { rows: updatedProj } = await sql`
          UPDATE projects 
          SET rating = ROUND((rating * rating_count - ${oldScore} + ${score}) / rating_count, 1)
          WHERE id = ${projectId}
          RETURNING rating, rating_count
        `;
        return { isNew: false, rating: updatedProj[0].rating, rating_count: updatedProj[0].rating_count };
    } else {
        await sql`INSERT INTO project_likes (user_id, project_id, score) VALUES (${userId}, ${projectId}, ${score})`;
        const { rows: updatedProj } = await sql`
          UPDATE projects 
          SET 
            rating = CASE WHEN rating_count = 0 THEN ${score} ELSE ROUND((rating * rating_count + ${score}) / (rating_count + 1), 1) END,
            rating_count = rating_count + 1
          WHERE id = ${projectId}
          RETURNING rating, rating_count
        `;
        
        // Reward author: 5 XP
        const { rows: proj } = await sql`SELECT author_id FROM projects WHERE id = ${projectId}`;
        if (proj[0] && proj[0].author_id !== userId) await addPoints(proj[0].author_id, 5);
        
        return { isNew: true, rating: updatedProj[0].rating, rating_count: updatedProj[0].rating_count };
    }
}

export async function addProjectComment(userId: number, projectId: number, content: string) {
    await ensureProjectEnhancements();

    const { rows: existing } = await sql`SELECT id FROM project_comments WHERE project_id = ${projectId} AND author_id = ${userId}`;
    
    if (existing.length > 0) {
        await sql`UPDATE project_comments SET content = ${content}, created_at = CURRENT_TIMESTAMP WHERE id = ${existing[0].id}`;
        return existing[0].id;
    } else {
        const { rows } = await sql`
          INSERT INTO project_comments (project_id, author_id, content)
          VALUES (${projectId}, ${userId}, ${content})
          RETURNING id
        `;
        
        // Reward commenter: 2 XP
        await addPoints(userId, 2);
        
        // Reward author: 3 XP
        const { rows: proj } = await sql`SELECT author_id FROM projects WHERE id = ${projectId}`;
        if (proj[0] && proj[0].author_id !== userId) await addPoints(proj[0].author_id, 3);
        
        return rows[0].id;
    }
}

export async function deleteProjectComment(commentId: number, userId: number) {
    await ensureProjectEnhancements();

    const { rows } = await sql`
      SELECT project_id FROM project_comments WHERE id = ${commentId} AND author_id = ${userId}
    `;
    if (rows.length === 0) return;
    const projectId = rows[0].project_id;

    // Delete comment
    await sql`
      DELETE FROM project_comments 
      WHERE id = ${commentId} AND author_id = ${userId}
    `;
    
    // Delete corresponding rating
    await sql`
      DELETE FROM project_likes
      WHERE project_id = ${projectId} AND user_id = ${userId}
    `;
    
    // Recalculate average rating
    const { rows: stats } = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(score), 0) as total 
      FROM project_likes 
      WHERE project_id = ${projectId} AND score > 0
    `;
    const count = Number(stats[0].count);
    const newRating = count > 0 ? Number(stats[0].total) / count : 0;
    
    await sql`
      UPDATE projects 
      SET rating = ${newRating}, rating_count = ${count}
      WHERE id = ${projectId}
    `;
}

export async function getProjectComments(projectId: number): Promise<ProjectComment[]> {
    await ensureProjectEnhancements();

    const { rows } = await sql<ProjectComment>`
      SELECT 
        project_comments.*, 
        users.username as author_name, 
        users.avatar as author_avatar,
        users.avatar_theme as author_avatar_theme,
        (SELECT score FROM project_likes WHERE project_likes.user_id = project_comments.author_id AND project_likes.project_id = ${projectId} LIMIT 1) as author_score
      FROM project_comments
      JOIN users ON project_comments.author_id = users.id
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
    return rows;
}

function normalizeProjectSubmission(input: ProjectSubmissionInput) {
    const submissionType: ProjectSubmissionType = input.submission_type === 'new_version' ? 'new_version' : 'new_project';
    const tags = Array.isArray(input.tags)
        ? input.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 5)
        : [];

    return {
        author_id: input.author_id,
        submission_type: submissionType,
        project_id: submissionType === 'new_version' && input.project_id ? Number(input.project_id) : null,
        title: String(input.title || '').trim().slice(0, 80),
        description: String(input.description || '').trim().slice(0, 520),
        emoji: String(input.emoji || '🚀').trim().slice(0, 8) || '🚀',
        url: String(input.url || '').trim().slice(0, 500) || null,
        tags: tags.length > 0 ? tags : ['Game'],
        accent_color: String(input.accent_color || 'rgba(162, 155, 254, 0.22)').trim().slice(0, 80) || 'rgba(162, 155, 254, 0.22)',
        version_notes: String(input.version_notes || '').trim().slice(0, 800) || null,
        cover_url: String(input.cover_url || '').trim().slice(0, 500) || null,
    };
}

export async function createProjectSubmission(input: ProjectSubmissionInput) {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    const data = normalizeProjectSubmission(input);

    if (!data.title || data.title.length < 2) {
        throw new Error('Invalid project title');
    }

    if (!data.description || data.description.length < 8) {
        throw new Error('Invalid project description');
    }

    if (data.url) {
        try {
            const parsed = new URL(data.url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Invalid URL');
        } catch {
            throw new Error('Invalid project URL');
        }
    }

    if (data.submission_type === 'new_version' && !data.project_id) {
        throw new Error('Missing project for version submission');
    }

    const { rows } = await sql<{ id: number }>`
      INSERT INTO project_submissions (
        author_id, submission_type, project_id, title, description, emoji, url, tags,
        accent_color, version_notes, cover_url
      )
      VALUES (
        ${data.author_id},
        ${data.submission_type},
        ${data.project_id},
        ${data.title},
        ${data.description},
        ${data.emoji},
        ${data.url},
        ${JSON.stringify(data.tags)}::jsonb,
        ${data.accent_color},
        ${data.version_notes},
        ${data.cover_url}
      )
      RETURNING id
    `;

    return rows[0].id;
}

export async function getProjectSubmissions(status: ProjectSubmissionStatus | 'all' = 'pending'): Promise<ProjectSubmission[]> {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();

    const { rows } = await sql<ProjectSubmission>`
      SELECT project_submissions.*, users.username as author_name, projects.title as project_title
      FROM project_submissions
      JOIN users ON project_submissions.author_id = users.id
      LEFT JOIN projects ON project_submissions.project_id = projects.id
      WHERE (${status} = 'all' OR project_submissions.status = ${status})
      ORDER BY project_submissions.created_at DESC
      LIMIT 80
    `;

    return rows;
}

export async function reviewProjectSubmission(submissionId: number, reviewerId: number, status: 'approved' | 'rejected', note = '') {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    await ensurePointAwardsTable();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;

        const { rows } = await client.sql<ProjectSubmission>`
          SELECT *
          FROM project_submissions
          WHERE id = ${submissionId}
            AND status = 'pending'
          FOR UPDATE
        `;
        const submission = rows[0];
        if (!submission) {
            throw new Error('Submission not found');
        }

        if (status === 'approved') {
            if (submission.submission_type === 'new_version' && submission.project_id) {
                const { rowCount } = await client.sql`
                  UPDATE projects
                  SET
                    title = ${submission.title},
                    description = ${submission.description},
                    emoji = ${submission.emoji},
                    url = ${submission.url},
                    tags = ${JSON.stringify(submission.tags)}::jsonb,
                    accent_color = ${submission.accent_color},
                    status = 'live'
                  WHERE id = ${submission.project_id}
                `;
                if (rowCount === 0) {
                    throw new Error('Target project not found');
                }

                const { rows: awardRows } = await client.sql<{ id: number }>`
                  INSERT INTO point_awards (user_id, award_key, amount)
                  VALUES (${submission.author_id}, ${`hub_version_bonus:${submission.id}`}, 50)
                  ON CONFLICT (user_id, award_key) DO NOTHING
                  RETURNING id
                `;
                if (awardRows[0]) {
                    await client.sql`
                      UPDATE users
                      SET
                        points = points + 50,
                        level = GREATEST(level, FLOOR(SQRT((points + 50) / 50.0))::int + 1)
                      WHERE id = ${submission.author_id}
                    `;
                }
            } else {
                await client.sql`
                  INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
                  VALUES (
                    ${submission.author_id},
                    ${submission.title},
                    ${submission.description},
                    ${submission.emoji},
                    ${submission.url},
                    ${JSON.stringify(submission.tags)}::jsonb,
                    ${submission.accent_color},
                    'live'
                  )
                `;

                const { rows: awardRows } = await client.sql<{ id: number }>`
                  INSERT INTO point_awards (user_id, award_key, amount)
                  VALUES (${submission.author_id}, 'hub_project_bonus', 100)
                  ON CONFLICT (user_id, award_key) DO NOTHING
                  RETURNING id
                `;
                if (awardRows[0]) {
                    await client.sql`
                      UPDATE users
                      SET
                        points = points + 100,
                        level = GREATEST(level, FLOOR(SQRT((points + 100) / 50.0))::int + 1)
                      WHERE id = ${submission.author_id}
                    `;
                }
            }
        }

        await client.sql`
          UPDATE project_submissions
          SET
            status = ${status},
            reviewed_by = ${reviewerId},
            reviewed_at = CURRENT_TIMESTAMP,
            review_note = ${note.trim() || null}
          WHERE id = ${submissionId}
            AND status = 'pending'
        `;

        await client.sql`COMMIT`;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

let notificationsTableReady: Promise<void> | null = null;

async function ensureNotificationsTable() {
    if (!notificationsTableReady) {
        notificationsTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                post_id INTEGER,
                comment_id INTEGER,
                read_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;

            await sql`
              CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
              ON notifications (recipient_id, created_at DESC);
            `;
        })().catch(error => {
            notificationsTableReady = null;
            throw error;
        });
    }

    return notificationsTableReady;
}

async function createNotification(input: {
    recipientId: number;
    actorId: number;
    type: Notification['type'];
    postId?: number | null;
    commentId?: number | null;
}) {
    if (!input.recipientId || input.recipientId === input.actorId) return;

    try {
        await ensureNotificationsTable();

        const { rows } = await sql`
          SELECT id
          FROM notifications
          WHERE recipient_id = ${input.recipientId}
            AND actor_id = ${input.actorId}
            AND type = ${input.type}
            AND post_id IS NOT DISTINCT FROM ${input.postId ?? null}
            AND comment_id IS NOT DISTINCT FROM ${input.commentId ?? null}
            AND created_at >= NOW() - INTERVAL '6 hours'
          LIMIT 1
        `;

        if (rows[0]) return;

        await sql`
          INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id)
          VALUES (${input.recipientId}, ${input.actorId}, ${input.type}, ${input.postId ?? null}, ${input.commentId ?? null})
        `;
    } catch (error) {
        console.warn('Notification write skipped:', error);
    }
}

export async function createPostInteractionNotification(actorId: number, postId: number, type: 'post_like' | 'post_bookmark') {
    const { rows } = await sql<{ author_id: number }>`
      SELECT author_id
      FROM posts
      WHERE id = ${postId}
      LIMIT 1
    `;

    const recipientId = rows[0]?.author_id;
    if (!recipientId) return;

    await createNotification({
        recipientId,
        actorId,
        type,
        postId,
    });
}

export async function createCommentLikeNotification(actorId: number, commentId: number) {
    const { rows } = await sql<{ author_id: number; post_id: number }>`
      SELECT author_id, post_id
      FROM comments
      WHERE id = ${commentId}
      LIMIT 1
    `;

    const comment = rows[0];
    if (!comment) return;

    await createNotification({
        recipientId: comment.author_id,
        actorId,
        type: 'comment_like',
        postId: comment.post_id,
        commentId,
    });
}

export async function getNotifications(userId: number) {
    await ensureNotificationsTable();

    const { rows } = await sql<Notification>`
      SELECT notifications.*, users.username as actor_name, users.avatar as actor_avatar, users.avatar_theme as actor_avatar_theme, posts.title as post_title
      FROM notifications
      JOIN users ON notifications.actor_id = users.id
      LEFT JOIN posts ON notifications.post_id = posts.id
      WHERE notifications.recipient_id = ${userId}
      ORDER BY notifications.created_at DESC
      LIMIT 20
    `;

    return rows;
}

export async function getUnreadNotificationCount(userId: number) {
    await ensureNotificationsTable();

    const { rows } = await sql<{ unread_count: number }>`
      SELECT COUNT(*)::int as unread_count
      FROM notifications
      WHERE recipient_id = ${userId}
        AND read_at IS NULL
    `;

    return rows[0]?.unread_count ?? 0;
}

export async function markNotificationsRead(userId: number) {
    await ensureNotificationsTable();

    await sql`
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE recipient_id = ${userId}
        AND read_at IS NULL
    `;
}

export async function getPostAttachmentForDelete(userId: number, postId: number, canModerate = false): Promise<string> {
    const { rows } = await sql<{ attachment_url: string | null }>`
      SELECT attachment_url
      FROM posts
      WHERE id = ${postId} AND (${canModerate}::boolean OR author_id = ${userId})
      LIMIT 1
  `;

    return rows[0]?.attachment_url || '';
}

export async function deletePost(userId: number, postId: number, canModerate = false): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    // Cleanup
    await sql`DELETE FROM comments WHERE post_id = ${postId}`;
    await sql`DELETE FROM post_likes WHERE post_id = ${postId}`;
    await sql`DELETE FROM bookmarks WHERE post_id = ${postId}`;
    await sql`DELETE FROM posts WHERE id = ${postId}`;
    return true;
}

export async function deleteComment(userId: number, commentId: number, canModerate = false): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM comments WHERE id = ${commentId}`;
    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    await sql`DELETE FROM comment_likes WHERE comment_id = ${commentId}`;
    await sql`DELETE FROM comments WHERE id = ${commentId}`;
    return true;
}

export async function initDB() {
    await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      role TEXT DEFAULT 'student',
      bio TEXT DEFAULT 'New member at Hajimi High!',
      avatar TEXT DEFAULT '😊',
      avatar_emoji TEXT DEFAULT '😊',
      avatar_theme TEXT DEFAULT 'lavender',
      profile_image TEXT,
      grade TEXT,
      age INTEGER,
      ethnicity TEXT,
      verification_status TEXT DEFAULT 'unverified',
      verification_type TEXT,
      verified_name TEXT,
      verified_grade TEXT,
      verified_subject TEXT,
      student_id_hash TEXT,
      student_id_last4 TEXT,
      verification_submitted_at TIMESTAMP WITH TIME ZONE,
      verified_at TIMESTAMP WITH TIME ZONE,
      verification_reviewed_by INTEGER,
      verification_note TEXT,
      streak_count INTEGER DEFAULT 0,
      last_checkin_at TIMESTAMP WITH TIME ZONE,
      daily_likes_count INTEGER DEFAULT 0,
      last_like_at TIMESTAMP WITH TIME ZONE,
      badge_preferences JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Migration for existing tables
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_likes_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_like_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_preferences JSONB DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE users ALTER COLUMN badge_preferences TYPE JSONB USING COALESCE(to_jsonb(badge_preferences), '[]'::jsonb)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '😊'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_theme TEXT DEFAULT 'lavender'`;
    await sql`UPDATE users SET bio = 'New member at Hajimi High!' WHERE bio = 'New student at Hajimi High!'`;
    await ensureVerificationColumns();
  } catch (e) {
    console.log("Migration columns already exist or failed:", e);
  }

    await sql`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      checkin_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, checkin_date)
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      tag TEXT DEFAULT 'general',
      attachment_url TEXT,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await ensureForumEnhancements();

    await sql`
    CREATE TABLE IF NOT EXISTS post_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      post_id INTEGER NOT NULL REFERENCES posts(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
  `;
    await ensureBookmarksTable();

    await sql`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, comment_id)
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      emoji TEXT NOT NULL,
      url TEXT,
      tags JSONB DEFAULT '[]',
      accent_color TEXT,
      status TEXT DEFAULT 'live',
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS project_comments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS project_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      score NUMERIC DEFAULT 5,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, project_id)
    );
  `;
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    await ensureProjectOpenEventsTable();

    await ensurePointAwardsTable();
    await sql`CREATE INDEX IF NOT EXISTS idx_point_awards_user_key ON point_awards(user_id, award_key)`;
    await ensureVerificationColumns();
    await ensureNotificationsTable();

    // Seeding logic (optional, but keep for now if needed)
    // In a real app, we'd run a separate seed script.
}
