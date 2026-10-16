'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Check, UserRoundPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';

type ProfileData = { id: string; email?: string; profile: { displayName: string; bio?: string | null; avatarUrl?: string | null; college?: string | null; course?: string | null; skills: string[]; interests: string[]; isPublic: boolean } | null; communityMemberships: { community: { id: string; name: string; slug: string } }[]; ownedProjects: { id: string; title: string; status: string; category: string }[] };
type RelationshipInfo = { relationship: 'NONE' | 'SENT' | 'RECEIVED' | 'CONNECTED'; requestId: string | null };
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [relationship, setRelationship] = useState<RelationshipInfo | null>(null);
  const [relBusy, setRelBusy] = useState(false);
  async function load() {
    try { const result = await api.get<{ user: ProfileData }>(`/users/${encodeURIComponent(id)}`); setProfile(result.user); setError(''); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to load profile.'); }
  }
  useEffect(() => { void load(); }, [id]);
  useEffect(() => {
    setRelationship(null);
    if (!user || user.id === id) return;
    api
      .get<RelationshipInfo>(`/connect/relationship/${encodeURIComponent(id)}`)
      .then((result) => setRelationship(result))
      .catch(() => setRelationship(null));
  }, [id, user]);
  async function runConnectionAction(action: () => Promise<RelationshipInfo>) {
    setRelBusy(true); setError('');
    try {
      setRelationship(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the connection.');
    } finally {
      setRelBusy(false);
    }
  }
  async function connect() {
    await runConnectionAction(async () => {
      const result = await api.post<{ connection: { id: string } }>(`/connect/requests/${encodeURIComponent(id)}`);
      return { relationship: 'SENT', requestId: result.connection.id } as RelationshipInfo;
    });
  }
  async function accept() {
    await runConnectionAction(async () => {
      await api.patch(`/connect/requests/${relationship?.requestId}/accept`, {});
      return { relationship: 'CONNECTED', requestId: null } as RelationshipInfo;
    });
  }
  async function cancelOrDecline() {
    await runConnectionAction(async () => {
      if (relationship?.relationship === 'RECEIVED') {
        await api.patch(`/connect/requests/${relationship.requestId}/decline`, {});
      } else if (relationship?.requestId) {
        await api.delete(`/connect/requests/${relationship.requestId}`);
      }
      return { relationship: 'NONE', requestId: null } as RelationshipInfo;
    });
  }
  async function removeConnection() {
    if (!window.confirm(`Remove ${profile?.profile?.displayName ?? 'this person'} from your connections?`)) return;
    await runConnectionAction(async () => {
      await api.delete(`/connect/${encodeURIComponent(id)}`);
      return { relationship: 'NONE', requestId: null } as RelationshipInfo;
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true);
    try {
      const update = await api.patch<{ profile: ProfileData['profile'] }>('/users/me/profile', {
        displayName: data.get('displayName'), bio: data.get('bio') || undefined,
        college: data.get('college') || undefined, course: data.get('course') || undefined,
      });
      setProfile((old) => old ? { ...old, profile: update.profile } : old); setEditing(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to save profile.'); }
    finally { setBusy(false); }
  }
  if (!profile) return <div className="page-width page-shell">{error ? <p role="alert" className="error-box">{error}</p> : <div className="loading-block"><LoadingSpinner /></div>}</div>;
  const ownProfile = user?.id === profile.id;
  return <div className="page-width page-shell">
    <div className="page-heading"><div className="member-row"><Avatar name={profile.profile?.displayName ?? 'Student'} src={profile.profile?.avatarUrl} /><div><span className="eyebrow">CampusConnect profile</span><h1>{profile.profile?.displayName ?? 'Student'}</h1><p>{[profile.profile?.course, profile.profile?.college].filter(Boolean).join(' · ')}</p></div></div><div className="profile-actions">{ownProfile && <Button variant="secondary" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit profile'}</Button>}
      {user && !ownProfile && relationship && <div className="connect-actions profile-connect">
        {relationship.relationship === 'NONE' && <Button onClick={() => void connect()} disabled={relBusy}><UserRoundPlus size={15} /> {relBusy ? 'Sending…' : 'Connect'}</Button>}
        {relationship.relationship === 'SENT' && <>
          <Button disabled>Request Sent</Button>
          <Button variant="ghost" disabled={relBusy} onClick={() => void cancelOrDecline()}>Cancel request</Button>
        </>}
        {relationship.relationship === 'RECEIVED' && <>
          <Button disabled={relBusy} onClick={() => void accept()}><Check size={15} /> {relBusy ? 'Accepting…' : 'Accept Request'}</Button>
          <Button variant="ghost" disabled={relBusy} onClick={() => void cancelOrDecline()}>Decline</Button>
        </>}
        {relationship.relationship === 'CONNECTED' && <>
          <Button disabled>Connected</Button>
          <Button variant="ghost" disabled={relBusy} onClick={() => void removeConnection()}>Remove connection</Button>
        </>}
      </div>}
    </div></div>
    {error && <p role="alert" className="error-box">{error}</p>}
    {editing && ownProfile && <Card className="detail-panel"><form className="stack" onSubmit={save}><label className="form-field">Display name<input className="input" name="displayName" defaultValue={profile.profile?.displayName} required /></label><label className="form-field">Bio<textarea className="textarea" name="bio" defaultValue={profile.profile?.bio ?? ''} maxLength={500} rows={4} /></label><label className="form-field">College<input className="input" name="college" defaultValue={profile.profile?.college ?? ''} /></label><label className="form-field">Course<input className="input" name="course" defaultValue={profile.profile?.course ?? ''} /></label><Button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button></form></Card>}
    <div className="detail-layout"><Card className="detail-panel"><h2>About</h2><p className="content-copy">{profile.profile?.bio || 'This student hasn’t added a bio yet.'}</p><h2>Skills</h2><div className="card-meta">{profile.profile?.skills.length ? profile.profile.skills.map((skill) => <Badge key={skill}>{skill}</Badge>) : <span>No skills added yet.</span>}</div><h2>Interests</h2><div className="card-meta">{profile.profile?.interests.length ? profile.profile.interests.map((item) => <Badge key={item}>{item}</Badge>) : <span>No interests added yet.</span>}</div>
        <section className="profile-projects"><h2>Projects</h2>{profile.ownedProjects.length ? <ul>{profile.ownedProjects.map((project) => <li key={project.id}><Link className="text-link" href={`/projects/${project.id}`}>{project.title}</Link><Badge>{project.status}</Badge></li>)}</ul> : <p>No public projects listed yet.</p>}</section>
      </Card>
      <aside className="detail-side"><Card><div className="card-body"><h3>Communities</h3>{profile.communityMemberships.map(({ community }) => <p key={community.id}><a className="text-link" href={`/communities/${community.slug}`}>{community.name}</a></p>)}{!profile.communityMemberships.length && <p>No public memberships listed.</p>}</div></Card></aside>
    </div>
  </div>;
}
