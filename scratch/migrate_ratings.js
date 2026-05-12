import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
