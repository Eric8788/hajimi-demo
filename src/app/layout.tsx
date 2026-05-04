import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hajimi-Dan | Student Community',
  description: 'Your high school life, gamified.',
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
