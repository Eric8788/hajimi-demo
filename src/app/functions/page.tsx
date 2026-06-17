import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Shell from '@/components/Shell';
import ProjectGrid from '@/components/ProjectGrid';
import { canUseMemberInteractions } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧩 Function Hall</h1>
                    <p style={{ opacity: 0.7 }}>Games, tools, and digital experiments from the AI Club.</p>
                </div>


                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2d3436', whiteSpace: 'nowrap' }}>🚀 Project Showcase</h2>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
                </div>

                {/* Project Grid with filters */}
                <ProjectGrid user={user} canSubmitProjects={canUseMemberInteractions(user)} />

            </div>
        </Shell>
    );
}
