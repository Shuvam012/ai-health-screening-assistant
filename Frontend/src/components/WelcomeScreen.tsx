import React from 'react';
import { Phone, AlertCircle } from 'lucide-react';

interface WelcomeScreenProps {
  language: 'en' | 'hi';
  setLanguage: (lang: 'en' | 'hi') => void;
  errorMsg: string | null;
  startCall: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  language,
  setLanguage,
  errorMsg,
  startCall,
}) => {
  return (
    <section className="welcome-card card fade-in">
      <div className="card-header">
        <h1>AI Health Screening Assistant</h1>
        <p>Welcome! Aegis conducts quick screening calls to organize health details before you see a doctor.</p>
      </div>
      
      <div className="card-body">
        <div className="language-selector">
          <label>Select Screening Language</label>
          <div className="lang-buttons">
            <button 
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              English (UK/US)
            </button>
            <button 
              className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
              onClick={() => setLanguage('hi')}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>

        <div className="intake-info">
          <h3>Required details Aegis will collect:</h3>
          <ul>
            <li>Your Name</li>
            <li>Main medical concern or symptom</li>
            <li>How long it has lasted (duration)</li>
            <li>Intensity of symptoms (severity)</li>
            <li>Any other related symptoms</li>
          </ul>
        </div>

        {errorMsg && (
          <div className="error-box animate-shake">
            <AlertCircle className="icon" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="card-footer">
        <button onClick={startCall} className="start-call-btn glow-effect">
          <Phone className="icon animate-bounce-soft" />
          <span>Start Screening Call</span>
        </button>
      </div>
    </section>
  );
};
