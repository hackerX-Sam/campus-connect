'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Code2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

type ProjectDetails = { id: string; title: string; description: string; objectives?: string | null; category: string; status: string; techStack: string[]; requiredSkills: string[]; repoUrl?: string | null; demoUrl?: string | null; owner: { id: string; profile?: { displayName: string; avatarUrl?: string | null } | null }; memberships?: { user: { id: string; profile?: { displayName: string; avatarUrl?: string | null } | null } }[] };
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<{ project: ProjectDetails }>(`/projects/${encodeURIComponent(id)}`).then((result) => setProject(result.project)).catch((error) => setMessage(error instanceof ApiError ? error.message : 'Unable to load project.')); }, [id]);
  async function collaborate() {
    setBusy(true); setMessage('');
    try { await api.post(`/projects/${id}/collaborate`, { message: 'I would like to collaborate on this project.' }); setMessage('Your collaboration request has been sent.'); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : 'Unable to send request.'); }
    finally { setBusy(false); }
  }
  if (!project) return <div className="page-width page-shell">{message ? <p role="alert" className="error-box">{message}</p> : <div className="loading-block"><LoadingSpinner /></div>}</div>;
  const team = [project.owner, ...(project.memberships ?? []).map((membership) => membership.user)]
    .filter((member, index, members) => members.findIndex((item) => item.id === member.id) === index);
  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><Code2 size={15} /> Student project</span><h1>{project.title}</h1><p>Created by <Link className="text-link" href={`/profile/${project.owner.id}`}>{project.owner.profile?.displayName ?? 'a CampusConnect member'}</Link></p><div className="card-meta"><Badge>{project.status}</Badge><Badge>{project.category}</Badge></div></div>
      {user && user.id !== project.owner.id && <Button onClick={() => void collaborate()} disabled={busy}>{busy ? 'Sending…' : 'Request to collaborate'}</Button>}
    </div>
    {message && <p className="error-box" role="status">{message}</p>}
    <div className="detail-layout"><Card className="detail-panel"><h2>About this project</h2><p className="content-copy">{project.description}</p>{project.objectives && <><h2>Goals</h2><p>{project.objectives}</p></>}<h2>Skills and tools</h2><div className="card-meta">{[...project.techStack, ...project.requiredSkills].map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>
        <section className="project-team"><h2><Users size={19} /> Project team</h2>{team.map((member) => <Link className="project-team-member" href={`/profile/${member.id}`} key={member.id}><Avatar name={member.profile?.displayName ?? 'Student'} src={member.profile?.avatarUrl} /><span>{member.profile?.displayName ?? 'CampusConnect member'}</span></Link>)}</section>
      </Card>
      <aside className="detail-side"><Card><div className="card-body"><h3>Project links</h3>{project.repoUrl ? <p><a className="text-link" href={project.repoUrl} target="_blank" rel="noreferrer">Repository</a></p> : <p>No repository linked yet.</p>}{project.demoUrl && <p><a className="text-link" href={project.demoUrl} target="_blank" rel="noreferrer">Live demo</a></p>}</div></Card></aside>
    </div>
  </div>;
}
