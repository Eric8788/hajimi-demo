import { getSession } from '@/lib/auth';
import { getUserById, type PostPage, type User } from '@/lib/db';
import Shell from '@/components/Shell';
import ForumFeed from '@/components/ForumFeed';

export const dynamic = 'force-dynamic';

function getForumSafeUser(user: User | null) {
    if (!user?.avatar?.startsWith('data:image/')) return user;
    return {
        ...user,
        avatar: user.avatar_emoji || '😊',
    };
}

export default async function Page() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;
    const safeUser = getForumSafeUser(user);

    let initialPage: PostPage = { posts: [], hasMore: false, nextOffset: 0 };
    try {
        const { getPostsPage } = await import('@/lib/db');
        initialPage = await getPostsPage('time', safeUser?.id, 'all', undefined, { limit: 15, offset: 0 });
    } catch (err) {
        console.error(err);
    }

    return (
        <Shell user={user}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
                <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>The Hallway 🗝️</h1>
                    <p style={{ opacity: 0.7 }}>Share resources, ask questions, or just hang out.</p>
                </div>

                <ForumFeed user={safeUser} initialPosts={initialPage.posts} initialHasMore={initialPage.hasMore} initialNextOffset={initialPage.nextOffset} />
            </div>
        </Shell>
    );
}
