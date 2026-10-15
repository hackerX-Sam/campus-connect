'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bell, CalendarDays, Code2, Compass, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Notification, User } from '@campusconnect/types';
import { Badge, Button, LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/apiClient';

type DashboardCommunity = {
  id: string;
  name: string;
  slug: string;
  category: string;
  _count: { memberships: number };
};

type DashboardEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  community: { name: string } | null;
};

type DashboardProject = {
  id: string;
  title: string;
  status: string;
  category: string;
  techStack: string[];
};

type DashboardData = {
  user: User | null;
  memberships: DashboardCommunity[];
  events: DashboardEvent[];
  projects: DashboardProject[];
  notifications: Notification[];
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    api.get<DashboardData>('/users/me/dashboard')
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err instanceof ApiError ? err.message : 'Unable to load your dashboard.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [authLoading, user, router, retry]);

  if (authLoading || !user || (loading && !data)) {
    return <div className="loading-block"><LoadingSpinner label="Loading your dashboard" /></div>;
  }

  if (error && !data) {
    return <div className="page-width page-shell">
      <div className="dashboard-error"><span className="eyebrow">Your campus</span><h1>Dashboard unavailable</h1>
        <p>{error}</p><div className="hero-actions"><Button onClick={() => setRetry((value) => value + 1)}>Try again</Button><Link className="button button-secondary" href="/communities">Explore communities</Link></div>
      </div>
    </div>;
  }

  if (!data) return null;
  const displayName = data.user?.profile?.displayName ?? user.profile?.displayName ?? 'there';
  const upcomingEvents = data.events.filter((event) => new Date(event.startAt).getTime() >= Date.now());

  return <div className="page-width page-shell">
    <header className="dashboard-heading">
      <div><span className="eyebrow"><Compass size={15} /> Your campus</span><h1>Welcome back, {displayName}</h1><p>Pick up where your campus collaborations left off.</p></div>
      <div className="dashboard-actions"><Link className="button button-primary" href="/projects"><Code2 size={16} /> Find a project</Link><Link className="button button-secondary" href="/communities"><Users size={16} /> Browse communities</Link></div>
    </header>

    {error && <p className="error-box" role="status">Some dashboard updates could not be refreshed: {error}</p>}

    <div className="dashboard-layout">
      <main className="dashboard-main">
        <section className="dashboard-section" aria-labelledby="dashboard-events-title">
          <div className="dashboard-section-heading"><div><span className="eyebrow"><CalendarDays size={15} /> On your calendar</span><h2 id="dashboard-events-title">Upcoming events</h2></div><Link className="text-link" href="/events">Browse events <ArrowRight size={14} /></Link></div>
          {loading ? <LoadingSpinner label="Refreshing events" /> : upcomingEvents.length ? <ul className="dashboard-list">
            {upcomingEvents.map((event) => <li className="dashboard-row" key={event.id}>
              <div className="dashboard-date"><strong>{new Date(event.startAt).toLocaleDateString(undefined, { day: 'numeric' })}</strong><span>{new Date(event.startAt).toLocaleDateString(undefined, { month: 'short' })}</span></div>
              <div className="dashboard-row-copy"><Link href={`/events/${event.id}`}><strong>{event.title}</strong></Link><span>{event.community?.name ?? 'Campus event'} · {new Date(event.startAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></div>
              <ArrowRight className="dashboard-row-arrow" size={17} />
            </li>)}
          </ul> : <div className="dashboard-empty"><p>No upcoming events in your registrations.</p><Link className="text-link" href="/events">Find an event <ArrowRight size={14} /></Link></div>}
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-projects-title">
          <div className="dashboard-section-heading"><div><span className="eyebrow"><Code2 size={15} /> Work in progress</span><h2 id="dashboard-projects-title">Your projects</h2></div><Link className="text-link" href="/projects">Discover projects <ArrowRight size={14} /></Link></div>
          {loading ? <LoadingSpinner label="Refreshing projects" /> : data.projects.length ? <ul className="dashboard-list">
            {data.projects.map((project) => <li className="dashboard-project" key={project.id}>
              <div className="dashboard-row-copy"><Link href={`/projects/${project.id}`}><strong>{project.title}</strong></Link><span>{project.category} · {project.techStack.slice(0, 3).join(', ') || 'Skills to be added'}</span></div>
              <Badge>{project.status}</Badge>
            </li>)}
          </ul> : <div className="dashboard-empty"><p>You haven’t joined a project yet.</p><Link className="text-link" href="/projects">Find your first project <ArrowRight size={14} /></Link></div>}
        </section>
      </main>

      <aside className="dashboard-side">
        <section className="dashboard-section" aria-labelledby="dashboard-communities-title">
          <div className="dashboard-section-heading"><div><span className="eyebrow"><Users size={15} /> Your circles</span><h2 id="dashboard-communities-title">Communities</h2></div></div>
          {loading ? <LoadingSpinner label="Refreshing communities" /> : data.memberships.length ? <ul className="dashboard-communities">
            {data.memberships.map((community) => <li key={community.id}><Link href={`/communities/${community.slug}`}><strong>{community.name}</strong><span>{community.category} · {community._count.memberships} members</span></Link></li>)}
          </ul> : <div className="dashboard-empty"><p>You haven’t joined a community yet.</p><Link className="text-link" href="/communities">Find your people <ArrowRight size={14} /></Link></div>}
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-notifications-title">
          <div className="dashboard-section-heading"><div><span className="eyebrow"><Bell size={15} /> Recent updates</span><h2 id="dashboard-notifications-title">Notifications</h2></div><Link className="text-link" href="/notifications">View all</Link></div>
          {loading ? <LoadingSpinner label="Refreshing notifications" /> : data.notifications.length ? <ul className="dashboard-notifications">
            {data.notifications.slice(0, 4).map((notification) => <li key={notification.id}><strong>{notification.title}</strong><p>{notification.message}</p><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>)}
          </ul> : <div className="dashboard-empty"><p>You’re all caught up.</p></div>}
        </section>
      </aside>
    </div>
  </div>;
}