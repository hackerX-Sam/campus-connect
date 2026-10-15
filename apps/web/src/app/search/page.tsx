'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { Community, Event as CampusEvent, Project } from '@campusconnect/types';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';

type SearchResult = { href: string; title: string; description: string; type: string; detail: string };

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
    setQuery(initialQuery);
    setSubmittedQuery(initialQuery.trim());
  }, []);

  useEffect(() => {
    if (!submittedQuery) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    const search = encodeURIComponent(submittedQuery);
    setLoading(true);
    setError('');
    Promise.all([
      api.get<{ communities: Community[] }>(`/communities?q=${search}&limit=50`),
      api.get<{ events: CampusEvent[] }>(`/events?q=${search}&limit=50`),
      api.get<{ projects: Project[] }>(`/projects?q=${search}&limit=50`),
    ]).then(([communityData, eventData, projectData]) => {
      if (!active) return;
      setResults([
        ...communityData.communities.map((item) => ({ href: `/communities/${item.slug}`, title: item.name, description: item.description, type: 'Community', detail: item.category })),
        ...eventData.events.map((item) => ({ href: `/events/${item.id}`, title: item.title, description: item.description, type: 'Event', detail: new Date(item.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })),
        ...projectData.projects.map((item) => ({ href: `/projects/${item.id}`, title: item.title, description: item.description, type: 'Project', detail: item.category ?? item.status })),
      ]);
    }).catch((err) => {
      if (active) setError(err instanceof ApiError ? err.message : 'Search is unavailable right now. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [submittedQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    setQuery(nextQuery);
    setSubmittedQuery(nextQuery);
    window.history.replaceState(null, '', nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search');
  }

  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><Search size={15} /> Search CampusConnect</span><h1>Find your next thing</h1><p>Search communities, events, and student projects in one place.</p></div></div>
    <form className="search-row" onSubmit={submit}>
      <input className="input" aria-label="Search all campus content" placeholder="Try accessibility, design, or gardening" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Button><Search size={16} /> Search</Button>
    </form>
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner label="Searching campus content" /></div> : results.length ? <>
      <p className="search-summary">{results.length} {results.length === 1 ? 'result' : 'results'} for “{submittedQuery}”</p>
      <div className="grid">{results.map((item) => <Link href={item.href} key={item.href}><Card><div className="card-body">
        <div className="card-top"><Badge>{item.type}</Badge><span className="card-meta">{item.detail}</span></div>
        <h3>{item.title}</h3><p>{item.description}</p>
      </div></Card></Link>)}</div>
    </> : submittedQuery ? <div className="empty-state"><div><strong>No matches for “{submittedQuery}”</strong><p>Try a broader term, or browse communities, events, and projects.</p></div></div> : <div className="empty-state"><div><strong>Start with something you care about</strong><p>Search a topic, campus group, event, or project name.</p></div></div>}
  </div>;
}