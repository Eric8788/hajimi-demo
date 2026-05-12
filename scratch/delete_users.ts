const { sql, deleteUser } = require('./src/lib/db.ts');

async function main() {
    const usernames = ['teacher1', 'eric2', 'student_1'];
    console.log('Searching for users:', usernames);

    for (const username of usernames) {
        const { rows } = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (rows.length > 0) {
            const id = rows[0].id;
            console.log(`Deleting user ${username} (ID: ${id})...`);
            await deleteUser(id);
            console.log(`User ${username} deleted.`);
        } else {
            console.log(`User ${username} not found.`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
