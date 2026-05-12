import { sql } from '@vercel/postgres';
import { initDB } from '../src/lib/db.js';
import { PROJECTS } from '../src/data/projects';

async function main() {
    console.log('Initializing DB...');
    await initDB();
    
    for (const project of PROJECTS) {
        let authorId;
        const authorName = project.author.split(' / ')[0];
        
        const { rows } = await sql`SELECT id FROM users WHERE username = ${authorName}`;
        if (rows.length > 0) {
            authorId = rows[0].id;
        } else {
            authorId = 1; 
        }

        console.log(`Seeding project: ${project.title} by ${authorName} (ID: ${authorId})`);
        
        await sql`
            INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
            VALUES (${authorId}, ${project.title}, ${project.description}, ${project.emoji}, ${project.url}, ${JSON.stringify(project.tags)}, ${project.accentColor}, ${project.status})
        `;
    }
    console.log('Seeding complete.');
}

main().catch(console.error);
