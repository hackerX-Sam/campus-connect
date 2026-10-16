import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as connectController from '../controllers/connect.controller';
import { authenticate } from '../middleware/authenticate';

export const connectRouter = Router();

// Connection actions are sensitive: bound them even though the global /api limiter applies.
const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { success: false, error: 'Too many connection actions, please try again later' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

connectRouter.use(authenticate);

connectRouter.get('/overview', connectController.getOverview);
connectRouter.get('/filters', connectController.getFilters);
connectRouter.get('/suggestions', connectController.listSuggestions);
connectRouter.get('/users', connectController.searchUsers);
connectRouter.get('/requests/received', connectController.listReceivedRequests);
connectRouter.get('/requests/sent', connectController.listSentRequests);
connectRouter.get('/relationship/:targetId', connectController.getRelationship);
connectRouter.get('/', connectController.listConnections);
connectRouter.post('/requests/:targetId', connectLimiter, connectController.sendConnectionRequest);
connectRouter.patch('/requests/:requestId/accept', connectLimiter, connectController.acceptConnectionRequest);
connectRouter.patch('/requests/:requestId/decline', connectLimiter, connectController.declineConnectionRequest);
connectRouter.delete('/requests/:requestId', connectLimiter, connectController.cancelConnectionRequest);
connectRouter.delete('/:targetId', connectLimiter, connectController.removeConnection);
