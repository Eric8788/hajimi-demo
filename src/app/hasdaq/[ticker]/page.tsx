import Shell from '@/components/Shell';
import HasdaqStockPanel from '@/components/HasdaqStockPanel';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HasdaqTickerPage({ params }: { params: Promise<{ ticker: string }> }) {
    const { ticker } = await params;
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <section className="main-view hasdaq-page">
                <HasdaqStockPanel ticker={String(ticker || '').toUpperCase()} user={user} />
            </section>
        </Shell>
    );
}
