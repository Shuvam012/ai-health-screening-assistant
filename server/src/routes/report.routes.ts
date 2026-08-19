import { Router } from 'express';
import { getReport } from '../controllers/report.controller';
import { validateCallId } from '../middleware/validation.middleware';

const router = Router();

// GET /api/calls/:callId/report — Get health report
router.get('/:callId/report', validateCallId, getReport);

export default router;
