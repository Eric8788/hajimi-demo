import { getSession } from '@/lib/auth';
import { getUserById, type User } from '@/lib/db';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AlumniWorldMap from '@/components/AlumniWorldMap';

function getDevAlumniMapUser(userId: number): User {
  return {
    id: userId,
    username: 'Local Tester',
    points: 0,
    level: 1,
    role: 'student',
    avatar: '😊',
    streak_count: 0,
    daily_likes_count: 0,
    created_at: new Date().toISOString(),
  };
}

export default async function AlumniMapPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await getUserById(Number(session.userId)).catch((error) => {
    if (process.env.NODE_ENV === 'production') throw error;
    console.warn('Alumni map user unavailable in dev, using local fallback:', error);
    return getDevAlumniMapUser(Number(session.userId));
  });
  if (!user) redirect('/login');

  return (
    <Shell user={user}>
      <section className="main-view alumni-map-page">
        <AlumniWorldMap />
      </section>
    </Shell>
  );
}
