import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import CheckInButton from '@/components/CheckInButton';
import Link from 'next/link';
import TarotGame from '@/components/TarotGame';
import { getPosts } from '@/lib/db';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await getUserById(Number(session.userId));
  if (!user) redirect('/login');

  const latestPosts = await getPosts('time');
  const recentTwo = latestPosts.slice(0, 2);

  return (
    <Shell user={user}>
      <section className="main-view">

        {/* Welcome Banner */}
        <div className="glass-card full-width" style={{ position: 'relative', overflow: 'hidden', padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ marginBottom: '10px' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '5px' }}>Good Morning, {user.username}! 🌤️</h2>
              <p style={{ opacity: 0.8, fontSize: '1.1rem' }}>Today&apos;s Insight: Life is like a mushroom, handle with care.</p>
            </div>
          </div>
          <div style={{ zIndex: 2 }}>
            <CheckInButton />
          </div>

          {/* Decoration */}
          <div style={{ position: 'absolute', right: '-20px', top: '-40px', fontSize: '12rem', opacity: 0.1, zIndex: 1, filter: 'blur(4px)' }}>
            🍄
          </div>
        </div>

        <div className="dashboard-grid">

          {/* Timeline Widget */}
          <div className="glass-card full-width">
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>⏳ Timeline Dancer</h3>
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
              <div style={{
                background: 'rgba(255, 234, 167, 0.4)', padding: '20px', borderRadius: '20px', minWidth: '140px',
                backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.5)', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>☀️</div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>Wake Up</strong>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '5px' }}>6:00 AM</div>
              </div>
              <div style={{
                background: 'rgba(116, 185, 255, 0.3)', padding: '20px', borderRadius: '20px', minWidth: '140px',
                backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.5)', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🚿</div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>Shower</strong>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '5px' }}>6:20 AM</div>
              </div>
              <div style={{
                background: 'rgba(85, 239, 196, 0.3)', padding: '20px', borderRadius: '20px', minWidth: '140px',
                backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.5)', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🚌</div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>Bus</strong>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '5px' }}>7:00 AM</div>
              </div>
              <div style={{
                background: 'rgba(162, 155, 254, 0.3)', padding: '20px', borderRadius: '20px', minWidth: '140px',
                backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.5)', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏫</div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>School</strong>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '5px' }}>8:00 AM</div>
              </div>
            </div>
          </div>

          {/* Oracle Widget */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '1.4rem' }}>✨ Cyber Oracle</h3>
            <div style={{ flex: 1, margin: '-10px', zoom: 0.85 }}>
                <TarotGame />
            </div>
          </div>

          {/* Rec Room Widget */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>💬 Rec Room</h3>
            <div style={{
              background: 'rgba(255,255,255,0.5)', borderRadius: '20px', padding: '20px', height: '200px',
              border: '1px solid rgba(255,255,255,0.6)',
              display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto'
            }}>
              {recentTwo.map((post) => (
                <div key={post.id} style={{ paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#6c5ce7' }}>{post.author_name || 'Anonymous'}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>New</span>
                  </div>
                  <div style={{ fontSize: '0.95rem' }}>
                    <Link href={`/resources`} style={{ textDecoration: 'none', color: '#2d3436' }}>
                      {post.title}
                    </Link>
                  </div>
                </div>
              ))}
              {recentTwo.length === 0 && (
                <div style={{ fontSize: '0.95rem', opacity: 0.5, textAlign: 'center', marginTop: '20px' }}>No recent messages.</div>
              )}
            </div>
          </div>

        </div>
      </section>
    </Shell>
  );
}
