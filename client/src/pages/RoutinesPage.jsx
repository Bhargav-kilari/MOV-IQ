import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  Edit3,
  Search,
  Dumbbell,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ExerciseThumbnail from '../components/common/ExerciseThumbnail';
import { routineService } from '../services/routineService';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';

export const RoutinesPage = () => {
  const navigate = useNavigate();

  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Routine Builder State
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [routineName, setRoutineName] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routineExercises, setRoutineExercises] = useState([]);
  const [builderError, setBuilderError] = useState('');

  // Exercise Picker Drawer State
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const muscles = ['All', 'chest', 'back', 'upper legs', 'lower legs', 'shoulders', 'upper arms', 'lower arms', 'waist'];

  const fetchRoutines = async () => {
    try {
      setLoading(true);
      const res = await routineService.getRoutines();
      setRoutines(res.data || []);
    } catch (err) {
      console.error('Error fetching routines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
  }, []);

  const openNewBuilder = () => {
    setEditingRoutineId(null);
    setRoutineName('');
    setRoutineDesc('');
    setRoutineExercises([]);
    setBuilderError('');
    setShowBuilder(true);
  };

  const openEditBuilder = async (routineId) => {
    try {
      const res = await routineService.getRoutineById(routineId);
      const data = res.data;
      setEditingRoutineId(data.id);
      setRoutineName(data.name);
      setRoutineDesc(data.description || '');
      setBuilderError('');
      setRoutineExercises(
        (data.exercises || []).map((ex) => ({
          exercise_id: ex.exercise_id,
          name: ex.name,
          equipment: ex.equipment,
          target_sets: ex.target_sets || 3,
          target_reps: ex.target_reps || 10,
          target_weight: ex.target_weight || 0,
          rest_seconds: ex.rest_seconds || 90,
          notes: ex.notes || '',
        }))
      );
      setShowBuilder(true);
    } catch (err) {
      console.error('Error opening builder:', err);
    }
  };

  const handleDuplicate = async (routineId, e) => {
    e.stopPropagation();
    try {
      const res = await routineService.getRoutineById(routineId);
      const orig = res.data;
      await routineService.createRoutine({
        name: `${orig.name} (Copy)`,
        description: orig.description || '',
        exercises: (orig.exercises || []).map((ex, idx) => ({
          exercise_id: ex.exercise_id,
          order_index: idx,
          target_sets: ex.target_sets || 3,
          target_reps: ex.target_reps || 10,
          target_weight: ex.target_weight || 0,
          rest_seconds: ex.rest_seconds || 90,
          notes: ex.notes || '',
        })),
      });
      fetchRoutines();
    } catch (err) {
      console.error('Error duplicating routine:', err);
    }
  };

  const handleDelete = async (routineId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this routine?')) return;
    try {
      await routineService.deleteRoutine(routineId);
      setRoutines(routines.filter((r) => r.id !== routineId));
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };

  const handleStartWorkout = async (routineId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await workoutService.createWorkout({ routine_id: routineId });
      navigate(`/app/workout/${res.data.id}`);
    } catch (err) {
      console.error('Error starting routine workout:', err);
    }
  };

  const handleOpenPicker = async () => {
    try {
      setLoadingCatalog(true);
      setShowExercisePicker(true);
      const res = await exerciseService.getExercises({ limit: 100 });
      setCatalog(res.data || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
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
      console.error('Error searching catalog:', err);
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

  const handleAddExercise = (ex) => {
    const defaultWt = getDefaultWeight(ex.equipment);
    setRoutineExercises((prev) => [
      ...prev,
      {
        exercise_id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        target_sets: 3,
        target_reps: 10,
        target_weight: defaultWt,
        rest_seconds: 90,
        notes: '',
      },
    ]);
    setShowExercisePicker(false);
  };

  const handleMove = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= routineExercises.length) return;
    const updated = [...routineExercises];
    const item = updated[index];
    updated[index] = updated[target];
    updated[target] = item;
    setRoutineExercises(updated);
  };

  const handleSaveRoutine = async (startNow = false) => {
    setBuilderError('');
    if (!routineName.trim()) {
      setBuilderError('Please enter a routine name before saving.');
      return;
    }

    const payload = {
      name: routineName.trim(),
      description: routineDesc.trim(),
      exercises: routineExercises.map((ex, idx) => ({
        ...ex,
        order_index: idx,
      })),
    };

    try {
      let result;
      if (editingRoutineId) {
        const res = await routineService.updateRoutine(editingRoutineId, payload);
        result = res.data;
      } else {
        const res = await routineService.createRoutine(payload);
        result = res.data;
      }

      setShowBuilder(false);
      if (startNow && result?.id) {
        handleStartWorkout(result.id);
      } else {
        fetchRoutines();
      }
    } catch (err) {
      console.error('Error saving routine:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-2 bg-[#FFFFFF]">
      {/* Page Header */}
      <PageHeader
        title="My Routines"
        subtitle="Saved training splits and repeatable exercise sequences."
        action={
          <button
            onClick={openNewBuilder}
            className="px-4 py-2.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Routine</span>
          </button>
        }
      />

      {/* Routine List */}
      {loading ? (
        <p className="text-xs text-[#6B7280] py-12 text-center">Loading routines...</p>
      ) : routines.length === 0 ? (
        <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-10 text-center space-y-3 bg-[#FFFFFF]">
          <Dumbbell className="w-8 h-8 text-[#9CA3AF] mx-auto" />
          <p className="text-xs text-[#6B7280]">
            No routines created yet. Build your first routine to streamline gym sessions.
          </p>
          <button
            onClick={openNewBuilder}
            className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Routine</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {routines.map((routine) => (
            <div
              key={routine.id}
              onClick={() => navigate(`/app/routines/${routine.id}`)}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] px-2 rounded-xl cursor-pointer transition group"
            >
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[#111111] group-hover:text-[#000000] uppercase tracking-tight transition">
                  {routine.name}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {routine.exercise_count || 0} exercises · ~45 min
                </p>
                {routine.description && (
                  <p className="text-[11px] text-[#9CA3AF] line-clamp-1">{routine.description}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditBuilder(routine.id);
                  }}
                  title="Edit Routine"
                  className="p-2 text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] rounded-lg transition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDuplicate(routine.id, e)}
                  title="Duplicate Routine"
                  className="p-2 text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] rounded-lg transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(routine.id, e)}
                  title="Delete Routine"
                  className="p-2 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStartWorkout(routine.id, e)}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Routine Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                {editingRoutineId ? 'Edit Routine' : 'Create Routine'}
              </h2>
              <button
                onClick={() => setShowBuilder(false)}
                className="text-[#6B7280] hover:text-[#111111] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {builderError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <span>{builderError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                  Routine Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PUSH / Upper Body Hypertrophy"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                  Notes / Focus
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chest, shoulders and triceps volume"
                  value={routineDesc}
                  onChange={(e) => setRoutineDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              {/* Exercises Sequence */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
                    Exercises ({routineExercises.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenPicker}
                    className="text-xs font-bold uppercase tracking-wider text-[#111111] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add Exercise</span>
                  </button>
                </div>

                {routineExercises.length === 0 ? (
                  <div
                    onClick={handleOpenPicker}
                    className="p-6 border border-dashed border-[#E5E7EB] rounded-xl text-center cursor-pointer hover:border-[#111111] transition bg-[#F9FAFB]"
                  >
                    <p className="text-xs text-[#6B7280] font-medium">Click to select exercises from 1,324+ library</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routineExercises.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#111111]">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-bold text-[#111111] uppercase">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-[#6B7280]">({item.equipment})</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-[#6B7280] hover:text-[#111111] disabled:opacity-20"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 1)}
                              disabled={idx === routineExercises.length - 1}
                              className="p-1 text-[#6B7280] hover:text-[#111111] disabled:opacity-20"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRoutineExercises(routineExercises.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-[#9CA3AF] hover:text-red-600 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Set Parameters */}
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">Sets</span>
                            <input
                              type="number"
                              min="1"
                              value={item.target_sets}
                              onChange={(e) => {
                                const up = [...routineExercises];
                                up[idx].target_sets = parseInt(e.target.value) || 1;
                                setRoutineExercises(up);
                              }}
                              className="w-full mt-1 py-1 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-center text-xs text-[#111111] font-bold focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">Reps</span>
                            <input
                              type="number"
                              min="1"
                              value={item.target_reps}
                              onChange={(e) => {
                                const up = [...routineExercises];
                                up[idx].target_reps = parseInt(e.target.value) || 1;
                                setRoutineExercises(up);
                              }}
                              className="w-full mt-1 py-1 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-center text-xs text-[#111111] font-bold focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">Weight (kg)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={item.target_weight}
                              onChange={(e) => {
                                const up = [...routineExercises];
                                up[idx].target_weight = parseFloat(e.target.value) || 0;
                                setRoutineExercises(up);
                              }}
                              className="w-full mt-1 py-1 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-center text-xs text-[#111111] font-bold focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-[#6B7280] block font-bold">Rest (sec)</span>
                            <input
                              type="number"
                              step="15"
                              value={item.rest_seconds}
                              onChange={(e) => {
                                const up = [...routineExercises];
                                up[idx].rest_seconds = parseInt(e.target.value) || 60;
                                setRoutineExercises(up);
                              }}
                              className="w-full mt-1 py-1 px-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-center text-xs text-[#111111] font-bold focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="px-3 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveRoutine(false)}
                  className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition"
                >
                  Save Routine
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRoutine(true)}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm"
                >
                  Save & Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1,324+ Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] space-y-3 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Add Exercise to Plan
                </h3>
                <button
                  onClick={() => setShowExercisePicker(false)}
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
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
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
                      handleSearchPicker(searchQuery, m);
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

export default RoutinesPage;
