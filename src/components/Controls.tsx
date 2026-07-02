import React from 'react';

interface ControlsProps {
  onSnapshot: () => void;
  onToggleRecord: () => void;
  isRecording: boolean;
  snapshotLabel?: string;
  snapshotDisabled?: boolean;
}

export const Controls: React.FC<ControlsProps> = ({ 
  onSnapshot, 
  onToggleRecord, 
  isRecording, 
  snapshotLabel = '📷 Snapshot',
  snapshotDisabled = false,
}) => {
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-panel-strong p-2 rounded-full flex items-center gap-2 premium-shadow">
        <button 
          onClick={onSnapshot}
          disabled={snapshotDisabled}
          className={`flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-surface-tint text-on-primary font-body-md font-semibold transition-all ${
            snapshotDisabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
          }`}
        >
          <span className="material-symbols-outlined">camera</span>
          <span>{snapshotLabel}</span>
        </button>
        
        <button 
          onClick={onToggleRecord}
          className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 font-body-md font-semibold hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all ${
            isRecording 
              ? 'bg-red-50 text-red-600 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
              : 'bg-white/50 text-on-surface border-white/60 hover:bg-white/80'
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse mr-1 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span>
              <span>Stop Record</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">videocam</span>
              <span>Record</span>
            </>
          )}
        </button>
        
        <div className="w-[1px] h-8 bg-outline-variant/50 mx-2"></div>
      </div>
    </div>
  );
};

export default Controls;