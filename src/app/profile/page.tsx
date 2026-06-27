import { getSession } from '@/lib/auth';
import { getArticlesByAuthor, getPostsByAuthor, getProjectsByAuthor, getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import ProfilePageClient from '@/components/ProfilePageClient';
import Shell from '@/components/Shell';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');
    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    const posts = await getPostsByAuthor(user.id, user.id);
    const projects = await getProjectsByAuthor(user.id);
    const articles = await getArticlesByAuthor(user.id);

    return (
        <Shell user={user}>
            <div className="profile-page-shell">
                <div className="glass-panel profile-page-panel">
                    <ProfilePageClient user={user} posts={posts} projects={projects} articles={articles} />
                </div>
            </div>
        </Shell>
    );
}
