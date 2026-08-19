import React from 'react';
import { Activity, Volume2, VolumeX } from 'lucide-react';
import type { ScreenState, WsStatus } from '../types';

interface HeaderProps {
  screen: ScreenState;
  wsStatus: WsStatus;
  isMuted: boolean;
  toggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  screen,
  wsStatus,
  isMuted,
  toggleMute,
}) => {
  return (
    <header className="app-header">
      <div className="brand">
        <Activity className="brand-icon pulse-fast" />
        <span className="brand-name">Aegis AI</span>
        <span className="brand-tagline">| Health Intake Screening</span>
      </div>
      <div className="header-actions">
        {screen === 'calling' && (
          <button 
            onClick={toggleMute} 
            className="action-btn mute-btn" 
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="icon" /> : <Volume2 className="icon" />}
          </button>
        )}
        <span className={`status-badge ${wsStatus}`}>
          {wsStatus === 'connecting' && 'Connecting...'}
          {wsStatus === 'connected' && 'Call Active'}
          {wsStatus === 'disconnected' && 'Disconnected'}
        </span>
      </div>
    </header>
  );
};
