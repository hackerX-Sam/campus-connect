process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'connect-tests-secret-value-32-chars-min';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'connect-tests-refresh-secret-32-chars-min';

jest.mock('../dist/lib/prisma', () => ({ prisma: require('./connect.mock').default }));

const request = require('supertest');
const { prisma: db } = require('../dist/lib/prisma');
const { signAccessToken } = require('../dist/lib/jwt');
const { makeUser } = require('./connect.mock');

const app = require('../dist/app').default;

const NOW = new Date('2026-03-01T12:00:00Z');

function authAs(userId) {
  const user = db.__users.get(userId);
  if (!user) throw new Error(`No test user registered: ${userId}`);
  return { Authorization: `Bearer ${signAccessToken({ userId, role: user.role })}` };
}

function registerUser(id, role = 'STUDENT') {
  db.__users.set(id, makeUser(id, role));
}

beforeEach(() => {
  jest.resetAllMocks();
  db.__install();
  registerUser('user-1');
  registerUser('user-2');
  registerUser('user-3');
});

describe('connect endpoints — authentication', () => {
  test('rejects connect requests without credentials', async () => {
    const response = await request(app).get('/api/connect/overview');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: 'Authentication required' });
  });
});

describe('connect endpoints — overview', () => {
  test('returns connection counts computed from the database', async () => {
    db.connection.count
      .mockImplementationOnce(({ where }) => {
        expect(where.OR).toEqual([
          { senderId: 'user-1', status: 'ACCEPTED' },
          { receiverId: 'user-1', status: 'ACCEPTED' },
        ]);
        return Promise.resolve(2);
      })
      .mockImplementationOnce(() => Promise.resolve(1));
    db.connection.findMany.mockResolvedValueOnce([]);
    db.userProfile.count.mockResolvedValueOnce(7);

    const response = await request(app).get('/api/connect/overview').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { connections: 2, pendingRequests: 1, suggestions: 7 } });
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});

describe('connect endpoints — discovery', () => {
  test('lists suggestions ranked and mapped with relationship states', async () => {
    db.connection.findMany.mockImplementationOnce(() => Promise.resolve([])); // exclusion links
    db.userProfile.findUnique.mockResolvedValueOnce({ college: 'DTU', course: 'CSE', skills: ['React'], interests: ['AI'] });
    db.userProfile.findMany.mockResolvedValueOnce([
      {
        userId: 'user-2', displayName: 'Priya', avatarUrl: null, bio: 'Hi', college: 'DTU',
        course: 'CSE', academicYear: '3rd Year', skills: ['React', 'Node'], interests: ['AI'], createdAt: NOW,
      },
    ]);
    db.connection.findMany.mockImplementationOnce(() => Promise.resolve([])); // pairRows
    db.connection.findMany.mockImplementationOnce(() => Promise.resolve([])); // myNetwork
    db.connection.findMany.mockImplementationOnce(() => Promise.resolve([])); // candidateNetwork
    db.communityMembership.findMany.mockResolvedValueOnce([]); // my communities
    db.communityMembership.findMany.mockResolvedValueOnce([]); // candidate communities

    const response = await request(app).get('/api/connect/suggestions').set(authAs('user-1'));
    expect(response.status).toBe(200);
    const { users, page, limit, total } = response.body.data;
    expect(page).toBe(1);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      userId: 'user-2',
      relationship: 'NONE',
      mutualConnections: 0,
      requestId: null,
    });
    // Same college (x2) + same course (x1) + shared skill (x3) + shared interest (x2) = 8
    expect(users[0].score).toBe(8);
    expect(users[0].recommended).toBe(true);
    expect(users[0].skills).toEqual(['React', 'Node']);
  });

  test('searches users sorted by name without discovery exclusions', async () => {
    db.userProfile.findMany.mockImplementationOnce(({ orderBy }) => {
      expect(orderBy).toEqual({ displayName: 'asc' });
      return Promise.resolve([
        {
          userId: 'user-3', displayName: 'Arjun', avatarUrl: null, bio: null, college: null,
          course: null, academicYear: null, skills: [], interests: [], createdAt: NOW,
        },
      ]);
    });
    db.userProfile.count.mockResolvedValueOnce(1);
    db.connection.findMany.mockResolvedValueOnce([]); // pairRows
    db.connection.findMany.mockResolvedValueOnce([]); // myNetwork
    db.connection.findMany.mockResolvedValueOnce([]); // candidateNetwork
    db.communityMembership.findMany.mockResolvedValueOnce([]); // me
    db.communityMembership.findMany.mockResolvedValueOnce([]); // others

    const response = await request(app).get('/api/connect/users?sort=name').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ total: 1 });
    expect(response.body.data.users[0]).toMatchObject({ userId: 'user-3', relationship: 'NONE', score: 0, recommended: false });
  });
});

