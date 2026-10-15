'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

type EventDetails = { id: string; title: string; description: string; startAt: string; endAt: string; venue?: string | null; meetingLink?: string | null; status: string; community?: { id: string; name: string; slug: string } | null; _count: { registrations: number } };
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<{ event: EventDetails }>(`/events/${encodeURIComponent(id)}`).then((result) => setEvent(result.event)).catch((error) => setMessage(error instanceof ApiError ? error.message : 'Unable to load event.')); }, [id]);
  async function register() {
    setBusy(true); setMessage('');
    try { await api.post(`/events/${id}/register`); setMessage('You are registered. See you there!'); setMessageType('success'); }
    catch (error) { setMessageType('error'); setMessage(error instanceof ApiError ? error.message : 'Unable to register.'); }
    finally { setBusy(false); }
  }
  if (!event) return <div className="page-width page-shell">{message ? <p role="alert" className="error-box">{message}</p> : <div className="loading-block"><LoadingSpinner /></div>}</div>;
  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><CalendarDays size={15} /> Campus event</span><h1>{event.title}</h1><p>{event.community && <Link href={`/communities/${event.community.slug}`}>{event.community.name}</Link>}</p></div>
      {user ? <Button disabled={busy || event.status !== 'PUBLISHED'} onClick={() => void register()}>{busy ? 'Registering…' : 'Register for event'}</Button> : <Link className="button button-primary" href="/auth/login">Sign in to register</Link>}
    </div>
    {message && <p className={messageType === 'success' ? 'success-box' : 'error-box'} role="status">{message}</p>}
    <div className="detail-layout"><Card className="detail-panel"><Badge>{event.status}</Badge><h2>About this event</h2><p className="content-copy">{event.description}</p>{event.meetingLink && <p><a className="text-link" href={event.meetingLink} target="_blank" rel="noreferrer">Join online</a></p>}</Card>
      <aside className="detail-side"><Card><div className="card-body"><h3>Event details</h3><p><CalendarDays size={15} /> {new Date(event.startAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</p><p>Ends {new Date(event.endAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>{event.venue && <p><MapPin size={15} /> {event.venue}</p>}<p><Users size={15} /> {event._count.registrations} attending</p></div></Card></aside>
    </div>
  </div>;
}
