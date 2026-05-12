import { sql } from '@vercel/postgres';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function wipeRatings() {
    try {
        console.log("Wiping project comments...");
        await sql`DELETE FROM project_comments`;
        
        console.log("Wiping project likes...");
        await sql`DELETE FROM project_likes`;
        
        console.log("Resetting project ratings...");
        await sql`UPDATE projects SET rating = 0, rating_count = 0`;
        
        console.log("All ratings and comments wiped successfully.");
    } catch (err) {
        console.error("Error wiping ratings:", err);
    }
}

wipeRatings().then(() => process.exit(0));
