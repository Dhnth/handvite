import { useRef, useState, useEffect } from 'react';
import { 
  Activity, 
  Fingerprint, 
  Monitor, 
  Timer,
  Zap,
  Cpu,
  Eye,
  Hand,
  Settings,
  Download,
  RefreshCw,
  Layers,
  Camera,
} from 'lucide-react';
import CameraFeed from './components/CameraFeed';
import type { CameraFeedRef } from './components/CameraFeed';
import type { Landmark } from './types/handTracking';
import Navbar from './components/Navbar';
import Controls from './components/Controls';

function App() {
  const cameraFeedRef = useRef<CameraFeedRef>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeFeature] = useState('Hand Tracking');

  const [countdownSetting, setCountdownSetting] = useState(() => {
    const saved = localStorage.getItem('dcam-countdown');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [currentCountdown, setCurrentCountdown] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [photoMode, setPhotoMode] = useState<'normal' | 'gabungan'>('normal');
  const [gabunganStep, setGabunganStep] = useState<0 | 1 | 2 | 3>(0);
  const [tempSnapshot, setTempSnapshot] = useState<string | null>(null);
  const [savedQuad, setSavedQuad] = useState<Landmark[] | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    localStorage.setItem('dcam-countdown', countdownSetting.toString());
  }, [countdownSetting]);

  useEffect(() => {
    if (photoMode === 'normal') {
      setGabunganStep(0);
      setTempSnapshot(null);
      setSavedQuad(null);
      setPreviewImage(null);
      setShowToast(false);
      cameraFeedRef.current?.resetSession();
    }
  }, [photoMode]);

  const compositeTwibbon = async (img1Src: string, img2Src: string, quad: Landmark[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img1 = new Image(); // Foto 1 - Background dengan frame tangan (SUDAH MIRROR)
      const img2 = new Image(); // Foto 2 - Isi di area frame (SUDAH MIRROR)
      let loaded = 0;
      
      const onImageLoad = () => {
        loaded++;
        if (loaded === 2) {
          try {
            const canvas = document.createElement('canvas');
            const width = img1.width;
            const height = img1.height;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Canvas context not available'));
              return;
            }

            // 1. Gambar Foto 1 (Background dengan frame tangan) - SUDAH MIRROR
            ctx.drawImage(img1, 0, 0, width, height);

            // 2. Hitung koordinat quad (dari canvas yang mirror)
            const topLeft = { x: quad[0].x, y: quad[0].y };
            const topRight = { x: quad[1].x, y: quad[1].y };
            const bottomRight = { x: quad[2].x, y: quad[2].y };
            const bottomLeft = { x: quad[3].x, y: quad[3].y };

            // 3. Clip area persegi
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(topLeft.x * width, topLeft.y * height);
            ctx.lineTo(topRight.x * width, topRight.y * height);
            ctx.lineTo(bottomRight.x * width, bottomRight.y * height);
            ctx.lineTo(bottomLeft.x * width, bottomLeft.y * height);
            ctx.closePath();
            ctx.clip();

            // 4. Gambar Foto 2 di dalam area persegi
            // Foto 2 sudah mirror dari canvas, jadi kita gambar NORMAL
            ctx.drawImage(img2, 0, 0, width, height);
            
            ctx.restore();

            // 5. Gambar border frame (GLOW EFFECT)
            ctx.save();
            ctx.shadowColor = 'rgba(0, 227, 253, 0.8)';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.moveTo(topLeft.x * width, topLeft.y * height);
            ctx.lineTo(topRight.x * width, topRight.y * height);
            ctx.lineTo(bottomRight.x * width, bottomRight.y * height);
            ctx.lineTo(bottomLeft.x * width, bottomLeft.y * height);
            ctx.closePath();
            ctx.strokeStyle = '#00e3fd';
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();

            // Border kedua (tipis) untuk efek neon
            ctx.beginPath();
            ctx.moveTo(topLeft.x * width, topLeft.y * height);
            ctx.lineTo(topRight.x * width, topRight.y * height);
            ctx.lineTo(bottomRight.x * width, bottomRight.y * height);
            ctx.lineTo(bottomLeft.x * width, bottomLeft.y * height);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            reject(error);
          }
        }
      };
      
      img1.onload = onImageLoad;
      img1.onerror = () => reject(new Error('Failed to load background image'));
      img2.onload = onImageLoad;
      img2.onerror = () => reject(new Error('Failed to load content image'));
      
      img1.src = img1Src;
      img2.src = img2Src;
    });
  };

  const handleGabunganStepChange = (step: 0 | 1 | 2 | 3) => {
    setGabunganStep(step);
  };

  const handleSnapshot = async () => {
    if (!cameraFeedRef.current) return;

    const runCountdown = async () => {
      if (countdownSetting > 0) {
        let count = countdownSetting;
        setCurrentCountdown(count);
        await new Promise<void>((resolve) => {
          const timerId = setInterval(() => {
            count -= 1;
            if (count > 0) {
              setCurrentCountdown(count);
            } else {
              clearInterval(timerId);
              setCurrentCountdown(null);
              resolve();
            }
          }, 1000);
        });
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
    };

    if (photoMode === 'gabungan') {
      if (gabunganStep === 0) {
        // STEP 1: Mulai deteksi area frame
        setGabunganStep(1);
        setShowToast(false);
        
        // Tunggu sebentar untuk deteksi tangan
        await new Promise(r => setTimeout(r, 1000));
        const quad = cameraFeedRef.current?.getQuadCoords();
        if (!quad || quad.length < 4) {
          setShowToast(true);
          setGabunganStep(0);
          return;
        }
      } else if (gabunganStep === 1) {
        // STEP 2: Ambil foto pertama (Background dengan frame)
        await runCountdown();
        
        // Cek quad setelah countdown
        const quad = cameraFeedRef.current?.getQuadCoords();
        if (!quad || quad.length < 4) {
          setShowToast(true);
          setGabunganStep(0);
          return;
        }
        
        const dataUrl = await cameraFeedRef.current?.takeSnapshot();
        if (dataUrl) {
          setTempSnapshot(dataUrl);
          setSavedQuad(quad);
          setGabunganStep(2);
          setShowToast(false);
        } else {
          setShowToast(true);
          setGabunganStep(0);
        }
      } else if (gabunganStep === 2) {
        // STEP 3: Ambil foto kedua (isi di area frame)
        await runCountdown();
        
        const dataUrl = await cameraFeedRef.current?.takeSnapshot();
        if (dataUrl && tempSnapshot && savedQuad) {
          // Composite twibbon
          const finalImage = await compositeTwibbon(tempSnapshot, dataUrl, savedQuad);
          setPreviewImage(finalImage);
        }
        setGabunganStep(0);
        setTempSnapshot(null);
        setSavedQuad(null);
      }
    } else {
      // Mode normal
      if (countdownSetting > 0) {
        let count = countdownSetting;
        setCurrentCountdown(count);
        
        const timerId = setInterval(async () => {
          count -= 1;
          if (count > 0) {
            setCurrentCountdown(count);
          } else {
            clearInterval(timerId);
            setCurrentCountdown(null);
            const dataUrl = await cameraFeedRef.current?.takeSnapshot() || null;
            setPreviewImage(dataUrl);
          }
        }, 1000);
      } else {
        const dataUrl = await cameraFeedRef.current?.takeSnapshot();
        setPreviewImage(dataUrl);
      }
    }
  };

  const handleDownload = () => {
    if (previewImage) {
      const a = document.createElement('a');
      a.href = previewImage;
      a.download = `dcam-twibbon-${Date.now()}.png`;
      a.click();
      setPreviewImage(null);
    }
  };

  const handleToggleRecord = () => {
    if (!cameraFeedRef.current) return;

    if (isRecording) {
      cameraFeedRef.current.stopRecording();
      setIsRecording(false);
    } else {
      cameraFeedRef.current.startRecording();
      setIsRecording(true);
    }
  };

  const handleRetake = () => {
    setPreviewImage(null);
    if (photoMode === 'gabungan') {
      setGabunganStep(0);
      setTempSnapshot(null);
      setSavedQuad(null);
      setShowToast(false);
      cameraFeedRef.current?.resetSession();
    }
  };

  const handleToastDismiss = () => {
    setShowToast(false);
    setGabunganStep(0);
    cameraFeedRef.current?.resetSession();
  };

  const getSnapshotLabel = () => {
    if (photoMode === 'gabungan') {
      if (gabunganStep === 0) return '🎯 Buat Frame';
      if (gabunganStep === 1) return '📸 Ambil Frame';
      if (gabunganStep === 2) return '📷 Isi Frame';
    }
    return '📷 Snapshot';
  };

  const isSnapshotDisabled = () => {
    if (photoMode === 'gabungan') {
      return gabunganStep === 3;
    }
    return false;
  };

  const getStepDescription = () => {
    if (photoMode === 'gabungan') {
      if (gabunganStep === 0) return 'Siapkan frame dengan kedua tangan';
      if (gabunganStep === 1) return '📐 Tahan posisi frame!';
      if (gabunganStep === 2) return '📸 Ambil foto untuk diisi di frame';
    }
    return '';
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md overflow-x-hidden">
      {/* Mobile Fallback */}
      <div className="flex md:hidden min-h-screen flex-col items-center justify-center p-xl text-center bg-surface-container-low">
        <Monitor className="w-16 h-16 text-primary mb-4 animate-bounce" />
        <h1 className="font-headline-md text-4xl font-bold mb-2 text-on-surface">Desktop Only</h1>
        <p className="text-on-surface-variant text-lg max-w-sm">DCam's premium tracking experience requires a larger screen. Please open this application on your computer.</p>
      </div>

      {/* Desktop App */}
      <div className="hidden md:flex flex-col min-h-screen">
        <Navbar />
        
        <main className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full items-stretch">
          {/* Left Sidebar - Stats & Info */}
          <aside className="w-[260px] flex-shrink-0 flex flex-col gap-4">
            <div className="glass-panel-strong rounded-2xl p-5 flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm text-on-surface tracking-wide">System Status</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/40 rounded-xl px-4 py-3 border border-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-medium text-on-surface">Camera</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">ACTIVE</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/40 rounded-xl px-3 py-3 border border-white/40 text-center">
                    <Hand className="w-4 h-4 text-primary mx-auto mb-1.5" />
                    <span className="text-xs font-medium text-on-surface-variant block">Hands</span>
                    <span className="text-sm font-bold text-on-surface">2</span>
                  </div>
                  <div className="bg-white/40 rounded-xl px-3 py-3 border border-white/40 text-center">
                    <Eye className="w-4 h-4 text-primary mx-auto mb-1.5" />
                    <span className="text-xs font-medium text-on-surface-variant block">Nodes</span>
                    <span className="text-sm font-bold text-on-surface">21</span>
                  </div>
                </div>

                <div className="space-y-2 bg-white/30 rounded-xl p-3 border border-white/30">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-medium">Latency</span>
                    <span className="text-on-surface font-semibold font-mono">12ms</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-medium">FPS</span>
                    <span className="text-on-surface font-semibold font-mono">30</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-medium">Resolution</span>
                    <span className="text-on-surface font-semibold font-mono">850×600</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel-strong rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="font-medium">GPU Acceleration</span>
                <span className="ml-auto text-emerald-600 font-semibold">ON</span>
              </div>
            </div>
          </aside>

          {/* Main Camera Feed */}
          <div className="flex-1 min-w-0 relative">
            <CameraFeed 
              ref={cameraFeedRef} 
              photoMode={photoMode} 
              gabunganStep={gabunganStep} 
              savedQuad={savedQuad}
              onStepChange={handleGabunganStepChange}
              showToast={showToast}
              onToastDismiss={handleToastDismiss}
            />
            {currentCountdown !== null && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-2xl backdrop-blur-[2px]">
                <span className="text-9xl font-bold text-white drop-shadow-lg animate-pulse">
                  {currentCountdown}
                </span>
              </div>
            )}

            {/* Step Description */}
            {photoMode === 'gabungan' && gabunganStep > 0 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm font-medium">
                  {getStepDescription()}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Feature Panel */}
          <aside className="w-[260px] flex-shrink-0 flex flex-col gap-4">
            <div className="glass-panel-strong rounded-2xl p-5 flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm text-on-surface tracking-wide">Feature</h3>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <select 
                    value={activeFeature}
                    className="w-full bg-white/60 backdrop-blur-sm border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer transition-all hover:bg-white/80 text-sm"
                  >
                    <option value="Hand Tracking">Hand Tracking</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-sm font-bold text-on-surface">Hand Tracking Ready</p>
                  <p className="text-xs text-on-surface-variant mt-1">Detecting up to 2 hands in real-time</p>
                </div>

                <div className="space-y-2 bg-white/30 rounded-xl p-3 border border-white/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant font-medium">Confidence</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">98.4%</span>
                      <div className="w-16 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                        <div className="w-[98%] h-full bg-primary rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant font-medium">Tracking</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Active</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel-strong rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm text-on-surface tracking-wide">Settings</h3>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface-variant">Countdown</span>
                <select 
                  value={countdownSetting}
                  onChange={(e) => setCountdownSetting(parseInt(e.target.value, 10))}
                  className="bg-white/60 backdrop-blur-sm border border-outline-variant/50 rounded-lg px-2 py-1 text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm cursor-pointer"
                >
                  <option value={0}>Off</option>
                  <option value={3}>3s</option>
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface-variant">Mode</span>
                <div className="flex gap-1.5 bg-white/50 rounded-lg p-1 border border-outline-variant/30">
                  <button
                    onClick={() => setPhotoMode('normal')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      photoMode === 'normal' 
                        ? 'bg-primary text-on-primary shadow-md' 
                        : 'text-on-surface-variant hover:bg-white/50'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setPhotoMode('gabungan')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                      photoMode === 'gabungan' 
                        ? 'bg-primary text-on-primary shadow-md' 
                        : 'text-on-surface-variant hover:bg-white/50'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Twibbon
                  </button>
                </div>
              </div>

              {photoMode === 'gabungan' && gabunganStep > 0 && (
                <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant font-medium">Step</span>
                    <span className="text-primary font-bold">{gabunganStep}/2</span>
                  </div>
                  <div className="w-full bg-surface-variant rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${(gabunganStep / 2) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {gabunganStep === 1 && '📐 Buat frame dengan tangan'}
                    {gabunganStep === 2 && '📷 Ambil foto isi frame'}
                  </p>
                </div>
              )}
            </div>

            <div className="glass-panel-strong rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <Timer className="w-4 h-4 text-primary" />
                <span className="font-medium">Session Time</span>
                <span className="ml-auto font-mono font-semibold text-on-surface">00:12:47</span>
              </div>
            </div>
          </aside>
        </main>

        <Controls 
          onSnapshot={handleSnapshot}
          onToggleRecord={handleToggleRecord}
          isRecording={isRecording}
          snapshotLabel={getSnapshotLabel()}
          snapshotDisabled={isSnapshotDisabled()}
        />

        {/* Preview Modal - Hasil Twibbon MIRROR */}
        {previewImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
            <div className="bg-surface-container-low rounded-3xl premium-shadow overflow-hidden max-w-4xl w-full flex flex-col">
              <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface/50">
                <h2 className="font-headline-sm text-xl font-bold text-on-surface flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  ✨ Twibbon Frame
                </h2>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-on-surface/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface-variant">close</span>
                </button>
              </div>
              
              <div className="relative aspect-[850/600] w-full bg-black/50">
                <img 
                  src={previewImage} 
                  alt="Twibbon Preview" 
                  className="w-full h-full object-contain scale-x-[-1]" // MIRROR
                />
              </div>
              
              <div className="p-6 flex items-center justify-end gap-4 bg-surface/50">
                <button 
                  onClick={handleRetake}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-outline-variant hover:bg-on-surface/5 text-on-surface font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retake</span>
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-medium hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;