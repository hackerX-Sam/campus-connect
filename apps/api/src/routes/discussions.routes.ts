import { Router } from 'express';
import * as discussionsController from '../controllers/discussions.controller';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const discussionsRouter = Router();

discussionsRouter.get('/community/:communityId', optionalAuthenticate, discussionsController.listDiscussions);
discussionsRouter.get('/:id', optionalAuthenticate, discussionsController.getDiscussion);
discussionsRouter.post('/community/:communityId', authenticate, discussionsController.createDiscussion);
discussionsRouter.patch('/:id', authenticate, discussionsController.updateDiscussion);
discussionsRouter.delete('/:id', authenticate, discussionsController.deleteDiscussion);
discussionsRouter.get('/:id/comments', optionalAuthenticate, discussionsController.listComments);
discussionsRouter.post('/:id/comments', authenticate, discussionsController.addComment);
discussionsRouter.delete('/:id/comments/:commentId', authenticate, discussionsController.deleteComment);
