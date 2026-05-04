import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROJECTS } from '@/data/projects';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    const user = await getUserById(Number(session.userId));
    if (user) redirect('/dashboard');
  }

  // Duplicate projects for seamless infinite loop
  const marqueeProjects = [...PROJECTS, ...PROJECTS];

  return (
    <div className="hub-bg" style={{
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#111827'
    }}>
      <div className="noise-overlay" />
      <div className="blob-3" />
      <div className="blob-4" />

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '15px 40px', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.7)',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#6c5ce7' }}>Hajimi</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/login" style={{
            padding: '8px 18px', borderRadius: '25px',
            background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
            textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(108,92,231,0.3)'
          }}>Sign In →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '30px 40px 10px', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '25px',
          background: 'rgba(162,155,254,0.15)', color: '#6c5ce7',
          fontSize: '0.8rem', fontWeight: 600, marginBottom: '15px',
          border: '1px solid rgba(162,155,254,0.3)'
        }}>✨ AI Club Student Community</div>

        <h1 className="animated-gradient-text" style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800,
          lineHeight: 1.05, marginBottom: '15px',
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 30%, #fd79a8 60%, #6c5ce7 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.03em'
        }}>
          Explore, Create,<br />and Exhibit
        </h1>

        <p style={{
          fontSize: '1.05rem', color: '#4b5563', maxWidth: '800px', margin: '0 auto 20px',
          lineHeight: 1.6
        }}>
          Meisha Honour Program AI Club: Student-led project incubation base and interactive forum.
        </p>

        <Link href="/login" style={{
          padding: '12px 32px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
          textDecoration: 'none', fontWeight: 700, fontSize: '1rem',
          boxShadow: '0 8px 20px rgba(108,92,231,0.25)',
          display: 'inline-flex', alignItems: 'center', gap: '8px'
        }}>Get Started 🚀</Link>
      </section>

      {/* Project Exhibition Marquee */}
      <section style={{ padding: '30px 0', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9ca3af', letterSpacing: '0.1em' }}>PROJECT SHOWCASE</h2>
        </div>
        
        <div className="marquee-container">
          <div className="marquee-content">
            {marqueeProjects.map((project, idx) => (
              <div key={`${project.id}-${idx}`} style={{
                width: '320px', height: '220px', flexShrink: 0,
                background: '#ffffff', borderRadius: '20px',
                border: '1px solid #e5e7eb',
                display: 'flex', flexDirection: 'column', padding: '24px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                position: 'relative', overflow: 'hidden',
                transition: 'transform 0.3s'
              }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '12px' }}>{project.emoji || '🧩'}</div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 10px', color: '#111827' }}>{project.title}</h4>
                <p style={{ 
                  fontSize: '0.85rem', color: '#4b5563', 
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', 
                  overflow: 'hidden', lineHeight: 1.5, marginBottom: 'auto' 
                }}>
                  {project.description}
                </p>
                <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                        {project.tags[0]}
                    </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / Intro */}
      <section style={{ padding: '40px 40px 80px', maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '30px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#4285F4' }}>20+ Projects</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>From 3D sailing simulators to AI-driven party games, explore a growing collection of student innovation.</p>
        </div>
        <div style={{ padding: '30px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#4285F4' }}>Live Forum</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>Engage in deep technical discussions and creative brainstorming in our distraction-free community.</p>
        </div>
      </section>

      {/* Simple Footer */}
      <footer style={{ textAlign: 'center', padding: '40px', opacity: 0.5, fontSize: '0.9rem' }}>
        © 2026 AI Club Student Community. Built with 💜 by Eric.
      </footer>
    </div>
  );
}
