import { sql } from '@vercel/postgres';

async function main() {
    // 1. Get all users
    const { rows: users } = await sql`SELECT id, username FROM users`;
    console.log('Users in DB:', users);

    // Map common names to actual DB usernames
    const nameMap = {
        'Albert': 'AlbertY',
        'Peter': 'p1TTER',
        'Cooka': 'Cooka', // Need to check if Cooka exists
        'Eric': 'eric'
    };

    for (const [shortName, dbName] of Object.entries(nameMap)) {
        const user = users.find(u => u.username === dbName);
        if (user) {
            console.log(`Updating projects for ${shortName} -> ${dbName} (ID: ${user.id})`);
            // Update projects that were authored by this name (search in description or title if needed, 
            // but during seeding I used author field which is now author_id)
            // Actually, I'll just look for projects currently assigned to ID 1 that should be someone else
            
            if (shortName === 'Albert') {
                await sql`UPDATE projects SET author_id = ${user.id} WHERE title = '帆船倒计时'`;
            } else if (shortName === 'Peter') {
                await sql`UPDATE projects SET author_id = ${user.id} WHERE title IN ('背单词', 'Flight Radar')`;
            } else if (shortName === 'Cooka') {
                await sql`UPDATE projects SET author_id = ${user.id} WHERE author_id = 1 AND title IN ('Boxhead', 'Climb 3D', 'Snake')`;
            }
        }
    }
    console.log('Update complete.');
}

main().catch(console.error);
