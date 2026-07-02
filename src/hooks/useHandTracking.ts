import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import type { Landmark, HandTrackingState, PhotoSessionState, PhotoSessionData } from '../types/handTracking';

const MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

interface UseHandTrackingConfig {
  disableBlur?: boolean;
  photoSessionStatus?: PhotoSessionState;
  savedQuad?: Landmark[] | null;
}

interface UseHandTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  state: HandTrackingState;
  captureBackground: () => Promise<string | null>;
  getQuadCoords: () => Landmark[] | null;
  startSecondCamera: () => Promise<MediaStream | null>;
  compositePhotos: (backgroundSrc: string, quad: Landmark[], videoElement: HTMLVideoElement) => Promise<string>;
  resetSession: () => void;
  photoData: PhotoSessionData;
}

export const useHandTracking = (config?: UseHandTrackingConfig): UseHandTrackingReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const configRef = useRef(config);
  const secondVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondStreamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<HandTrackingState>({
    isReady: false,
    landmarks: [],
    handCount: 0,
    error: null,
    quadCoords: null,
  });

  const [photoData, setPhotoData] = useState<PhotoSessionData>({
    status: 'idle',
    backgroundImage: null,
    quadCoords: null,
    compositeResult: null,
  });

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const getQuadCoords = useCallback((): Landmark[] | null => {
    return state.quadCoords;
  }, [state.quadCoords]);

  const captureBackground = useCallback(async (): Promise<string | null> => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      if (dataUrl) {
        setPhotoData(prev => ({
          ...prev,
          backgroundImage: dataUrl,
          status: 'captured',
        }));
        return dataUrl;
      }
    }
    return null;
  }, []);

  const startSecondCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
      }

      if (stream) {
        secondStreamRef.current = stream;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.autoplay = true;
        video.muted = true;
        await video.play();
        secondVideoRef.current = video;
        return stream;
      }
      return null;
    } catch (error) {
      console.error('Error starting second camera:', error);
      return null;
    }
  }, []);

  const compositePhotos = useCallback((backgroundSrc: string, quad: Landmark[], videoElement: HTMLVideoElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = img.width;
          const height = img.height;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Gambar background (NORMAL, tanpa flip)
          ctx.drawImage(img, 0, 0, width, height);

          // Koordinat quad
          const topLeft = { x: quad[0].x, y: quad[0].y };
          const topRight = { x: quad[1].x, y: quad[1].y };
          const bottomRight = { x: quad[2].x, y: quad[2].y };
          const bottomLeft = { x: quad[3].x, y: quad[3].y };

          // Buat clipping path
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(topLeft.x * width, topLeft.y * height);
          ctx.lineTo(topRight.x * width, topRight.y * height);
          ctx.lineTo(bottomRight.x * width, bottomRight.y * height);
          ctx.lineTo(bottomLeft.x * width, bottomLeft.y * height);
          ctx.closePath();
          ctx.clip();

          // Gambar video dari kamera kedua (NORMAL)
          ctx.drawImage(videoElement, 0, 0, width, height);
          
          ctx.restore();

          // Gambar border
          ctx.beginPath();
          ctx.moveTo(topLeft.x * width, topLeft.y * height);
          ctx.lineTo(topRight.x * width, topRight.y * height);
          ctx.lineTo(bottomRight.x * width, bottomRight.y * height);
          ctx.lineTo(bottomLeft.x * width, bottomLeft.y * height);
          ctx.closePath();
          ctx.strokeStyle = '#00e3fd';
          ctx.lineWidth = 4;
          ctx.stroke();

          const result = canvas.toDataURL('image/png');
          setPhotoData(prev => ({
            ...prev,
            compositeResult: result,
            status: 'compositing',
          }));
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load background image'));
      };

      img.src = backgroundSrc;
    });
  }, []);

  const resetSession = useCallback(() => {
    setPhotoData({
      status: 'idle',
      backgroundImage: null,
      quadCoords: null,
      compositeResult: null,
    });
    if (secondStreamRef.current) {
      secondStreamRef.current.getTracks().forEach(track => track.stop());
      secondStreamRef.current = null;
    }
    if (secondVideoRef.current) {
      secondVideoRef.current.srcObject = null;
      secondVideoRef.current = null;
    }
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !canvas || !handLandmarker) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    try {
      const detections = handLandmarker.detectForVideo(video, performance.now());
      
      // Clear dan gambar video (NORMAL, tanpa flip)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const landmarks: Landmark[][] = [];
      let currentQuad: Landmark[] | null = null;

      if (detections.landmarks && detections.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        
        for (const handLandmarks of detections.landmarks) {
          const convertedLandmarks: Landmark[] = handLandmarks.map((lm: { x: number; y: number; z: number }) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
          }));
          landmarks.push(convertedLandmarks);
        }

        if (landmarks.length === 2) {
          const hand1Thumb = landmarks[0][4];
          const hand1Index = landmarks[0][8];
          const hand2Thumb = landmarks[1][4];
          const hand2Index = landmarks[1][8];

          if (hand1Thumb && hand1Index && hand2Thumb && hand2Index) {
            currentQuad = [hand1Thumb, hand1Index, hand2Index, hand2Thumb];
            
            if (!configRef.current?.disableBlur) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(hand1Thumb.x * canvas.width, hand1Thumb.y * canvas.height);
              ctx.lineTo(hand1Index.x * canvas.width, hand1Index.y * canvas.height);
              ctx.lineTo(hand2Index.x * canvas.width, hand2Index.y * canvas.height);
              ctx.lineTo(hand2Thumb.x * canvas.width, hand2Thumb.y * canvas.height);
              ctx.closePath();
              
              ctx.clip();
              ctx.filter = 'blur(12px)';
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }

            // Gambar border
            ctx.beginPath();
            ctx.moveTo(hand1Thumb.x * canvas.width, hand1Thumb.y * canvas.height);
            ctx.lineTo(hand1Index.x * canvas.width, hand1Index.y * canvas.height);
            ctx.lineTo(hand2Index.x * canvas.width, hand2Index.y * canvas.height);
            ctx.lineTo(hand2Thumb.x * canvas.width, hand2Thumb.y * canvas.height);
            ctx.closePath();
            ctx.strokeStyle = '#00e3fd';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(0, 227, 253, 0.08)';
            ctx.fill();

            if (configRef.current?.photoSessionStatus === 'selecting') {
              ctx.fillStyle = 'rgba(0, 227, 253, 0.2)';
              ctx.fill();
              
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 24px system-ui';
              ctx.textAlign = 'center';
              ctx.fillText('📸 Tahan posisi!', canvas.width / 2, 40);
              ctx.font = '16px system-ui';
              ctx.fillStyle = 'rgba(255,255,255,0.8)';
              ctx.fillText('Area yang dibentuk tangan akan menjadi bingkai', canvas.width / 2, 70);
            }
          }
        }

        // Draw landmarks dan connections
        for (const handLandmarks of detections.landmarks) {
          drawingUtils.drawConnectors(
            handLandmarks,
            HandLandmarker.HAND_CONNECTIONS,
            { color: '#00e3fd', lineWidth: 2 }
          );
          drawingUtils.drawLandmarks(
            handLandmarks,
            { color: '#00e3fd', lineWidth: 1, radius: 3 }
          );
        }

        setState((prev) => ({
          ...prev,
          landmarks,
          handCount: landmarks.length,
          quadCoords: currentQuad,
        }));

        if (currentQuad && configRef.current?.photoSessionStatus === 'selecting') {
          setPhotoData(prev => ({
            ...prev,
            quadCoords: currentQuad,
          }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          landmarks: [],
          handCount: 0,
          quadCoords: null,
        }));
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  useEffect(() => {
    const initHandTracking = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        handLandmarkerRef.current = handLandmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 850 },
            height: { ideal: 600 },
            facingMode: 'user',
          },
        });

        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element not found');
        }

        video.srcObject = stream;
        await video.play();

        setState((prev) => ({
          ...prev,
          isReady: true,
          error: null,
        }));

        processFrame();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setState((prev) => ({
          ...prev,
          isReady: false,
          error: errorMessage,
        }));
        console.error('Error initializing hand tracking:', error);
      }
    };

    initHandTracking();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (secondStreamRef.current) {
        secondStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [processFrame]);

  return {
    videoRef,
    canvasRef,
    state,
    captureBackground,
    getQuadCoords,
    startSecondCamera,
    compositePhotos,
    resetSession,
    photoData,
  };
};