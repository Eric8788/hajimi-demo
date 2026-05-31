import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';

const MAX_PROJECT_COVER_SIZE = 1 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

function safeFilename(name: string) {
    const extension = name.includes('.') ? name.split('.').pop() : 'webp';
    const baseName = name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60) || 'project-cover';

    return `${baseName}.${extension?.replace(/[^a-zA-Z0-9]/g, '') || 'webp'}`;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以上传项目封面。' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file || file.size <= 0) {
            return NextResponse.json({ error: '请选择一张项目截图。' }, { status: 400 });
        }

        if (!ALLOWED_COVER_TYPES.has(file.type)) {
            return NextResponse.json({ error: '项目封面只支持 JPEG、PNG 或 WebP。' }, { status: 415 });
        }

        if (file.size > MAX_PROJECT_COVER_SIZE) {
            return NextResponse.json({ error: '项目封面需要小于 1 MB。' }, { status: 413 });
        }

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json({ error: 'File uploads are not configured yet' }, { status: 503 });
        }

        const blobName = `project-covers/${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
        const blob = await put(blobName, file, {
            access: 'public',
            contentType: file.type || undefined,
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error('Project cover upload error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
