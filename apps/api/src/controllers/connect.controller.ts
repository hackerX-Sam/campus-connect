import type { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getPagination } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';

type Relationship = 'NONE' | 'SENT' | 'RECEIVED' | 'CONNECTED';

const profileSelect = {
  userId: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  college: true,
  course: true,
  academicYear: true,
  skills: true,
  interests: true,
} as const;

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

type MyProfileInfo = {
  college: string | null;
  course: string | null;
  skills: string[];
  interests: string[];
};

const RECOMMENDATION_WINDOW = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function insensitive(value: string) {
  return { contains: value, mode: 'insensitive' as const };
}

type ConnectFilters = {
  q?: string;
  college?: string;
  department?: string;
  skill?: string;
  interest?: string;
  sort: 'recommended' | 'recent' | 'name';
};

function readFilters(query: Record<string, string | undefined>): ConnectFilters {
  const value = (key: string) => {
    const raw = query[key];
    return raw && raw.trim() ? raw.trim() : undefined;
  };
  return {
    q: value('q'),
    college: value('college'),
    department: value('department'),
    skill: value('skill'),
    interest: value('interest'),
    sort: query.sort === 'recent' || query.sort === 'name' ? (query.sort as 'recent' | 'name') : 'recommended',
  };
}

function searchWhere(filters: ConnectFilters): Prisma.UserProfileWhereInput {
  return {
    isPublic: true,
    user: { isActive: true },
    ...(filters.q && {
      OR: [
        { displayName: insensitive(filters.q) },
        { bio: insensitive(filters.q) },
        { college: insensitive(filters.q) },
        { course: insensitive(filters.q) },
        { academicYear: insensitive(filters.q) },
        { skills: { has: filters.q } },
        { interests: { has: filters.q } },
      ] as Prisma.UserProfileWhereInput[],
    }),
    ...(filters.college && { college: { equals: filters.college } }),
    ...(filters.department && { course: { equals: filters.department } }),
    ...(filters.skill && { skills: { has: filters.skill } }),
    ...(filters.interest && { interests: { has: filters.interest } }),
  };
}

type Extras = {
  relationship: Relationship;
  requestId?: string;
  mutualConnections: number;
  score: number;
  recommended: boolean;
};

/**
 * Deterministic recommendations: shared skills (×3), shared interests (×2),
 * same college (×2), same course (×1), shared communities (×2), mutual
 * connections (×1). No external services involved.
 */
