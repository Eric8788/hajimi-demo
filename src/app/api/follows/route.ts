import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    createNotification,
    followUser,
    getFollowStatus,
    getUserById,
    unfollowUser,
} from '@/lib/db';
import { getInteractionBlockedMessage } from '@/lib/access';
import { isVerifiedAccount } from '@/lib/verification';

function getTargetUserId(request: Request) {
    const { searchParams } = new URL(request.url);
    return Number(searchParams.get('userId') || searchParams.get('followingId') || 0);
}

async function getViewer() {
    const session = await getSession();
    if (!session) return null;

    const userId = Number(session.userId);
    const user = await getUserById(userId);
    return user ? { user, userId } : null;
}

function canFollow(user: { verification_status?: string | null; role?: string | null; account_status?: string | null } | null) {
    return Boolean(user && user.account_status !== 'disabled' && isVerifiedAccount(user));
}

export async function GET(request: Request) {
    try {
        const targetUserId = getTargetUserId(request);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const target = await getUserById(targetUserId);
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const viewer = await getViewer();
        const targetAvailable = target.account_status !== 'disabled';
        const allowed = targetAvailable && canFollow(viewer?.user || null) && viewer?.userId !== targetUserId;
        const followBlockedMessage = !targetAvailable
            ? ''
            : !viewer
                ? '登录并完成 Hajimi 认证后可以关注用户。'
                : viewer.userId === targetUserId
                    ? '不能关注自己。'
                    : canFollow(viewer.user)
                        ? ''
                        : getInteractionBlockedMessage(viewer.user, '关注用户');
        const isFollowing = viewer?.userId
            ? await getFollowStatus(viewer.userId, targetUserId)
            : false;

        return NextResponse.json({
            isFollowing,
            canFollow: allowed,
            targetAvailable,
            followBlockedMessage,
        }, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error) {
        console.error('GET /api/follows failed:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const viewer = await getViewer();
        if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canFollow(viewer.user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(viewer.user, '关注用户') }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const targetUserId = Number(body?.userId || body?.followingId || 0);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }
        if (targetUserId === viewer.userId) {
            return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
        }

        const target = await getUserById(targetUserId);
        if (!target || target.account_status === 'disabled') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const created = await followUser(viewer.userId, targetUserId);
        if (created) {
            await createNotification({
                recipientId: targetUserId,
                actorId: viewer.userId,
                type: 'user_follow',
            });
        }

        return NextResponse.json({ success: true, isFollowing: true });
    } catch (error) {
        console.error('POST /api/follows failed:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const viewer = await getViewer();
        if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canFollow(viewer.user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(viewer.user, '取消关注') }, { status: 403 });
        }

        const targetUserId = getTargetUserId(request);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }
        if (targetUserId === viewer.userId) {
            return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
        }

        await unfollowUser(viewer.userId, targetUserId);
        return NextResponse.json({ success: true, isFollowing: false });
    } catch (error) {
        console.error('DELETE /api/follows failed:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
