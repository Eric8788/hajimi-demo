import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createProjectSubmission, getProjectSubmissions, getUserById, reviewProjectSubmission } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';
import { isVerifiedAccount } from '@/lib/verification';

const ALLOWED_TAGS = new Set(['Game', 'Tool', 'AI', 'Multiplayer', 'Simulation', 'Visual', 'Finance', 'Narrative', 'Sailing', 'Classroom']);

function normalizeTags(value: unknown) {
    if (!Array.isArray(value)) return ['Game'];
    const tags = value
        .map(tag => String(tag || '').trim())
        .filter(tag => ALLOWED_TAGS.has(tag))
        .slice(0, 5);
    return tags.length > 0 ? tags : ['Game'];
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const statusParam = String(searchParams.get('status') || 'pending');
        const status = statusParam === 'all' || statusParam === 'approved' || statusParam === 'rejected' ? statusParam : 'pending';
        const submissions = await getProjectSubmissions(status);
        return NextResponse.json(submissions);
    } catch (error) {
        console.error('Project Submissions GET Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以提交项目或新版本申请。' }, { status: 403 });
        }

        const body = await request.json();
        const submissionType = body.submissionType === 'new_version' ? 'new_version' : 'new_project';
        const submissionId = await createProjectSubmission({
            author_id: user.id,
            submission_type: submissionType,
            project_id: submissionType === 'new_version' ? Number(body.projectId) || null : null,
            title: body.title,
            description: body.description,
            emoji: body.emoji,
            url: body.url,
            tags: normalizeTags(body.tags),
            accent_color: body.accentColor,
            version_notes: body.versionNotes,
            cover_url: body.coverUrl,
        });

        return NextResponse.json({ success: true, submissionId });
    } catch (error: any) {
        if (error?.message === 'Invalid project title') {
            return NextResponse.json({ error: '项目名至少 2 个字符。' }, { status: 400 });
        }
        if (error?.message === 'Invalid project description') {
            return NextResponse.json({ error: '简介至少 8 个字符。' }, { status: 400 });
        }
        if (error?.message === 'Invalid project URL') {
            return NextResponse.json({ error: '项目链接必须是 http 或 https 地址。' }, { status: 400 });
        }
        if (error?.message === 'Missing project for version submission') {
            return NextResponse.json({ error: '请选择要更新的项目。' }, { status: 400 });
        }

        console.error('Project Submissions POST Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const reviewer = await getUserById(Number(session.userId));
        if (!reviewer || !isAdminRole(reviewer.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const submissionId = Number(body.submissionId);
        const action = String(body.action || '');
        const note = String(body.note || '').slice(0, 240);

        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        await reviewProjectSubmission(submissionId, reviewer.id, action === 'approve' ? 'approved' : 'rejected', note);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error?.message === 'Submission not found') {
            return NextResponse.json({ error: '这个申请已经被处理或不存在。' }, { status: 409 });
        }
        if (error?.message === 'Target project not found') {
            return NextResponse.json({ error: '要更新的项目不存在。' }, { status: 400 });
        }

        console.error('Project Submissions PATCH Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
