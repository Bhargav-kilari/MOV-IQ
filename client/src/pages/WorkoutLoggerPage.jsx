import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Check,
  Plus,
  Dumbbell,
  CheckCircle2,
  ArrowLeft,
  X,
  Search,
  Timer,
} from 'lucide-react';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import ExerciseThumbnail from '../components/common/ExerciseThumbnail';

export const WorkoutLoggerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  // Modals & Pickers
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Rest Timer
  const [restSeconds, setRestSeconds] = useState(0);
  const [isRestActive, setIsRestActive] = useState(false);

  const workoutTimerRef = useRef(null);
  const restTimerRef = useRef(null);

  const muscles = ['All', 'chest', 'back', 'upper legs', 'lower legs', 'shoulders', 'upper arms', 'lower arms', 'waist'];

  useEffect(() => {
    const initWorkout = async () => {
      try {
        setLoading(true);
        if (id === 'new') {
          const res = await workoutService.createWorkout({
            name: `Workout • ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
          });
          navigate(`/app/workout/${res.data.id}`, { replace: true });
          return;
        }

        const res = await workoutService.getWorkoutById(id);
        const data = res.data;

        if (data.exercises) {
          data.exercises.forEach((ex) => {
            if (!ex.sets || ex.sets.length === 0) {
              ex.sets = [
                { set_number: 1, weight: 50, reps: 8, completed: false, rpe: 8 },
                { set_number: 2, weight: 50, reps: 8, completed: false, rpe: 8 },
                { set_number: 3, weight: 50, reps: 8, completed: false, rpe: 8 },
              ];
            }
          });
        }

        setWorkout(data);

        if (data.started_at && !data.completed_at) {
          const start = new Date(data.started_at).getTime();
          const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
          setElapsedSeconds(diff);
        } else if (data.duration) {
          setElapsedSeconds(data.duration);
        }
      } catch (err) {
        console.error('Failed to load workout:', err);
      } finally {
        setLoading(false);
      }
    };

    initWorkout();
  }, [id, navigate]);

  // Workout Timer Stopwatch
  useEffect(() => {
    if (workout && !workout.completed_at) {
      workoutTimerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(workoutTimerRef.current);
  }, [workout]);

  // Rest Timer Countdown
  useEffect(() => {
    if (isRestActive && restSeconds > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(restTimerRef.current);
            setIsRestActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(restTimerRef.current);
    }
    return () => clearInterval(restTimerRef.current);
  }, [isRestActive, restSeconds]);

  const triggerRest = (seconds = 90) => {
    setRestSeconds(seconds);
    setIsRestActive(true);
  };

  const adjustRest = (sec) => {
    setRestSeconds((s) => Math.max(0, s + sec));
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleOpenPicker = async () => {
    try {
      setLoadingCatalog(true);
      setShowAddExerciseModal(true);
      const res = await exerciseService.getExercises({ limit: 100 });
      setCatalog(res.data || []);
    } catch (err) {
      console.error('Error loading exercises:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleSearchPicker = async (query, muscle) => {
    try {
      setLoadingCatalog(true);
      const res = await exerciseService.getExercises({
        search: query || undefined,
        body_part: muscle !== 'All' ? muscle : undefined,
        limit: 100,
      });
      setCatalog(res.data || []);
    } catch (err) {
      console.error('Error searching exercises:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const getDefaultWeight = (equipment) => {
    const eq = (equipment || '').toLowerCase();
    if (eq.includes('body weight') || eq.includes('band')) {
      return 0;
    }
    if (eq.includes('barbell')) {
      return 20;
    }
    if (eq.includes('dumbbell')) {
      return 10;
    }
    return 0;
  };

  const handleAddExercise = (exercise) => {
    const current = workout.exercises || [];
    const defaultWt = getDefaultWeight(exercise.equipment);
    const newEx = {
      exercise_id: exercise.id,
      name: exercise.name,
      equipment: exercise.equipment,
      order_index: current.length,
      notes: '',
      sets: [
        { set_number: 1, weight: defaultWt, reps: 10, completed: false, rpe: 8 },
        { set_number: 2, weight: defaultWt, reps: 10, completed: false, rpe: 8 },
        { set_number: 3, weight: defaultWt, reps: 10, completed: false, rpe: 8 },
      ],
    };

    setWorkout({ ...workout, exercises: [...current, newEx] });
    setShowAddExerciseModal(false);
  };

  const handleAddSet = (exerciseIndex) => {
    const updated = [...workout.exercises];
    const target = updated[exerciseIndex];
    const prevSet = target.sets[target.sets.length - 1];
    const defaultWt = getDefaultWeight(target.equipment);

    const newSet = {
      set_number: (target.sets?.length || 0) + 1,
      weight: prevSet ? prevSet.weight : defaultWt,
      reps: prevSet ? prevSet.reps : 10,
      completed: false,
      rpe: prevSet ? prevSet.rpe : 8,
    };

    target.sets = [...(target.sets || []), newSet];
    setWorkout({ ...workout, exercises: updated });
  };

  const handleRemoveSet = (exerciseIndex, setIndex) => {
    const updated = [...workout.exercises];
    updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, idx) => idx !== setIndex);
    updated[exerciseIndex].sets.forEach((s, idx) => {
      s.set_number = idx + 1;
    });
    setWorkout({ ...workout, exercises: updated });
  };

  const handleSetChange = (exerciseIndex, setIndex, field, val) => {
    const updated = [...workout.exercises];
    updated[exerciseIndex].sets[setIndex][field] = val;
    setWorkout({ ...workout, exercises: updated });
  };

  const handleToggleComplete = (exerciseIndex, setIndex) => {
    const updated = [...workout.exercises];
    const set = updated[exerciseIndex].sets[setIndex];
    const newState = !set.completed;
    set.completed = newState;
    setWorkout({ ...workout, exercises: updated });

    if (newState && !workout.completed_at) {
      triggerRest(90);
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      await workoutService.completeWorkout(workout.id, {
        duration: elapsedSeconds,
        notes: workout.notes || '',
        exercises: workout.exercises,
      });
      navigate('/app/progress');
    } catch (err) {
      console.error('Error completing workout:', err);
      setIsFinishing(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-[#6B7280]">Loading workout...</div>;
  }

  if (!workout) {
    return <div className="py-12 text-center text-xs text-[#6B7280]">Workout session not found.</div>;
  }

  const isCompleted = !!workout.completed_at;

  let totalSets = 0;
  let doneSets = 0;
  let volumeKg = 0;

  workout.exercises?.forEach((ex) => {
    ex.sets?.forEach((s) => {
      totalSets++;
      if (s.completed) {
        doneSets++;
        volumeKg += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      }
    });
  });

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-32 bg-[#FFFFFF]">
      {/* 1. Sticky Header */}
      <header className="sticky top-2 sm:top-4 z-40 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app')}
            className="p-1 text-[#6B7280] hover:text-[#111111] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-black text-[#111111] uppercase tracking-tight truncate max-w-[200px] sm:max-w-md">
              {workout.name}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-[#6B7280] font-tabular font-bold">
              <span className="text-[#111111]">{formatTimer(elapsedSeconds)}</span>
              <span>·</span>
              <span>{doneSets}/{totalSets} sets</span>
            </div>
          </div>
        </div>

        {!isCompleted ? (
          <button
            onClick={() => setShowFinishModal(true)}
            className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish</span>
          </button>
        ) : (
          <span className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
            Completed
          </span>
        )}
      </header>

      {/* 2. Floating Rest Timer Banner */}
      {isRestActive && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#FFFFFF] border border-[#E5E7EB] text-[#111111] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#111111]" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#6B7280] font-bold block">
                Rest Timer
              </span>
              <span className="text-sm font-mono font-bold text-[#111111] font-tabular">
                {formatTimer(restSeconds)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustRest(-15)}
              className="px-2 py-1 bg-[#F3F4F6] text-[10px] font-bold rounded text-[#4B5563] hover:text-[#111111]"
            >
              -15s
            </button>
            <button
              onClick={() => adjustRest(30)}
              className="px-2 py-1 bg-[#F3F4F6] text-[10px] font-bold rounded text-[#4B5563] hover:text-[#111111]"
            >
              +30s
            </button>
            <button
              onClick={() => {
                setIsRestActive(false);
                setRestSeconds(0);
              }}
              className="px-2.5 py-1 bg-[#111111] text-white text-[10px] font-bold rounded hover:bg-[#000000] transition ml-1"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* 3. Exercises & Set Rows */}
      {(!workout.exercises || workout.exercises.length === 0) ? (
        <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-10 text-center space-y-3 bg-[#FFFFFF]">
          <Dumbbell className="w-8 h-8 text-[#9CA3AF] mx-auto" />
          <p className="text-xs text-[#6B7280]">No exercises added yet.</p>
          {!isCompleted && (
            <button
              onClick={handleOpenPicker}
              className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Exercise</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {workout.exercises.map((ex, exIdx) => {
            const nextExercise = workout.exercises[exIdx + 1];
            return (
              <div key={ex.workout_exercise_id || exIdx} className="space-y-3">
                {/* Exercise Header */}
                <div className="flex items-baseline justify-between border-b border-[#E5E7EB] pb-2">
                  <div>
                    <h2 className="text-base font-black text-[#111111] uppercase tracking-tight flex items-center gap-2">
                      <Link
                        to={`/app/exercises/${ex.exercise_id}`}
                        target="_blank"
                        className="hover:underline transition"
                      >
                        {ex.name}
                      </Link>
                    </h2>
                    <span className="text-[10px] text-[#6B7280] uppercase font-bold">
                      {ex.equipment || 'Standard'}
                    </span>
                  </div>

                  {!isCompleted && (
                    <button
                      onClick={() => {
                        const up = workout.exercises.filter((_, i) => i !== exIdx);
                        setWorkout({ ...workout, exercises: up });
                      }}
                      className="text-[11px] text-[#9CA3AF] hover:text-red-600 transition font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Sets Table */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7280] px-2">
                    <span className="col-span-1 text-center">Set</span>
                    <span className="col-span-3">Previous</span>
                    <span className="col-span-3">Kg</span>
                    <span className="col-span-3">Reps</span>
                    <span className="col-span-2 text-center">Done</span>
                  </div>

                  {ex.sets?.map((set, setIdx) => {
                    const prevBenchmark = `${set.weight || 50} kg × ${set.reps || 8}`;
                    return (
                      <div
                        key={set.set_id || setIdx}
                        className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition ${
                          set.completed
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-[#FFFFFF] border-[#E5E7EB] text-[#111111]'
                        }`}
                      >
                        {/* Set # */}
                        <span className="col-span-1 text-center text-xs font-bold text-[#6B7280] font-tabular">
                          {setIdx + 1}
                        </span>

                        {/* Previous Benchmark */}
                        <span className="col-span-3 text-[11px] text-[#6B7280] font-tabular truncate">
                          {prevBenchmark}
                        </span>

                        {/* Weight Input */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.5"
                            disabled={isCompleted}
                            value={set.weight}
                            onChange={(e) =>
                              handleSetChange(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)
                            }
                            className="w-full py-1.5 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-bold text-center text-[#111111] font-tabular focus:outline-none focus:border-[#111111]"
                          />
                        </div>

                        {/* Reps Input */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            disabled={isCompleted}
                            value={set.reps}
                            onChange={(e) =>
                              handleSetChange(exIdx, setIdx, 'reps', parseInt(e.target.value, 10) || 0)
                            }
                            className="w-full py-1.5 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-bold text-center text-[#111111] font-tabular focus:outline-none focus:border-[#111111]"
                          />
                        </div>

                        {/* Complete Button */}
                        <div className="col-span-2 text-center">
                          <button
                            type="button"
                            disabled={isCompleted}
                            onClick={() => handleToggleComplete(exIdx, setIdx)}
                            className={`w-7 h-7 rounded-lg mx-auto flex items-center justify-center transition active:scale-90 ${
                              set.completed
                                ? 'bg-[#10B981] text-white shadow-xs'
                                : 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#9CA3AF] hover:text-[#111111] border border-[#E5E7EB]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Set Action */}
                {!isCompleted && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleAddSet(exIdx)}
                      className="text-xs font-bold uppercase tracking-wider text-[#111111] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                      <span>Add Set</span>
                    </button>

                    {ex.sets?.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSet(exIdx, ex.sets.length - 1)}
                        className="text-[11px] text-[#9CA3AF] hover:text-[#111111]"
                      >
                        Delete set
                      </button>
                    )}
                  </div>
                )}

                {/* Next exercise indicator */}
                {nextExercise && (
                  <div className="pt-2 text-[11px] text-[#6B7280]">
                    Next: <span className="text-[#111111] font-bold uppercase">{nextExercise.name}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Next Exercise Action */}
          {!isCompleted && (
            <button
              onClick={handleOpenPicker}
              className="w-full py-3 border border-dashed border-[#E5E7EB] hover:border-[#111111] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 bg-[#FFFFFF]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Next Exercise</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Finish Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-black uppercase tracking-tight text-[#111111]">
                Complete Workout
              </h2>
              <p className="text-xs text-[#6B7280]">
                Log your training volume and update your progression.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center py-2">
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">
                  Duration
                </span>
                <span className="text-sm font-black text-[#111111] font-tabular">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">
                  Volume
                </span>
                <span className="text-sm font-black text-[#111111] font-tabular">
                  {Number(volumeKg).toLocaleString()} kg
                </span>
              </div>
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">
                  Sets
                </span>
                <span className="text-sm font-black text-[#111111] font-tabular">
                  {doneSets}/{totalSets}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
              >
                Keep Logging
              </button>
              <button
                type="button"
                disabled={isFinishing}
                onClick={handleFinish}
                className="px-5 py-2.5 bg-[#111111] hover:bg-[#000000] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
              >
                {isFinishing ? 'Saving...' : 'Save & Log Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 1,324+ Exercise Picker Drawer */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] space-y-3 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Add Exercise to Workout
                </h3>
                <button
                  onClick={() => setShowAddExerciseModal(false)}
                  className="text-[#6B7280] hover:text-[#111111] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search 1,324+ exercises..."
                  value={exerciseSearch}
                  onChange={(e) => {
                    setExerciseSearch(e.target.value);
                    handleSearchPicker(e.target.value, selectedMuscle);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              {/* Muscle Chips */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {muscles.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedMuscle(m);
                      handleSearchPicker(exerciseSearch, m);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold whitespace-nowrap transition ${
                      selectedMuscle === m
                        ? 'bg-[#111111] text-white'
                        : 'bg-[#F3F4F6] text-[#4B5563] hover:text-[#111111]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1 divide-y divide-[#E5E7EB]">
              {loadingCatalog ? (
                <p className="text-xs text-[#6B7280] py-8 text-center">Searching catalog...</p>
              ) : catalog.length === 0 ? (
                <p className="text-xs text-[#6B7280] py-8 text-center">No exercises found.</p>
              ) : (
                catalog.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => handleAddExercise(ex)}
                    className="p-3 flex items-center justify-between hover:bg-[#F9FAFB] rounded-xl cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ExerciseThumbnail
                        src={ex.thumbnail_url}
                        alt={ex.name}
                        className="w-10 h-10"
                        iconSize="w-4 h-4"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#111111] group-hover:text-[#000000] uppercase tracking-tight truncate transition">
                          {ex.name}
                        </h4>
                        <p className="text-[10px] text-[#6B7280] mt-0.5 uppercase truncate">
                          {ex.target_muscle || ex.body_part} · {ex.equipment}
                        </p>
                      </div>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-[#111111]" />
                  </div>
                ))
              )}
            </div>

            {/* Modal Attribution Footer */}
            <div className="px-4 py-2.5 bg-[#F9FAFB] border-t border-[#E5E7EB] text-[10px] text-[#6B7280] text-center rounded-b-2xl shrink-0">
              Exercise media &copy; <a href="https://gymvisual.com/" target="_blank" rel="noopener noreferrer" className="text-[#111111] underline hover:text-[#000000]">Gym Visual</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutLoggerPage;
