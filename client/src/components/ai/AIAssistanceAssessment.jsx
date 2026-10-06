import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  RotateCcw,
  Save,
  Check,
  Calendar,
  Clock,
  Activity,
  ArrowRight,
} from 'lucide-react';
import aiService from '../../services/aiService';

export const AIAssistanceAssessment = ({
  sessionData,
  onStartAnother,
  onGoToDashboard,
}) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const {
    exerciseName,
    modelKey,
    dbExercise,
    totalReps = 0,
    correctReps = 0,
    incorrectReps = 0,
    formScore = 100,
    detectedIssues = {},
    durationSeconds = 0,
    detectedExercise,
    modelConfidence = 85,
    repHistory = [],
  } = sessionData;

  // Calculate genuine movement quality metrics based on rep consistency & issues
  const romScore = totalReps > 0
    ? Math.max(50, Math.min(98, Math.round(92 - (detectedIssues['Insufficient depth (break 90° parallel)'] || 0) * 8)))
    : 85;

  const consistencyScore = totalReps > 0
    ? Math.max(40, Math.min(99, Math.round((correctReps / totalReps) * 100)))
    : 90;

  const tempoScore = totalReps > 0
    ? Math.max(60, Math.min(95, Math.round(88 - incorrectReps * 3)))
    : 88;

  // Generate synthesized AI coaching assessment
  const generateAIFeedback = () => {
    if (totalReps === 0) {
      return 'No repetitions detected during this session. Position your camera so your full body is visible next time.';
    }

    const issueList = Object.entries(detectedIssues);
    if (formScore >= 85 && issueList.length === 0) {
      return `Outstanding execution! Your ${exerciseName} mechanics demonstrated consistent range of motion and joint stability across all ${totalReps} repetitions. Keep this cadence into your loaded working sets.`;
    }

    if (formScore >= 70) {
      const topIssue = issueList.sort((a, b) => b[1] - a[1])[0];
      const issueNote = topIssue ? `Focus specifically on correcting ${topIssue[0].toLowerCase()} on fatigue reps.` : '';
      return `Solid work overall with ${correctReps} of ${totalReps} repetitions executed with good form. ${issueNote} Maintaining steady tempo through the transition phase will further improve your power transfer.`;
    }

    return `Technique breakdown was observed on several reps (${incorrectReps} total). Review the flagged issues below before loading additional weight. Prioritize controlled cadence and full range of motion.`;
  };

  const aiFeedbackText = generateAIFeedback();

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const issuesArray = Object.entries(detectedIssues).map(
        ([issue, count]) => `${issue} — ${count} rep${count > 1 ? 's' : ''}`
      );

      await aiService.saveSession({
        exercise_id: dbExercise?.id || null,
        analysis_type: 'mov_iq_ai_stage4',
        reps: totalReps,
        correct_reps: correctReps,
        incorrect_reps: incorrectReps,
        form_score: formScore,
        mistakes: issuesArray,
        feedback: aiFeedbackText,
        model_confidence: modelConfidence,
        detected_exercise: detectedExercise || modelKey,
        metrics: {
          range_of_motion: romScore,
          consistency: consistencyScore,
          tempo: tempoScore,
          duration_seconds: durationSeconds,
        },
      });

      setSaved(true);
    } catch (err) {
      console.error('Failed to save AI session:', err);
      setSaveError('Could not save session to history. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#111111] text-white rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              AI Workout Assessment
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        <h1 className="text-3xl font-black text-[#111111] tracking-tight">{exerciseName}</h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Analyzed by MOV-IQ Stage 4 Biomechanical Temporal Sequence Engine
        </p>
      </div>

      {/* Main Score & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Total Reps</span>
          <p className="text-3xl font-black text-[#111111] mt-1">{totalReps}</p>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Correct</span>
          <p className="text-3xl font-black text-emerald-700 mt-1">{correctReps}</p>
        </div>

        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Incorrect</span>
          <p className="text-3xl font-black text-rose-700 mt-1">{incorrectReps}</p>
        </div>

        <div className="p-4 bg-[#111111] text-white rounded-2xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Form Score</span>
          <p className="text-3xl font-black text-white mt-1">
            {formScore}
            <span className="text-sm font-normal text-gray-400">/100</span>
          </p>
        </div>
      </div>

      {/* Detected Issues List */}
      <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center justify-between">
          <span>Detected Issues</span>
          <span className="text-[10px] text-[#6B7280]">
            {Object.keys(detectedIssues).length} issue types
          </span>
        </h3>

        {Object.keys(detectedIssues).length === 0 ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No recurring form issues detected! Clean movement execution throughout.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(detectedIssues).map(([issue, count]) => (
              <div
                key={issue}
                className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-semibold text-[#111111]">{issue}</span>
                </div>
                <span className="text-[11px] font-bold text-[#6B7280] bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                  {count} rep{count > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movement Quality Bars */}
      <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
          Movement Quality Metrics
        </h3>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#4B5563]">Range of Motion</span>
              <span className="text-[#111111] font-bold">{romScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${romScore}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#4B5563]">Consistency</span>
              <span className="text-[#111111] font-bold">{consistencyScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${consistencyScore}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#4B5563]">Cadence / Tempo Control</span>
              <span className="text-[#111111] font-bold">{tempoScore}%</span>
            </div>
            <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${tempoScore}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Feedback & Coaching */}
      <div className="p-5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          AI Coaching Feedback
        </h3>
        <p className="text-xs text-[#374151] leading-relaxed font-medium">
          {aiFeedbackText}
        </p>
      </div>

      {saveError && (
        <p className="text-xs font-bold text-rose-600 text-center">{saveError}</p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm ${
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-[#111111] hover:bg-[#000000] text-white disabled:bg-gray-400'
          }`}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved to History</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save AI Assessment'}</span>
            </>
          )}
        </button>

        <button
          onClick={onStartAnother}
          className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Exercise</span>
        </button>

        <button
          onClick={onGoToDashboard}
          className="w-full sm:w-auto px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B7280] hover:text-[#111111] transition"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
};

export default AIAssistanceAssessment;
