import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AuthProvider } from '@/context/AuthContext';
import { Footer, Navbar } from '@/components/Shell';
import './globals.css';

const manrope = localFont({
  src: '../../../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  display: 'swap',
  weight: '200 800',
});

export const metadata: Metadata = {
  title: { default: 'CampusConnect — Find your people', template: '%s | CampusConnect' },
  description: 'Discover campus communities, events, and projects. Make your next idea happen together.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable} suppressHydrationWarning>
    <body><AuthProvider><Navbar /><main className="main-content">{children}</main><Footer /></AuthProvider></body>
  </html>;
}
