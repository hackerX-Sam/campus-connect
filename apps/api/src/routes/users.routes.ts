import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const usersRouter = Router();

usersRouter.patch('/me/profile', authenticate, usersController.updateProfile);
usersRouter.get('/me/dashboard', authenticate, usersController.getDashboard);
usersRouter.get('/', usersController.listUsers);
usersRouter.get('/:id', optionalAuthenticate, usersController.getUser);