describe('connect endpoints — sending requests', () => {
  test('prevents connecting to yourself', async () => {
    const response = await request(app).post('/api/connect/requests/user-1').set(authAs('user-1'));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: 'You cannot send a connection request to yourself' });
  });

  test('returns 404 when the target user does not exist', async () => {
    const response = await request(app).post('/api/connect/requests/ghost-user').set(authAs('user-1'));
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'User not found' });
  });

  test('returns 409 when already connected', async () => {
    db.connection.findFirst.mockResolvedValueOnce({ id: 'conn-1', senderId: 'user-2', receiverId: 'user-1', status: 'ACCEPTED' });
    const response = await request(app).post('/api/connect/requests/user-2').set(authAs('user-1'));
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ success: false, error: 'You are already connected with this person' });
  });

  test('rejects duplicates while an outgoing request is pending', async () => {
    db.connection.findFirst.mockResolvedValueOnce({ id: 'conn-2', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' });
    const response = await request(app).post('/api/connect/requests/user-2').set(authAs('user-1'));
    expect(response.status).toBe(409);
    expect(db.connection.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  test('asks the sender to accept when a reverse request is already pending', async () => {
    db.connection.findFirst.mockResolvedValueOnce({ id: 'conn-3', senderId: 'user-2', receiverId: 'user-1', status: 'PENDING' });
    const response = await request(app).post('/api/connect/requests/user-2').set(authAs('user-1'));
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already sent you/i);
  });

  test('creates a pending request and notifies the recipient', async () => {
    const created = { id: 'conn-new', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING', createdAt: NOW, updatedAt: NOW };
    db.connection.findFirst.mockResolvedValueOnce(null);
    db.connection.create.mockResolvedValueOnce(created);
    db.connection.findMany.mockResolvedValueOnce([created]); // reconcile: single pending row
    db.userProfile.findUnique.mockResolvedValueOnce({ displayName: 'Aarav' });
    db.notification.create.mockResolvedValueOnce({});
    db.connection.findUnique.mockResolvedValueOnce(created);

    const response = await request(app).post('/api/connect/requests/user-2').set(authAs('user-1'));
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(db.connection.create).toHaveBeenCalledWith({
      data: { senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' },
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-2',
        type: 'CONNECTION_REQUEST',
        data: { connectionId: 'conn-new', userId: 'user-1' },
      }),
    });
  });

  test('reactivates a declined request when the previous sender tries again', async () => {
    const reused = { id: 'conn-old', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING', createdAt: NOW, updatedAt: NOW };
    db.connection.findFirst.mockResolvedValueOnce({ id: 'conn-old', senderId: 'user-1', receiverId: 'user-2', status: 'DECLINED' });
    db.connection.update.mockResolvedValueOnce(reused);
    db.connection.findMany.mockResolvedValueOnce([reused]);
    db.userProfile.findUnique.mockResolvedValueOnce({ displayName: 'Aarav' });
    db.notification.create.mockResolvedValueOnce({});
    db.connection.findUnique.mockResolvedValueOnce(reused);

    const response = await request(app).post('/api/connect/requests/user-2').set(authAs('user-1'));
    expect(response.status).toBe(201);
    expect(db.connection.update).toHaveBeenCalledWith({ where: { id: 'conn-old' }, data: { status: 'PENDING' } });
  });
});

describe('connect endpoints — accepting requests', () => {
  test('only the recipient can accept', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 0 });
    db.connection.findUnique.mockResolvedValueOnce({
      id: 'conn-4', senderId: 'user-2', receiverId: 'user-3', status: 'PENDING',
    });
    const response = await request(app).patch('/api/connect/requests/conn-4/accept').set(authAs('user-1'));
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, error: 'Only the recipient can accept this request' });
  });

  test('rejects double-accepts with a handled-request error', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 0 });
    db.connection.findUnique.mockResolvedValueOnce({
      id: 'conn-4', senderId: 'user-2', receiverId: 'user-1', status: 'ACCEPTED',
    });
    const response = await request(app).patch('/api/connect/requests/conn-4/accept').set(authAs('user-1'));
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/already been handled/i);
  });

  test('accepting marks the row accepted and notifies the sender', async () => {
    const row = {
      id: 'conn-5', senderId: 'user-2', receiverId: 'user-1', status: 'ACCEPTED', updatedAt: NOW,
      sender: { id: 'user-2', profile: { displayName: 'Priya' } },
      receiver: { id: 'user-1', profile: { displayName: 'Aarav' } },
    };
    db.connection.updateMany
      .mockResolvedValueOnce({ count: 1 }) // accept guard
      .mockResolvedValueOnce({ count: 0 }); // reverse-row cleanup
    db.connection.findUnique.mockResolvedValueOnce(row);
    db.notification.create.mockResolvedValueOnce({});

    const response = await request(app).patch('/api/connect/requests/conn-5/accept').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data.connection).toMatchObject({ connectionId: 'conn-5' });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-2',
        type: 'CONNECTION_ACCEPTED',
        data: { connectionId: 'conn-5', userId: 'user-1' },
      }),
    });
  });
});

