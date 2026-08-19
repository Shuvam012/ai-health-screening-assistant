import { Types } from 'mongoose';
import { HealthReport, IHealthReport } from '../models/HealthReport';
import { Message } from '../models/Message';
import { Call } from '../models/Call';
import { LLMService, createLLMService } from './ai/llm.service';
import { buildReportGenerationPrompt } from '../prompts/report.prompt';
import { logger } from '../utils/logger';

/**
 * Generates and retrieves health screening reports.
 */
export class ReportService {
  private llmService: LLMService;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || createLLMService();
  }

  /**
   * Generate a health report for a completed call.
   */
  async generateReport(callId: string): Promise<IHealthReport> {
    logger.info(`Generating health report for call: ${callId}`);

    // Check if report already exists
    const existing = await HealthReport.findOne({
      callId: new Types.ObjectId(callId),
    }).exec();
    if (existing) {
      logger.info(`Report already exists for call: ${callId}`);
      return existing;
    }

    // Load call data
    const call = await Call.findById(callId).exec();
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    // Load conversation history
    const messages = await Message.find({
      callId: new Types.ObjectId(callId),
    })
      .sort({ sequence: 1 })
      .exec();

    // Build the transcript for the LLM
    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');

    let reportData: Record<string, unknown>;

    if (messages.length === 0) {
      // No conversation happened at all
      reportData = this.buildMinimalReport(call.collectedData as unknown as Record<string, unknown>);
    } else {
      try {
        // Ask LLM to generate structured report
        const systemPrompt = buildReportGenerationPrompt();
        const rawResponse = await this.llmService.chatRaw({
          systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Here is the conversation transcript:\n\n${transcript}\n\nAdditionally, here is the structured data collected during the call:\n${JSON.stringify(call.collectedData || {}, null, 2)}\n\nPlease generate the structured health screening report.`,
            },
          ],
          responseFormat: 'json',
        });

        reportData = this.parseReportResponse(rawResponse);
      } catch (error) {
        logger.error('LLM report generation failed, using collected data:', error);
        reportData = this.buildFallbackReport(call.collectedData as unknown as Record<string, unknown>, messages.length);
      }
    }

    // Determine completeness
    const completeness = this.determineCompleteness(reportData);

    // Create and save the report
    const report = await HealthReport.create({
      callId: new Types.ObjectId(callId),
      patientName: (reportData.patientName as string) || 'Not provided',
      mainConcern: (reportData.mainConcern as string) || 'Not provided',
      symptoms: (reportData.symptoms as string[]) || [],
      duration: (reportData.duration as string) || 'Not provided',
      severity: (reportData.severity as string) || 'Not provided',
      relatedSymptoms: (reportData.relatedSymptoms as string[]) || [],
      followUpPoints: (reportData.followUpPoints as string[]) || [],
      completeness,
      summary:
        (reportData.summary as string) ||
        'Limited information was collected during this screening.',
      disclaimer:
        'This is an AI-generated health screening summary and does NOT constitute a medical diagnosis. Please consult a qualified healthcare professional for proper medical advice.',
      generatedAt: new Date(),
    });

    logger.info(
      `Health report generated for call ${callId}: completeness=${completeness}`
    );
    return report;
  }

  /**
   * Retrieve an existing report for a call.
   */
  async getReport(callId: string): Promise<IHealthReport | null> {
    return HealthReport.findOne({
      callId: new Types.ObjectId(callId),
    }).exec();
  }

  private parseReportResponse(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw);
    } catch {
      logger.warn('Failed to parse report JSON, returning empty report');
      return {};
    }
  }

  private determineCompleteness(
    data: Record<string, unknown>
  ): 'complete' | 'partial' | 'minimal' {
    // If the LLM already determined completeness, use it
    if (
      data.completeness === 'complete' ||
      data.completeness === 'partial' ||
      data.completeness === 'minimal'
    ) {
      return data.completeness;
    }

    let filledCount = 0;
    const keyFields = ['patientName', 'mainConcern', 'duration', 'severity'];

    for (const field of keyFields) {
      const value = data[field];
      if (value && value !== 'Not provided' && value !== '') {
        filledCount++;
      }
    }

    if (filledCount >= 4) return 'complete';
    if (filledCount >= 2) return 'partial';
    return 'minimal';
  }

  private buildMinimalReport(
    collectedData: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      patientName: collectedData?.patientName || 'Not provided',
      mainConcern: collectedData?.mainConcern || 'Not provided',
      symptoms: [],
      duration: collectedData?.duration || 'Not provided',
      severity: collectedData?.severity || 'Not provided',
      relatedSymptoms: [],
      followUpPoints: ['Call ended with minimal information collected'],
      completeness: 'minimal',
      summary:
        'The screening call ended before sufficient information could be gathered. Please consider scheduling another screening.',
    };
  }

  private buildFallbackReport(
    collectedData: Record<string, unknown>,
    messageCount: number
  ): Record<string, unknown> {
    const completeness =
      messageCount > 6 ? 'partial' : 'minimal';
    return {
      patientName: collectedData?.patientName || 'Not provided',
      mainConcern: collectedData?.mainConcern || 'Not provided',
      symptoms: collectedData?.mainConcern
        ? [collectedData.mainConcern as string]
        : [],
      duration: collectedData?.duration || 'Not provided',
      severity: collectedData?.severity || 'Not provided',
      relatedSymptoms: (collectedData?.relatedSymptoms as string[]) || [],
      followUpPoints: [
        'Report generated from collected data only (LLM summarization was unavailable)',
      ],
      completeness,
      summary: `Health screening data was collected over ${messageCount} messages. Report generated from structured data only.`,
    };
  }
}
