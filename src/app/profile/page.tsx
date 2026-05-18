import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import ProfileCard from '@/components/ProfileCard';
import Shell from '@/components/Shell';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');
    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');

    return (
        <Shell user={user}>
            <div className="profile-page-shell">
                <div className="profile-page-heading">
                    <span>Hajimi account</span>
                    <h1>My Profile</h1>
                </div>

                <div className="glass-panel profile-page-panel">
                    <ProfileCard user={user} />
                </div>
            </div>
        </Shell>
    );
}
