import { getSession } from '@/lib/auth';
import { getProjects, getUserById } from '@/lib/db';
import { getImageDisplayUrl } from '@/lib/imageProxy';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROJECTS } from '@/data/projects';
import ParticleBackground from '@/components/ParticleBackground';
import RotatingText from '@/components/reactbits/RotatingText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import LogoLoop from '@/components/reactbits/LogoLoop';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';

export const dynamic = 'force-dynamic';

const HERO_WORDS = ['Create', 'Build', 'Ship', 'Learn'];
const STATIC_PROJECT_COVER_FALLBACKS: Record<string, string> = {
  'ai-tabletop': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780278797507-de97e759-ddc4-4c97-9d9c-47e9ae9253a4-project-cover-1780278796290.webp',
  'boxhead': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780278975996-be86a7e7-3873-4d44-ac0e-f1fa23bd86ac-project-cover-1780278975702.webp',
  'cv-picker': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780279695272-503fee92-aafd-43d5-ac97-95de7a243440-project-cover-1780279694504.webp',
  'prometheus': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780279131111-030fb9c6-1267-482f-bf8c-190f348bebb9-project-cover-1780279130838.webp',
  'quant-panel': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780279181627-b1fb1d47-85a1-45f2-adc7-a3d338c8ad8e-project-cover-1780279180732.webp',
  'sailer-2d': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780278905350-0630b955-c14a-47ce-9fc5-0623ad25d4c6-project-cover-1780278904734.webp',
  'sailer-3d': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780279069095-7b1d3e8b-1e04-447d-af15-4bcae66a67a2-project-cover-1780279068519.webp',
  'snake-io': 'https://ik6t1z18nrztogz9.public.blob.vercel-storage.com/project-covers/1/1780279765469-97376e0a-d7e9-40d3-8588-3db0881d27b7-project-cover-1780279764593.webp',
  'vocab-runner-game': '/projects/vocab-runner-game/cover.svg',
};

async function getLandingProjectLoopItems() {
  try {
    const projects = await getProjects();
    if (projects.length > 0) {
      return projects.map(project => ({
        id: String(project.id),
        title: project.title,
        icon: project.emoji || 'AI',
        eyebrow: project.author_name || 'AI Club',
        meta: project.tags.slice(0, 2).join(' / '),
        description: project.description,
        coverSrc: getImageDisplayUrl(project.cover_url),
        accentColor: project.accent_color,
        href: project.url ?? '/functions',
      }));
    }
  } catch (error) {
    console.warn('Landing project covers unavailable, using static fallback:', error);
  }

  return PROJECTS.map(project => ({
    id: project.id,
    title: project.title,
    icon: project.emoji || 'AI',
    eyebrow: project.author,
    meta: project.tags.slice(0, 2).join(' / '),
    description: project.description,
    coverSrc: getImageDisplayUrl(STATIC_PROJECT_COVER_FALLBACKS[project.id]),
    accentColor: project.accentColor,
    href: project.url ?? '/functions',
  }));
}

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    const user = await getUserById(Number(session.userId));
    if (user) redirect('/dashboard');
  }

  const projectLoopItems = await getLandingProjectLoopItems();

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

        <LogoLoop items={projectLoopItems} className="landing-project-loop" speed={68} />
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
