import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROJECTS } from '@/data/projects';
import ParticleBackground from '@/components/ParticleBackground';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';

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
      <ParticleBackground />

      {/* Nav */}
      <nav className="landing-topbar">
        <div className="landing-brand-area">
            <Link href="/" className="landing-brand">Hajimi</Link>
            <div className="landing-version-pill">
              <span className="landing-live-dot" />
              {APP_VERSION_LABEL.replace('Hajimi Beta ', 'Beta ')}
            </div>
            <div className="landing-subtitle">
                Meisha Honour Program AI Club
            </div>
        </div>
        <div className="landing-actions">
          <Link href="/login" className="landing-outline-btn">Log in</Link>
          <Link href="/login" className="landing-primary-btn">Join Beta</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '34px 40px 12px', position: 'relative', zIndex: 10 }}>
        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '25px',
          background: 'rgba(162,155,254,0.15)', color: '#6c5ce7',
          fontSize: '0.8rem', fontWeight: 600, marginBottom: '18px',
          border: '1px solid rgba(162,155,254,0.3)'
        }}>✨ AI Club Student Community</div>

        <h1 className="animated-gradient-text" style={{
          fontSize: 'clamp(2.5rem, 7.4vw, 5rem)', fontWeight: 900,
          lineHeight: 1.12, marginBottom: '20px', paddingBottom: '10px',
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 30%, #fd79a8 60%, #6c5ce7 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0'
        }}>
          Let&apos;s Create<br />Together
        </h1>

        <Link href="/login" className="landing-hero-cta" style={{
          padding: '12px 32px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white',
          textDecoration: 'none', fontWeight: 700, fontSize: '1rem',
          boxShadow: '0 8px 20px rgba(108,92,231,0.25)',
          display: 'inline-flex', alignItems: 'center', gap: '8px'
        }}>Get Started 🚀</Link>
      </section>

      {/* Project Exhibition Marquee */}
      <section id="projects" style={{ padding: '10px 0 20px', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9ca3af', letterSpacing: '0.1em' }}>PROJECT SHOWCASE</h2>
        </div>
        
        <div className="marquee-container">
          <div className="marquee-content">
            {marqueeProjects.map((project, idx) => (
              <div key={`${project.id}-${idx}`} className="project-card" style={{
                width: '320px', height: '220px', flexShrink: 0,
                background: 'rgba(255,255,255,0.85)', borderRadius: '20px',
                border: '1px solid #e5e7eb',
                display: 'flex', flexDirection: 'column', padding: '24px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                position: 'relative', overflow: 'hidden',
                backdropFilter: 'blur(5px)'
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
      <section id="about" style={{ padding: '34px 40px 34px', maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '30px', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid #e5e7eb', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#6c5ce7' }}>20+ Projects</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>From 3D sailing simulators to AI-driven party games, explore a growing collection of student innovation.</p>
        </div>
        <div style={{ padding: '30px', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid #e5e7eb', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#6c5ce7' }}>Live Forum</h3>
            <p style={{ opacity: 0.7, lineHeight: 1.5, fontSize: '0.95rem' }}>Engage in deep technical discussions and creative brainstorming in our distraction-free community.</p>
        </div>
      </section>

      <section className="landing-principles" aria-label="Hajimi principles">
        <div>
          <span>👥</span>
          <strong>Student-built</strong>
          <p>Made by students, with heart.</p>
        </div>
        <div>
          <span>⚑</span>
          <strong>Club-led</strong>
          <p>Run by the AI Club team.</p>
        </div>
        <div>
          <span>🔒</span>
          <strong>Invite-gated</strong>
          <p>Safe space for members.</p>
        </div>
        <div>
          <span>◎</span>
          <strong>Public browse</strong>
          <p>Explore projects and updates.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>Hajimi</strong>
          <span>AI Club</span>
          <span>{APP_VERSION_LABEL} · {APP_RELEASE_DATE}</span>
          <span>Built with 💜 by AI Club and Eric.</span>
        </div>
        <div className="landing-footer-links">
          <Link href="#about">About</Link>
          <Link href="/functions">Projects</Link>
          <Link href="/resources">Hallway</Link>
          <Link href="/login">Login</Link>
        </div>
      </footer>
    </div>
  );
}
