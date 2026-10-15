'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

type DiscussionSummary = { id: string; title: string; body: string; createdAt: string; author: { id: string; profile?: { displayName: string } | null }; _count: { comments: number } };
export default function CommunityDiscussionsPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const { user } = useAuth();
  const [items, setItems] = useState<DiscussionSummary[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const result = await api.get<{ discussions: DiscussionSummary[] }>(`/discussions/community/${encodeURIComponent(communityId)}?page=1&limit=50`);
      setItems(result.discussions); setError('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to load discussions.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [communityId]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api.post(`/discussions/community/${communityId}`, { title, body }); setTitle(''); setBody(''); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to post discussion.'); }
    finally { setBusy(false); }
  }
  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><MessageSquare size={15} /> Talk it out</span><h1>Community discussions</h1><p>Ask questions, share ideas, and learn from other members.</p></div></div>
    {user && <Card className="detail-panel"><form className="stack" onSubmit={create}><label className="form-field">Discussion title<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} required /></label><label className="form-field">Your post<textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} minLength={10} rows={3} required /></label><Button disabled={busy}>{busy ? 'Posting…' : 'Start a discussion'}</Button></form></Card>}
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner /></div> : items.length ? <div className="stack">{items.map((item) => <Link href={`/discussions/${item.id}`} key={item.id}><Card className="detail-panel"><div className="card-top"><h3>{item.title}</h3><span>{item._count.comments} replies</span></div><p>{item.body}</p><div className="card-meta"><span>{item.author.profile?.displayName ?? 'CampusConnect member'}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span></div></Card></Link>)}</div> : <div className="empty-state"><strong>No discussions yet</strong><p>Start the first conversation.</p></div>}
  </div>;
}
