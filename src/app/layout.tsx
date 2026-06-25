import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';

export const metadata: Metadata = {
  title: 'Hajimi | Student Community',
  description: 'Your high school life, gamified.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👾</text></svg>',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
