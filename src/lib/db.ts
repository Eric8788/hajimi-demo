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
    created_at: Date;
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
    author_name?: string;
    author_avatar?: string;
    author_role?: string;
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
    author_name?: string;
    author_avatar?: string;
    author_role?: string;
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

export async function getUserById(id: number) {
    const { rows } = await sql<User>`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return rows[0];
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

export async function addPoints(userId: number, amount: number) {
    await sql`UPDATE users SET points = points + ${amount} WHERE id = ${userId}`;
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
        // Vercel Postgres (neon) doesn't support complex transactions in HTTP everywhere easily, 
        // but a simple insert is fine. Constraint will handle duplicate.
        await sql`
      INSERT INTO checkins (user_id, checkin_date) 
      VALUES (${userId}, CURRENT_DATE)
    `;
        await addPoints(userId, 10);
        return true;
    } catch (error) {
        console.error("Checkin Error:", error);
        return false;
    }
}

// --- Forum Helpers ---

export async function getPosts(sort: 'time' | 'heat' | 'likes' = 'time', userId?: number, filter: 'all' | 'saved' = 'all', tag?: string) {
    const { rows } = await sql`
      SELECT posts.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
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
    const { rows } = await sql`
      SELECT comments.*, users.username as author_name, users.avatar as author_avatar, users.role as author_role,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM comment_likes WHERE user_id = ${userId ?? null}::int AND comment_id = comments.id)
      ELSE false END as has_liked
      FROM comments
      JOIN users ON comments.author_id = users.id
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
    await addPoints(authorId, 10);
    return rows[0]?.id;
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

export async function createComment(authorId: number, postId: number, content: string) {
    await sql`
    INSERT INTO comments (author_id, post_id, content) 
    VALUES (${authorId}, ${postId}, ${content})
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
        return true;
    }
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

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
    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL REFERENCES users(id),
      post_id INTEGER NOT NULL REFERENCES posts(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
  `;

    await ensureNotificationsTable();
}
