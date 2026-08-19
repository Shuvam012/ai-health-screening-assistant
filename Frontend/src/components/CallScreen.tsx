import React, { useEffect, useRef } from 'react';
import { Clock, Activity, Mic, PhoneOff, AlertCircle } from 'lucide-react';
import type { Message, AiStatus } from '../types';

interface CallScreenProps {
  aiStatus: AiStatus;
  isRecording: boolean;
  callTimer: number;
  messages: Message[];
  errorMsg: string | null;
  handleMicToggle: () => void;
  endCall: () => void;
  language: 'en' | 'hi';
}

export const CallScreen: React.FC<CallScreenProps> = ({
  aiStatus,
  isRecording,
  callTimer,
  messages,
  errorMsg,
  handleMicToggle,
  endCall,
  language,
}) => {
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Format call timer (e.g. 01:24)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiStatus]);

  return (
    <section className="calling-panel fade-in">
      <div className="workspace">
        {/* Left Column: Wave & Timer */}
        <div className="call-control-panel card">
          <div className="timer-wrapper">
            <Clock className="icon" />
            <span className="call-timer">{formatTimer(callTimer)}</span>
          </div>

          <div className="ai-agent-avatar">
            <div className={`avatar-ring ring-1 ${aiStatus === 'speaking' ? 'speaking' : ''} ${aiStatus === 'listening' ? 'listening' : ''} ${aiStatus === 'thinking' ? 'thinking' : ''}`}></div>
            <div className={`avatar-ring ring-2 ${aiStatus === 'speaking' ? 'speaking' : ''} ${aiStatus === 'listening' ? 'listening' : ''} ${aiStatus === 'thinking' ? 'thinking' : ''}`}></div>
            <Activity className={`avatar-core brand-icon ${aiStatus === 'speaking' ? 'pulse-fast' : ''}`} />
          </div>

          <div className="ai-status-label">
            {aiStatus === 'idle' && (language === 'hi' ? 'एजिस तैयार है' : 'Aegis is idle')}
            {aiStatus === 'speaking' && (language === 'hi' ? 'एजिस बोल रही है...' : 'Aegis is speaking...')}
            {aiStatus === 'listening' && (language === 'hi' ? 'एजिस सुन रही है...' : 'Aegis is listening...')}
            {aiStatus === 'thinking' && (language === 'hi' ? 'एजिस सोच रही है...' : 'Aegis is formulating reply...')}
          </div>

          {/* CSS Waves */}
          <div className="waveform">
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
            <div className={`bar ${isRecording ? 'recording' : ''}`}></div>
          </div>

          {/* Interactive Mic Button */}
          <div className="ptt-wrapper">
            <button
              className={`ptt-btn ${isRecording ? 'active' : ''} ${aiStatus === 'thinking' || aiStatus === 'speaking' ? 'disabled' : ''}`}
              onClick={handleMicToggle}
              title={isRecording ? 'Click to Stop and Send Turn' : 'Click to Start Speaking'}
              disabled={aiStatus === 'thinking' || aiStatus === 'speaking'}
            >
              <Mic className="ptt-icon" />
            </button>
            <span className="ptt-hint">
              {isRecording 
                ? (language === 'hi' ? 'भेजने के लिए दोबारा माइक दबाएं' : 'Click to Stop and Send Turn') 
                : (language === 'hi' ? 'बोलने के लिए माइक दबाएं' : 'Click Mic Button to Speak')}
            </span>
          </div>

          <button onClick={endCall} className="end-call-btn">
            <PhoneOff className="icon" />
            <span>{language === 'hi' ? 'कॉल समाप्त करें' : 'End Screening Call'}</span>
          </button>
        </div>

        {/* Right Column: Chat Logs & Transcript */}
        <div className="transcript-panel card">
          <div className="panel-header">
            <h2>Conversation Transcript</h2>
            <p>Aegis remembers what you mention. No need to repeat details.</p>
          </div>
          
          <div className="chat-viewport">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-content">
                  <div className="bubble-sender">
                    {msg.role === 'assistant' ? 'Aegis (Assistant)' : 'You (Patient)'}
                  </div>
                  <div className="bubble-text">{msg.text}</div>
                </div>
              </div>
            ))}
            {aiStatus === 'thinking' && (
              <div className="chat-bubble assistant typing">
                <div className="bubble-content">
                  <div className="bubble-sender">Aegis (Assistant)</div>
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {errorMsg && (
            <div className="error-toast animate-shake">
              <AlertCircle className="icon" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
