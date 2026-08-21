import { getSession } from '@/lib/auth';
import { getArticlesByAuthor, getMemberProfileUserById, getPostsByAuthor, getProjectsByAuthor, getUserById } from '@/lib/db';
import { canViewMemberIdentity } from '@/lib/access';
import { notFound, redirect } from 'next/navigation';
import ProfileCard from '@/components/ProfileCard';
import Shell from '@/components/Shell';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) redirect('/login');

    const viewer = await getUserById(Number(session.userId));
    if (!viewer) redirect('/login');

    const { id } = await params;
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) notFound();
    if (profileId === viewer.id) redirect('/profile');

    const profileUser = await getMemberProfileUserById(profileId, canViewMemberIdentity(viewer));
    if (!profileUser) notFound();
    const posts = await getPostsByAuthor(profileUser.id, viewer.id);
    const projects = await getProjectsByAuthor(profileUser.id);
    const articles = await getArticlesByAuthor(profileUser.id);

    return (
        <Shell user={viewer}>
            <div className="profile-page-shell">
                <div className="glass-panel profile-page-panel">
                    <ProfileCard user={profileUser} readOnly posts={posts} projects={projects} articles={articles} />
                </div>
            </div>
        </Shell>
    );
}
