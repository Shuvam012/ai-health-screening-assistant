import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CallScreen } from './components/CallScreen';
import { ReportScreen } from './components/ReportScreen';
import { AudioRecorder } from './services/audio.service';
import type { Message, CollectedData, HealthReport, ScreenState, AiStatus, WsStatus } from './types';
import './App.css';

const API_BASE = 'http://localhost:3001/api';
const WS_BASE = 'ws://localhost:3001/ws';

function App() {
  const [screen, setScreen] = useState<ScreenState>('welcome');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [callId, setCallId] = useState<string | null>(null);
  
  // Call States
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  
  // Conversation History
  const [messages, setMessages] = useState<Message[]>([]);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [latestTranscript, setLatestTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Final Health Report
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Audio Playback
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const timerRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Call timer hook
  useEffect(() => {
    if (screen === 'calling') {
      timerRef.current = window.setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallTimer(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [screen]);

  // Play base64 audio responses
  const playAudio = async (base64Audio: string, fallbackText?: string) => {
    if (isMuted) return;

    try {
      // Stop currently playing audio if any
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      setAiStatus('speaking');

      // Try WAV first (Sarvam TTS returns WAV), then MP3
      const tryPlay = async (mimeType: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const audioUrl = `data:${mimeType};base64,${base64Audio}`;
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setAiStatus('idle');
            currentAudioRef.current = null;
            resolve(true);
          };

          audio.onerror = () => {
            currentAudioRef.current = null;
            resolve(false);
          };

          audio.play().catch(() => resolve(false));
        });
      };

      // Try WAV (Sarvam), then MP3, then browser fallback
      const played = await tryPlay('audio/wav') || await tryPlay('audio/mp3');

      if (!played && fallbackText && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(fallbackText);
        utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        utterance.onend = () => setAiStatus('idle');
        utterance.onerror = () => setAiStatus('idle');
        window.speechSynthesis.speak(utterance);
      } else if (!played) {
        setAiStatus('idle');
      }
    } catch (err) {
      console.error('Audio playback failed:', err);
      setAiStatus('idle');
    }
  };

  // Initialize call session
  const startCall = async () => {
    setErrorMsg(null);
    setMessages([]);
    setCollectedData({});
    setLatestTranscript('');
    
    try {
      // Step 1: Create call via REST API
      const res = await fetch(`${API_BASE}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create call session');
      }

      const newCallId = data.call.id;
      setCallId(newCallId);
      setScreen('calling');
      setWsStatus('connecting');

      // Step 2: Establish WebSocket Connection
      const ws = new WebSocket(`${WS_BASE}/call/${newCallId}`);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        setAiStatus('idle');
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        setErrorMsg('Connection error occurred. Please try again.');
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setAiStatus('idle');
      };

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start call. Please check if backend is running.');
      console.error(err);
    }
  };

  // Process incoming server messages
  const handleServerMessage = (msg: any) => {
    console.log('[WS] Server message:', msg.type, msg);
    switch (msg.type) {
      case 'ai.greeting':
        setMessages([{ role: 'assistant', text: msg.text, timestamp: new Date() }]);
        if (msg.audio) {
          playAudio(msg.audio, msg.text);
        } else if ('speechSynthesis' in window) {
          setAiStatus('speaking');
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(msg.text);
          utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
          utterance.onend = () => setAiStatus('idle');
          utterance.onerror = () => setAiStatus('idle');
          window.speechSynthesis.speak(utterance);
        }
        break;

      case 'ai.processing':
        setAiStatus('thinking');
        break;

      case 'transcript':
        if (msg.role === 'user') {
          setLatestTranscript(msg.text);
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: msg.text, timestamp: new Date() }
          ]);
        }
        break;

      case 'ai.response':
        setAiStatus('idle');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: msg.text, timestamp: new Date() }
        ]);
        if (msg.audio) {
          playAudio(msg.audio, msg.text);
        } else if ('speechSynthesis' in window) {
          setAiStatus('speaking');
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(msg.text);
          utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
          utterance.onend = () => setAiStatus('idle');
          utterance.onerror = () => setAiStatus('idle');
          window.speechSynthesis.speak(utterance);
        }
        break;

      case 'call.ended':
        socketRef.current?.close();
        if (msg.reportAvailable) {
          fetchReport();
        } else {
          setScreen('welcome');
        }
        break;

      case 'error':
        setAiStatus('idle');
        setErrorMsg(msg.message);
        break;
    }
  };

  // Toggle Mic Recording controls
  const handleMicToggle = async () => {
    if (wsStatus !== 'connected' || aiStatus === 'speaking' || aiStatus === 'thinking') return;

    if (isRecording) {
      setIsRecording(false);
      audioRecorderRef.current.stopRecording();
    } else {
      // Stop current audio or browser speech if playing
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      try {
        setIsRecording(true);
        setAiStatus('listening');
        setErrorMsg(null);

        // Signal audio start to server
        socketRef.current?.send(JSON.stringify({ type: 'audio.start' }));

        // Begin recording
        await audioRecorderRef.current.startRecording((base64Audio, mimeType) => {
          console.log('[Audio] Recording complete, base64 length:', base64Audio.length, 'mimeType:', mimeType);
          // Send audio chunk with mimeType so server knows the format
          socketRef.current?.send(
            JSON.stringify({ type: 'audio.chunk', data: base64Audio, mimeType: mimeType || 'audio/webm' })
          );
          socketRef.current?.send(JSON.stringify({ type: 'audio.end' }));
          console.log('[Audio] Sent audio.chunk + audio.end to server');
        });

      } catch (err) {
        setIsRecording(false);
        setAiStatus('idle');
        setErrorMsg('Failed to access microphone. Please grant mic permissions.');
      }
    }
  };

  // Force Call End
  const endCall = () => {
    if (socketRef.current && wsStatus === 'connected') {
      socketRef.current.send(JSON.stringify({ type: 'call.end' }));
    } else if (callId) {
      // Fallback REST call if websocket already closed
      triggerRestEndCall();
    } else {
      setScreen('welcome');
    }
  };

  const triggerRestEndCall = async () => {
    if (!callId) return;
    try {
      setLoadingReport(true);
      await fetch(`${API_BASE}/calls/${callId}/end`, { method: 'POST' });
      await fetchReport();
    } catch (err) {
      setScreen('welcome');
    }
  };

  // Fetch screening report from REST API
  const fetchReport = async () => {
    if (!callId) return;
    
    setLoadingReport(true);
    setScreen('report');
    
    try {
      // Add slight delay to allow report generator to finish saving report
      await new Promise((resolve) => setTimeout(resolve, 800));

      const res = await fetch(`${API_BASE}/calls/${callId}/report`);
      const data = await res.json();

      if (data.success) {
        setReport(data.report);
      } else {
        throw new Error(data.error || 'Failed to retrieve screening report.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Report could not be retrieved.');
    } finally {
      setLoadingReport(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setAiStatus('idle');
    }
  };

  const restartScreening = () => {
    setScreen('welcome');
    setCallId(null);
    setReport(null);
    setErrorMsg(null);
  };

  return (
    <div className="app-container">
      {/* Premium Glassmorphic Header */}
      <Header 
        screen={screen} 
        wsStatus={wsStatus} 
        isMuted={isMuted} 
        toggleMute={toggleMute} 
      />

      {/* Main Panel */}
      <main className="app-main">
        {screen === 'welcome' && (
          <WelcomeScreen 
            language={language} 
            setLanguage={setLanguage} 
            errorMsg={errorMsg} 
            startCall={startCall} 
          />
        )}

        {screen === 'calling' && (
          <CallScreen 
            aiStatus={aiStatus} 
            isRecording={isRecording} 
            callTimer={callTimer} 
            messages={messages} 
            errorMsg={errorMsg} 
            handleMicToggle={handleMicToggle} 
            endCall={endCall}
            language={language}
          />
        )}

        {screen === 'report' && (
          <ReportScreen 
            loadingReport={loadingReport} 
            report={report} 
            errorMsg={errorMsg} 
            onRestart={restartScreening} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 Aegis Health Screening Assistant. This screening is powered by Cohere and Groq.</p>
      </footer>
    </div>
  );
}

export default App;
