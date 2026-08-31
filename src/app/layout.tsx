import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { canUseDomiAgent } from '@/lib/agentAccess';
import DomiAgentHost from '@/components/DomiAgentHost';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hajimi | Student Community',
  description: 'Your high school life, gamified.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👾</text></svg>',
  }
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loadAgentEligibility = async () => {
    try {
      const session = await getSession();
      if (!session) return false;
      return canUseDomiAgent(await getUserById(Number(session.userId)));
    } catch {
      return false;
    }
  };

  return (
    <html lang="en">
      <body>
        {children}
        <DomiAgentHost enabled={await loadAgentEligibility()} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
