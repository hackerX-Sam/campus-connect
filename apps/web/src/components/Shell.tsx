'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/apiClient';
import { enableDemoMode } from '@/lib/demoMode';

const links = [
  ['Home', '/'],
  ['Search', '/search'],
  ['Communities', '/communities'],
  ['Events', '/events'],
  ['Projects', '/projects'],
];

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('campusconnect-theme');
    setDark(stored === 'dark');
    document.documentElement.dataset.theme = stored === 'dark' ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const refreshCount = async () => {
      try {
        const result = await api.get<{ unreadCount: number }>('/notifications?limit=1');
        if (active) setUnread(result.unreadCount);
      } catch {
        if (active) setUnread(0);
      }
    };
    void refreshCount();
    const timer = window.setInterval(refreshCount, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('campusconnect-theme', next ? 'dark' : 'light');
  };

  const closeMenu = () => setOpen(false);
  return <header className="site-header">
    <nav className="navbar page-width" aria-label="Main navigation">
      <Link className="brand" href="/" onClick={closeMenu}>Campus<span>Connect</span></Link>
      <button className="icon-button menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <div className={`nav-links ${open ? 'nav-open' : ''}`}>
        {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={closeMenu}>{label}</Link>)}
        {user && <Link href="/dashboard" aria-current={pathname === '/dashboard' ? 'page' : undefined} onClick={closeMenu}>Dashboard</Link>}
        <Link href="/communities" onClick={(event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); enableDemoMode('manual'); window.location.assign('/communities'); closeMenu(); }}>Explore demo</Link>
        {user && <Link className="notification-link" href="/notifications" aria-current={pathname === '/notifications' ? 'page' : undefined} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={closeMenu}><Bell size={17} /> Notifications {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}</Link>}
        {user && <Link href={`/profile/${user.id}`} onClick={closeMenu}>Profile</Link>}
        {user?.role === 'ADMIN' && <Link href="/admin" onClick={closeMenu}>Admin</Link>}
        <button className="icon-button theme-toggle" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        {loading ? null : user
          ? <button className="nav-auth" onClick={() => { void signOut(); closeMenu(); }}><LogOut size={16} /> Sign out</button>
          : <Link className="nav-auth nav-login" href="/auth/login" onClick={closeMenu}>Sign in</Link>}
      </div>
    </nav>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="page-width footer-inner">
      <div><Link className="brand footer-brand" href="/">Campus<span>Connect</span></Link><p>Find your people. Build what matters.</p></div>
      <div className="footer-links"><Link href="/communities">Explore communities</Link><Link href="/events">Campus events</Link><Link href="mailto:hello@campusconnect.app">Contact</Link><Link href="/terms">Terms</Link><a href="https://www.linkedin.com/" rel="noreferrer">LinkedIn</a></div>
      <small>© {new Date().getFullYear()} CampusConnect</small>
    </div>
  </footer>;
}
