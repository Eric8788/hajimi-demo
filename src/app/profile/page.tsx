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
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
                <h1 style={{ marginBottom: '30px', fontSize: '2.5rem', textAlign: 'center' }}>Student Identity</h1>

                <div className="glass-panel" style={{ padding: '50px', background: 'rgba(255,255,255,0.7)' }}>
                    <ProfileCard user={user} />
                </div>
            </div>
        </Shell>
    );
}
