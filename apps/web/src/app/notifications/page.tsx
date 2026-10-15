'use client';

import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import type { Notification } from '@campusconnect/types';
import { Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    try { const result = await api.get<{ notifications: Notification[] }>('/notifications?limit=50'); setItems(result.notifications); setError(''); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function markRead(id: string) {
    try { await api.patch(`/notifications/${id}/read`, {}); setItems((old) => old.map((item) => item.id === id ? { ...item, isRead: true } : item)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to update notification.'); }
  }
  async function markAllRead() {
    try { await api.patch('/notifications/read-all', {}); setItems((old) => old.map((item) => ({ ...item, isRead: true }))); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to update notifications.'); }
  }
  return <div className="page-width page-shell"><div className="page-heading"><div><span className="eyebrow"><Bell size={15} /> Stay in the loop</span><h1>Notifications</h1><p>Updates about your communities and campus life.</p></div><Button variant="secondary" onClick={() => void markAllRead()}><Check size={16} /> Mark all as read</Button></div>
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner /></div> : items.length ? <div className="stack">{items.map((item) => <Card key={item.id} className="detail-panel"><div className="card-top"><h3>{item.title}</h3>{!item.isRead && <Button variant="ghost" onClick={() => void markRead(item.id)}>Mark read</Button>}</div><p>{item.message}</p><div className="card-meta"><span>{new Date(item.createdAt).toLocaleString()}</span>{item.isRead ? <span>Read</span> : <span>New</span>}</div></Card>)}</div> : <div className="empty-state"><strong>You’re all caught up</strong></div>}
  </div>;
}
