import { Router } from 'express';
import * as projectsController from '../controllers/projects.controller';
import { authenticate } from '../middleware/authenticate';

export const projectsRouter = Router();

projectsRouter.get('/', projectsController.listProjects);
projectsRouter.get('/:id', projectsController.getProject);
projectsRouter.post('/', authenticate, projectsController.createProject);
projectsRouter.patch('/:id', authenticate, projectsController.updateProject);
projectsRouter.delete('/:id', authenticate, projectsController.deleteProject);
projectsRouter.post('/:id/collaborate', authenticate, projectsController.requestCollaboration);
projectsRouter.patch('/:id/collaborate/:requestId', authenticate, projectsController.reviewCollaboration);
projectsRouter.get('/:id/members', projectsController.listProjectMembers);
projectsRouter.delete('/:id/members/:userId', authenticate, projectsController.removeMember);
