import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPosts, createPost } from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';

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
        const title = formData.get('title') as string;
        const content = formData.get('content') as string;
        const type = formData.get('type') as string || 'text';
        const tag = formData.get('tag') as string || 'general';
        const file = formData.get('file') as File | null;

        let attachmentUrl = '';

        if (file && file.size > 0) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const filename = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const uploadDir = path.join(process.cwd(), 'public/uploads'); // Ensure this exists

            // Basic check if upload dir exists, if not need to create it manually or assume existing
            // For now we assume standard nextjs public folder setup.
            await writeFile(path.join(uploadDir, filename), buffer);
            attachmentUrl = '/uploads/' + filename;
        }

        await createPost(Number(session.userId), title, content, type, attachmentUrl, tag);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
