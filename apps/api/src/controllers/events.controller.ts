import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { validate, eventSchema, eventUpdateSchema, getPagination } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, communityId, upcoming } = req.query as Record<string, string>;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    const where = {
      status: 'PUBLISHED' as const,
      ...(q && { title: { contains: q, mode: 'insensitive' as const } }),
      ...(communityId && { communityId }),
      ...(upcoming === 'true' && { startAt: { gte: new Date() } }),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        select: {
          id: true, title: true, description: true, startAt: true, endAt: true,
          venue: true, meetingLink: true, maxCapacity: true, status: true, tags: true,
          community: { select: { id: true, name: true, slug: true } },
          creator: { select: { id: true, profile: { select: { displayName: true } } } },
          _count: { select: { registrations: true } },
        },
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ success: true, data: { events, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function getEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        community: { select: { id: true, name: true, slug: true } },
        creator: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        _count: { select: { registrations: true } },
      },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.status !== 'PUBLISHED' && event.creatorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new NotFoundError('Event');
    }

    res.json({ success: true, data: { event } });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(eventSchema, { body: req.body });

    if (new Date(body.startAt) >= new Date(body.endAt)) {
      throw new ValidationError('Event end time must be after start time');
    }

    // If linked to a community, verify membership
    if (body.communityId) {
      const membership = await prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: req.user!.id, communityId: body.communityId } },
      });
      if (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
        throw new ForbiddenError('You must be a community moderator to create events');
      }
    }

    const event = await prisma.event.create({
      data: {
        ...body,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        creatorId: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: { event } });
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new NotFoundError('Event');

    if (event.creatorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the event creator can update this event');
    }

    const { body } = validate(eventUpdateSchema, { body: req.body });
    const nextCommunityId = body.communityId ?? event.communityId;
    if (nextCommunityId && nextCommunityId !== event.communityId) {
      const membership = await prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: req.user!.id, communityId: nextCommunityId } },
      });
      if (req.user!.role !== 'ADMIN' && (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role))) {
        throw new ForbiddenError('You must be a community moderator to move this event');
      }
    }

    const startAt = body.startAt ? new Date(body.startAt) : event.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : event.endAt;
    if (startAt >= endAt) {
      throw new ValidationError('Event end time must be after start time');
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...body,
        startAt: body.startAt ? startAt : undefined,
        endAt: body.endAt ? endAt : undefined,
      },
    });

    // Notify registered users of update
    if (updated.status === 'CANCELLED') {
      const registrations = await prisma.eventRegistration.findMany({
        where: { eventId: req.params.id },
        select: { userId: true },
      });

      await prisma.notification.createMany({
        data: registrations.map((r) => ({
          userId: r.userId,
          type: 'EVENT_CANCELLED' as const,
          title: `Event cancelled: ${updated.title}`,
          message: 'An event you registered for has been cancelled',
        })),
      });
    }

    res.json({ success: true, data: { event: updated } });
  } catch (err) {
    next(err);
  }
}

export async function deleteEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new NotFoundError('Event');
    if (event.creatorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the event creator can delete this event');
    }

    await prisma.event.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });

    res.json({ success: true, message: 'Event cancelled' });
  } catch (err) {
    next(err);
  }
}

export async function registerForEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.status !== 'PUBLISHED') throw new ValidationError('Event is not open for registration');
    if (event.startAt < new Date()) throw new ValidationError('Event has already started');

    if (event.maxCapacity && event._count.registrations >= event.maxCapacity) {
      throw new ValidationError('Event is at full capacity');
    }

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
    });
    if (existing) throw new ConflictError('You are already registered for this event');

    const registration = await prisma.eventRegistration.create({
      data: { eventId: req.params.id, userId: req.user!.id },
    });

    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        type: 'EVENT_REGISTERED',
        title: `Registered: ${event.title}`,
        message: `You have successfully registered for ${event.title}`,
      },
    });

    res.status(201).json({ success: true, data: { registration } });
  } catch (err) {
    next(err);
  }
}

export async function unregisterFromEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
    });

    if (!registration) throw new NotFoundError('Registration');

    await prisma.eventRegistration.delete({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
    });

    res.json({ success: true, message: 'Unregistered from event' });
  } catch (err) {
    next(err);
  }
}

export async function listParticipants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new NotFoundError('Event');

    // Only creator or admin can see participant list
    if (event.creatorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the event creator can view participants');
    }

    const participants = await prisma.eventRegistration.findMany({
      where: { eventId: req.params.id },
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

    res.json({ success: true, data: { participants } });
  } catch (err) {
    next(err);
  }
}
