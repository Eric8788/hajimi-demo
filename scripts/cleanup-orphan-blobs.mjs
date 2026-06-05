import { del, list } from '@vercel/blob';
import { sql } from '@vercel/postgres';

const shouldDelete = process.argv.includes('--delete');
const prefix = 'forum/';
const pageSize = 1000;
const deleteBatchSize = 100;

async function getReferencedUrls() {
    const { rows } = await sql`
      SELECT DISTINCT url
      FROM (
        SELECT attachment_url as url
        FROM posts
        WHERE attachment_url IS NOT NULL
          AND attachment_url != ''
        UNION ALL
        SELECT jsonb_array_elements_text(COALESCE(attachment_urls, '[]'::jsonb)) as url
        FROM posts
        UNION ALL
        SELECT attachment_url as url
        FROM comments
        WHERE attachment_url IS NOT NULL
          AND attachment_url != ''
      ) referenced_urls
      WHERE url IS NOT NULL
        AND url != ''
    `;

    return new Set(rows.map((row) => row.url));
}

async function getForumBlobs() {
    const blobs = [];
    let cursor;

    do {
        const page = await list({
            prefix,
            limit: pageSize,
            cursor,
        });

        blobs.push(...page.blobs);
        cursor = page.cursor;
    } while (cursor);

    return blobs;
}

async function main() {
    const referencedUrls = await getReferencedUrls();
    const blobs = await getForumBlobs();
    const orphans = blobs.filter((blob) => !referencedUrls.has(blob.url));

    console.log(`Referenced attachment URLs: ${referencedUrls.size}`);
    console.log(`Forum blobs: ${blobs.length}`);
    console.log(`Orphan blobs: ${orphans.length}`);

    for (const blob of orphans.slice(0, 20)) {
        console.log(`- ${blob.pathname} (${blob.size} bytes)`);
    }

    if (orphans.length > 20) {
        console.log(`...and ${orphans.length - 20} more`);
    }

    if (!shouldDelete) {
        console.log('Dry run only. Re-run with --delete to remove orphan blobs.');
        return;
    }

    for (let i = 0; i < orphans.length; i += deleteBatchSize) {
        const batch = orphans.slice(i, i + deleteBatchSize).map((blob) => blob.url);
        await del(batch);
        console.log(`Deleted ${Math.min(i + deleteBatchSize, orphans.length)} / ${orphans.length}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
