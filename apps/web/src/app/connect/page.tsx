'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BellRing,
  Check,
  MessageCircle,
  Search,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, LoadingSpinner, Tooltip } from '@/components/ui';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type Relationship = 'NONE' | 'SENT' | 'RECEIVED' | 'CONNECTED';

type ProfileSummary = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  college: string | null;
  course: string | null;
  academicYear: string | null;
  skills: string[];
  interests: string[];
};

type Person = ProfileSummary & {
  relationship: Relationship;
  requestId: string | null;
  mutualConnections: number;
  recommended: boolean;
};

type ConnectRequest = { id: string; createdAt: string; profile: ProfileSummary };

type ConnectionItem = { connectionId: string; since: string; profile: ProfileSummary };

type Overview = { connections: number; pendingRequests: number; suggestions: number };

type FilterOptions = { colleges: string[]; departments: string[]; skills: string[]; interests: string[] };

type NetworkTab = 'connections' | 'received' | 'sent';

const PAGE_SIZE = 9;

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export default function ConnectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'discover' | 'network'>('discover');
  const [tab, setTab] = useState<NetworkTab>('connections');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [skill, setSkill] = useState('');
  const [interest, setInterest] = useState('');
  const [sort, setSort] = useState('recommended');
  const [page, setPage] = useState(1);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [peopleError, setPeopleError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());

  const [connectionsList, setConnectionsList] = useState<ConnectionItem[] | null>(null);
  const [receivedList, setReceivedList] = useState<ConnectRequest[] | null>(null);
  const [sentList, setSentList] = useState<ConnectRequest[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  const refreshOverview = useCallback(async () => {
    if (!user) return;
    try {
      setOverview(await api.get<Overview>('/connect/overview'));
    } catch {
      // Header counts are secondary; the page still works without them.
    }
  }, [user]);

  const refreshNetworkLists = useCallback(async () => {
    if (!user) return;
    try {
      const [connectionsData, receivedData, sentData] = await Promise.all([
        api.get<{ connections: ConnectionItem[] }>('/connect'),
        api.get<{ requests: ConnectRequest[] }>('/connect/requests/received'),
        api.get<{ requests: ConnectRequest[] }>('/connect/requests/sent'),
      ]);
      setConnectionsList(connectionsData.connections);
      setReceivedList(receivedData.requests);
      setSentList(sentData.requests);
    } catch {
      setConnectionsList(null);
      setReceivedList(null);
      setSentList(null);
    }
  }, [user]);

  const loadDiscovery = useCallback(async () => {
    if (!user) return;
    setLoadingPeople(true);
    setPeopleError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
      if (search) params.set('q', search);
      if (college) params.set('college', college);
      if (department) params.set('department', department);
      if (skill) params.set('skill', skill);
      if (interest) params.set('interest', interest);
      const hasFilters = Boolean(search || college || department || skill || interest);
      const endpoint = hasFilters || sort !== 'recommended' ? '/connect/users' : '/connect/suggestions';
      const result = await api.get<{ users: Person[]; total: number }>(`${endpoint}?${params}`);
      setPeople(result.users);
      setPeopleTotal(result.total);
    } catch (err) {
      setPeopleError(err instanceof ApiError ? err.message : 'Unable to load people right now.');
    } finally {
      setLoadingPeople(false);
    }
  }, [user, page, sort, search, college, department, skill, interest]);

  useEffect(() => {
    void refreshOverview();
    void refreshNetworkLists();
  }, [refreshOverview, refreshNetworkLists]);

  useEffect(() => {
    if (!user) return;
    api
      .get<FilterOptions>('/connect/filters')
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));
  }, [user]);

  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  // Reset to the first page whenever the query or filters change.
  useEffect(() => {
    setPage(1);
  }, [search, college, department, skill, interest, sort]);

  const markBusy = (key: string, busy: boolean) => {
    setBusyActions((current) => {
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  async function runAction(key: string, action: () => Promise<void>) {
    markBusy(key, true);
    setActionError('');
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      markBusy(key, false);
    }
  }

  const updatePeople = (userId: string, patch: Partial<Person>) => {
    setPeople((current) => current.map((person) => (person.userId === userId ? { ...person, ...patch } : person)));
  };

  const connect = (person: Person) => {
    void runAction(`connect:${person.userId}`, async () => {
      const result = await api.post<{ connection: { id: string } }>(`/connect/requests/${person.userId}`);
      updatePeople(person.userId, { relationship: 'SENT', requestId: result.connection.id });
      await Promise.all([refreshOverview(), refreshNetworkLists(), loadDiscovery()].map((p) => p.catch(() => undefined)));
    });
  };

  const cancelRequest = (person: Person) => {
    if (!person.requestId) return;
    void runAction(`cancel:${person.userId}`, async () => {
      await api.delete(`/connect/requests/${person.requestId}`);
      updatePeople(person.userId, { relationship: 'NONE', requestId: null });
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  const acceptRequest = (requestId: string) => {
    void runAction(`accept:${requestId}`, async () => {
      await api.patch(`/connect/requests/${requestId}/accept`, {});
      setReceivedList((current) => current?.filter((item) => item.id !== requestId) ?? null);
      setPeople((current) => current.map((person) => (person.requestId === requestId ? { ...person, relationship: 'CONNECTED', requestId: null } : person)));
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  const declineRequest = (requestId: string) => {
    void runAction(`decline:${requestId}`, async () => {
      await api.patch(`/connect/requests/${requestId}/decline`, {});
      setReceivedList((current) => current?.filter((item) => item.id !== requestId) ?? null);
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  const cancelSent = (request: ConnectRequest) => {
    void runAction(`cancel-sent:${request.id}`, async () => {
      await api.delete(`/connect/requests/${request.id}`);
      setSentList((current) => current?.filter((item) => item.id !== request.id) ?? null);
      updatePeople(request.profile.userId, { relationship: 'NONE', requestId: null });
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  const removeConnection = (connection: ConnectionItem) => {
    if (!window.confirm(`Remove ${connection.profile.displayName} from your connections?`)) return;
    void runAction(`remove:${connection.profile.userId}`, async () => {
      await api.delete(`/connect/${connection.profile.userId}`);
      setConnectionsList((current) => current?.filter((item) => item.profile.userId !== connection.profile.userId) ?? null);
      updatePeople(connection.profile.userId, { relationship: 'NONE', requestId: null });
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  const removeConnectionFromGrid = (person: Person) => {
    if (!window.confirm(`Remove ${person.displayName} from your connections?`)) return;
    void runAction(`remove:${person.userId}`, async () => {
      await api.delete(`/connect/${person.userId}`);
      updatePeople(person.userId, { relationship: 'NONE', requestId: null });
      await Promise.all([refreshOverview(), refreshNetworkLists()].map((p) => p.catch(() => undefined)));
    });
  };

  if (authLoading || !user) {
    return <div className="page-width page-shell"><div className="loading-block"><LoadingSpinner label="Loading Connect" /></div></div>;
  }

  const filtersActive = Boolean(search || college || department || skill || interest) || sort !== 'recommended';

  const clearFilters = () => {
    setSearchInput('');
    setCollege('');
    setDepartment('');
    setSkill('');
    setInterest('');
    setSort('recommended');
  };

  return <div className="page-width page-shell connect-page">
    {actionError && <p role="alert" className="error-box">{actionError}</p>}

    <div className="connect-header">
      <div>
        <span className="eyebrow"><UsersRound size={15} /> Connect</span>
        <h1>Connect with People</h1>
        <p>Discover students, meet like-minded people, share interests, and build your campus network.</p>
        <small className="connect-tagline">Your next great collaboration could start here.</small>
      </div>
      <div className="connect-header-side">
        <Button variant={view === 'network' ? 'primary' : 'secondary'} onClick={() => setView(view === 'network' ? 'discover' : 'network')}>
          <UsersRound size={16} /> {view === 'network' ? 'Back to Discover' : 'My Network'}
        </Button>
      </div>
    </div>

    <div className="connect-stats">
      <button className="connect-stat" onClick={() => { setView('network'); setTab('connections'); }}>
        <span className="connect-stat-icon"><UsersRound size={18} /></span>
        <span className="connect-stat-copy"><span>My Connections</span><strong>{overview?.connections ?? 0}</strong></span>
      </button>
      <button className="connect-stat" onClick={() => { setView('network'); setTab('received'); }}>
        <span className="connect-stat-icon"><BellRing size={18} /></span>
        <span className="connect-stat-copy"><span>Pending Requests</span><strong>{overview?.pendingRequests ?? 0}</strong></span>
      </button>
      <button className="connect-stat" onClick={() => { setView('discover'); setPage(1); }}>
        <span className="connect-stat-icon"><Sparkles size={18} /></span>
        <span className="connect-stat-copy"><span>People You May Know</span><strong>{overview?.suggestions ?? 0}</strong></span>
      </button>
    </div>

    {view === 'discover' ? <>
      <form className="search-row" onSubmit={(event) => { event.preventDefault(); setPage(1); void loadDiscovery(); }}>
        <input className="input" aria-label="Search people" placeholder="Search people by name, skills, college, or interests..."
          value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <Button variant="secondary"><Search size={16} /> Search</Button>
      </form>
      <div className="connect-filters" aria-label="People filters">
        <select className="select" aria-label="Filter by college" value={college} onChange={(event) => setCollege(event.target.value)}>
          <option value="">All colleges</option>
          {filterOptions?.colleges.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="select" aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">All departments</option>
          {filterOptions?.departments.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="select" aria-label="Filter by skill" value={skill} onChange={(event) => setSkill(event.target.value)}>
          <option value="">Any skill</option>
          {filterOptions?.skills.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="select" aria-label="Filter by interest" value={interest} onChange={(event) => setInterest(event.target.value)}>
          <option value="">Any interest</option>
          {filterOptions?.interests.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="select" aria-label="Sort people" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="recommended">Recommended</option>
          <option value="recent">Recently joined</option>
          <option value="name">Name: A–Z</option>
        </select>
        {filtersActive && <Button variant="ghost" type="button" onClick={clearFilters}><X size={15} /> Reset filters</Button>}
      </div>

      <section className="section" aria-labelledby="discover-heading">
        <div className="section-heading"><div><h2 id="discover-heading">People You May Know</h2><p>Based on shared skills, interests, college, and communities.</p></div></div>
        {peopleError && <p role="alert" className="error-box">{peopleError}<Button variant="secondary" onClick={() => void loadDiscovery()}>Retry</Button></p>}
        {loadingPeople ? <div className="people-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => <div className="person-card skeleton skeleton-card" key={index} />)}
        </div> : people.length ? <>
          {!peopleError && <p className="search-summary">{peopleTotal} {peopleTotal === 1 ? 'person' : 'people'}</p>}
          <div className="people-grid">
            {people.map((person) => <PersonCardView
              key={person.userId} person={person} busyActions={busyActions}
              onConnect={connect} onCancel={cancelRequest} onAccept={acceptRequest} onRemove={removeConnectionFromGrid}
            />)}
          </div>
          <nav className="pagination" aria-label="People pagination">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {Math.max(1, Math.ceil(peopleTotal / PAGE_SIZE))}</span>
            <Button variant="secondary" disabled={page >= Math.ceil(peopleTotal / PAGE_SIZE)} onClick={() => setPage(page + 1)}>Next</Button>
          </nav>
        </> : <div className="empty-state"><div><strong>No people found</strong><p>No people found. Try another name, skill, or filter.</p></div></div>}
      </section>
    </> : <section className="network-panel" aria-label="My network">
      <div className="connect-tabs" role="tablist" aria-label="Network sections">
        <button role="tab" aria-selected={tab === 'connections'} onClick={() => setTab('connections')}><UsersRound size={15} /> Connections {overview ? `(${overview.connections})` : ''}</button>
        <button role="tab" aria-selected={tab === 'received'} onClick={() => setTab('received')}><BellRing size={15} /> Received {overview ? `(${overview.pendingRequests})` : ''}</button>
        <button role="tab" aria-selected={tab === 'sent'} onClick={() => setTab('sent')}><UserRoundPlus size={15} /> Sent {sentList ? `(${sentList.length})` : ''}</button>
        <button role="tab" aria-selected={false} onClick={() => setView('discover')}><Sparkles size={15} /> Discover</button>
      </div>

      {tab === 'connections' && (connectionsList === null
        ? <div className="loading-block"><LoadingSpinner label="Loading your connections" /></div>
        : connectionsList.length
          ? <div className="request-list">{connectionsList.map((connection) => <ConnectionRowView
              key={connection.connectionId} connection={connection} busyActions={busyActions} onRemove={removeConnection}
            />)}</div>
          : <div className="empty-state"><div><strong>Your network starts here</strong><p>Your network starts here. Discover students and send your first connection request.</p></div><Button variant="primary" onClick={() => setView('discover')}>Discover People</Button></div>)}

      {tab === 'received' && (receivedList === null
        ? <div className="loading-block"><LoadingSpinner label="Loading requests" /></div>
        : receivedList.length
          ? <div className="request-list">{receivedList.map((request) => <RequestRowView
              key={request.id} request={request} busyActions={busyActions}
              onAccept={acceptRequest} onDecline={declineRequest} relatedTab="received"
            />)}</div>
          : <div className="empty-state"><div><strong>You're all caught up</strong><p>You're all caught up. New connection requests will appear here.</p></div></div>)}

      {tab === 'sent' && (sentList === null
        ? <div className="loading-block"><LoadingSpinner label="Loading sent requests" /></div>
        : sentList.length
          ? <div className="request-list">{sentList.map((request) => <RequestRowView
              key={request.id} request={request} busyActions={busyActions} relatedTab="sent" onCancel={cancelSent}
            />)}</div>
          : <div className="empty-state"><div><strong>No outgoing requests</strong><p>When you send a connection request it will appear here with a Cancel option.</p></div><Button variant="primary" onClick={() => setView('discover')}>Discover People</Button></div>)}
    </section>}
  </div>;
}

function PersonCardView({ person, busyActions, onConnect, onCancel, onAccept, onRemove }: {
  person: Person;
  busyActions: Set<string>;
  onConnect: (person: Person) => void;
  onCancel: (person: Person) => void;
  onAccept: (requestId: string) => void;
  onRemove: (person: Person) => void;
}) {
  const busyFor = (action: string) => busyActions.has(`${action}:${action === 'accept' ? person.requestId : person.userId}`);
  const facts = [person.college, person.course, person.academicYear].filter(Boolean).join(' · ');
  return <article className="person-card">
    <div className="person-head">
      <Avatar name={person.displayName} src={person.avatarUrl} />
      <div className="person-identity">
        <h3>{person.displayName}</h3>
        <span>{person.recommended ? 'Recommended for you' : 'Discover students'}</span>
      </div>
    </div>
    {facts && <p className="person-facts">{facts}</p>}
    {person.bio && <p className="person-bio">{person.bio}</p>}
    {person.skills.length > 0 && <div className="person-skills">{person.skills.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>}
    {person.mutualConnections > 0 && <small className="person-mutual">{person.mutualConnections} mutual connection{person.mutualConnections === 1 ? '' : 's'}</small>}
    <div className="connect-actions">
      <Link className="button button-secondary" href={`/profile/${person.userId}`}>View Profile</Link>
      {person.relationship === 'NONE' && <Button disabled={busyFor('connect')} onClick={() => onConnect(person)}><UserRoundPlus size={15} /> {busyFor('connect') ? 'Sending…' : 'Connect'}</Button>}
      {person.relationship === 'SENT' && <>
        <Button disabled>Request Sent</Button>
        <Button variant="ghost" disabled={busyFor('cancel')} onClick={() => onCancel(person)}>Cancel</Button>
      </>}
      {person.relationship === 'RECEIVED' && <Button disabled={busyFor('accept')} onClick={() => { if (person.requestId) onAccept(person.requestId); }}><Check size={15} /> {busyFor('accept') ? 'Accepting…' : 'Accept Request'}</Button>}
      {person.relationship === 'CONNECTED' && <>
        <Tooltip label="Messaging is coming soon. You are connected — chat arrives when messaging launches.">
          <span><Button disabled><MessageCircle size={15} /> Message</Button></span>
        </Tooltip>
        <Button variant="ghost" disabled={busyFor('remove')} onClick={() => onRemove(person)}>Remove</Button>
      </>}
    </div>
  </article>;
}

function ConnectionRowView({ connection, busyActions, onRemove }: {
  connection: ConnectionItem;
  busyActions: Set<string>;
  onRemove: (connection: ConnectionItem) => void;
}) {
  const busy = busyActions.has(`remove:${connection.profile.userId}`);
  const facts = [connection.profile.college, connection.profile.course].filter(Boolean).join(' · ');
  return <div className="request-row">
    <div className="request-who">
      <Avatar name={connection.profile.displayName} src={connection.profile.avatarUrl} />
      <div>
        <strong>{connection.profile.displayName}</strong>
        <span>{facts || 'CampusConnect member'}</span>
        {connection.profile.skills.length > 0 && <span className="person-skills">{connection.profile.skills.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</span>}
      </div>
    </div>
    <div className="connect-actions">
      <Link className="button button-secondary" href={`/profile/${connection.profile.userId}`}>View Profile</Link>
      <Tooltip label="Messaging is coming soon.">
        <span><Button disabled><MessageCircle size={15} /> Message</Button></span>
      </Tooltip>
      <Button variant="ghost" disabled={busy} onClick={() => onRemove(connection)}>{busy ? 'Removing…' : 'Remove'}</Button>
    </div>
  </div>;
}

function RequestRowView({ request, busyActions, relatedTab, onAccept, onDecline, onCancel }: {
  request: ConnectRequest;
  busyActions: Set<string>;
  relatedTab: 'received' | 'sent';
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (request: ConnectRequest) => void;
}) {
  const acceptBusy = busyActions.has(`accept:${request.id}`);
  const declineBusy = busyActions.has(`decline:${request.id}`);
  const cancelBusy = busyActions.has(`cancel-sent:${request.id}`);
  const facts = [request.profile.college, request.profile.course].filter(Boolean).join(' · ');
  return <div className="request-row">
    <div className="request-who">
      <Avatar name={request.profile.displayName} src={request.profile.avatarUrl} />
      <div>
        <strong>{request.profile.displayName}</strong>
        <span>{facts || 'CampusConnect member'}</span>
        {request.profile.bio && <span className="request-bio">{request.profile.bio}</span>}
        <span><small>Requested {new Date(request.createdAt).toLocaleDateString()}</small></span>
      </div>
    </div>
    <div className="connect-actions">
      <Link className="button button-secondary" href={`/profile/${request.profile.userId}`}>View Profile</Link>
      {relatedTab === 'received' && <>
        <Button disabled={acceptBusy} onClick={() => onAccept?.(request.id)}><Check size={15} /> {acceptBusy ? 'Accepting…' : 'Accept'}</Button>
        <Button variant="ghost" disabled={declineBusy} onClick={() => onDecline?.(request.id)}>{declineBusy ? 'Declining…' : 'Decline'}</Button>
      </>}
      {relatedTab === 'sent' && <>
        <span className="status-pill status-pending">Pending</span>
        <Button variant="ghost" disabled={cancelBusy} onClick={() => onCancel?.(request)}>{cancelBusy ? 'Cancelling…' : 'Cancel Request'}</Button>
      </>}
    </div>
  </div>;
}
