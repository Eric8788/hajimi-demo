import Shell from '@/components/Shell';
import HasdaqDashboard from '@/components/HasdaqDashboard';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HasdaqPage() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <section className="main-view hasdaq-page">
                <HasdaqDashboard user={user} />
            </section>
        </Shell>
    );
}
