'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Event as CampusEvent } from '@campusconnect/types';
import { Badge, Button, Card, LoadingSpinner, Pagination } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

const SIZE = 9;
export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ events: CampusEvent[]; total: number }>(`/events?q=${encodeURIComponent(query)}&upcoming=true&page=${page}&limit=${SIZE}`);
      setEvents(result.events); setTotal(result.total); setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load events.');
    } finally { setLoading(false); }
  }, [query, page]);
  useEffect(() => { void load(); }, [load]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    try {
      await api.post('/events', {
        title: form.get('title'), description: form.get('description'),
        venue: form.get('venue') || undefined,
        startAt: new Date(String(form.get('startAt'))).toISOString(),
        endAt: new Date(String(form.get('endAt'))).toISOString(),
        status: 'PUBLISHED',
      });
      setFormOpen(false); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to create the event.'); }
    finally { setCreating(false); }
  }

  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><CalendarDays size={15} /> Make it a date</span><h1>Campus events</h1><p>Workshops, meetups, hackathons, and the moments in between.</p></div>
      {user && <Button onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Cancel' : 'Create event'}</Button>}
    </div>
    {formOpen && <Card className="detail-panel"><form className="stack" onSubmit={createEvent}>
      <label className="form-field">Event name<input className="input" name="title" minLength={5} required /></label>
      <label className="form-field">Description<textarea className="textarea" name="description" minLength={20} rows={3} required /></label>
      <label className="form-field">Venue<input className="input" name="venue" /></label>
      <div className="grid"><label className="form-field">Starts<input className="input" type="datetime-local" name="startAt" required /></label><label className="form-field">Ends<input className="input" type="datetime-local" name="endAt" required /></label></div>
      <Button disabled={creating}>{creating ? 'Publishing…' : 'Publish event'}</Button>
    </form></Card>}
    <form className="search-row" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}>
      <input className="input" aria-label="Search events" placeholder="Search events" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} />
      <Button variant="secondary">Search</Button>
    </form>
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner label="Loading events" /></div> : events.length
      ? <div className="grid">{events.map((item) => <Link href={`/events/${item.id}`} key={item.id}><Card><div className="card-body">
        <div className="card-top"><div className="category-mark"><CalendarDays size={20} /></div><Badge>{new Date(item.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Badge></div>
        <h3>{item.title}</h3><p>{item.description}</p><div className="card-meta"><span>{new Date(item.startAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>{item.venue && <span>{item.venue}</span>}</div>
      </div></Card></Link>)}</div>
      : <div className="empty-state"><strong>No upcoming events yet</strong></div>}
    <Pagination page={page} total={total} limit={SIZE} onChange={setPage} />
  </div>;
}
