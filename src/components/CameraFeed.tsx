import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';

import type { Landmark } from '../types/handTracking';

export interface CameraFeedRef {
  takeSnapshot: () => Promise<string | null>;
  startRecording: () => void;
  stopRecording: () => void;
  getQuadCoords: () => Landmark[] | null;
  captureBackground: () => Promise<string | null>;
  resetSession: () => void;
  getCanvasElement: () => HTMLCanvasElement | null;
}

export interface CameraFeedProps {
  photoMode?: 'normal' | 'gabungan';
  gabunganStep?: 0 | 1 | 2 | 3;
  savedQuad?: Landmark[] | null;
  onStepChange?: (step: 0 | 1 | 2 | 3) => void;
  showToast?: boolean;
  onToastDismiss?: () => void;
}

export const CameraFeed = forwardRef<CameraFeedRef, CameraFeedProps>(({ 
  photoMode = 'normal', 
  gabunganStep = 0, 
  savedQuad = null,
  onStepChange,
  showToast = false,
  onToastDismiss,
}, ref) => {
  const compositingRef = useRef(false);

  const { 
    videoRef, 
    canvasRef, 
    state, 
    captureBackground, 
    getQuadCoords, 
    resetSession,
    photoData,
  } = useHandTracking({
    disableBlur: photoMode === 'gabungan' && gabunganStep >= 2,
    photoSessionStatus: photoMode === 'gabungan' && gabunganStep === 1 ? 'selecting' : 'idle',
    savedQuad: savedQuad || undefined,
  });

  const { isReady, handCount, error, quadCoords } = state;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Auto-capture frame ketika step 1 dan quad terdeteksi
  useEffect(() => {
    if (photoMode === 'gabungan') {
      if (gabunganStep === 1 && quadCoords && !photoData.backgroundImage) {
        const autoCapture = async () => {
          if (!compositingRef.current) {
            compositingRef.current = true;
            const bg = await captureBackground();
            if (bg) {
              onStepChange?.(2);
            }
            compositingRef.current = false;
          }
        };
        autoCapture();
      }
    }
  }, [gabunganStep, quadCoords, photoData.backgroundImage, captureBackground, onStepChange]);

  useImperativeHandle(ref, () => ({
    getQuadCoords,
    takeSnapshot: async () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png');
      }
      return null;
    },
    startRecording: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, { 
          mimeType: 'video/webm' 
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dcam-recording-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          recordedChunksRef.current = [];
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (error) {
        console.error('MediaRecorder init failed:', error);
      }
    },
    stopRecording: () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    },
    captureBackground,
    resetSession,
    getCanvasElement: () => canvasRef.current,
  }));

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/50 bg-surface-container-lowest premium-shadow w-full max-w-[850px] aspect-[850/600] shrink-0 mx-auto transition-all duration-500 hover:shadow-2xl">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover scale-x-[-1]"
      />

      {/* Overlay untuk menampilkan saved quad */}
      {photoMode === 'gabungan' && gabunganStep >= 2 && savedQuad && (
        <svg 
          viewBox="0 0 1 1" 
          preserveAspectRatio="none" 
          className="absolute inset-0 w-full h-full z-40 pointer-events-none"
        >
          <path 
            fill="rgba(0,0,0,0.5)" 
            fillRule="evenodd" 
            d={`M0,0 H1 V1 H0 Z M${savedQuad[0].x},${savedQuad[0].y} L${savedQuad[1].x},${savedQuad[1].y} L${savedQuad[2].x},${savedQuad[2].y} L${savedQuad[3].x},${savedQuad[3].y} Z`} 
          />
          <path
            fill="none"
            stroke="#00e3fd"
            strokeWidth="0.005"
            strokeDasharray="0.02,0.02"
            d={`M${savedQuad[0].x},${savedQuad[0].y} L${savedQuad[1].x},${savedQuad[1].y} L${savedQuad[2].x},${savedQuad[2].y} L${savedQuad[3].x},${savedQuad[3].y} Z`}
          />
        </svg>
      )}

      {/* Status Overlay */}
      {photoMode === 'gabungan' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-medium flex items-center gap-2">
            {gabunganStep === 0 && <span>🖼️ Siapkan frame dengan tangan</span>}
            {gabunganStep === 1 && <span>✋ Deteksi frame...</span>}
            {gabunganStep === 2 && <span>📷 Ambil foto isi frame</span>}
            {gabunganStep >= 2 && savedQuad && (
              <span className="ml-2 text-emerald-400">✓ Frame terkunci</span>
            )}
          </div>
        </div>
      )}

      {/* Toast notifikasi - no hand detected */}
      {showToast && photoMode === 'gabungan' && gabunganStep === 1 && handCount < 2 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <span className="text-5xl block mb-3">🤲</span>
            <h3 className="text-on-surface font-bold text-lg">Frame Tidak Terdeteksi!</h3>
            <p className="text-on-surface-variant text-sm mt-2">
              Buka kedua tangan dan bentuk persegi / bingkai di depan kamera.
            </p>
            <button 
              onClick={() => {
                onToastDismiss?.();
                resetSession();
              }}
              className="mt-4 px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:shadow-lg transition-all"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <div className="bg-surface p-md rounded-lg max-w-md text-center">
            <span className="material-symbols-outlined text-error text-4xl">error</span>
            <p className="text-on-surface font-semibold mt-sm">Camera Error</p>
            <p className="text-on-surface-variant text-sm mt-xs">{error}</p>
          </div>
        </div>
      )}

      <div className="absolute top-md left-md z-20 flex gap-xs">
        <span className="bg-primary px-sm py-xs text-on-primary rounded-lg flex items-center gap-xs shadow-md">
          <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="font-label-sm text-label-sm">
            {isReady ? 'LIVE' : 'STARTING...'}
          </span>
        </span>
        <span className="bg-surface/80 backdrop-blur-md border border-outline-variant px-sm py-xs text-on-surface rounded-lg font-label-sm text-label-sm">
          {handCount > 0 ? `${handCount} HAND${handCount > 1 ? 'S' : ''}` : 'WAITING'}
        </span>
        {photoMode === 'gabungan' && gabunganStep >= 2 && savedQuad && (
          <span className="bg-emerald-500/80 backdrop-blur-md px-sm py-xs text-white rounded-lg font-label-sm text-label-sm">
            🔒 FRAME LOCKED
          </span>
        )}
      </div>

      <div className="absolute bottom-md left-md z-20">
        <div className="bg-white/70 backdrop-blur-md border border-outline-variant p-sm rounded-lg flex flex-col gap-xs">
          <div className="flex items-center justify-between gap-md">
            <span className="font-label-sm text-label-sm text-secondary">LATENCY</span>
            <span className="font-label-sm text-label-sm">~30ms</span>
          </div>
          <div className="w-32 h-1 bg-surface-variant rounded-full overflow-hidden">
            <div
              className={`h-full bg-secondary transition-all duration-300 ${
                isReady ? 'w-4/5 opacity-100' : 'w-0 opacity-50'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Indikator step progress */}
      {photoMode === 'gabungan' && (
        <div className="absolute bottom-4 right-4 z-20 flex gap-1.5">
          {[0, 1, 2].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                gabunganStep >= step ? 'bg-primary' : 'bg-white/30'
              } ${gabunganStep === step ? 'scale-125' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;