import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller';
import { authenticate } from '../middleware/authenticate';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate); // all notification routes require auth
notificationsRouter.get('/', notificationsController.listNotifications);
notificationsRouter.patch('/:id/read', notificationsController.markRead);
notificationsRouter.patch('/read-all', notificationsController.markAllRead);
notificationsRouter.delete('/:id', notificationsController.deleteNotification);
