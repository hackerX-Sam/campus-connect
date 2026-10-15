'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar, Button, Card, LoadingSpinner } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

type Person = { id: string; profile?: { displayName: string; avatarUrl?: string | null } | null };
type CommentEntry = { id: string; body: string; parentId?: string | null; createdAt: string; author: Person; replies?: CommentEntry[] };
type DiscussionEntry = { id: string; title: string; body: string; communityId: string; createdAt: string; author: Person; community: { id: string; name: string } };
export default function DiscussionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<DiscussionEntry | null>(null);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [detail, commentData] = await Promise.all([
        api.get<{ discussion: DiscussionEntry }>(`/discussions/${id}`),
        api.get<{ comments: CommentEntry[] }>(`/discussions/${id}/comments`),
      ]);
      setDiscussion(detail.discussion); setComments(commentData.comments); setError('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to load discussion.'); }
  }
  useEffect(() => { void load(); }, [id]);
  async function addComment(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api.post(`/discussions/${id}/comments`, { body, parentId: replyTo }); setBody(''); setReplyTo(undefined); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to post comment.'); }
    finally { setBusy(false); }
  }
  if (!discussion) return <div className="page-width page-shell">{error ? <p role="alert" className="error-box">{error}</p> : <div className="loading-block"><LoadingSpinner /></div>}</div>;
  const renderComment = (comment: CommentEntry) => <article className="comment" key={comment.id}>
    <div className="member-row"><Avatar name={comment.author.profile?.displayName ?? 'Member'} src={comment.author.profile?.avatarUrl} /><strong>{comment.author.profile?.displayName ?? 'Member'}</strong><small>{new Date(comment.createdAt).toLocaleString()}</small></div>
    <p>{comment.body}</p>
    {user && <button className="button button-ghost" onClick={() => { setReplyTo(comment.id); document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' }); }}>Reply</button>}
    {comment.replies?.map(renderComment)}
  </article>;
  return <div className="page-width page-shell">
    <div className="page-heading"><div><span className="eyebrow"><MessageSquare size={15} /> {discussion.community.name}</span><h1>{discussion.title}</h1><p>Posted by {discussion.author.profile?.displayName ?? 'a member'} · {new Date(discussion.createdAt).toLocaleDateString()}</p></div></div>
    <Card className="detail-panel"><p className="content-copy">{discussion.body}</p></Card>
    <section className="section"><div className="section-heading"><div><h2>Replies</h2><p>Keep it thoughtful and useful.</p></div></div>
      {user ? <form id="comment-form" className="stack" onSubmit={addComment}><label className="form-field">{replyTo ? 'Write a reply' : 'Add a comment'}<textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required rows={3} /></label><div className="hero-actions"><Button disabled={busy}>{busy ? 'Posting…' : 'Post comment'}</Button>{replyTo && <Button variant="ghost" type="button" onClick={() => setReplyTo(undefined)}>Cancel reply</Button>}</div></form> : <p><a className="text-link" href="/auth/login">Sign in</a> to join the conversation.</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {comments.length ? <div className="stack">{comments.map(renderComment)}</div> : <div className="empty-state"><strong>No replies yet</strong></div>}
    </section>
  </div>;
}
