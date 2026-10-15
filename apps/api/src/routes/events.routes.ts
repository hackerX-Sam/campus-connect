import { Router } from 'express';
import * as eventsController from '../controllers/events.controller';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const eventsRouter = Router();

eventsRouter.get('/', eventsController.listEvents);
eventsRouter.get('/:id', optionalAuthenticate, eventsController.getEvent);
eventsRouter.post('/', authenticate, eventsController.createEvent);
eventsRouter.patch('/:id', authenticate, eventsController.updateEvent);
eventsRouter.delete('/:id', authenticate, eventsController.deleteEvent);
eventsRouter.post('/:id/register', authenticate, eventsController.registerForEvent);
eventsRouter.delete('/:id/register', authenticate, eventsController.unregisterFromEvent);
eventsRouter.get('/:id/participants', authenticate, eventsController.listParticipants);
