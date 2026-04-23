import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import * as settingsController from './settings.controller';

export const settingsRouter = Router();
settingsRouter.get('/public', asyncHandler(settingsController.getPublicHandler));
