import { getSession } from '@/lib/auth';
import { getUserById, getPosts } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  // If already logged in, go straight to dashboard
  const session = await getSession();
  if (session) {
    const user = await getUserById(Number(session.userId));
    if (user) redirect('/dashboard');
  }

  // Fetch a few trending posts for the public preview (no userId needed)
  let trendingPosts: { id: number; title: string; tag: string; likes: number; author_name?: string; comment_count?: number }[] = [];
  try {
    const posts = await getPosts('heat');
    trendingPosts = posts.slice(0, 3);
  } catch {
    // silently fail if DB is unavailable
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f0ff 0%, #e8f4fd 50%, #fdf0f8 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.8)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#6c5ce7' }}>🎌 Hajimi-Dan</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/resources" style={{
            padding: '10px 20px', borderRadius: '25px',
            background: 'rgba(255,255,255,0.7)', color: '#6c5ce7',
            border: '1px solid rgba(108,92,231,0.3)', textDecoration: 'none',
            fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'
          }}>Browse Posts</Link>
          <Link href="/login" style={{
            padding: '10px 20px', borderRadius: '25px',
            background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
            textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
            boxShadow: '0 4px 15px rgba(108,92,231,0.35)'
          }}>Sign In →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 40px 80px' }}>
        <div style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: '25px',
          background: 'rgba(162,155,254,0.2)', color: '#6c5ce7',
          fontSize: '0.9rem', fontWeight: 600, marginBottom: '30px',
          border: '1px solid rgba(162,155,254,0.4)'
        }}>✨ The AI Club Student Community</div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900,
          lineHeight: 1.1, marginBottom: '25px',
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 40%, #fd79a8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Where Students<br />Connect & Create
        </h1>

        <p style={{
          fontSize: '1.2rem', color: '#636e72', maxWidth: '540px', margin: '0 auto 45px',
          lineHeight: 1.7
        }}>
          Share ideas, ask questions, explore resources, and earn XP with your classmates in a beautiful, distraction-free space.
        </p>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{
            padding: '16px 36px', borderRadius: '30px',
            background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
            textDecoration: 'none', fontWeight: 700, fontSize: '1.05rem',
            boxShadow: '0 8px 25px rgba(108,92,231,0.4)',
            display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}>Join the Club 🚀</Link>
          <Link href="/resources" style={{
            padding: '16px 36px', borderRadius: '30px',
            background: 'rgba(255,255,255,0.8)', color: '#6c5ce7',
            textDecoration: 'none', fontWeight: 700, fontSize: '1.05rem',
            border: '2px solid rgba(108,92,231,0.25)',
            display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}>Browse Posts 👀</Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section style={{ padding: '0 40px 80px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {[
            { icon: '💬', title: 'The Hallway', desc: 'Post discussions, share resources, and ask questions anonymously or openly.' },
            { icon: '⭐', title: 'XP System', desc: 'Earn experience points for posting, commenting, and daily check-ins.' },
            { icon: '🎴', title: 'Cyber Oracle', desc: 'Get daily insights from the Tarot Trinity — past, present, and future.' },
            { icon: '🧩', title: 'Mini Tools', desc: 'Explore utilities, games, and digital tools built by club members.' },
          ].map((f) => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.7)', borderRadius: '24px', padding: '28px',
              border: '1px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '14px' }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, marginBottom: '8px', color: '#2d3436' }}>{f.title}</h3>
              <p style={{ color: '#636e72', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Posts Preview */}
      {trendingPosts.length > 0 && (
        <section style={{ padding: '0 40px 100px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, color: '#2d3436', marginBottom: '30px' }}>
            🔥 Trending Right Now
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {trendingPosts.map((post) => (
              <Link key={post.id} href="/resources" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.75)', borderRadius: '20px', padding: '22px 28px',
                  border: '1px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: 'rgba(162,155,254,0.2)', color: '#6c5ce7'
                      }}>#{post.tag}</span>
                      <span style={{ fontSize: '0.8rem', color: '#636e72' }}>by {post.author_name}</span>
                    </div>
                    <h4 style={{ fontWeight: 700, color: '#2d3436', fontSize: '1rem', margin: 0 }}>{post.title}</h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#b2bec3', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <span>❤️ {post.likes}</span>
                    <span>💬 {post.comment_count || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '25px' }}>
            <Link href="/resources" style={{
              padding: '12px 28px', borderRadius: '25px',
              background: 'rgba(255,255,255,0.8)', color: '#6c5ce7',
              textDecoration: 'none', fontWeight: 600,
              border: '1px solid rgba(108,92,231,0.25)'
            }}>See all posts →</Link>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section style={{
        textAlign: 'center', padding: '80px 40px',
        background: 'linear-gradient(135deg, rgba(108,92,231,0.1), rgba(253,121,168,0.1))',
        borderTop: '1px solid rgba(255,255,255,0.6)'
      }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#2d3436', marginBottom: '15px' }}>Ready to join?</h2>
        <p style={{ color: '#636e72', marginBottom: '30px', fontSize: '1.05rem' }}>It&apos;s free, it&apos;s fun, and your classmates are already here.</p>
        <Link href="/login" style={{
          padding: '16px 40px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
          textDecoration: 'none', fontWeight: 700, fontSize: '1.05rem',
          boxShadow: '0 8px 25px rgba(108,92,231,0.4)'
        }}>Create Account 🎌</Link>
      </section>
    </div>
  );
}
