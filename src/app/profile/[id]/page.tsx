import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
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

    const profileUser = await getUserById(profileId);
    if (!profileUser) notFound();

    return (
        <Shell user={viewer}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
                <h1 style={{ marginBottom: '30px', fontSize: '2.5rem', textAlign: 'center' }}>Member Profile</h1>

                <div className="glass-panel" style={{ padding: '50px', background: 'rgba(255,255,255,0.7)' }}>
                    <ProfileCard user={profileUser} readOnly />
                </div>
            </div>
        </Shell>
    );
}
