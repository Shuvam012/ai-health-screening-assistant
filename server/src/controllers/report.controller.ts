import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { CallService, CallNotFoundError } from '../services/call.service';

const reportService = new ReportService();
const callService = new CallService();

/**
 * GET /api/calls/:callId/report — Get health report for a call.
 */
export async function getReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callId = req.params.callId as string;

    // Check call exists and is completed
    const call = await callService.getCall(callId);

    if (call.status !== 'completed' && call.status !== 'failed') {
      res.status(400).json({
        success: false,
        error: 'Report is only available after the call has ended.',
      });
      return;
    }

    const report = await reportService.getReport(callId);

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found. It may still be generating.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      report: {
        callId: report.callId,
        patientName: report.patientName,
        mainConcern: report.mainConcern,
        symptoms: report.symptoms,
        duration: report.duration,
        severity: report.severity,
        relatedSymptoms: report.relatedSymptoms,
        followUpPoints: report.followUpPoints,
        completeness: report.completeness,
        summary: report.summary,
        disclaimer: report.disclaimer,
        generatedAt: report.generatedAt,
      },
    });
  } catch (error) {
    if (error instanceof CallNotFoundError) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
}
