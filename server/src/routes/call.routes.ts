import { Router } from 'express';
import { createCall, getCall, endCall } from '../controllers/call.controller';
import { validateCallId, validateCreateCall } from '../middleware/validation.middleware';

const router = Router();

// POST /api/calls — Create a new call
router.post('/', validateCreateCall, createCall);

// GET /api/calls/:callId — Get call details
router.get('/:callId', validateCallId, getCall);

// POST /api/calls/:callId/end — End a call
router.post('/:callId/end', validateCallId, endCall);

export default router;
