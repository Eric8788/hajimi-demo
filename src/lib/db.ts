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
    has_liked?: boolean;
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

export async function createUser(username: string, passwordHash: string) {
    // Use RETURNING id to get the ID immediately
    const { rows } = await sql`
    INSERT INTO users (username, password_hash, points) 
    VALUES (${username}, ${passwordHash}, 0) 
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
    // Note: Complex dynamic queries with template literals need careful construction.
    // We can condition parts of the query.

    // Base query text
    let queryBase = `
    SELECT posts.*, users.username as author_name, users.avatar as author_avatar,
    (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count
  `;

    if (userId) {
        queryBase += `,
      EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId} AND post_id = posts.id) as is_bookmarked,
      EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${userId} AND post_id = posts.id) as has_liked
    `;
    } else {
        queryBase += `, false as is_bookmarked, false as has_liked`;
    }

    queryBase += ` FROM posts JOIN users ON posts.author_id = users.id`;

    const conditions = [];

    if (filter === 'saved' && userId) {
        conditions.push(`EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId} AND post_id = posts.id)`);
    }

    if (tag && tag !== 'all') {
        conditions.push(`posts.tag = '${tag}'`); // Simple string injection protection needed? tag is usually strict enum/string. 
        // Ideally use param but for simple string concatenation in non-sensitive fields...
        // Let's safe-guard:
        // Actually, we can't easily mix dynamic strings and template params in one sql\`...` call without helpers.
        // For Vercel Postgres, standard practice for dynamic queries is tricky.
        // We will assume tag is safe or validate it.
    }

    if (conditions.length > 0) {
        queryBase += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Ordering
    if (sort === 'likes') {
        queryBase += ` ORDER BY posts.likes DESC, posts.created_at DESC`;
    } else if (sort === 'heat') {
        queryBase += ` ORDER BY (posts.likes * 2 + (SELECT COUNT(*) FROM comments WHERE post_id = posts.id)) DESC, posts.created_at DESC`;
    } else {
        queryBase += ` ORDER BY posts.created_at DESC`;
    }

    // LIMIT
    queryBase += ` LIMIT 50`;

    // Provide raw query (BE CAREFUL with inputs if not using template tag properly)
    // Since we construct string, we use sql.query(string) or client.
    // But sql template tag REQUIRES literal.
    // Only way to use dynamic condition in sql\`\` is using boolean logic:
    // WHERE (${tag}::text IS NULL OR posts.tag = ${tag})

    // Let's use the Robust Pattern:
    // We'll filter in SQL using "OR NULL" pattern for parameters

    const { rows } = await sql`
      SELECT posts.*, users.username as author_name, users.avatar as author_avatar,
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
        CASE WHEN ${sort} = 'likes' THEN posts.likes END DESC,
        CASE WHEN ${sort} = 'heat' THEN (posts.likes + (SELECT COUNT(*) FROM comments WHERE post_id = posts.id)) END DESC,
        posts.created_at DESC
      LIMIT 50
  `;

    return rows as Post[];
}

export async function getComments(postId: number, userId?: number) {
    const { rows } = await sql`
      SELECT comments.*, users.username as author_name, users.avatar as author_avatar,
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
        return true;//124124124
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

export async function deletePost(userId: number, postId: number): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
    if (!rows[0] || rows[0].author_id !== userId) return false;

    // Cleanup
    await sql`DELETE FROM comments WHERE post_id = ${postId}`;
    await sql`DELETE FROM post_likes WHERE post_id = ${postId}`;
    await sql`DELETE FROM bookmarks WHERE post_id = ${postId}`;
    await sql`DELETE FROM posts WHERE id = ${postId}`;
    return true;
}

export async function deleteComment(userId: number, commentId: number): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM comments WHERE id = ${commentId}`;
    if (!rows[0] || rows[0].author_id !== userId) return false;

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
}
