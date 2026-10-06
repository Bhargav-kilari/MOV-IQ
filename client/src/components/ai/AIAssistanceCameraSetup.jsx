import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Maximize2,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import aiService from '../../services/aiService';

export const AIAssistanceCameraSetup = ({ exercise, onBack, onStartAnalysis }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraStatus, setCameraStatus] = useState('checking'); // 'checking' | 'connected' | 'denied' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [aiServerStatus, setAiServerStatus] = useState('checking');

  useEffect(() => {
    checkAiServer();
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const checkAiServer = async () => {
    try {
      const res = await aiService.getHealth();
      if (res.online && res.model_loaded) {
        setAiServerStatus('online');
      } else {
        setAiServerStatus('degraded');
      }
    } catch {
      setAiServerStatus('offline');
    }
  };

  const startCamera = async () => {
    setCameraStatus('checking');
    setErrorMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('error');
        setErrorMessage('Camera access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraStatus('connected');
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setErrorMessage(
          'Camera access is required for AI Assistance. Please allow camera permissions in your browser address bar.'
        );
      } else {
        setCameraStatus('error');
        setErrorMessage('No camera detected or camera is currently in use by another application.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleStart = () => {
    stopCamera();
    onStartAnalysis();
  };

  const dbEx = exercise.dbExercise || {};
  const instructions = Array.isArray(dbEx.instructions)
    ? dbEx.instructions
    : typeof dbEx.instructions === 'string'
    ? dbEx.instructions.split('\n').filter(Boolean)
    : [
        'Position your full body in the camera frame.',
        'Perform each repetition with controlled eccentric and concentric movement.',
        'Observe the real-time angle gauges and posture feedback alerts.',
      ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#4B5563] hover:text-[#111111] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Exercise</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">AI Service:</span>
          {aiServerStatus === 'online' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Degraded
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Camera Preview & Status */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video bg-[#111111] rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm flex items-center justify-center">
            {cameraStatus === 'connected' && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            {cameraStatus === 'checking' && (
              <div className="text-center text-white/80 p-6">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-bold uppercase tracking-wider">Connecting Camera...</p>
              </div>
            )}

            {(cameraStatus === 'denied' || cameraStatus === 'error') && (
              <div className="p-8 text-center max-w-sm text-white">
                <VideoOff className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                <h4 className="text-sm font-bold uppercase tracking-wider mb-1">Camera Unavailable</h4>
                <p className="text-xs text-gray-300 mb-4">{errorMessage}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-white text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-100 transition inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              </div>
            )}

            {/* Camera Overlay Status Badge */}
            {cameraStatus === 'connected' && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-lg text-white text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Camera Connected</span>
              </div>
            )}
          </div>

          {/* Positioning Guidance Checklist */}
          <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Optimal Camera Guidance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#4B5563]">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-[#111111]" />
                <span>Full body visible head-to-toe</span>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-[#111111]" />
                <span>Adequate front lighting</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-[#111111]" />
                <span>Stable surface 6–8 ft away</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Side/diagonal angle recommended</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Exercise Summary & Instructions */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Title & Metadata */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Target Exercise
                </span>
                <span className="text-xs text-[#6B7280] capitalize">
                  {dbEx.difficulty || 'All Levels'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">
                {exercise.displayName}
              </h2>
              <p className="text-xs text-[#6B7280] capitalize mt-0.5">
                {dbEx.body_part || 'Full Body'} • {dbEx.equipment || 'Equipment'} • {dbEx.target_muscle || 'Primary Muscle'}
              </p>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                Technique Instructions
              </h4>
              <ol className="space-y-2 text-xs text-[#4B5563] list-decimal list-inside leading-relaxed">
                {instructions.slice(0, 4).map((step, idx) => (
                  <li key={idx} className="pl-1">
                    <span>{step.replace(/^\d+[\.\)]\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2">
            <button
              onClick={handleStart}
              disabled={cameraStatus !== 'connected'}
              className="w-full py-3.5 px-4 bg-[#111111] hover:bg-[#000000] disabled:bg-[#9CA3AF] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-white stroke-none" />
              <span>Start AI Analysis</span>
            </button>
            <p className="text-[11px] text-center text-[#9CA3AF] mt-2">
              Privacy note: Video frames are processed locally for pose extraction. Raw video is never saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistanceCameraSetup;
