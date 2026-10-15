'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Code2, Compass, Users } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { Badge, Card, LoadingSpinner } from '@/components/ui';
import { api } from '@/lib/apiClient';
import { enterDemoMode } from '@/lib/demoMode';
import type { Community, Event, Project } from '@campusconnect/types';

export default function HomePage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ communities: Community[] }>('/communities?limit=3'),
      api.get<{ events: Event[] }>('/events?upcoming=true&limit=3'),
      api.get<{ projects: Project[] }>('/projects?limit=3'),
    ]).then(([communityData, eventData, projectData]) => {
      setCommunities(communityData.communities);
      setEvents(eventData.events);
      setProjects(projectData.projects);
    }).catch(() => {
      setCommunities([]);
      setEvents([]);
      setProjects([]);
    }).finally(() => setLoading(false));
  }, []);

  const featuredProject = projects[0];
  const upcomingEvent = events[0];

  return <>
    <section className="hero">
      <div className="page-width hero-inner">
        <div>
          <span className="eyebrow"><Compass size={15} /> Your campus, closer</span>
          <h1>Find your people.<br /><em>Build what matters.</em></h1>
          <p className="hero-copy">One place for the communities, events, and projects that make campus life yours.</p>
          <form className="search-row" onSubmit={(event) => { event.preventDefault(); window.location.href = `/search?q=${encodeURIComponent(query)}`; }}>
            <input aria-label="Search communities, projects, and events" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clubs, events, ideas..." />
            <button className="button button-primary">Explore</button>
          </form>
          <div className="hero-actions"><Link className="button button-primary" href="/communities" onClick={(event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); enterDemoMode('/communities'); }}>Explore demo <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/auth/signup">Join CampusConnect</Link></div>
        </div>
        <aside className="hero-art" aria-label="CampusConnect collaboration preview">
          <div className="hero-preview-top"><span>Collaboration board</span><span className="hero-live">Campus activity</span></div>
          <div className="hero-preview-feature">
            <span className="category-mark"><Code2 size={20} /></span>
            <div><span className="hero-preview-label">Project spotlight</span>
              {featuredProject ? <Link href={`/projects/${featuredProject.id}`}><h2>{featuredProject.title}</h2></Link> : <h2>Find a project to build together</h2>}
              <p>{featuredProject?.description ?? 'Explore student projects and find a team that fits your interests.'}</p>
            </div>
            {featuredProject && <Badge>{featuredProject.status}</Badge>}
          </div>
          <div className="hero-preview-footer"><div><span>Next on campus</span>{upcomingEvent ? <Link href={`/events/${upcomingEvent.id}`}>{upcomingEvent.title}</Link> : <Link href="/events">Browse upcoming events</Link>}</div><ArrowRight size={17} /></div>
        </aside>
      </div>
    </section>
    {loading ? <div className="loading-block"><LoadingSpinner /></div> : <>
      <DirectorySection title="Find your community" subtitle="Meet people who are into what you’re into." href="/communities" icon={<Users size={19} />} items={communities.map((item) => ({
        href: `/communities/${item.slug}`, title: item.name, description: item.description, badge: item.category, meta: item.visibility === 'PUBLIC' ? 'Open to join' : 'Request to join',
      }))} empty="No communities yet. Start the first one." variant="communities" />
      <DirectorySection title="Coming up on campus" subtitle="Good things happen when you show up." href="/events" icon={<CalendarDays size={19} />} items={events.map((item) => ({
        href: `/events/${item.id}`, title: item.title, description: item.description, badge: new Date(item.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), meta: new Date(item.startAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      }))} empty="There are no upcoming events. Check back soon." variant="agenda" />
      <DirectorySection title="Ideas in motion" subtitle="Find a project and make it better together." href="/projects" icon={<Code2 size={19} />} items={projects.map((item) => ({
        href: `/projects/${item.id}`, title: item.title, description: item.description, badge: item.status, meta: 'Open collaboration',
      }))} empty="No projects have been shared yet." variant="projects" />
    </>}
    <section className="collaboration-strip">
      <div className="page-width">
        <div className="collaboration-heading"><span className="eyebrow">A good place to begin</span><h2>From first idea to shared progress</h2></div>
        <ol className="collaboration-steps">
          <li><span>01</span><div><h3>Find your people</h3><p>Discover a community working on something you care about.</p></div></li>
          <li><span>02</span><div><h3>Bring a useful skill</h3><p>See what a team needs and offer a practical way to help.</p></div></li>
          <li><span>03</span><div><h3>Make steady progress</h3><p>Share updates, learn together, and build something tangible.</p></div></li>
        </ol>
        <Link className="text-link" href="/auth/signup">Join CampusConnect <ArrowRight size={14} /></Link>
      </div>
    </section>
  </>;
}

function DirectorySection({ title, subtitle, href, icon, items, empty, variant }: {
  title: string; subtitle: string; href: string; icon: React.ReactNode;
  items: { href: string; title: string; description: string; badge: string; meta: string }[]; empty: string;
  variant: 'communities' | 'agenda' | 'projects';
}) {
  return <section className="section page-width">
    <div className="section-heading"><div><span className="eyebrow">{icon} CampusConnect</span><h2>{title}</h2><p>{subtitle}</p></div><Link className="text-link" href={href}>View all <ArrowRight size={14} /></Link></div>
    {items.length ? variant === 'agenda' ? <div className="home-agenda">{items.map((item) => <Link href={item.href} className="home-agenda-row" key={item.href}>
      <Badge>{item.badge}</Badge><div><h3>{item.title}</h3><p>{item.description}</p><span>{item.meta}</span></div><ArrowRight size={17} />
    </Link>)}</div> : variant === 'projects' ? <div className="home-projects">{items.map((item, index) => <Link href={item.href} className={index === 0 ? 'home-project-feature' : 'home-project-row'} key={item.href}>
      <Badge>{item.badge}</Badge><h3>{item.title}</h3><p>{item.description}</p><span>{item.meta}</span>
    </Link>)}</div> : <div className="grid">{items.map((item) => <Link href={item.href} key={item.href}><Card><div className="card-body">
      <div className="card-top"><Badge>{item.badge}</Badge><ArrowRight size={16} /></div>
      <h3>{item.title}</h3><p>{item.description}</p><div className="card-meta"><span>{item.meta}</span></div>
    </div></Card></Link>)}</div> : <div className="empty-state"><strong>{empty}</strong></div>}
  </section>;
}