async function networkExtras(
  meId: string,
  meProfile: MyProfileInfo | null,
  people: ProfileSummary[]
): Promise<Map<string, Extras>> {
  const result = new Map<string, Extras>();
  for (const person of people) {
    result.set(person.userId, {
      relationship: 'NONE',
      mutualConnections: 0,
      score: 0,
      recommended: false,
    });
  }
  const others = people.map((person) => person.userId);
  if (!others.length) return result;

  const [pairRows, myNetworkRows, candidateNetworkRows, myCommunityRows, candidateCommunityRows] =
    await Promise.all([
      prisma.connection.findMany({
        where: {
          OR: [
            { senderId: meId, receiverId: { in: others } },
            { receiverId: meId, senderId: { in: others } },
          ],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { id: true, senderId: true, receiverId: true, status: true },
      }),
      prisma.connection.findMany({
        where: {
          OR: [
            { senderId: meId },
            { receiverId: meId },
          ],
          status: 'ACCEPTED',
        },
        select: { senderId: true, receiverId: true },
      }),
      prisma.connection.findMany({
        where: {
          OR: [{ senderId: { in: others } }, { receiverId: { in: others } }],
          status: 'ACCEPTED',
        },
        select: { senderId: true, receiverId: true },
      }),
      prisma.communityMembership.findMany({
        where: { userId: meId, status: 'ACTIVE' },
        select: { communityId: true },
      }),
      prisma.communityMembership.findMany({
        where: { userId: { in: others }, status: 'ACTIVE' },
        select: { userId: true, communityId: true },
      }),
    ]);

  // Per candidate: current relationship (prefer ACCEPTED, then oldest pending)
  const pairByOther = new Map<string, { id: string; senderId: string; status: string }>();
  for (const row of pairRows) {
    const otherId = row.senderId === meId ? row.receiverId : row.senderId;
    const existing = pairByOther.get(otherId);
    if (!existing) {
      pairByOther.set(otherId, row);
      continue;
    }
    if (existing.status === 'ACCEPTED') continue;
    if (row.status === 'ACCEPTED') pairByOther.set(otherId, row);
  }

  // Peer sets for mutual connection counts
  const myPeers = new Set<string>();
  for (const row of myNetworkRows) {
    myPeers.add(row.senderId === meId ? row.receiverId : row.senderId);
  }
  const peerSets = new Map<string, Set<string>>();
  for (const row of candidateNetworkRows) {
    for (const [a, b] of [[row.senderId, row.receiverId], [row.receiverId, row.senderId]] as const) {
      if (!others.includes(a)) continue;
      let set = peerSets.get(a);
      if (!set) {
        set = new Set<string>();
        peerSets.set(a, set);
      }
      set.add(b);
    }
  }

  const meCommunities = new Set(myCommunityRows.map((row) => row.communityId));
  const sharedCommunities = new Map<string, number>();
  for (const row of candidateCommunityRows) {
    if (!meCommunities.has(row.communityId)) continue;
    sharedCommunities.set(row.userId, (sharedCommunities.get(row.userId) ?? 0) + 1);
  }

  const mySkills = new Set(meProfile?.skills ?? []);
  const myInterests = new Set(meProfile?.interests ?? []);

  for (const person of people) {
    let score = 0;
    if (person.college && person.college === meProfile?.college) score += 2;
    if (person.course && person.course === meProfile?.course) score += 1;
    score += person.skills.filter((skill) => mySkills.has(skill)).length * 3;
    score += person.interests.filter((interest) => myInterests.has(interest)).length * 2;
    score += (sharedCommunities.get(person.userId) ?? 0) * 2;

    const peerSet = peerSets.get(person.userId) ?? new Set<string>();
    let mutual = 0;
    for (const peerId of peerSet) {
      if (myPeers.has(peerId)) mutual += 1;
    }
    score += mutual;

    let relationship: Relationship = 'NONE';
    let requestId: string | undefined;
    const pair = pairByOther.get(person.userId);
    if (pair) {
      if (pair.status === 'ACCEPTED') {
        relationship = 'CONNECTED';
      } else if (pair.senderId === meId) {
        relationship = 'SENT';
        requestId = pair.id;
      } else {
        relationship = 'RECEIVED';
        requestId = pair.id;
      }
    }

    result.set(person.userId, { relationship, requestId, mutualConnections: mutual, score, recommended: score > 0 });
  }

  return result;
}

function unpack(profile: ProfileSummary, extras: Extras) {
  return { ...profile, ...extras, requestId: extras.requestId ?? null, recommended: extras.recommended };
}

// ─── Overview ────────────────────────────────────────────────────────────────

export async function getOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const [connections, pendingRequests, links] = await Promise.all([
      prisma.connection.count({
        where: {
          OR: [
            { senderId: me, status: 'ACCEPTED' },
            { receiverId: me, status: 'ACCEPTED' },
          ],
        },
      }),
      prisma.connection.count({ where: { receiverId: me, status: 'PENDING' } }),
      prisma.connection.findMany({
        where: {
          OR: [{ senderId: me }, { receiverId: me }],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { senderId: true, receiverId: true, status: true },
      }),
    ]);

    // Eligible for discovery: everyone except me, existing connections,
    // and outgoing pending requests (incoming ones surface with Accept actions).
    const excluded = new Set<string>([me]);
    for (const link of links) {
      if (link.status === 'ACCEPTED' || link.senderId === me) {
        excluded.add(link.senderId === me ? link.receiverId : link.senderId);
      }
    }
    const suggestions = await prisma.userProfile.count({
      where: { isPublic: true, user: { isActive: true }, userId: { notIn: [...excluded] } },
    });

    res.json({
      success: true,
      data: { connections, pendingRequests, suggestions },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Filter options ──────────────────────────────────────────────────────────

export async function getFilters(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profiles = await prisma.userProfile.findMany({
      where: { isPublic: true },
      select: { college: true, course: true, skills: true, interests: true },
      take: 1500,
    });
    const unique = (values: (string | null)[]) =>
      Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 40);
    res.json({
      success: true,
      data: {
        colleges: unique(profiles.map((profile) => profile.college)),
        departments: unique(profiles.map((profile) => profile.course)),
        skills: unique(profiles.flatMap((profile) => profile.skills)),
        interests: unique(profiles.flatMap((profile) => profile.interests)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── People discovery ────────────────────────────────────────────────────────

async function listPeople(
  meId: string,
  filters: ConnectFilters,
  page: number,
  limit: number,
  skip: number,
  options: { excludeIds?: string[] } = {}
): Promise<{ users: unknown[]; total: number }> {
  if (filters.sort === 'recommended') {
    const [meProfile, candidates] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId: meId },
        select: { college: true, course: true, skills: true, interests: true },
      }),
      prisma.userProfile.findMany({
        where: {
          ...searchWhere(filters),
          ...(options.excludeIds?.length && { userId: { notIn: options.excludeIds } }),
        },
        orderBy: { createdAt: 'desc' },
        take: RECOMMENDATION_WINDOW,
        select: profileSelect,
      }),
    ]);
    const extras = await networkExtras(meId, meProfile, candidates);
    const ranked = candidates
      .map((profile) => ({ profile, extras: extras.get(profile.userId)! }))
      .sort(
        (a, b) =>
          b.extras.score - a.extras.score ||
          b.extras.mutualConnections - a.extras.mutualConnections ||
          a.profile.displayName.localeCompare(b.profile.displayName)
      );
    const slices = ranked.slice(skip, skip + limit);
    return {
      users: slices.map(({ profile, extras }) => unpack(profile, extras)),
      total: ranked.length,
    };
  }

  const where = {
    ...searchWhere(filters),
    ...(options.excludeIds?.length && { userId: { notIn: options.excludeIds } }),
  };
  const [profiles, total] = await Promise.all([
    prisma.userProfile.findMany({
      where,
      orderBy: filters.sort === 'name' ? { displayName: 'asc' } : { createdAt: 'desc' },
      skip,
      take: limit,
      select: profileSelect,
    }),
    prisma.userProfile.count({ where }),
  ]);
  const extras = await networkExtras(meId, null, profiles);
  return { users: profiles.map((profile) => unpack(profile, extras.get(profile.userId)!)), total };
}

export async function listSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const filters = readFilters(req.query as Record<string, string>);

    // Exclude me, existing connections, and my outgoing pending requests.
    // Incoming pending requests stay visible so users can accept them directly.
    const links = await prisma.connection.findMany({
      where: {
        OR: [{ senderId: req.user!.id }, { receiverId: req.user!.id }],
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      select: { senderId: true, receiverId: true, status: true },
    });
    const excludeIds = new Set<string>([req.user!.id]);
    for (const link of links) {
      if (link.status === 'ACCEPTED' || link.senderId === req.user!.id) {
        excludeIds.add(link.senderId === req.user!.id ? link.receiverId : link.senderId);
      }
    }

    const result = await listPeople(req.user!.id, filters, page, limit, skip, {
      excludeIds: [...excludeIds],
    });
    res.json({ success: true, data: { ...result, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const filters = readFilters(req.query as Record<string, string>);
    const result = await listPeople(req.user!.id, filters, page, limit, skip);
    res.json({ success: true, data: { ...result, page, limit } });
  } catch (err) {
    next(err);
  }
}

// ─── My network ──────────────────────────────────────────────────────────────

export async function listConnections(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const me = req.user!.id;
    const where: Prisma.ConnectionWhereInput = {
      OR: [
        { senderId: me, status: 'ACCEPTED' },
        { receiverId: me, status: 'ACCEPTED' },
      ],
    };
    const [rows, total] = await Promise.all([
      prisma.connection.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { profile: { select: profileSelect } } },
          receiver: { select: { profile: { select: profileSelect } } },
        },
      }),
      prisma.connection.count({ where }),
    ]);

    const connections = rows
      .map((row) => {
        const profile = row.senderId === me ? row.receiver.profile : row.sender.profile;
        if (!profile) return null;
        return { connectionId: row.id, since: row.updatedAt.toISOString(), profile };
      })
      .filter(Boolean);

    res.json({ success: true, data: { connections, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function listReceivedRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await prisma.connection.findMany({
      where: { receiverId: req.user!.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { profile: { select: profileSelect } } } },
    });
    const requests = rows
      .filter((row) => row.sender.profile)
      .map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString(), profile: row.sender.profile! }));
    res.json({ success: true, data: { requests } });
  } catch (err) {
    next(err);
  }
}

