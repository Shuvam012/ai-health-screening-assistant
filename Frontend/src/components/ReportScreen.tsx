import React from 'react';
import { RefreshCw, FileText, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { HealthReport } from '../types';

interface ReportScreenProps {
  loadingReport: boolean;
  report: HealthReport | null;
  errorMsg: string | null;
  onRestart: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  loadingReport,
  report,
  errorMsg,
  onRestart,
}) => {
  if (loadingReport) {
    return (
      <section className="report-panel fade-in">
        <div className="loading-card card">
          <RefreshCw className="icon animate-spin spinner" />
          <h2>Generating Clinical Intake Summary...</h2>
          <p>Cohere is summarizing and organizing your screening details.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="report-panel fade-in">
      <div className="report-card card">
        <div className="report-header">
          <div className="header-title">
            <FileText className="report-icon" />
            <h1>Health Intake Screening Summary</h1>
          </div>

          {report && (
            <div className={`completeness-badge ${report.completeness}`}>
              {report.completeness === 'complete' && <CheckCircle2 className="icon" />}
              {report.completeness === 'partial' && <AlertTriangle className="icon" />}
              {report.completeness === 'minimal' && <AlertCircle className="icon" />}
              <span>{report.completeness.toUpperCase()} REPORT</span>
            </div>
          )}
        </div>

        {errorMsg ? (
          <div className="card-body">
            <div className="error-box">
              <AlertCircle className="icon" />
              <span>{errorMsg}</span>
            </div>
          </div>
        ) : (
          report && (
            <>
              <div className="card-body report-grid">
                {/* Demographic & Main Concern */}
                <div className="report-section meta-section">
                  <div className="meta-field">
                    <span className="field-label">Patient Name:</span>
                    <span className="field-value">{report.patientName}</span>
                  </div>
                  <div className="meta-field">
                    <span className="field-label">Primary Concern:</span>
                    <span className="field-value highlight">{report.mainConcern}</span>
                  </div>
                </div>

                {/* Symptoms Badges */}
                <div className="report-section symptoms-section">
                  <h3>Key Symptoms Discussed</h3>
                  <div className="badge-container">
                    {report.symptoms.length > 0 ? (
                      report.symptoms.map((s, i) => (
                        <span key={i} className="symptom-badge">{s}</span>
                      ))
                    ) : (
                      <span className="text-muted">None specified</span>
                    )}
                  </div>
                </div>

                {/* Details duration & severity */}
                <div className="report-section details-section">
                  <div className="detail-item">
                    <h3>Duration</h3>
                    <p>{report.duration}</p>
                  </div>
                  <div className="detail-item">
                    <h3>Assessed Severity</h3>
                    <span className={`severity-tag ${report.severity.toLowerCase()}`}>
                      {report.severity}
                    </span>
                  </div>
                </div>

                {/* Related symptoms */}
                <div className="report-section related-section">
                  <h3>Related Symptoms Noted</h3>
                  <div className="badge-container">
                    {report.relatedSymptoms.length > 0 ? (
                      report.relatedSymptoms.map((s, i) => (
                        <span key={i} className="related-badge">{s}</span>
                      ))
                    ) : (
                      <span className="text-muted">No additional symptoms reported.</span>
                    )}
                  </div>
                </div>

                {/* Narrative Summary */}
                <div className="report-section summary-section">
                  <h3>Clinical Summary</h3>
                  <p className="narrative">{report.summary}</p>
                </div>

                {/* Recommendations */}
                <div className="report-section follow-up-section">
                  <h3>AI-Generated Follow-Up Guidance</h3>
                  <ul>
                    {report.followUpPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="report-disclaimer">
                <AlertCircle className="icon" />
                <p>{report.disclaimer}</p>
              </div>
            </>
          )
        )}

        <div className="card-footer">
          <button onClick={onRestart} className="restart-btn">
            <span>Conduct New Screening</span>
          </button>
        </div>
      </div>
    </section>
  );
};
