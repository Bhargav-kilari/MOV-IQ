import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Pause,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Zap,
  Activity,
  Maximize,
  Volume2,
  VolumeX,
} from 'lucide-react';
import aiService from '../../services/aiService';
import { getKinematicsConfig, calculateJointAngle } from '../../utils/aiKinematics';

// BlazePose 33 Connections
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [12, 24], [24, 23], [23, 11],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27],
  // Right leg
  [24, 26], [26, 28],
];

export const AIAssistanceLiveSession = ({ exercise, onEndSession, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);
  const animationFrameId = useRef(null);

  // Session State
  const [isPaused, setIsPaused] = useState(false);
  const [totalReps, setTotalReps] = useState(0);
  const [correctReps, setCorrectReps] = useState(0);
  const [incorrectReps, setIncorrectReps] = useState(0);
  const [formScore, setFormScore] = useState(100);
  const [activeFeedback, setActiveFeedback] = useState('Position yourself in camera view');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info' | 'good' | 'warning'
  const [repHistory, setRepHistory] = useState([]);
  const [detectedExercise, setDetectedExercise] = useState(null);
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [currentJointAngle, setCurrentJointAngle] = useState(180);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(0);
  const [modelLatency, setModelLatency] = useState(0);
  const [exerciseMismatch, setExerciseMismatch] = useState(null);

  // References for live inference loop without stale closures
  const frameBufferRef = useRef([]); // holds landmark frames [T, 33, 3]
  const repStateRef = useRef({
    phase: 'UP', // 'UP', 'DOWN', 'INFLECTION'
    minAngle: 180,
    maxAngle: 0,
    repFrames: [],
    lastRepTimestamp: 0,
  });
  const sessionStatsRef = useRef({
    totalReps: 0,
    correctReps: 0,
    incorrectReps: 0,
    detectedIssues: {},
    angles: [],
    startTime: Date.now(),
  });

  const kinematics = getKinematicsConfig(exercise.modelKey);

  // Play subtle feedback chime
  const playBeep = useCallback((isSuccess = true) => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 587.33 : 261.63, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // AudioContext policy
    }
  }, [audioEnabled]);

  // Main lifecycle: initialize camera and MediaPipe
  useEffect(() => {
    let active = true;

    async function initPipeline() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!active) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize MediaPipe Pose if available in window
        if (window.Pose) {
          const pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
          });

          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          pose.onResults(handlePoseResults);
          poseRef.current = pose;

          // Camera utility loop
          if (window.Camera && videoRef.current) {
            const cam = new window.Camera(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && poseRef.current && !isPaused) {
                  await poseRef.current.send({ image: videoRef.current });
                }
              },
              width: 1280,
              height: 720,
            });
            cam.start();
            cameraRef.current = cam;
          }
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        setActiveFeedback('Camera access error. Please check permissions.');
        setFeedbackType('warning');
      }
    }

    initPipeline();

    // Frame counter
    let lastTime = performance.now();
    let frameCount = 0;
    const fpsInterval = setInterval(() => {
      const now = performance.now();
      const currentFps = Math.round((frameCount * 1000) / (now - lastTime));
      setFps(currentFps);
      frameCount = 0;
      lastTime = now;
    }, 1000);

    return () => {
      active = false;
      clearInterval(fpsInterval);
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (poseRef.current) {
        poseRef.current.close();
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPaused]);

  // Handle MediaPipe pose landmarks on every frame
  const handlePoseResults = (results) => {
    if (isPaused) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
      setActiveFeedback('No person detected. Move into camera frame.');
      setFeedbackType('info');
      return;
    }

    const landmarks = results.poseLandmarks;

    // 1. Draw Skeleton Overlay
    drawSkeleton(ctx, landmarks, canvas.width, canvas.height);

    // 2. Format 33 landmarks for AI Model [33, 3]
    const frameLandmarks = landmarks.map((lm) => [lm.x, lm.y, lm.z || 0]);

    // Keep sliding buffer of last 60 frames (~2 seconds)
    frameBufferRef.current.push(frameLandmarks);
    if (frameBufferRef.current.length > 70) {
      frameBufferRef.current.shift();
    }

    // 3. Extract Kinematic Primary Joint Angle
    const angle = kinematics.getAngle(landmarks);
    setCurrentJointAngle(angle);

    // 4. Rep Counting State Machine
    processRepStateMachine(angle, landmarks, frameLandmarks);
  };

  // Deterministic Rep Counting & Phase Tracking
  const processRepStateMachine = (angle, landmarks, currentFrame) => {
    const state = repStateRef.current;
    const now = Date.now();
    state.repFrames.push(currentFrame);

    if (angle < state.minAngle) state.minAngle = angle;
    if (angle > state.maxAngle) state.maxAngle = angle;

    // Exercise specific state transition
    const startThresh = kinematics.startThreshold;
    const inflectionThresh = kinematics.inflectionThreshold;
    const completionThresh = kinematics.completionThreshold;

    const isDownward = startThresh > inflectionThresh; // e.g. Squat (160 -> 90 -> 160)

    if (isDownward) {
      // Phase: Descending towards inflection point
      if (state.phase === 'UP' && angle <= startThresh - 10) {
        state.phase = 'DESCENT';
        setActiveFeedback('Control movement through descent');
        setFeedbackType('info');
      } else if (state.phase === 'DESCENT' && angle <= inflectionThresh + 10) {
        state.phase = 'INFLECTION';
        setActiveFeedback('Good depth reached — drive up');
        setFeedbackType('good');
      } else if (state.phase === 'INFLECTION' && angle >= completionThresh - 5) {
        // Cooldown check: at least 700ms between reps to prevent bouncing/double count
        if (now - state.lastRepTimestamp > 700) {
          completeRep(state, landmarks);
          state.lastRepTimestamp = now;
        }
        state.phase = 'UP';
        state.minAngle = 180;
        state.maxAngle = 0;
        state.repFrames = [];
      }
    } else {
      // Inverted kinematics (e.g. Overhead press / Lateral raise: ascending to lockout)
      if (state.phase === 'UP' && angle >= startThresh + 10) {
        state.phase = 'ASCENT';
      } else if (state.phase === 'ASCENT' && angle >= inflectionThresh - 10) {
        state.phase = 'INFLECTION';
        setActiveFeedback('Full contraction reached');
        setFeedbackType('good');
      } else if (state.phase === 'INFLECTION' && angle <= completionThresh + 5) {
        if (now - state.lastRepTimestamp > 700) {
          completeRep(state, landmarks);
          state.lastRepTimestamp = now;
        }
        state.phase = 'UP';
        state.minAngle = 180;
        state.maxAngle = 0;
        state.repFrames = [];
      }
    }
  };

  // Called when a full repetition completes
  const completeRep = async (state, landmarks) => {
    const repNum = totalReps + 1;
    setTotalReps(repNum);
    sessionStatsRef.current.totalReps = repNum;

    // Kinematic rule check
    const kinematicResult = kinematics.checkForm(state.minAngle, state.maxAngle, landmarks);

    // AI Model prediction on this rep's sequence window
    const framesToSend =
      state.repFrames.length >= 15
        ? state.repFrames
        : frameBufferRef.current.slice(-30);

    let modelFormResult = 'proper_form';
    let modelConf = 0.8;
    let predictedEx = exercise.modelKey;

    try {
      if (framesToSend.length >= 2) {
        const t0 = performance.now();
        const pred = await aiService.predictPose(framesToSend, 30.0, exercise.modelKey);
        const lat = Math.round(performance.now() - t0);
        setModelLatency(lat);

        if (pred && pred.form) {
          modelFormResult = pred.form.prediction;
          modelConf = pred.form.confidence;
        }

        if (pred && pred.exercise) {
          predictedEx = pred.exercise.prediction;
          setDetectedExercise(pred.exercise.prediction);
          setDetectedConfidence(Math.round(pred.exercise.confidence * 100));

          // Check exercise mismatch
          if (
            pred.exercise.prediction !== exercise.modelKey &&
            pred.exercise.confidence > 0.6
          ) {
            setExerciseMismatch(pred.exercise.prediction);
          } else {
            setExerciseMismatch(null);
          }
        }
      }
    } catch (err) {
      console.warn('Inference error for rep:', err);
    }

    // Combine Model Form + Kinematic checks
    const isModelProper = modelFormResult === 'proper_form';
    const isKinematicProper = kinematicResult.isCorrect;
    const isRepCorrect = isModelProper && isKinematicProper;

    const repFeedbackIssues = [...kinematicResult.issues];
    if (!isModelProper && repFeedbackIssues.length === 0) {
      repFeedbackIssues.push('Form breakdown detected by AI model');
    }

    // Update Rep counts
    if (isRepCorrect) {
      setCorrectReps((prev) => {
        const next = prev + 1;
        sessionStatsRef.current.correctReps = next;
        return next;
      });
      setActiveFeedback('✓ Good rep! Maintain your tempo');
      setFeedbackType('good');
      playBeep(true);
    } else {
      setIncorrectReps((prev) => {
        const next = prev + 1;
        sessionStatsRef.current.incorrectReps = next;
        return next;
      });
      const topIssue = repFeedbackIssues[0] || 'Technique issue detected';
      setActiveFeedback(`⚠ ${topIssue}`);
      setFeedbackType('warning');
      playBeep(false);

      // Track issues
      repFeedbackIssues.forEach((iss) => {
        sessionStatsRef.current.detectedIssues[iss] =
          (sessionStatsRef.current.detectedIssues[iss] || 0) + 1;
      });
    }

    // Recalculate Form Score (0–100)
    const newCorrect = isRepCorrect ? correctReps + 1 : correctReps;
    const newScore = Math.round((newCorrect / repNum) * 100);
    setFormScore(newScore);

    // Append to rep log
    const repLogItem = {
      repNumber: repNum,
      isCorrect: isRepCorrect,
      modelForm: modelFormResult,
      confidence: Math.round(modelConf * 100),
      issues: repFeedbackIssues,
      peakAngle: state.minAngle,
    };

    setRepHistory((prev) => [repLogItem, ...prev.slice(0, 19)]);
  };

  // Skeleton Drawing on Canvas
  const drawSkeleton = (ctx, landmarks, width, height) => {
    ctx.save();
    // Mirror coordinates horizontally to match mirrored user video
    ctx.translate(width, 0);
    ctx.scale(-1, 1);

    // Draw connecting bones
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const [i, j] of POSE_CONNECTIONS) {
      const lmA = landmarks[i];
      const lmB = landmarks[j];
      if (lmA && lmB && (lmA.visibility || 1) > 0.4 && (lmB.visibility || 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(lmA.x * width, lmA.y * height);
        ctx.lineTo(lmB.x * width, lmB.y * height);
        ctx.strokeStyle = feedbackType === 'warning' ? '#F59E0B' : '#10B981';
        ctx.stroke();
      }
    }

    // Draw joint landmarks
    for (let k = 11; k <= 28; k++) {
      const lm = landmarks[k];
      if (lm && (lm.visibility || 1) > 0.4) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const handleFinish = () => {
    const sessionData = {
      exerciseName: exercise.displayName,
      modelKey: exercise.modelKey,
      dbExercise: exercise.dbExercise,
      totalReps,
      correctReps,
      incorrectReps,
      formScore,
      repHistory,
      detectedIssues: sessionStatsRef.current.detectedIssues,
      durationSeconds: Math.round((Date.now() - sessionStatsRef.current.startTime) / 1000),
      detectedExercise: detectedExercise || exercise.modelKey,
      modelConfidence: detectedConfidence || 85,
    };
    onEndSession(sessionData);
  };

  return (
    <div className="space-y-4">
      {/* Exercise Mismatch Warning */}
      {exerciseMismatch && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900 font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>
              ⚠ Exercise mismatch detected: You selected <strong>{exercise.displayName}</strong>, but the model detects <strong>{exerciseMismatch}</strong>. Please perform {exercise.displayName}.
            </span>
          </div>
        </div>
      )}

      {/* Main Dedicated Workout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Center: Camera Video + Skeleton Canvas */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative aspect-video bg-[#000000] rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-md">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* Skeleton Canvas Overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Top Left: Live Status HUD */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>LIVE AI</span>
              </div>

              <div className="px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-white text-[11px] font-medium border border-white/10">
                <span>{kinematics.primaryAngleName}: </span>
                <span className="font-bold text-emerald-400">{currentJointAngle}°</span>
              </div>
            </div>

            {/* Top Right: Latency & Controls HUD */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="p-1.5 bg-black/70 backdrop-blur rounded-lg text-white hover:bg-black/90 transition border border-white/10"
                title="Toggle Sound Cues"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
              </button>

              <div className="px-2 py-1 bg-black/70 backdrop-blur rounded-lg text-[10px] text-gray-300 border border-white/10">
                <span>{fps} FPS</span>
                {modelLatency > 0 && <span className="ml-1 text-emerald-400">• {modelLatency}ms</span>}
              </div>
            </div>

            {/* Bottom Real-Time Coaching Banner */}
            <div className="absolute bottom-3 inset-x-3">
              <div
                className={`p-3 rounded-xl backdrop-blur border text-xs font-bold transition flex items-center justify-between shadow-lg ${
                  feedbackType === 'good'
                    ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
                    : feedbackType === 'warning'
                    ? 'bg-amber-950/80 border-amber-500/30 text-amber-200'
                    : 'bg-black/80 border-white/15 text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {feedbackType === 'good' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : feedbackType === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate">{activeFeedback}</span>
                </div>

                {detectedExercise && (
                  <span className="text-[10px] font-semibold opacity-75 uppercase tracking-wider shrink-0 ml-2">
                    AI: {detectedExercise} ({detectedConfidence}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Session Controls Bottom Bar */}
          <div className="flex items-center justify-between p-3 bg-white border border-[#E5E7EB] rounded-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                onClick={onCancel}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#6B7280] hover:text-[#111111] transition"
              >
                Discard
              </button>
            </div>

            <button
              onClick={handleFinish}
              className="px-5 py-2.5 bg-[#111111] hover:bg-[#000000] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-sm active:scale-[0.98]"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Finish Session</span>
            </button>
          </div>
        </div>

        {/* Right: AI Coach Stats & Live Rep Log */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header / Exercise name */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Active Session</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  AI Analyzing
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-[#111111] tracking-tight">{exercise.displayName}</h3>
            </div>

            {/* Reps Scorecard */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-[#6B7280]">Total</span>
                <p className="text-2xl font-black text-[#111111] mt-0.5">{totalReps}</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-700">Correct</span>
                <p className="text-2xl font-black text-emerald-700 mt-0.5">{correctReps}</p>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-rose-700">Incorrect</span>
                <p className="text-2xl font-black text-rose-700 mt-0.5">{incorrectReps}</p>
              </div>
            </div>

            {/* Form Score Dial */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#6B7280]">Form Quality Score</span>
                <p className="text-3xl font-black text-[#111111] mt-0.5">
                  {formScore}
                  <span className="text-sm font-semibold text-[#6B7280]">/100</span>
                </p>
              </div>

              <div className="w-12 h-12 rounded-full border-4 border-[#F3F4F6] border-t-emerald-500 flex items-center justify-center font-bold text-xs text-[#111111]">
                {formScore}%
              </div>
            </div>

            {/* Live Reps Stream */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2 flex items-center justify-between">
                <span>Rep Breakdown</span>
                <span className="text-[10px] font-normal text-[#6B7280]">Live</span>
              </h4>

              {repHistory.length === 0 ? (
                <p className="text-xs text-[#9CA3AF] py-4 text-center">
                  Start exercising to track repetitions.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {repHistory.map((rep) => (
                    <div
                      key={rep.repNumber}
                      className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                        rep.isCorrect
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {rep.isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span className="font-bold">Rep #{rep.repNumber}</span>
                        {rep.issues.length > 0 && (
                          <span className="text-[10px] text-rose-700 truncate max-w-[140px]">
                            — {rep.issues[0]}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-semibold text-[#6B7280]">
                        {rep.confidence}% conf
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistanceLiveSession;
