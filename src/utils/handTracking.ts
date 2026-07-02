export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  landmarks: Landmark[];
}

export interface HandDetectionResult {
  landmarks: Landmark[][];
  handedness: Array<{ index: number; score: number }>;
}

export interface HandTrackingState {
  isReady: boolean;
  landmarks: Landmark[][];
  handCount: number;
  error: string | null;
  quadCoords: Landmark[] | null;
}

// Tambahan untuk photo session
export type PhotoSessionState = 'idle' | 'selecting' | 'captured' | 'compositing';

export interface PhotoSessionData {
  status: PhotoSessionState;
  backgroundImage: string | null;
  quadCoords: Landmark[] | null;
  compositeResult: string | null;
}