import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/authenticate';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/users', adminController.listUsers);
adminRouter.patch('/users/:id/status', adminController.toggleUserStatus);
adminRouter.patch('/users/:id/role', adminController.updateUserRole);
adminRouter.get('/communities', adminController.listCommunities);
adminRouter.patch('/communities/:id/status', adminController.toggleCommunityStatus);
adminRouter.get('/reports', adminController.listReports);
adminRouter.patch('/reports/:id', adminController.updateReport);
adminRouter.get('/stats', adminController.getStats);
