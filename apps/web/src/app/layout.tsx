import type { Metadata } from 'next';
import { DM_Sans, Newsreader } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { DemoModeNotice, Footer, Navbar } from '@/components/Shell';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' });

export const metadata: Metadata = {
  title: { default: 'CampusConnect — Find your people', template: '%s | CampusConnect' },
  description: 'Discover campus communities, events, and projects. Make your next idea happen together.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${dmSans.variable} ${newsreader.variable}`} suppressHydrationWarning>
    <body><AuthProvider><Navbar /><DemoModeNotice /><main className="main-content">{children}</main><Footer /></AuthProvider></body>
  </html>;
}
