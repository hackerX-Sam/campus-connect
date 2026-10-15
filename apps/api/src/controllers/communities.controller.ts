import { Request, Response, NextFunction } from 'express';
import slugify from 'slugify';
import { prisma } from '../lib/prisma';
import { validate, communitySchema, communityUpdateSchema, getPagination, memberRoleUpdateSchema, membershipReviewSchema } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';

// Helper to check if user is community admin/owner
async function assertCommunityAdmin(communityId: string, userId: string) {
  const membership = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });
  if (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw new ForbiddenError('You must be a community admin to do this');
  }
  return membership;
}

export async function listCommunities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, category } = req.query as Record<string, string>;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    const where = {
      status: 'ACTIVE' as const,
      visibility: 'PUBLIC' as const,
      ...(q && { name: { contains: q, mode: 'insensitive' as const } }),
      ...(category && { category }),
    };

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        select: {
          id: true, slug: true, name: true, description: true,
          category: true, logoUrl: true, visibility: true,
          _count: { select: { memberships: true, events: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.community.count({ where }),
    ]);

    res.json({
      success: true,
      data: { communities, total, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCommunity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const community = await prisma.community.findUnique({
      where: { slug: req.params.slug },
      include: {
        owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        _count: { select: { memberships: true, events: true, projects: true } },
        events: {
          where: { status: 'PUBLISHED', startAt: { gte: new Date() } },
          orderBy: { startAt: 'asc' },
          take: 5,
          select: { id: true, title: true, startAt: true, endAt: true, venue: true },
        },
      },
    });

    if (!community) throw new NotFoundError('Community');
    if (community.status !== 'ACTIVE') throw new NotFoundError('Community');
    const viewer = (req as AuthRequest).user;
    if (community.visibility === 'PRIVATE' && viewer?.role !== 'ADMIN' &&
      (!viewer || !(await prisma.communityMembership.findFirst({
        where: { communityId: community.id, userId: viewer.id, status: 'ACTIVE' },
        select: { id: true },
      })))) {
      throw new NotFoundError('Community');
    }

    res.json({ success: true, data: { community } });
  } catch (err) {
    next(err);
  }
}

export async function createCommunity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(communitySchema, { body: req.body });

    const baseSlug = slugify(body.name, { lower: true, strict: true });
    let slug = baseSlug;
    let attempt = 0;

    while (await prisma.community.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++attempt}`;
    }

    const community = await prisma.$transaction(async (tx) => {
      const c = await tx.community.create({
        data: {
          ...body,
          slug,
          ownerId: req.user!.id,
        },
      });

      // Creator automatically becomes OWNER member
      await tx.communityMembership.create({
        data: {
          userId: req.user!.id,
          communityId: c.id,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      return c;
    });

    res.status(201).json({ success: true, data: { community } });
  } catch (err) {
    next(err);
  }
}

export async function updateCommunity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') await assertCommunityAdmin(req.params.id, req.user!.id);
    const { body } = validate(communityUpdateSchema, { body: req.body });

    const community = await prisma.community.update({
      where: { id: req.params.id },
      data: body,
    });

    res.json({ success: true, data: { community } });
  } catch (err) {
    next(err);
  }
}

export async function deleteCommunity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) throw new NotFoundError('Community');
    if (req.user!.role !== 'ADMIN') await assertCommunityAdmin(req.params.id, req.user!.id);
    const archived = await prisma.community.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
      select: { id: true, status: true },
    });
    res.json({ success: true, data: { community: archived } });
  } catch (err) {
    next(err);
  }
}

export async function joinCommunity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) throw new NotFoundError('Community');
    if (community.status !== 'ACTIVE') throw new ValidationError('Community is not active');

    const existing = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId: req.params.id } },
    });
    if (existing) throw new ConflictError('You are already a member or have a pending request');

    const status = community.visibility === 'PUBLIC' ? 'ACTIVE' : 'PENDING';

    const membership = await prisma.communityMembership.create({
      data: {
        userId: req.user!.id,
        communityId: req.params.id,
        status,
        joinedAt: status === 'ACTIVE' ? new Date() : null,
      },
    });

    res.status(201).json({
      success: true,
      data: { membership, message: status === 'ACTIVE' ? 'Joined successfully' : 'Request sent for approval' },
    });
  } catch (err) {
    next(err);
  }
}

export async function leaveCommunity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const membership = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId: req.params.id } },
    });

    if (!membership) throw new NotFoundError('Membership');
    if (membership.role === 'OWNER') throw new ValidationError('Owners cannot leave. Transfer ownership first.');

    await prisma.communityMembership.delete({
      where: { userId_communityId: { userId: req.user!.id, communityId: req.params.id } },
    });

    res.json({ success: true, message: 'Left community successfully' });
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const community = await prisma.community.findUnique({ where: { id: req.params.id }, select: { visibility: true } });
    if (!community) throw new NotFoundError('Community');
    const viewer = (req as AuthRequest).user;
    if (community.visibility === 'PRIVATE' && viewer?.role !== 'ADMIN' &&
      (!viewer || !(await prisma.communityMembership.findFirst({
        where: { communityId: req.params.id, userId: viewer.id, status: 'ACTIVE' },
        select: { id: true },
      })))) {
      throw new NotFoundError('Community');
    }
    const members = await prisma.communityMembership.findMany({
      where: { communityId: req.params.id, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, college: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({ success: true, data: { members } });
  } catch (err) {
    next(err);
  }
}

export async function updateMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.user!.role === 'ADMIN' ? null : await assertCommunityAdmin(req.params.id, req.user!.id);
    const { body } = validate(memberRoleUpdateSchema, { body: req.body });
    const role = body.role;
    if (actor && actor.role !== 'OWNER' && role === 'ADMIN') {
      throw new ForbiddenError('Only the community owner can appoint admins');
    }

    const target = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
    });
    if (!target) throw new NotFoundError('Membership');
    if (target.role === 'OWNER') throw new ValidationError('Community ownership cannot be changed here');
    if (actor && actor.role !== 'OWNER' && target.role === 'ADMIN') {
      throw new ForbiddenError('Only the community owner can change an admin role');
    }
    const membership = await prisma.communityMembership.update({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
      data: { role },
    });

    res.json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.user!.role === 'ADMIN' ? null : await assertCommunityAdmin(req.params.id, req.user!.id);
    const target = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
    });
    if (!target) throw new NotFoundError('Membership');
    if (target.role === 'OWNER') throw new ValidationError('Community ownership cannot be removed');
    if (actor && actor.role !== 'OWNER' && target.role === 'ADMIN') {
      throw new ForbiddenError('Only the community owner can remove an admin');
    }

    await prisma.communityMembership.delete({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
    });

    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

export async function listMembershipRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') await assertCommunityAdmin(req.params.id, req.user!.id);

    const requests = await prisma.communityMembership.findMany({
      where: { communityId: req.params.id, status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true, avatarUrl: true, college: true } },
          },
        },
      },
    });

    res.json({ success: true, data: { requests } });
  } catch (err) {
    next(err);
  }
}

export async function reviewMembershipRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') await assertCommunityAdmin(req.params.id, req.user!.id);
    const { body } = validate(membershipReviewSchema, { body: req.body });
    const { action } = body;

    const status = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';

    const current = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
    });
    if (!current || current.status !== 'PENDING') throw new NotFoundError('Membership request');
    const membership = await prisma.communityMembership.update({
      where: { userId_communityId: { userId: req.params.userId, communityId: req.params.id } },
      data: { status, joinedAt: status === 'ACTIVE' ? new Date() : null },
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: req.params.userId,
        type: status === 'ACTIVE' ? 'MEMBERSHIP_APPROVED' : 'MEMBERSHIP_REJECTED',
        title: status === 'ACTIVE' ? 'Membership approved' : 'Membership request rejected',
        message: status === 'ACTIVE'
          ? 'Your membership request has been approved'
          : 'Your membership request was not approved',
      },
    });

    res.json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}
