import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { Post } from '@/lib/db';
import Shell from '@/components/Shell';
import ForumFeed from '@/components/ForumFeed';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    let initialPosts: Post[] = [];
    try {
        const { getPosts } = await import('@/lib/db');
        initialPosts = await getPosts('time', user?.id);
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

                <ForumFeed user={user} initialPosts={initialPosts} />
            </div>
        </Shell>
    );
}
