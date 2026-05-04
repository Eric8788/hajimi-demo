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
    <div className="dynamic-bg" style={{
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#2d3436'
    }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.3)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#6c5ce7' }}>Hajimi</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/login" style={{
            padding: '10px 20px', borderRadius: '25px',
            background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
            textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
            boxShadow: '0 4px 15px rgba(108,92,231,0.35)'
          }}>Sign In →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 40px 40px' }}>
        <div style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: '25px',
          background: 'rgba(162,155,254,0.2)', color: '#6c5ce7',
          fontSize: '0.9rem', fontWeight: 600, marginBottom: '25px',
          border: '1px solid rgba(162,155,254,0.4)'
        }}>✨ AI Club Student Community</div>

        <h1 className="animated-gradient-text" style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 900,
          lineHeight: 1.1, marginBottom: '20px',
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 30%, #fd79a8 60%, #6c5ce7 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Explore, Create,<br />and Exhibit
        </h1>

        <p style={{
          fontSize: '1.2rem', color: '#636e72', maxWidth: '600px', margin: '0 auto 40px',
          lineHeight: 1.7
        }}>
          The high-fidelity exhibition for student-led AI projects and creative tools. Join the club to launch your own vision.
        </p>

        <Link href="/login" style={{
          padding: '16px 40px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
          textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem',
          boxShadow: '0 12px 30px rgba(108,92,231,0.4)',
          display: 'inline-flex', alignItems: 'center', gap: '10px'
        }}>Get Started 🚀</Link>
      </section>

      {/* Project Exhibition Marquee */}
      <section style={{ padding: '60px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, opacity: 0.6 }}>PROJECT SHOWCASE</h2>
        </div>
        
        <div className="marquee-container">
          <div className="marquee-content">
            {marqueeProjects.map((project, idx) => (
              <div key={`${project.id}-${idx}`} style={{
                width: '320px', height: '200px', flexShrink: 0,
                background: 'rgba(255,255,255,0.6)', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', flexDirection: 'column', padding: '20px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>{project.emoji || '🧩'}</div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px' }}>{project.title}</h4>
                <p style={{ fontSize: '0.85rem', color: '#636e72', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                  {project.description}
                </p>
                <div style={{ position: 'absolute', bottom: '20px', left: '20px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', background: 'rgba(108,92,231,0.1)', color: '#6c5ce7' }}>
                        {project.tags[0]}
                    </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / Intro */}
      <section style={{ padding: '80px 40px', maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '2rem', marginBottom: '15px', color: '#6c5ce7' }}>20+ Projects</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.6 }}>From 3D sailing simulators to AI-driven party games, explore a growing collection of student innovation.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '2rem', marginBottom: '15px', color: '#6c5ce7' }}>Live Forum</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.6 }}>Engage in deep technical discussions and creative brainstorming in our distraction-free "Hallway".</p>
        </div>
      </section>

      {/* Simple Footer */}
      <footer style={{ textAlign: 'center', padding: '40px', opacity: 0.5, fontSize: '0.9rem' }}>
        © 2026 AI Club Student Community. Built with 💜 by Eric.
      </footer>
    </div>
  );
}
