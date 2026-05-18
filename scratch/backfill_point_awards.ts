import { loadEnvConfig } from '@next/env';
import { sql } from '@vercel/postgres';

loadEnvConfig(process.cwd());

async function ensurePointAwardsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS point_awards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      award_key TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, award_key)
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_point_awards_user_key
    ON point_awards(user_id, award_key)
  `;
}

async function addAwardPointsOnce(userId: number, awardKey: string, amount: number) {
  const inserted = await sql<{ id: number }>`
    INSERT INTO point_awards (user_id, award_key, amount)
    VALUES (${userId}, ${awardKey}, ${amount})
    ON CONFLICT (user_id, award_key) DO NOTHING
    RETURNING id
  `;

  if (!inserted.rows[0]) return false;

  await sql`
    UPDATE users
    SET
      points = points + ${amount},
      level = GREATEST(level, FLOOR(SQRT((points + ${amount}) / 50.0))::int + 1)
    WHERE id = ${userId}
  `;

  return true;
}

async function backfillPointAwards() {
  await ensurePointAwardsTable();

  const postAuthors = await sql<{ author_id: number }>`
    SELECT DISTINCT author_id
    FROM posts
  `;

  let firstPostCount = 0;
  for (const row of postAuthors.rows) {
    // Existing post creation already awarded 10 XP, so backfill only the
    // remaining 90 XP to make the first-post reward total 100.
    const awarded = await addAwardPointsOnce(row.author_id, 'first_post_bonus', 90);
    if (awarded) firstPostCount += 1;
  }

  const projectAuthors = await sql<{ author_id: number }>`
    SELECT DISTINCT author_id
    FROM projects
  `;

  let hubProjectCount = 0;
  for (const row of projectAuthors.rows) {
    const awarded = await addAwardPointsOnce(row.author_id, 'hub_project_bonus', 200);
    if (awarded) hubProjectCount += 1;
  }

  console.log(`Backfilled first-post awards for ${firstPostCount} users.`);
  console.log(`Backfilled Hub project awards for ${hubProjectCount} users.`);
}

backfillPointAwards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to backfill point awards:', error);
    process.exit(1);
  });
