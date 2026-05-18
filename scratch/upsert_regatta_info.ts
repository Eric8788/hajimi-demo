import { loadEnvConfig } from '@next/env';
import { sql } from '@vercel/postgres';

loadEnvConfig(process.cwd());

const project = {
  title: 'Regatta Info',
  description: 'A sailing regatta information hub for checking event details, race resources, and training references.',
  emoji: '🏁',
  url: 'https://regatta-info.top/',
  tags: ['Tool', 'Sailing'],
  accentColor: 'rgba(9, 132, 227, 0.18)',
  status: 'live',
};

async function getAlbertAuthorId() {
  const { rows } = await sql<{ id: number }>`
    SELECT id
    FROM users
    WHERE username IN ('AlbertY', 'Albert', 'albert')
    ORDER BY CASE username
      WHEN 'AlbertY' THEN 1
      WHEN 'Albert' THEN 2
      ELSE 3
    END
    LIMIT 1
  `;

  if (rows[0]) return rows[0].id;

  const fallback = await sql<{ id: number }>`
    SELECT id
    FROM users
    ORDER BY id ASC
    LIMIT 1
  `;

  return fallback.rows[0]?.id ?? 1;
}

async function upsertRegattaInfo() {
  const authorId = await getAlbertAuthorId();

  const existing = await sql<{ id: number }>`
    SELECT id
    FROM projects
    WHERE title = ${project.title} OR url = ${project.url}
    LIMIT 1
  `;

  if (existing.rows[0]) {
    await sql`
      UPDATE projects
      SET
        author_id = ${authorId},
        title = ${project.title},
        description = ${project.description},
        emoji = ${project.emoji},
        url = ${project.url},
        tags = ${JSON.stringify(project.tags)},
        accent_color = ${project.accentColor},
        status = ${project.status}
      WHERE id = ${existing.rows[0].id}
    `;
    console.log(`Updated Regatta Info project id=${existing.rows[0].id}`);
    return;
  }

  const inserted = await sql<{ id: number }>`
    INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
    VALUES (
      ${authorId},
      ${project.title},
      ${project.description},
      ${project.emoji},
      ${project.url},
      ${JSON.stringify(project.tags)},
      ${project.accentColor},
      ${project.status}
    )
    RETURNING id
  `;

  console.log(`Inserted Regatta Info project id=${inserted.rows[0].id}`);
}

upsertRegattaInfo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to upsert Regatta Info:', error);
    process.exit(1);
  });
