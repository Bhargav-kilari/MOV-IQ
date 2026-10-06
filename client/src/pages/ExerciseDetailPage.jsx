import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Plus,
  Trophy,
  History,
  Dumbbell,
  X,
} from 'lucide-react';
import { exerciseService } from '../services/exerciseService';
import { workoutService } from '../services/workoutService';
import { routineService } from '../services/routineService';

export const ExerciseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('how-to');

  // Media Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gifKey, setGifKey] = useState(0);
  const [mediaError, setMediaError] = useState(false);

  // Add to Routine Modal State
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [addingToRoutine, setAddingToRoutine] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await exerciseService.getExerciseById(id);
        setExercise(res.data);
      } catch (err) {
        console.error('Error loading exercise detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  const handleStartWorkout = async () => {
    try {
      const res = await workoutService.createWorkout({
        name: `${exercise.name} Session`,
        exercises: [{ exercise_id: exercise.id, order_index: 0 }],
      });
      navigate(`/app/workout/${res.data.id}`);
    } catch (err) {
      console.error('Error starting workout:', err);
    }
  };

  const handleOpenRoutineModal = async () => {
    try {
      const res = await routineService.getRoutines();
      setRoutines(res.data || []);
      setShowRoutineModal(true);
    } catch (err) {
      console.error('Error loading routines:', err);
    }
  };

  const handleSelectRoutine = async (routineId) => {
    try {
      setAddingToRoutine(true);
      const res = await routineService.getRoutineById(routineId);
      const routine = res.data;
      const currentExercises = (routine.exercises || []).map((ex, idx) => ({
        exercise_id: ex.exercise_id,
        order_index: idx,
        target_sets: ex.target_sets || 3,
        target_reps: ex.target_reps || 10,
        target_weight: ex.target_weight || 0,
        rest_seconds: ex.rest_seconds || 90,
      }));

      currentExercises.push({
        exercise_id: exercise.id,
        order_index: currentExercises.length,
        target_sets: 3,
        target_reps: 10,
        target_weight: 40,
        rest_seconds: 90,
      });

      await routineService.updateRoutine(routineId, {
        name: routine.name,
        description: routine.description,
        exercises: currentExercises,
      });

      setShowRoutineModal(false);
      setToastMessage(`Added ${exercise.name} to ${routine.name}!`);
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      console.error('Error adding to routine:', err);
    } finally {
      setAddingToRoutine(false);
    }
  };

  const handleReplay = () => {
    setGifKey((k) => k + 1);
    setIsPlaying(true);
  };

  if (loading) {
    return <div className="py-16 text-center text-xs text-[#6B7280]">Loading exercise details...</div>;
  }

  if (!exercise) {
    return (
      <div className="py-16 text-center text-xs text-[#6B7280]">
        Exercise not found.{' '}
        <Link to="/app/exercises" className="text-[#111111] font-bold underline">
          Return to Exercise Library
        </Link>
      </div>
    );
  }

  const pr = exercise.personal_records || { pr_weight: 0, pr_estimated_1rm: 0, pr_single_set_volume: 0 };
  const history = exercise.history || [];
  const hasPerformance = Number(pr.pr_weight) > 0 || history.length > 0;
  const lastSession = history[history.length - 1] || null;

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2 pb-16 bg-[#FFFFFF]">
      {/* Back button */}
      <button
        onClick={() => navigate('/app/exercises')}
        className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111111] transition uppercase font-bold tracking-wider"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Library
      </button>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="border-b border-[#E5E7EB] pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">
            Exercise Demonstration & Mechanics
          </span>
          {exercise.is_custom && (
            <span className="px-1.5 py-0.2 bg-[#F3F4F6] text-[#111111] text-[9px] font-extrabold uppercase rounded border border-[#E5E7EB]">
              Custom Exercise
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-[#111111] uppercase tracking-tight">
          {exercise.name}
        </h1>

        <p className="text-xs text-[#6B7280] uppercase tracking-wider">
          <span className="text-[#111111] font-bold">{exercise.target_muscle || exercise.body_part}</span> · {exercise.equipment} · {exercise.difficulty}
        </p>

        {/* Primary Action Buttons */}
        <div className="pt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={handleStartWorkout}
            className="px-6 py-3 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 active:scale-95 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Workout</span>
          </button>

          <button
            onClick={handleOpenRoutineModal}
            className="px-5 py-3 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] font-semibold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Routine</span>
          </button>
        </div>
      </div>

      {/* Animated Exercise Demonstration Area (Native 180x180 Resolution) */}
      <section className="space-y-2">
        <div className="relative bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 min-h-[260px] w-full">
          {exercise.animation_url && isPlaying && !mediaError ? (
            <img
              key={gifKey}
              src={exercise.animation_url}
              alt={exercise.name}
              width={180}
              height={180}
              className="w-[180px] h-[180px] object-contain rounded-xl shadow-xs"
              onError={() => setMediaError(true)}
            />
          ) : exercise.thumbnail_url ? (
            <img
              src={exercise.thumbnail_url}
              alt={exercise.name}
              width={180}
              height={180}
              className="w-[180px] h-[180px] object-contain rounded-xl opacity-90 shadow-xs"
            />
          ) : (
            <div className="p-12 text-center space-y-2">
              <Dumbbell className="w-12 h-12 text-[#9CA3AF] mx-auto" />
              <p className="text-xs text-[#6B7280] font-medium">Custom Exercise Demonstration</p>
            </div>
          )}

          {/* Media Player Controls Overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#FFFFFF]/90 backdrop-blur border border-[#E5E7EB] p-1.5 rounded-xl shadow-xs">
            {exercise.animation_url && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause Animation' : 'Play Animation'}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    isPlaying ? 'text-[#111111] bg-[#F3F4F6]' : 'text-[#6B7280] hover:text-[#111111]'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleReplay}
                  title="Replay Animation"
                  className="p-1.5 text-[#6B7280] hover:text-[#111111] rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Fullscreen Demonstration"
              className="p-1.5 text-[#6B7280] hover:text-[#111111] rounded-lg transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Media Attribution Overlay */}
          <div className="absolute bottom-2.5 left-3 text-[10px] text-[#6B7280] bg-[#FFFFFF]/90 backdrop-blur px-2.5 py-1 rounded-md border border-[#E5E7EB]">
            {exercise.media_attribution || '© Gym visual — https://gymvisual.com/'}
          </div>
        </div>
      </section>

      {/* Exercise Information Tags */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-[#E5E7EB]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Target Muscle
          </span>
          <span className="text-sm font-black text-[#111111] uppercase mt-0.5 block truncate">
            {exercise.target_muscle || exercise.body_part || 'General'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Secondary
          </span>
          <span className="text-sm font-semibold text-[#4B5563] uppercase mt-0.5 block truncate">
            {exercise.secondary_muscles?.length > 0 ? exercise.secondary_muscles.join(', ') : 'None'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Equipment
          </span>
          <span className="text-sm font-black text-[#111111] uppercase mt-0.5 block truncate">
            {exercise.equipment || 'Body Weight'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Body Part
          </span>
          <span className="text-sm font-black text-[#111111] uppercase mt-0.5 block truncate">
            {exercise.body_part || 'Full Body'}
          </span>
        </div>
      </section>

      {/* Tabs: How To / Performance / History */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 border-b border-[#E5E7EB] pb-2">
          <button
            onClick={() => setActiveTab('how-to')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'how-to'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
            }`}
          >
            How To
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
              activeTab === 'stats'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
            }`}
          >
            <Trophy className="w-3 h-3" />
            <span>Statistics</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
            }`}
          >
            <History className="w-3 h-3" />
            <span>History ({history.length})</span>
          </button>
        </div>

        {/* Tab 1: How To Instructions */}
        {activeTab === 'how-to' && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              Execution Steps
            </h3>
            {(!exercise.instructions || exercise.instructions.length === 0) ? (
              <p className="text-xs text-[#6B7280]">Maintain proper alignment and control throughout the movement.</p>
            ) : (
              <ol className="space-y-2.5">
                {exercise.instructions.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs text-[#374151] leading-relaxed">
                    <span className="text-xs font-mono font-black text-[#111111] shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Tab 2: Performance Statistics */}
        {activeTab === 'stats' && (
          <section className="space-y-4">
            {!hasPerformance ? (
              <div className="border border-dashed border-[#E5E7EB] rounded-xl p-8 text-center space-y-1 bg-[#F9FAFB]">
                <p className="text-xs text-[#111111] font-bold">No performance data yet.</p>
                <p className="text-[11px] text-[#6B7280]">Complete a workout session including this exercise to record personal records.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-3.5 shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#6B7280] block">
                      Max Weight PR
                    </span>
                    <span className="text-lg font-black text-[#111111] font-tabular mt-0.5 block">
                      {pr.pr_weight || 0} <span className="text-xs font-normal text-[#6B7280]">kg</span>
                    </span>
                  </div>

                  <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-3.5 shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#6B7280] block">
                      Estimated 1RM
                    </span>
                    <span className="text-lg font-black text-[#111111] font-tabular mt-0.5 block">
                      {pr.pr_estimated_1rm || 0} <span className="text-xs font-normal text-[#6B7280]">kg</span>
                    </span>
                  </div>

                  <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-3.5 shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#6B7280] block">
                      Logged Sessions
                    </span>
                    <span className="text-lg font-black text-[#111111] font-tabular mt-0.5 block">
                      {history.length}
                    </span>
                  </div>

                  <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-3.5 shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#6B7280] block">
                      Best Set Volume
                    </span>
                    <span className="text-lg font-black text-[#111111] font-tabular mt-0.5 block">
                      {pr.pr_single_set_volume ? `${Number(pr.pr_single_set_volume).toLocaleString()} kg` : '0 kg'}
                    </span>
                  </div>
                </div>

                {lastSession && (
                  <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-1 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] block">
                      Last Recorded Session ({new Date(lastSession.completed_at).toLocaleDateString()})
                    </span>
                    <p className="text-xs font-bold text-[#111111]">
                      Top Set: <span className="text-[#111111]">{lastSession.max_weight} kg × {lastSession.max_reps} reps</span> · Total Volume: {Number(lastSession.session_volume).toLocaleString()} kg
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: History Log */}
        {activeTab === 'history' && (
          <section className="space-y-3">
            {history.length === 0 ? (
              <div className="border border-dashed border-[#E5E7EB] rounded-xl p-8 text-center space-y-1 bg-[#F9FAFB]">
                <p className="text-xs text-[#111111] font-bold">No history yet.</p>
                <p className="text-[11px] text-[#6B7280]">Log this exercise during your next workout to track set progressions.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {history.map((h, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-[#111111] uppercase">{h.workout_name}</h4>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {new Date(h.completed_at).toLocaleDateString()} · {h.sets_completed} sets completed
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-[#111111] font-tabular">
                        {h.max_weight} kg × {h.max_reps}
                      </span>
                      <span className="text-[10px] text-[#6B7280] block font-medium">
                        Vol: {Number(h.session_volume).toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Fullscreen Demonstration Modal (Preserving Native 180x180 Dimensions) */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative max-w-sm w-full bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl space-y-4">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 text-[#6B7280] hover:text-[#111111] bg-[#F3F4F6] p-2 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-[180px] h-[180px] bg-[#F9FAFB] rounded-2xl flex items-center justify-center border border-[#E5E7EB] overflow-hidden">
              <img
                src={exercise.animation_url || exercise.thumbnail_url}
                alt={exercise.name}
                width={180}
                height={180}
                className="w-[180px] h-[180px] object-contain"
              />
            </div>
            <p className="text-[11px] text-[#6B7280] text-center font-medium">
              {exercise.media_attribution || '© Gym visual — https://gymvisual.com/'}
            </p>
          </div>
        </div>
      )}

      {/* Add to Routine Modal */}
      {showRoutineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                Add to Routine
              </h3>
              <button
                onClick={() => setShowRoutineModal(false)}
                className="text-[#6B7280] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6B7280]">
              Select which routine you'd like to add <span className="text-[#111111] font-bold">{exercise.name}</span> to:
            </p>

            {routines.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-[#6B7280]">No routines created yet.</p>
                <Link
                  to="/app/routines"
                  className="inline-block px-4 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-xl"
                >
                  Create a Routine
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] max-h-60 overflow-y-auto">
                {routines.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => !addingToRoutine && handleSelectRoutine(r.id)}
                    className="py-3 px-2 flex items-center justify-between hover:bg-[#F9FAFB] rounded-xl cursor-pointer transition group"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#111111] group-hover:text-[#000000] uppercase">
                        {r.name}
                      </h4>
                      <p className="text-[10px] text-[#6B7280]">
                        {r.exercise_count || 0} exercises
                      </p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-[#111111]" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseDetailPage;
