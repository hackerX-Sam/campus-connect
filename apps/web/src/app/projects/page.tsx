'use client';

import Link from 'next/link';
import { ArrowRight, Code2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Project } from '@campusconnect/types';
import { Badge, Button, Card, LoadingSpinner, Pagination } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

const SIZE = 9;
type ProjectListItem = Project & {
  techStack: string[];
  requiredSkills: string[];
  owner?: { id: string; profile?: { displayName: string | null } | null };
  _count?: { memberships: number };
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [technology, setTechnology] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(SIZE), sort });
      if (query) params.set('q', query);
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      if (technology) params.set('technology', technology);
      const result = await api.get<{ projects: ProjectListItem[]; total: number }>(`/projects?${params}`);
      setProjects(result.projects); setTotal(result.total); setError('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to load projects.'); }
    finally { setLoading(false); }
  }, [query, category, status, technology, sort, page]);
  useEffect(() => { void load(); }, [load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    try {
      await api.post('/projects', {
        title: form.get('title'), description: form.get('description'),
        category: form.get('category'), status: 'IDEA',
      });
      setFormOpen(false); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to create the project.'); }
    finally { setCreating(false); }
  }

  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><Code2 size={15} /> Ideas in motion</span><h1>Student projects</h1><p>Find collaborators, share your idea, and build something for your campus and beyond.</p></div>
      {user && <Button onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Cancel' : 'Start a project'}</Button>}
    </div>
    {formOpen && <Card className="detail-panel"><form className="stack" onSubmit={createProject}>
      <label className="form-field">Project name<input className="input" name="title" minLength={5} required /></label>
      <label className="form-field">Category<input className="input" name="category" required /></label>
      <label className="form-field">Description<textarea className="textarea" name="description" minLength={20} rows={4} required /></label>
      <Button disabled={creating}>{creating ? 'Creating…' : 'Create project'}</Button>
    </form></Card>}
    <form className="search-row project-search-row" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}>
      <input className="input" aria-label="Search projects" placeholder="Search projects" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} />
      <select className="select" aria-label="Filter projects by category" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }}>
        <option value="">All categories</option><option>Open Source</option><option>Community</option><option>Education</option><option>Sustainability</option><option>Student life</option>
      </select>
      <select className="select" aria-label="Filter projects by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
        <option value="">All statuses</option><option value="IDEA">Idea</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ON_HOLD">On hold</option>
      </select>
      <select className="select" aria-label="Filter projects by technology" value={technology} onChange={(event) => { setPage(1); setTechnology(event.target.value); }}>
        <option value="">All technologies</option><option>React</option><option>TypeScript</option><option>Next.js</option><option>ESP32</option>
      </select>
      <select className="select" aria-label="Sort projects" value={sort} onChange={(event) => { setPage(1); setSort(event.target.value); }}>
        <option value="newest">Recently added</option><option value="title">Name A to Z</option><option value="status">Status</option>
      </select>
      <Button variant="secondary">Search</Button>
    </form>
    {!loading && !error && <p className="search-summary">{total} {total === 1 ? 'project' : 'projects'} found</p>}
    {error && <p role="alert" className="error-box">{error}</p>}
    {loading ? <div className="loading-block"><LoadingSpinner label="Loading projects" /></div> : projects.length
      ? <div className="project-results">{projects.map((item) => <Link className="project-result" href={`/projects/${item.id}`} key={item.id}>
        <div className="project-result-copy"><div className="project-result-heading"><Code2 size={18} /><h2>{item.title}</h2><Badge>{item.status}</Badge></div>
          <p>{item.description}</p><div className="project-result-meta"><span>{item.category}</span>{item.owner?.profile?.displayName && <span>by {item.owner.profile.displayName}</span>}{item._count && <span>{item._count.memberships} collaborators</span>}</div>
          {item.requiredSkills.length > 0 && <div className="project-skills">{item.requiredSkills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>}
        </div><ArrowRight size={18} />
      </Link>)}</div>
      : <div className="empty-state"><strong>No projects to show</strong><p>Be the first to share an idea.</p></div>}
    <Pagination page={page} total={total} limit={SIZE} onChange={setPage} />
  </div>;
}
