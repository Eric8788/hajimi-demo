import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPosts, createPost } from '@/lib/db';
import { put } from '@vercel/blob';

const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024;

function safeFilename(name: string) {
    const extension = name.includes('.') ? name.split('.').pop() : 'file';
    const baseName = name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60) || 'attachment';

    return `${baseName}.${extension?.replace(/[^a-zA-Z0-9]/g, '') || 'file'}`;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sort = (searchParams.get('sort') || 'time') as 'time' | 'heat' | 'likes';
    const filter = (searchParams.get('filter') || 'all') as 'all' | 'saved';
    const tag = searchParams.get('tag') || undefined;
    const session = await getSession();

    try {
        const posts = await getPosts(sort, session ? Number(session.userId) : undefined, filter, tag);
        return NextResponse.json(posts, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate'
            }
        });
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const title = String(formData.get('title') || '').trim();
        const content = String(formData.get('content') || '').trim();
        let type = 'text';
        const tag = formData.get('tag') as string || 'general';
        const file = formData.get('file') as File | null;

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        let attachmentUrl = '';

        if (file && file.size > 0) {
            if (file.size > MAX_ATTACHMENT_SIZE) {
                return NextResponse.json({ error: 'Attachment must be 4 MB or smaller' }, { status: 413 });
            }

            if (!process.env.BLOB_READ_WRITE_TOKEN) {
                return NextResponse.json({ error: 'File uploads are not configured yet' }, { status: 503 });
            }

            const blobName = `forum/${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
            const blob = await put(blobName, file, {
                access: 'public',
                contentType: file.type || undefined,
            });

            attachmentUrl = blob.url;
            type = file.type.startsWith('image/') ? 'image' : 'file';
        }

        await createPost(Number(session.userId), title, content, type, attachmentUrl, tag);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
