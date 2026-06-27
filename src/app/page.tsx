import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROJECTS } from '@/data/projects';
import ParticleBackground from '@/components/ParticleBackground';
import RotatingText from '@/components/reactbits/RotatingText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';

export const dynamic = 'force-dynamic';

const HERO_WORDS = ['Create', 'Build', 'Ship', 'Learn'];

function getProjectSpotlightColor(accentColor: string) {
  return accentColor
    .replace('0.2)', '0.46)')
    .replace('0.18)', '0.42)')
    .replace('0.16)', '0.38)');
}

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    const user = await getUserById(Number(session.userId));
    if (user) redirect('/dashboard');
  }

  const marqueeProjects = [...PROJECTS, ...PROJECTS];

  return (
    <div className="hub-bg landing-page">
      <ParticleBackground />

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

      <section className="landing-hero">
        <div className="landing-hero-badge">AI Club Student Community</div>

        <h1 className="landing-hero-title" aria-label="Let's create together">
          <span className="landing-title-line landing-title-line-with-rotator">
            <span className="landing-gradient-copy">Let&apos;s</span>
            <RotatingText
              texts={HERO_WORDS}
              mainClassName="landing-hero-rotator"
              splitLevelClassName="landing-rotator-split"
              elementLevelClassName="landing-rotator-character"
              staggerFrom="center"
              staggerDuration={0.018}
              rotationInterval={2400}
              initial={{ y: '115%', rotateX: -40, opacity: 0 }}
              animate={{ y: 0, rotateX: 0, opacity: 1 }}
              exit={{ y: '-120%', rotateX: 36, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 420 }}
            />
          </span>
          <span className="landing-title-line landing-gradient-copy">Together</span>
        </h1>

        <p className="landing-hero-subcopy">
          A student community for sharing projects, testing ideas, and turning club experiments into real tools.
        </p>

        <div className="landing-hero-actions">
          <Link href="/login" className="landing-hero-cta">Get Started</Link>
          <Link href="/functions" className="landing-hero-secondary">Explore Projects</Link>
        </div>
      </section>

      <section id="projects" className="landing-showcase-section">
        <div className="landing-section-heading">
          <span>Live from Function Hall</span>
          <h2>Project Showcase</h2>
        </div>

        <div className="marquee-container landing-marquee">
          <div className="marquee-content landing-marquee-content">
            {marqueeProjects.map((project, idx) => (
              <SpotlightCard
                key={`${project.id}-${idx}`}
                className="project-card landing-project-card"
                spotlightColor={getProjectSpotlightColor(project.accentColor)}
              >
                <div className="landing-project-icon">{project.emoji || 'AI'}</div>
                <div className="landing-project-copy">
                  <span>{project.author}</span>
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                </div>
                <div className="landing-project-footer">
                  <span>{project.tags[0]}</span>
                  <strong>{project.status === 'live' ? 'Live' : 'Soon'}</strong>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="landing-info-grid">
        <SpotlightCard className="landing-info-card is-violet" spotlightColor="rgba(108, 92, 231, 0.2)">
          <span>01</span>
          <h3>20+ Projects</h3>
          <p>From sailing simulators to classroom utilities, explore a growing collection of student innovation.</p>
        </SpotlightCard>
        <SpotlightCard className="landing-info-card is-cyan" spotlightColor="rgba(55, 198, 208, 0.2)">
          <span>02</span>
          <h3>Live Forum</h3>
          <p>Share progress, trade feedback, and keep beta testing conversations close to the work.</p>
        </SpotlightCard>
        <SpotlightCard className="landing-info-card is-pink" spotlightColor="rgba(253, 121, 168, 0.2)">
          <span>03</span>
          <h3>Creator Loop</h3>
          <p>XP, H coins, ratings, and comments give students a lightweight reason to keep shipping.</p>
        </SpotlightCard>
      </section>

      <section className="landing-principles" aria-label="Hajimi principles">
        <div>
          <span>01</span>
          <strong>Student-built</strong>
          <p>Made by students, with heart.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Club-led</strong>
          <p>Run by the AI Club team.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Invite-gated</strong>
          <p>Safe space for members.</p>
        </div>
        <div>
          <span>04</span>
          <strong>Public browse</strong>
          <p>Explore projects and updates.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>Hajimi</strong>
          <span>AI Club</span>
          <span>{APP_VERSION_LABEL} - {APP_RELEASE_DATE}</span>
          <span>Built by AI Club and Eric.</span>
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
