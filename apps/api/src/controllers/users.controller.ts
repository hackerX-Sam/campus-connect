import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { validate, updateProfileSchema, getPagination } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError } from '../lib/errors';

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const [users, total] = await Promise.all([prisma.userProfile.findMany({
      where: { isPublic: true },
      select: {
        userId: true,
        displayName: true,
        avatarUrl: true,
        college: true,
        course: true,
        skills: true,
        interests: true,
      },
      skip,
      take: limit,
    }), prisma.userProfile.count({ where: { isPublic: true } })]);
    res.json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        role: true,
        createdAt: true,
        profile: true,
        communityMemberships: {
          where: { status: 'ACTIVE' },
          select: { community: { select: { id: true, name: true, slug: true, logoUrl: true } } },
        },
        ownedProjects: {
          where: { status: { not: 'CANCELLED' } },
          select: { id: true, title: true, status: true, category: true },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundError('User');
    if (!user.profile?.isPublic && req.user?.id !== user.id && req.user?.role !== 'ADMIN') {
      throw new NotFoundError('User');
    }

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(updateProfileSchema, { body: req.body });

    const profile = await prisma.userProfile.update({
      where: { userId: req.user!.id },
      data: {
        ...body,
        githubUrl: body.githubUrl || null,
        linkedinUrl: body.linkedinUrl || null,
        websiteUrl: body.websiteUrl || null,
      },
    });

    res.json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const [user, memberships, events, projects, notifications] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, profile: true },
      }),
      prisma.communityMembership.findMany({
        where: { userId, status: 'ACTIVE' },
        include: {
          community: {
            select: {
              id: true, name: true, slug: true, category: true, logoUrl: true,
              _count: { select: { memberships: true } },
            },
          },
        },
        take: 6,
      }),
      prisma.eventRegistration.findMany({
        where: { userId },
        include: {
          event: {
            select: { id: true, title: true, startAt: true, endAt: true, status: true, community: { select: { name: true } } },
          },
        },
        orderBy: { event: { startAt: 'asc' } },
        take: 5,
      }),
      prisma.projectMembership.findMany({
        where: { userId },
        include: {
          project: { select: { id: true, title: true, status: true, category: true, techStack: true } },
        },
        take: 6,
      }),
      prisma.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        user,
        memberships: memberships.map((m) => m.community),
        events: events.map((e) => e.event),
        projects: projects.map((p) => p.project),
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
}
