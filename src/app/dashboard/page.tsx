import { getSession } from '@/lib/auth';
import { getUserById, type User } from '@/lib/db';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import CheckInButton from '@/components/CheckInButton';
import Link from 'next/link';
import TarotGame from '@/components/TarotGame';
import { getRecentPostHighlights } from '@/lib/db';
import LeaderboardWidget from '@/components/LeaderboardWidget';
import DashboardAlumniPreview from '@/components/DashboardAlumniPreview';
import DashboardPromoCarousel from '@/components/DashboardPromoCarousel';
import PresencePanel from '@/components/PresencePanel';
import SpotlightCard from '@/components/reactbits/SpotlightCard';

type DashboardGreeting = {
  title: string;
  insight: string;
};

const TIME_ZONE = 'Asia/Shanghai';

const timeGreetingPools = [
  {
    start: 5,
    end: 10,
    messages: [
      { title: 'Morning, {name} ☀️', insight: 'New day, new tiny win.' },
      { title: 'Rise and shine, {name} (ง •̀_•́)ง', insight: 'Brain loading... still counts.' },
      { title: 'AM quest, {name} 🌱', insight: 'Start small, stack wins.' },
    ],
  },
  {
    start: 11,
    end: 13,
    messages: [
      { title: 'Lunch break, {name} 🍱', insight: 'Feed the brain first.' },
      { title: 'Midday check-in, {name} ✨', insight: 'Halfway there, still iconic.' },
      { title: 'Noon mode, {name} (๑˃̵ᴗ˂̵)و', insight: 'Refuel, then roll.' },
    ],
  },
  {
    start: 14,
    end: 17,
    messages: [
      { title: 'Afternoon boost, {name} ⚡', insight: 'Reboot your brain, keep rolling.' },
      { title: 'Post-lunch loading, {name} (｡•̀ᴗ-)✧', insight: 'Tiny progress still counts.' },
      { title: 'PM power-up, {name} 🚀', insight: 'One smart move at a time.' },
    ],
  },
  {
    start: 18,
    end: 21,
    messages: [
      { title: 'Evening mode, {name} 🌙', insight: 'One last push, then chill.' },
      { title: 'Golden hour, {name} ✨', insight: 'Finish strong, stay soft.' },
      { title: 'After-school energy, {name} (￣▽￣)ノ', insight: 'Wrap it up with style.' },
    ],
  },
  {
    start: 22,
    end: 23,
    messages: [
      { title: 'Late night, {name} (｡•́‿•̀｡)', insight: 'Do one small thing, then log off.' },
      { title: 'Night shift, {name} 🌌', insight: 'Great ideas happen late. Sleep does too.' },
      { title: 'Almost bedtime, {name} 💤', insight: 'Save your work, save yourself.' },
    ],
  },
  {
    start: 0,
    end: 4,
    messages: [
      { title: 'Still awake, {name}? 👀', insight: 'Brilliant, yes. But sleep is OP.' },
      { title: 'Deep night mode, {name} 🌙', insight: 'One tiny win, then offline.' },
      { title: 'Midnight brain, {name} (。-ω-)zzz', insight: 'Ideas can wait in drafts.' },
    ],
  },
];

const fixedHolidayGreetings: Record<string, DashboardGreeting> = {
  '01-01': { title: 'New year, {name} 🎆', insight: 'New save file. Better stats.' },
  '04-05': { title: 'Take it slow, {name} 🌿', insight: 'Quiet days count too.' },
  '05-01': { title: 'Long weekend energy, {name} ✨', insight: 'Rest is also productivity.' },
  '10-01': { title: 'Golden week, {name} 🇨🇳', insight: 'Homework can wait. Maybe.' },
  '10-31': { title: 'Spooky season, {name} 🎃', insight: 'Survive school beautifully.' },
  '12-25': { title: 'Holiday sparkle, {name} 🎄', insight: 'Good vibes are in season.' },
};

const lunarHolidayGreetings: Record<string, DashboardGreeting> = {
  '1-1': { title: 'CNY mode, {name} 🧧', insight: 'Luck buff activated.' },
  '1-15': { title: 'Lantern night, {name} 🏮', insight: 'Soft glow, smart moves.' },
  '5-5': { title: 'Dragon Boat vibes, {name} 🚣', insight: 'Stay sharp, stay steady.' },
  '8-15': { title: 'Mooncake mode, {name} 🌕', insight: 'Big moon, bigger dreams.' },
};

function getShanghaiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: Number(value('hour')),
  };
}

function getChineseCalendarParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
    timeZone: TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';

  return {
    month: Number(value('month')),
    day: Number(value('day')),
  };
}

function isThanksgiving(year: string, month: string, day: string, hour: number) {
  if (month !== '11') return false;

  const date = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, '0')}:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(date);

  return weekday === 'Thu' && Number(day) >= 22 && Number(day) <= 28;
}

function stableMessageIndex(seed: string, length: number) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % length;
}

function personalizeGreeting(message: DashboardGreeting, username: string): DashboardGreeting {
  const displayName = username || 'friend';

  return {
    title: message.title.replace('{name}', displayName),
    insight: message.insight,
  };
}

function getDashboardGreeting(username: string): DashboardGreeting {
  const { year, month, day, hour } = getShanghaiDateParts();
  const holidayKey = `${month}-${day}`;
  const { month: lunarMonth, day: lunarDay } = getChineseCalendarParts();
  const holidayGreeting =
    lunarHolidayGreetings[`${lunarMonth}-${lunarDay}`] ??
    (isThanksgiving(year, month, day, hour)
      ? { title: 'Thanks mode, {name} 🫶', insight: 'Tiny gratitude, big energy.' }
      : fixedHolidayGreetings[holidayKey]);

  if (holidayGreeting) {
    return personalizeGreeting(holidayGreeting, username);
  }

  const timePool = timeGreetingPools.find((pool) => hour >= pool.start && hour <= pool.end) ?? timeGreetingPools[0];
  const message = timePool.messages[stableMessageIndex(`${year}-${month}-${day}-${username}`, timePool.messages.length)];

  return personalizeGreeting(message, username);
}

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

  const greeting = getDashboardGreeting(user.username);

  const recentTwo = await getRecentPostHighlights(2).catch((error) => {
    if (process.env.NODE_ENV === 'production') throw error;
    console.warn('Dashboard posts unavailable:', error);
    return [];
  });

  return (
    <Shell user={user}>
      <section className="main-view dashboard-page">

        {/* Welcome Banner */}
        <SpotlightCard className="glass-card full-width dashboard-welcome-card" spotlightColor="rgba(108, 92, 231, 0.16)">
          <div className="dashboard-welcome-content">
            <div className="dashboard-cat-mascot" aria-hidden="true" />
            <div className="dashboard-welcome-copy">
              <h2 className="dashboard-welcome-title">{greeting.title}</h2>
              <p className="dashboard-welcome-insight">{greeting.insight}</p>
            </div>
          </div>

          <div className="dashboard-checkin-slot">
            <CheckInButton />
          </div>
        </SpotlightCard>

        <DashboardPromoCarousel userRole={user.role} />

        <DashboardAlumniPreview />

        <PresencePanel userId={user.id} limit={8} />

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
