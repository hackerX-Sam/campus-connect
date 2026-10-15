'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, MessageSquare, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

type CommunityDetails = {
  id: string; slug: string; name: string; description: string; category: string;
  visibility: string; objectives?: string | null; rules?: string | null;
  events: { id: string; title: string; startAt: string; venue?: string | null }[];
  _count: { memberships: number; events: number; projects: number };
};

export default function CommunityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [community, setCommunity] = useState<CommunityDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<{ community: CommunityDetails }>(`/communities/${encodeURIComponent(slug)}`)
      .then((data) => setCommunity(data.community))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load this community.'));
  }, [slug]);
  async function join() {
    if (!community) return;
    setBusy(true); setError('');
    try {
      const result = await api.post<{ message: string }>(`/communities/${community.id}/join`);
      setError(result.message);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to join community.'); }
    finally { setBusy(false); }
  }
  if (!community) return <div className="page-width page-shell">{error ? <p role="alert" className="error-box">{error}</p> : <div className="loading-block"><LoadingSpinner /></div>}</div>;
  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><Users size={15} /> Community</span><h1>{community.name}</h1><p>{community.description}</p><div className="card-meta"><Badge>{community.category}</Badge><span>{community._count.memberships} members</span></div></div>
      {user ? <Button onClick={() => void join()} disabled={busy}>{busy ? 'Joining…' : community.visibility === 'PUBLIC' ? 'Join community' : 'Request to join'}</Button> : <Link className="button button-primary" href="/auth/login">Sign in to join</Link>}
    </div>
    {error && <p className="error-box" role="status">{error}</p>}
    <div className="detail-layout">
      <Card className="detail-panel"><h2>About this community</h2><p className="content-copy">{community.description}</p>{community.objectives && <><h2>What we do</h2><p>{community.objectives}</p></>}{community.rules && <><h2>Community guidelines</h2><p>{community.rules}</p></>}</Card>
      <aside className="detail-side">
        <Card><div className="card-body"><h3>Community activity</h3><p><Users size={15} /> {community._count.memberships} members</p><p><CalendarDays size={15} /> {community._count.events} events</p><p><MessageSquare size={15} /> Discussions</p><Link className="text-link" href={`/discussions/community/${community.id}`}>View discussions</Link></div></Card>
        <Card><div className="card-body"><h3>Upcoming events</h3>{community.events.length ? community.events.map((item) => <p key={item.id}><Link href={`/events/${item.id}`}>{item.title}</Link><br /><small>{new Date(item.startAt).toLocaleDateString()}</small></p>) : <p>No upcoming events yet.</p>}</div></Card>
      </aside>
    </div>
  </div>;
}
