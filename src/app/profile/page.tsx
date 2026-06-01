import { getSession } from '@/lib/auth';
import { getPostsByAuthor, getProfileAnalytics, getProjectsByAuthor, getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import ProfileCard from '@/components/ProfileCard';
import Shell from '@/components/Shell';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');
    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    const posts = await getPostsByAuthor(user.id, user.id);
    const projects = await getProjectsByAuthor(user.id);
    const analytics = await getProfileAnalytics(user.id);

    return (
        <Shell user={user}>
            <div className="profile-page-shell">
                <div className="glass-panel profile-page-panel">
                    <ProfileCard user={user} posts={posts} projects={projects} analytics={analytics} />
                </div>
            </div>
        </Shell>
    );
}
