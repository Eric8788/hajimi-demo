import { getSession } from '@/lib/auth';
import { getUserById, type User } from '@/lib/db';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import CheckInButton from '@/components/CheckInButton';
import Link from 'next/link';
import TarotGame from '@/components/TarotGame';
import { getRecentPostHighlights } from '@/lib/db';
import LeaderboardWidget from '@/components/LeaderboardWidget';
import Avatar from '@/components/Avatar';
import DashboardAlumniPreview from '@/components/DashboardAlumniPreview';
import DashboardPromoCarousel from '@/components/DashboardPromoCarousel';

function getDevDashboardUser(userId: number): User {
  return {
    id: userId,
    username: 'Local Tester',
    points: 0,
    level: 1,
    role: 'student',
    avatar: '😊',
    avatar_theme: 'lavender',
    streak_count: 0,
    daily_likes_count: 0,
    created_at: new Date().toISOString(),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await getUserById(Number(session.userId)).catch((error) => {
    if (process.env.NODE_ENV === 'production') throw error;
    console.warn('Dashboard user unavailable in dev, using local fallback:', error);
    return getDevDashboardUser(Number(session.userId));
  });
  if (!user) redirect('/login');

  const recentTwo = await getRecentPostHighlights(2).catch((error) => {
    if (process.env.NODE_ENV === 'production') throw error;
    console.warn('Dashboard posts unavailable:', error);
    return [];
  });

  return (
    <Shell user={user}>
      <section className="main-view dashboard-page">

        {/* Welcome Banner */}
        <div className="glass-card full-width dashboard-welcome-card">
          <div className="dashboard-cat-mascot" aria-hidden="true" style={{ left: '-20px', opacity: 0.35 }} />
          
          <div className="dashboard-welcome-content">
            <Avatar value={user.avatar} theme={user.avatar_theme} size={64} />
            <div>
              <h2 className="dashboard-welcome-title">Good Morning, {user.username}! 🌤️</h2>
              <p className="dashboard-welcome-insight">Today&apos;s Insight: Life is like a mushroom, handle with care.</p>
            </div>
          </div>

          <div className="dashboard-checkin-slot">
            <CheckInButton />
          </div>
        </div>

        <DashboardPromoCarousel userRole={user.role} />

        <DashboardAlumniPreview />

        <div className="dashboard-grid">

          {/* Leaderboard Widget */}
          <LeaderboardWidget limit={5} defaultWindow="week" subtitle="本周 Top 5" />

          {/* Oracle Widget */}
          <div className="glass-card full-width" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255, 255, 255, 0.65)' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '1.4rem', alignSelf: 'flex-start' }}>✨ Cyber Oracle</h3>
            <div style={{ margin: '10px 0', transform: 'scale(0.9)', transformOrigin: 'top center' }}>
                <TarotGame />
            </div>
          </div>


          {/* Rec Room Widget */}
          <div className="glass-card full-width" style={{ padding: '30px', background: 'rgba(255, 255, 255, 0.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem', margin: 0 }}>💬 Rec Room Highlights</h3>
              <Link href="/resources" style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.7)', borderRadius: '16px', padding: '20px',
              border: '1px solid rgba(255,255,255,0.8)',
              display: 'flex', flexDirection: 'column', gap: '15px'
            }}>
              {recentTwo.map((post) => (
                <div key={post.id} style={{ 
                    paddingBottom: '15px', borderBottom: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span style={{ fontWeight: 700, color: '#2d3436', fontSize: '0.95rem' }}>{post.author_name || 'Anonymous'}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fd79a8', background: 'rgba(253, 121, 168, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>New</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 500, paddingLeft: '36px' }}>
                    <Link href={`/resources`} style={{ textDecoration: 'none', color: '#111827', transition: 'color 0.2s' }}>
                      {post.title}
                    </Link>
                  </div>
                </div>
              ))}
              {recentTwo.length === 0 && (
                <div style={{ fontSize: '0.95rem', color: '#888', textAlign: 'center', padding: '20px' }}>No recent messages in the Hallway.</div>
              )}
            </div>
          </div>

        </div>
      </section>
    </Shell>
  );
}