export async function listSentRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await prisma.connection.findMany({
      where: { senderId: req.user!.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { receiver: { select: { profile: { select: profileSelect } } } },
    });
    const requests = rows
      .filter((row) => row.receiver.profile)
      .map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString(), profile: row.receiver.profile! }));
    res.json({ success: true, data: { requests } });
  } catch (err) {
    next(err);
  }
}

// ─── Connection request workflow ─────────────────────────────────────────────

export async function sendConnectionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const targetId = (req as Request & { params: { targetId: string } }).params.targetId;
    if (me === targetId) throw new ValidationError('You cannot send a connection request to yourself');

    const connection = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, isActive: true, profile: { select: { userId: true } } },
      });
      if (!target || !target.isActive || !target.profile) throw new NotFoundError('User');

      const existing = await tx.connection.findFirst({
        where: {
          OR: [
            { senderId: me, receiverId: targetId },
            { senderId: targetId, receiverId: me },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      let connectionId: string;
      if (existing) {
        if (existing.status === 'ACCEPTED') {
          throw new ConflictError('You are already connected with this person');
        }
        if (existing.status === 'PENDING') {
          if (existing.receiverId === me) {
            throw new ConflictError('This person already sent you a connection request. Accept it instead.');
          }
          throw new ConflictError('A connection request is already pending');
        }
        if (existing.senderId === me) {
          // Reuse my prior declined/cancelled row in the same direction
          const reused = await tx.connection.update({
            where: { id: existing.id },
            data: { status: 'PENDING' },
          });
          connectionId = reused.id;
        } else {
          connectionId = (
            await tx.connection.create({
              data: { senderId: me, receiverId: targetId, status: 'PENDING' },
            })
          ).id;
        }
      } else {
        connectionId = (
          await tx.connection.create({
            data: { senderId: me, receiverId: targetId, status: 'PENDING' },
          })
        ).id;
      }

      // Reconcile the unlikely double-pending race (A→B and B→A at once).
      // Deterministic policy: the oldest pending row for the pair wins.
      const pendingPair = await tx.connection.findMany({
        where: {
          OR: [
            { senderId: me, receiverId: targetId, status: 'PENDING' },
            { senderId: targetId, receiverId: me, status: 'PENDING' },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      if (pendingPair.length > 1) {
        const winner = pendingPair[0].id;
        await tx.connection.updateMany({
          where: { id: { in: pendingPair.filter((row) => row.id !== winner).map((row) => row.id) } },
          data: { status: 'CANCELLED' },
        });
        if (winner !== connectionId) {
          connectionId = winner;
        }
      }

      const meProfile = await tx.userProfile.findUnique({
        where: { userId: me },
        select: { displayName: true },
      });
      await tx.notification.create({
        data: {
          userId: targetId,
          type: 'CONNECTION_REQUEST',
          title: 'New connection request',
          message: `${meProfile?.displayName ?? 'A student'} wants to connect with you`,
          data: { connectionId, userId: me },
        },
      });

      return tx.connection.findUnique({ where: { id: connectionId } });
    });

    res.status(201).json({ success: true, data: { connection } });
  } catch (err) {
    next(err);
  }
}

export async function acceptConnectionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const requestId = (req as Request & { params: { requestId: string } }).params.requestId;

    const connection = await prisma.$transaction(async (tx) => {
      const updated = await tx.connection.updateMany({
        where: { id: requestId, receiverId: me, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (updated.count === 0) {
        const existing = await tx.connection.findUnique({ where: { id: requestId } });
        if (!existing) throw new NotFoundError('Connection request');
        if (existing.receiverId !== me) throw new ForbiddenError('Only the recipient can accept this request');
        throw new ValidationError('This connection request has already been handled');
      }

      const row = await tx.connection.findUnique({
        where: { id: requestId },
        include: {
          sender: { select: { id: true, profile: { select: { displayName: true } } } },
          receiver: { select: { id: true, profile: { select: { displayName: true } } } },
        },
      });
      if (!row) throw new NotFoundError('Connection request');

      // Cancel any stray reverse-direction pending request for the pair.
      await tx.connection.updateMany({
        where: {
          senderId: row.receiverId,
          receiverId: row.senderId,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });

      await tx.notification.create({
        data: {
          userId: row.senderId,
          type: 'CONNECTION_ACCEPTED',
          title: 'Connection accepted',
          message: `${row.receiver.profile?.displayName ?? 'A student'} accepted your connection request`,
          data: { connectionId: row.id, userId: row.receiverId },
        },
      });

      return row;
    });

    res.json({
      success: true,
      data: {
        connection: {
          connectionId: connection.id,
          since: connection.updatedAt.toISOString(),
          profile: connection.sender.profile,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function declineConnectionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const requestId = (req as Request & { params: { requestId: string } }).params.requestId;

    const updated = await prisma.connection.updateMany({
      where: { id: requestId, receiverId: me, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    if (updated.count === 0) {
      const existing = await prisma.connection.findUnique({ where: { id: requestId } });
      if (!existing) throw new NotFoundError('Connection request');
      if (existing.receiverId !== me) throw new ForbiddenError('Only the recipient can decline this request');
      throw new ValidationError('This connection request has already been handled');
    }

    res.json({ success: true, data: { status: 'DECLINED' } });
  } catch (err) {
    next(err);
  }
}

export async function cancelConnectionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const requestId = (req as Request & { params: { requestId: string } }).params.requestId;

    const updated = await prisma.connection.updateMany({
      where: { id: requestId, senderId: me, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) {
      const existing = await prisma.connection.findUnique({ where: { id: requestId } });
      if (!existing) throw new NotFoundError('Connection request');
      if (existing.senderId !== me) throw new ForbiddenError('You can only cancel your own requests');
      throw new ValidationError('Only pending requests can be cancelled');
    }

    res.json({ success: true, data: { status: 'CANCELLED' } });
  } catch (err) {
    next(err);
  }
}

export async function removeConnection(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const targetId = (req as Request & { params: { targetId: string } }).params.targetId;

    const removed = await prisma.$transaction(async (tx) => {
      const connection = await tx.connection.findFirst({
        where: {
          OR: [
            { senderId: me, receiverId: targetId, status: 'ACCEPTED' },
            { senderId: targetId, receiverId: me, status: 'ACCEPTED' },
          ],
        },
      });
      if (!connection) throw new NotFoundError('Connection');
      await tx.connection.delete({ where: { id: connection.id } });

      const meProfile = await tx.userProfile.findUnique({
        where: { userId: me },
        select: { displayName: true },
      });
      await tx.notification.create({
        data: {
          userId: targetId,
          type: 'CONNECTION_REMOVED',
          title: 'Connection removed',
          message: `${meProfile?.displayName ?? 'A student'} removed you from their network`,
          data: { userId: me },
        },
      });

      return connection.id;
    });

    res.json({ success: true, data: { removedId: removed } });
  } catch (err) {
    next(err);
  }
}

// ─── Relationship status (used by the shared profile page) ───────────────────

export async function getRelationship(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const me = req.user!.id;
    const targetId = (req as Request & { params: { targetId: string } }).params.targetId;
    if (me === targetId) throw new ValidationError('Self has no relationship state');

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isActive: true },
    });
    if (!target || !target.isActive) throw new NotFoundError('User');

    const pair = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: me, receiverId: targetId },
          { senderId: targetId, receiverId: me },
        ],
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    let relationship: Relationship = 'NONE';
    let requestId: string | null = null;
    let since: string | null = null;
    if (pair) {
      requestId = pair.id;
      if (pair.status === 'ACCEPTED') {
        relationship = 'CONNECTED';
        since = pair.updatedAt.toISOString();
      } else {
        relationship = pair.senderId === me ? 'SENT' : 'RECEIVED';
      }
    }

    const [myNetwork, otherNetwork] = await Promise.all([
      prisma.connection.findMany({
        where: { OR: [{ senderId: me }, { receiverId: me }], status: 'ACCEPTED' },
        select: { senderId: true, receiverId: true },
      }),
      prisma.connection.findMany({
        where: { OR: [{ senderId: targetId }, { receiverId: targetId }], status: 'ACCEPTED' },
        select: { senderId: true, receiverId: true },
      }),
    ]);
    const myPeers = new Set(myNetwork.map((row) => (row.senderId === me ? row.receiverId : row.senderId)));
    let mutualConnections = 0;
    for (const row of otherNetwork) {
      if (myPeers.has(row.senderId === targetId ? row.receiverId : row.senderId)) mutualConnections += 1;
    }

    res.json({ success: true, data: { relationship, requestId, since, mutualConnections } });
  } catch (err) {
    next(err);
  }
}