describe('connect endpoints — declining and cancelling', () => {
  test('only the recipient can decline', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 0 });
    db.connection.findUnique.mockResolvedValueOnce({
      id: 'conn-6', senderId: 'user-2', receiverId: 'user-3', status: 'PENDING',
    });
    const response = await request(app).patch('/api/connect/requests/conn-6/decline').set(authAs('user-1'));
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Only the recipient/);
  });

  test('recipient declines a pending request', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 1 });
    const response = await request(app).patch('/api/connect/requests/conn-7/decline').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'DECLINED' });
    expect(db.connection.updateMany).toHaveBeenCalledWith({
      where: { id: 'conn-7', receiverId: 'user-1', status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
  });

  test('only the original sender can cancel', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 0 });
    db.connection.findUnique.mockResolvedValueOnce({
      id: 'conn-8', senderId: 'user-2', receiverId: 'user-1', status: 'PENDING',
    });
    const response = await request(app).delete('/api/connect/requests/conn-8').set(authAs('user-1'));
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/your own requests/);
  });

  test('sender cancels a pending request', async () => {
    db.connection.updateMany.mockResolvedValueOnce({ count: 1 });
    const response = await request(app).delete('/api/connect/requests/conn-9').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'CANCELLED' });
  });
});

describe('connect endpoints — removing connections', () => {
  test('returns 404 when no accepted connection exists', async () => {
    db.connection.findFirst.mockResolvedValueOnce(null);
    const response = await request(app).delete('/api/connect/user-2').set(authAs('user-1'));
    expect(response.status).toBe(404);
    expect(db.connection.delete).not.toHaveBeenCalled();
  });

  test('removes an accepted connection in either direction and notifies the other user', async () => {
    db.connection.findFirst.mockResolvedValueOnce({ id: 'conn-10', senderId: 'user-2', receiverId: 'user-1', status: 'ACCEPTED' });
    db.connection.delete.mockResolvedValueOnce({});
    db.userProfile.findUnique.mockResolvedValueOnce({ displayName: 'Aarav' });
    db.notification.create.mockResolvedValueOnce({});

    const response = await request(app).delete('/api/connect/user-2').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ removedId: 'conn-10' });
    expect(db.connection.delete).toHaveBeenCalledWith({ where: { id: 'conn-10' } });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-2', type: 'CONNECTION_REMOVED' }),
    });
  });
});

