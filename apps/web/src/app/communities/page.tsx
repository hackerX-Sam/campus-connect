'use client';

import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Community } from '@campusconnect/types';
import { Badge, Button, Card, LoadingSpinner, Pagination } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 9;

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (query) params.set('q', query);
      if (category) params.set('category', category);
      const result = await api.get<{ communities: Community[]; total: number }>(`/communities?${params}`);
      setCommunities(result.communities);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load communities.');
    } finally {
      setLoading(false);
    }
  }, [query, category, page]);
  useEffect(() => { void load(); }, [load]);

  async function createCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setCreating(true);
    setError('');
    try {
      await api.post('/communities', {
        name: fields.get('name'),
        description: fields.get('description'),
        category: fields.get('category'),
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create the community.');
    } finally {
      setCreating(false);
    }
  }

  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><Users size={15} /> Find your circle</span><h1>Communities</h1><p>Discover student groups, clubs, and campus communities built around what you care about.</p></div>
      {user && <Button onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Cancel' : 'Create a community'}</Button>}
    </div>
    {formOpen && <Card className="detail-panel"><form className="stack" onSubmit={createCommunity}>
      <label className="form-field">Community name<input className="input" name="name" minLength={3} maxLength={100} required /></label>
      <label className="form-field">Category<input className="input" name="category" maxLength={80} required placeholder="Technology, Arts,..." /></label>
      <label className="form-field">Description<textarea className="textarea" name="description" minLength={20} maxLength={2000} rows={4} required /></label>
      <Button disabled={creating}>{creating ? 'Creating…' : 'Create community'}</Button>
    </form></Card>}
    <form className="search-row" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}>
      <input className="input" aria-label="Search communities" placeholder="Search communities by name" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} />
      <select className="select" aria-label="Filter communities by category" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }}>
        <option value="">All categories</option><option>Technology</option><option>Design</option><option>Sustainability</option>
      </select>
      <Button variant="secondary"><Search size={16} /> Search</Button>
    </form>
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner label="Loading communities" /></div> : communities.length
      ? <div className="grid">{communities.map((community) => <Link href={`/communities/${community.slug}`} key={community.id}><Card><div className="card-body">
        <div className="card-top"><div className="category-mark"><Users size={20} /></div><Badge>{community.category}</Badge></div>
        <h3>{community.name}</h3><p>{community.description}</p>
        <div className="card-meta"><span>{community.visibility === 'PUBLIC' ? 'Open membership' : 'Approval required'}</span></div>
      </div></Card></Link>)}</div>
      : <div className="empty-state"><div><strong>No communities found</strong><p>Try a different search, or start a new community.</p></div></div>}
    <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
  </div>;
}
