import { Router } from 'express';
import * as communitiesController from '../controllers/communities.controller';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const communitiesRouter = Router();

communitiesRouter.get('/', communitiesController.listCommunities);
communitiesRouter.get('/:slug', optionalAuthenticate, communitiesController.getCommunity);
communitiesRouter.post('/', authenticate, communitiesController.createCommunity);
communitiesRouter.patch('/:id', authenticate, communitiesController.updateCommunity);
communitiesRouter.delete('/:id', authenticate, communitiesController.deleteCommunity);
communitiesRouter.post('/:id/join', authenticate, communitiesController.joinCommunity);
communitiesRouter.post('/:id/leave', authenticate, communitiesController.leaveCommunity);
communitiesRouter.get('/:id/members', optionalAuthenticate, communitiesController.listMembers);
communitiesRouter.patch('/:id/members/:userId', authenticate, communitiesController.updateMember);
communitiesRouter.delete('/:id/members/:userId', authenticate, communitiesController.removeMember);
communitiesRouter.get('/:id/membership-requests', authenticate, communitiesController.listMembershipRequests);
communitiesRouter.patch('/:id/membership-requests/:userId', authenticate, communitiesController.reviewMembershipRequest);