describe('connect endpoints — relationship status', () => {
  test('reports SENT for an outgoing pending request with mutual counts', async () => {
    db.connection.findFirst.mockResolvedValueOnce({
      id: 'conn-11', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING', createdAt: NOW, updatedAt: NOW,
    });
    db.connection.findMany
      .mockResolvedValueOnce([{ senderId: 'user-1', receiverId: 'user-3' }]) // my network
      .mockResolvedValueOnce([{ senderId: 'user-2', receiverId: 'user-3' }]); // their network

    const response = await request(app).get('/api/connect/relationship/user-2').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ relationship: 'SENT', requestId: 'conn-11', mutualConnections: 1, since: null });
  });

  test('reports CONNECTED with a since date for accepted pairs', async () => {
    db.connection.findFirst.mockResolvedValueOnce({
      id: 'conn-12', senderId: 'user-2', receiverId: 'user-1', status: 'ACCEPTED', createdAt: NOW, updatedAt: NOW,
    });
    db.connection.findMany.mockResolvedValueOnce([]);
    db.connection.findMany.mockResolvedValueOnce([]);

    const response = await request(app).get('/api/connect/relationship/user-2').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ relationship: 'CONNECTED', since: NOW.toISOString() });
  });
});

describe('connect endpoints — data access/privacy', () => {
  test('lists my connections including the other person and hides null profiles rows', async () => {
    db.connection.findMany.mockResolvedValueOnce([
      {
        id: 'conn-13', senderId: 'user-1', receiverId: 'user-2', updatedAt: NOW,
        sender: { profile: { userId: 'user-1', displayName: 'Me' } },
        receiver: { profile: { userId: 'user-2', displayName: 'Priya' } },
      },
      {
        id: 'conn-14', senderId: 'user-1', receiverId: 'user-3', updatedAt: NOW,
        sender: { profile: { userId: 'user-1', displayName: 'Me' } },
        receiver: { profile: null },
      },
    ]);
    db.connection.count.mockResolvedValueOnce(1);

    const response = await request(app).get('/api/connect').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data.connections).toHaveLength(1);
    expect(response.body.data.connections[0].profile).toMatchObject({ displayName: 'Priya' });
    expect(response.body.data.total).toBe(1);
  });

  test('lists received requests with the sender profile', async () => {
    db.connection.findMany.mockResolvedValueOnce([
      {
        id: 'conn-r1', createdAt: NOW, updatedAt: NOW, senderId: 'user-2', receiverId: 'user-1',
        sender: { profile: { userId: 'user-2', displayName: 'Priya', skills: [] } },
      },
      {
        id: 'conn-r2', createdAt: NOW, updatedAt: NOW, senderId: 'user-3', receiverId: 'user-1',
        sender: { profile: null },
      },
    ]);

    const response = await request(app).get('/api/connect/requests/received').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data.requests).toHaveLength(1);
    expect(response.body.data.requests[0]).toMatchObject({ id: 'conn-r1', profile: { displayName: 'Priya' } });
  });

  test('lists sent requests with the receiver profile', async () => {
    db.connection.findMany.mockResolvedValueOnce([
      {
        id: 'conn-s1', createdAt: NOW, updatedAt: NOW, senderId: 'user-1', receiverId: 'user-2',
        receiver: { profile: { userId: 'user-2', displayName: 'Priya' } },
      },
    ]);

    const response = await request(app).get('/api/connect/requests/sent').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data.requests).toHaveLength(1);
    expect(response.body.data.requests[0]).toMatchObject({ id: 'conn-s1', profile: { displayName: 'Priya' } });
  });

  test('serves the concrete filter options from real profiles', async () => {
    db.userProfile.findMany.mockResolvedValueOnce([
      { college: 'DTU', course: 'CSE', skills: ['React', 'Node'], interests: ['AI'] },
      { college: 'NSUT', course: 'CSE', skills: ['Design'], interests: [] },
      { college: null, course: 'IT', skills: [], interests: ['Robotics'] },
    ]);

    const response = await request(app).get('/api/connect/filters').set(authAs('user-1'));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      colleges: ['DTU', 'NSUT'],
      departments: ['CSE', 'IT'],
    });
    expect(response.body.data.skills).toEqual(['Design', 'Node', 'React']);
    expect(response.body.data.interests).toEqual(['AI', 'Robotics']);
  });
});
