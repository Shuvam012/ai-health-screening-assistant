import { Request, Response, NextFunction } from 'express';
import { CallService, CallNotFoundError, InvalidCallStateError } from '../services/call.service';
import { ReportService } from '../services/report.service';
import { logger } from '../utils/logger';

const callService = new CallService();
const reportService = new ReportService();

/**
 * POST /api/calls — Create a new call session.
 */
export async function createCall(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { language } = req.body;
    const call = await callService.createCall(language || 'en');

    res.status(201).json({
      success: true,
      call: {
        id: call._id,
        status: call.status,
        language: call.language,
        createdAt: call.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/calls/:callId — Get call details.
 */
export async function getCall(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callId = req.params.callId as string;
    const call = await callService.getCall(callId);

    res.status(200).json({
      success: true,
      call: {
        id: call._id,
        status: call.status,
        language: call.language,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        collectedData: call.collectedData,
        metadata: call.metadata,
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof CallNotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/calls/:callId/end — End an active call.
 */
export async function endCall(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callId = req.params.callId as string;
    const call = await callService.endCall(callId, 'user_ended');

    // Generate report
    let reportAvailable = false;
    try {
      await reportService.generateReport(callId as string);
      reportAvailable = true;
    } catch (reportError) {
      logger.error('Report generation failed:', reportError);
    }

    res.status(200).json({
      success: true,
      call: {
        id: call._id,
        status: call.status,
        endedAt: call.endedAt,
        metadata: call.metadata,
      },
      reportAvailable,
    });
  } catch (error) {
    if (error instanceof CallNotFoundError) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof InvalidCallStateError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
}
