const { sql } = require('@vercel/postgres');

async function deleteUser(id) {
    console.log(`Cleaning up for ID: ${id}...`);
    // 1. Delete notifications
    await sql`DELETE FROM notifications WHERE recipient_id = ${id} OR actor_id = ${id}`;
    
    // 2. Delete interactions MADE BY the user
    await sql`DELETE FROM comment_likes WHERE user_id = ${id}`;
    await sql`DELETE FROM post_likes WHERE user_id = ${id}`;
    await sql`DELETE FROM bookmarks WHERE user_id = ${id}`;
    
    // 3. Delete interactions ON content MADE BY the user
    // Likes on comments written by this user
    await sql`DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE author_id = ${id})`;
    await sql`DELETE FROM comments WHERE author_id = ${id}`;
    
    // Everything related to posts written by this user
    const { rows: postRows } = await sql`SELECT id FROM posts WHERE author_id = ${id}`;
    for (const post of postRows) {
        // Likes on comments of this post
        await sql`DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ${post.id})`;
        // Comments on this post
        await sql`DELETE FROM comments WHERE post_id = ${post.id}`;
        // Likes on this post
        await sql`DELETE FROM post_likes WHERE post_id = ${post.id}`;
        // Bookmarks on this post
        await sql`DELETE FROM bookmarks WHERE post_id = ${post.id}`;
    }
    await sql`DELETE FROM posts WHERE author_id = ${id}`;
    
    // 4. Delete checkins and the user record
    await sql`DELETE FROM checkins WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
    console.log(`ID ${id} fully deleted.`);
}

async function main() {
    const usernames = ['teacher1', 'eric2', 'student_1'];
    for (const username of usernames) {
        const { rows } = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (rows.length > 0) {
            await deleteUser(rows[0].id);
        } else {
            console.log(`User ${username} not found.`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
