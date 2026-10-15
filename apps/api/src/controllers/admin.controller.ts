import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ValidationError } from '../lib/errors';
import { validate, userRoleUpdateSchema, reportStatusSchema, getPagination } from '../lib/validation';

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const [users, total] = await Promise.all([prisma.user.findMany({
      select: {
        id: true, email: true, role: true, isActive: true, createdAt: true,
        profile: { select: { displayName: true, college: true } },
        _count: { select: { communityMemberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }), prisma.user.count()]);
    res.json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function toggleUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.params.id === req.user!.id) throw new ValidationError('Cannot deactivate your own account');

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new NotFoundError('User');

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true },
    });

    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(userRoleUpdateSchema, { body: req.body });
    const { role } = body;
    if (req.params.id === req.user!.id && role !== req.user!.role) {
      throw new ValidationError('You cannot change your own administrator role');
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, role: true },
    });

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function listCommunities(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const communities = await prisma.community.findMany({
      select: {
        id: true, name: true, slug: true, category: true, status: true, createdAt: true,
        owner: { select: { email: true, profile: { select: { displayName: true } } } },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { communities } });
  } catch (err) {
    next(err);
  }
}

export async function toggleCommunityStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) throw new NotFoundError('Community');

    const newStatus = community.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';

    const updated = await prisma.community.update({
      where: { id: req.params.id },
      data: { status: newStatus },
      select: { id: true, status: true },
    });

    res.json({ success: true, data: { community: updated } });
  } catch (err) {
    next(err);
  }
}

export async function listReports(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { reports } });
  } catch (err) {
    next(err);
  }
}

export async function updateReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(reportStatusSchema, { body: req.body });

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: body.status },
    });

    res.json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [users, communities, events, projects] = await Promise.all([
      prisma.user.count(),
      prisma.community.count({ where: { status: 'ACTIVE' } }),
      prisma.event.count({ where: { status: 'PUBLISHED' } }),
      prisma.project.count({ where: { status: { not: 'CANCELLED' } } }),
    ]);

    res.json({ success: true, data: { stats: { users, communities, events, projects } } });
  } catch (err) {
    next(err);
  }
}
