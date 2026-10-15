'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';

type Stats = { users: number; communities: number; events: number; projects: number };
type UserRow = { id: string; email: string; role: string; isActive: boolean; createdAt: string; profile?: { displayName: string } | null };
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!loading && user?.role !== 'ADMIN') router.replace('/');
    if (user?.role === 'ADMIN') {
      Promise.all([api.get<{ stats: Stats }>('/admin/stats'), api.get<{ users: UserRow[] }>('/admin/users')])
        .then(([statData, userData]) => { setStats(statData.stats); setUsers(userData.users); })
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load admin dashboard.'));
    }
  }, [user, loading, router]);
  async function toggle(id: string) {
    try { const result = await api.patch<{ user: { id: string; isActive: boolean } }>(`/admin/users/${id}/status`, {}); setUsers((old) => old.map((item) => item.id === id ? { ...item, isActive: result.user.isActive } : item)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to update user.'); }
  }
  if (loading || user?.role !== 'ADMIN') return <div className="loading-block"><LoadingSpinner label="Checking access" /></div>;
  return <div className="page-width page-shell"><div className="page-heading"><div><span className="eyebrow"><ShieldCheck size={15} /> Platform operations</span><h1>Admin dashboard</h1><p>Review platform activity and manage user access.</p></div></div>
    {error && <p className="error-box" role="alert">{error}</p>}
    {stats ? <div className="stat-grid">{Object.entries(stats).map(([name, value]) => <Card key={name}><div className="stat-card"><span>{name}</span><strong>{value}</strong></div></Card>)}</div> : <div className="loading-block"><LoadingSpinner /></div>}
    <section className="section"><div className="section-heading"><div><h2><Users size={20} /> User management</h2><p>Manage account status for CampusConnect members.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.profile?.displayName ?? 'Student'}</td><td>{item.email}</td><td><Badge>{item.role}</Badge></td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.isActive ? 'Active' : 'Disabled'}</td><td><Button variant="secondary" disabled={item.id === user.id} onClick={() => void toggle(item.id)}>{item.isActive ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
