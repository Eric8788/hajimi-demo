import { sql } from '@vercel/postgres';

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
    grade?: string;
    age?: number;
    ethnicity?: string;
    is_creator?: boolean;
    streak_count: number;
    last_checkin_at?: string;
    daily_likes_count: number;
    last_like_at?: string;
    created_at: string;
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
    created_at: string;
}

export interface ProjectComment {
    id: number;
    project_id: number;
    author_id: number;
    author_name?: string;
    author_avatar?: string;
    content: string;
    created_at: string;
}

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
    author_role?: string;
    author_is_creator?: boolean;
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
    author_role?: string;
    author_is_creator?: boolean;
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
    post_title?: string;
}

// --- User Helpers ---

export async function getUser(username: string) {
    const { rows } = await sql<User>`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    return rows[0];
}

export async function getUserById(id: number): Promise<User | null> {
    const { rows } = await sql<User>`
      SELECT users.*, 
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM users 
      WHERE id = ${id} 
      LIMIT 1
    `;
    return rows[0] || null;
}

export async function createUser(username: string, passwordHash: string, role = 'student') {
    // Use RETURNING id to get the ID immediately
    const { rows } = await sql`
    INSERT INTO users (username, password_hash, points, role)
    VALUES (${username}, ${passwordHash}, 0, ${role})
    RETURNING id
  `;
    return rows[0].id;
}

export async function updateUserProfile(id: number, updates: { bio?: string; avatar?: string; grade?: string; age?: number; ethnicity?: string }) {
    // Construct dynamic query carefully or just update all fields?
    // Updating individually is safer with COALESCE but sql template tag needs careful handling for dynamic columns.
    // Easiest verified way: use separate updates or smart COALESCE with all params passed.
    await sql`
    UPDATE users 
    SET 
      bio = COALESCE(${updates.bio ?? null}, bio), 
      avatar = COALESCE(${updates.avatar ?? null}, avatar), 
      grade = COALESCE(${updates.grade ?? null}, grade), 
      age = COALESCE(${updates.age ?? null}, age), 
      ethnicity = COALESCE(${updates.ethnicity ?? null}, ethnicity) 
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

async function ensurePointAwardsTable() {
    await sql`
      CREATE TABLE IF NOT EXISTS point_awards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        award_key TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, award_key)
      );
    `;
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

async function ensureForumEnhancements() {
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL`;
}

export async function getPosts(sort: 'time' | 'heat' | 'likes' = 'time', userId?: number, filter: 'all' | 'saved' = 'all', tag?: string) {
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT posts.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
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

export async function getComments(postId: number, userId?: number) {
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT comments.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
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
      WHERE post_id = ${postId}
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

export async function getLeaderboard(): Promise<User[]> {
    const { rows } = await sql<User>`
      SELECT id, username, avatar, points, level, role, 
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM users 
      ORDER BY points DESC 
      LIMIT 10
    `;
    return rows;
}

// --- Project Functions ---

export async function getProjects(): Promise<Project[]> {
    const { rows } = await sql<Project>`
      SELECT projects.*, users.username as author_name,
        COALESCE(projects.rating, 0.0) as rating,
        COALESCE(projects.rating_count, 0) as rating_count,
        (SELECT COUNT(*)::int FROM project_comments WHERE project_id = projects.id) as "commentCount"
      FROM projects
      JOIN users ON projects.author_id = users.id
      ORDER BY created_at DESC
    `;
    return rows;
}

export async function createProject(data: Omit<Project, 'id' | 'likes' | 'created_at'>) {
    const { rows } = await sql`
      INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
      VALUES (${data.author_id}, ${data.title}, ${data.description}, ${data.emoji}, ${data.url}, ${JSON.stringify(data.tags)}, ${data.accent_color}, ${data.status})
      RETURNING id
    `;

    await addAwardPointsOnce(data.author_id, 'hub_project_bonus', 200);

    return rows[0].id;
}

export async function rateProject(userId: number, projectId: number, score: number) {
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
    const { rows } = await sql<ProjectComment>`
      SELECT 
        project_comments.*, 
        users.username as author_name, 
        users.avatar as author_avatar,
        (SELECT score FROM project_likes WHERE project_likes.user_id = project_comments.author_id AND project_likes.project_id = ${projectId} LIMIT 1) as author_score
      FROM project_comments
      JOIN users ON project_comments.author_id = users.id
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
    return rows;
}

async function ensureNotificationsTable() {
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
      SELECT notifications.*, users.username as actor_name, users.avatar as actor_avatar, posts.title as post_title
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
      bio TEXT DEFAULT 'New student at Hajimi High!',
      avatar TEXT DEFAULT '😊',
      grade TEXT,
      age INTEGER,
      ethnicity TEXT,
      streak_count INTEGER DEFAULT 0,
      last_checkin_at TIMESTAMP WITH TIME ZONE,
      daily_likes_count INTEGER DEFAULT 0,
      last_like_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Migration for existing tables
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_likes_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_like_at TIMESTAMP WITH TIME ZONE`;
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, project_id)
    );
  `;

    await ensurePointAwardsTable();
    await sql`CREATE INDEX IF NOT EXISTS idx_point_awards_user_key ON point_awards(user_id, award_key)`;
    await ensureNotificationsTable();

    // Seeding logic (optional, but keep for now if needed)
    // In a real app, we'd run a separate seed script.
}
