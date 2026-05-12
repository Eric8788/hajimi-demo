import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            process.env[match[1]] = val;
        }
    });
}

async function migrate() {
    console.log("Starting rating migration...");

    try {
        console.log("1. Adding score column to project_likes...");
        await sql`ALTER TABLE project_likes ADD COLUMN IF NOT EXISTS score NUMERIC(3,1) NOT NULL DEFAULT 5.0`;

        console.log("2. Adding rating columns to projects...");
        await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 0.0`;
        await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0`;

        console.log("3. Backfilling data for existing projects based on likes...");
        await sql`
            UPDATE projects 
            SET 
                rating_count = likes, 
                rating = CASE WHEN likes > 0 THEN 5.0 ELSE 0.0 END
        `;

        console.log("Migration complete! Database is now ready for 5-star ratings.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
