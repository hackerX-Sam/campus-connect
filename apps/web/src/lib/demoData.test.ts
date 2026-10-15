import { api, resolveApiBase } from './apiClient';
import { getDemoResponse } from './demoData';
import { disableDemoMode, enableDemoMode, isDemoMode } from './demoMode';

const fetchMock = jest.fn();

describe('public demo fixtures', () => {
  beforeEach(() => {
    disableDemoMode();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
    fetchMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  });

  it('searches and paginates the sample communities', () => {
    const result = getDemoResponse('/communities?q=design&page=1&limit=1') as {
      communities: { name: string }[];
      total: number;
    };

    expect(result.communities.map((community) => community.name)).toEqual(['Westlake Design Lab']);
    expect(result.total).toBe(1);
  });

  it('filters projects by technology and sorts results by title', () => {
    const technologyResult = getDemoResponse('/projects?technology=React') as {
      projects: { title: string }[];
      total: number;
    };
    const sortedResult = getDemoResponse('/projects?sort=title') as { projects: { title: string }[] };

    expect(technologyResult.projects.map((project) => project.title)).toEqual(['Campus Access Map']);
    expect(technologyResult.total).toBe(1);
    expect(sortedResult.projects.map((project) => project.title)).toEqual([
      'A Welcome Zine for New Students', 'Campus Access Map', 'Garden Sensor Kit', 'The Pantry Exchange Board',
    ]);
  });

  it('keeps detail pages connected to related sample records', () => {
    const community = getDemoResponse('/communities/northbridge-builders') as {
      community: { id: string; events: { id: string }[] };
    };
    const discussions = getDemoResponse(`/discussions/community/${community.community.id}`) as {
      discussions: { id: string }[];
    };
    const comments = getDemoResponse(`/discussions/${discussions.discussions[0].id}/comments`) as {
      comments: { replies: unknown[] }[];
    };

    expect(community.community.events.length).toBeGreaterThan(0);
    expect(discussions.discussions).toHaveLength(1);
    expect(comments.comments[0].replies).toHaveLength(1);
  });

  it('does not create fixtures for protected or unknown records', () => {
    expect(getDemoResponse('/notifications?limit=50')).toBeUndefined();
    expect(getDemoResponse('/admin/stats')).toBeUndefined();
    expect(getDemoResponse('/users/private-user-id')).toBeUndefined();
  });

  it('serves public fixtures in explicit demo mode without calling the API', async () => {
    fetchMock.mockRejectedValue(new TypeError('API should not be called'));
    enableDemoMode('manual');

    const result = await api.get<{ projects: { id: string }[] }>('/projects?q=Campus%20Access');

    expect(result.projects).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('activates a demo after an unavailable public API read', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await api.get<{ events: { id: string }[] }>('/events?upcoming=true&limit=2');

    expect(result.events).toHaveLength(2);
    expect(isDemoMode()).toBe(true);
  });

  it('uses public fixtures when the API responds with a server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Database unavailable' }),
    } as Response);

    const result = await api.get<{ communities: { id: string }[] }>('/communities?limit=2');

    expect(result.communities).toHaveLength(2);
    expect(isDemoMode()).toBe(true);
  });

  it('blocks writes while demo mode is active', async () => {
    fetchMock.mockRejectedValue(new TypeError('API should not be called'));
    enableDemoMode('manual');

    await expect(api.post('/communities', { name: 'A sample' })).rejects.toMatchObject({
      status: 403,
      message: 'Demo mode is read-only. Sign in or exit demo mode to make changes.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not return demo data for protected reads when the API is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.get('/notifications?limit=50')).rejects.toThrow('Failed to fetch');
    expect(isDemoMode()).toBe(false);
  });
});

describe('API deployment URL', () => {
  it('uses localhost for local development but never for production', () => {
    expect(resolveApiBase(undefined, 'development')).toBe('http://localhost:3001/api');
    expect(resolveApiBase(undefined, 'production')).toBe('');
    expect(resolveApiBase('http://localhost:3001/api', 'production')).toBe('');
  });

  it('preserves an explicitly configured hosted API URL', () => {
    expect(resolveApiBase('https://api.campusconnect.example/api/', 'production')).toBe('https://api.campusconnect.example/api');
  });
});