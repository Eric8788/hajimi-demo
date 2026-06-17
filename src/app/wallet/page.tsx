import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import WalletPanel from '@/components/WalletPanel';
import { getSession } from '@/lib/auth';
import { getCoinWalletOverview, getUserById } from '@/lib/db';
import { canUseMemberInteractions } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');

    const overview = await getCoinWalletOverview(Number(user.id));

    return (
        <Shell user={user}>
            <section className="main-view wallet-page">
                <div className="leaderboard-page-hero wallet-hero">
                    <div>
                        <span>Hajimi Coin</span>
                        <h1>H币钱包</h1>
                        <p>H币用于项目打赏、创作者激励和 token 兑换申请。XP 仍然只记录等级和贡献，不会被消费。</p>
                    </div>
                    <div className="wallet-hero-balance">
                        <strong>{overview.wallet.balance.toLocaleString()}</strong>
                        <span>H币余额</span>
                    </div>
                </div>
                <WalletPanel initialOverview={overview} verified={canUseMemberInteractions(user)} readOnlyRole={user.role} />
            </section>
        </Shell>
    );
}
