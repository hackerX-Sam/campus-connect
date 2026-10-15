import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { getPagination } from '../lib/validation';

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { unreadOnly } = req.query as Record<string, string>;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    const where = {
      userId: req.user!.id,
      ...(unreadOnly === 'true' && { isRead: false }),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    res.json({ success: true, data: { notifications, unreadCount, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.userId !== req.user!.id) throw new ForbiddenError();

    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.userId !== req.user!.id) throw new ForbiddenError();

    await prisma.notification.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
