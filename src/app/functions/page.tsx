import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import TarotGame from '@/components/TarotGame';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');
    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');

    return (
        <Shell user={user}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
                <h1 style={{ marginBottom: '10px', fontSize: '2.5rem', textAlign: 'center' }}>🧩 Function Hall</h1>
                <p style={{ textAlign: 'center', marginBottom: '40px', opacity: 0.7 }}>Utilities, games, and digital tools.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>

                    {/* Tarot Game Module */}
                    <div className="glass-panel" style={{ padding: '30px', gridColumn: '1 / -1' }}>
                        <TarotGame />
                    </div>

                    {/* Snake.io Link */}
                    <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="glass-panel hover-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '100%', transition: 'transform 0.2s' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🐍</div>
                            <h3 style={{ marginBottom: '10px' }}>Snake.io</h3>
                            <p style={{ opacity: 0.7, textAlign: 'center' }}>Slither into the classic arcade action.</p>
                            <div style={{ marginTop: '15px', padding: '5px 12px', background: 'rgba(46, 213, 115, 0.2)', color: '#2ed573', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600 }}>Localhost:3000</div>
                        </div>
                    </a>

                    {/* Quant Panel Link */}
                    <a href="https://unqualifyingly-nonregimented-rea.ngrok-free.dev/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="glass-panel hover-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '100%', transition: 'transform 0.2s' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📈</div>
                            <h3 style={{ marginBottom: '10px' }}>Quant Panel</h3>
                            <p style={{ opacity: 0.7, textAlign: 'center' }}>Advanced financial alerts and monitoring.</p>
                            <div style={{ marginTop: '15px', padding: '5px 12px', background: 'rgba(55, 66, 250, 0.2)', color: '#3742fa', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600 }}>External Tool</div>
                        </div>
                    </a>

                </div>
            </div>

            <style>{`
                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }
            `}</style>
        </Shell>
    );
}
