import { sql } from '@vercel/postgres';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function updateSailer2d() {
    try {
        console.log("Updating Sailer 2D...");
        await sql`
            UPDATE projects 
            SET url = 'https://hub.ericproject.xyz/projects/sailer-2d/index.html', status = 'live' 
            WHERE title = 'Sailer 2D'
        `;
        console.log("Sailer 2D updated successfully.");
    } catch (err) {
        console.error("Error updating Sailer 2D:", err);
    }
}

updateSailer2d().then(() => process.exit(0));
