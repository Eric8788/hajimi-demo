import { redirect } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import HasdaqApplyPanel from '@/components/HasdaqApplyPanel';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HasdaqApplyPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');

    return (
        <Shell user={user}>
            <section className="main-view hasdaq-page">
                <Link href="/hasdaq" className="hasdaq-apply-back">← 返回 Hasdaq</Link>
                <div className="leaderboard-page-hero">
                    <div>
                        <span>Hasdaq IPO</span>
                        <h1>申请上市</h1>
                        <p>公司至少需要一个已上线或完整可使用的成熟项目。提交后由管理员审核，批准后进入 IPO 认购。</p>
                    </div>
                </div>
                <HasdaqApplyPanel user={user} />
            </section>
        </Shell>
    );
}
