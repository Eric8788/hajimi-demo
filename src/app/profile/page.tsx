import { getSession } from '@/lib/auth';
import { getArticlesByAuthor, getMemberProfileUserById, getPostsByAuthor, getProjectsByAuthor, getUserById } from '@/lib/db';
import { canViewMemberIdentity } from '@/lib/access';
import { redirect } from 'next/navigation';
import ProfilePageClient from '@/components/ProfilePageClient';
import Shell from '@/components/Shell';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');
    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    const profileUser = await getMemberProfileUserById(user.id, canViewMemberIdentity(user));
    if (!profileUser) redirect('/login');
    const posts = await getPostsByAuthor(profileUser.id, profileUser.id);
    const projects = await getProjectsByAuthor(profileUser.id);
    const articles = await getArticlesByAuthor(profileUser.id);

    return (
        <Shell user={user}>
            <div className="profile-page-shell">
                <div className="glass-panel profile-page-panel">
                    <ProfilePageClient user={profileUser} posts={posts} projects={projects} articles={articles} />
                </div>
            </div>
        </Shell>
    );
}
