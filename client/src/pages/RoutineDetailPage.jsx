import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Trash2,
} from 'lucide-react';
import { routineService } from '../services/routineService';
import { workoutService } from '../services/workoutService';

export const RoutineDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoutine = async () => {
      try {
        setLoading(true);
        const res = await routineService.getRoutineById(id);
        setRoutine(res.data);
      } catch (err) {
        console.error('Failed to load routine:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutine();
  }, [id]);

  const handleStartWorkout = async () => {
    try {
      const res = await workoutService.createWorkout({ routine_id: id });
      navigate(`/app/workout/${res.data.id}`);
    } catch (err) {
      console.error('Failed to start workout:', err);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!window.confirm('Delete this routine?')) return;
    try {
      await routineService.deleteRoutine(id);
      navigate('/app/routines');
    } catch (err) {
      console.error('Failed to delete routine:', err);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-[#6B7280]">Loading workout plan...</div>;
  }

  if (!routine) {
    return (
      <div className="py-12 text-center text-xs text-[#6B7280]">
        Routine not found.{' '}
        <Link to="/app/routines" className="text-[#111111] font-bold underline">
          Return to routines
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-2 bg-[#FFFFFF]">
      {/* Back button */}
      <button
        onClick={() => navigate('/app/routines')}
        className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111111] transition uppercase font-bold tracking-wider"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Routines
      </button>

      {/* Routine Plan Header */}
      <div className="border-b border-[#E5E7EB] pb-6 space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">
          Training Plan
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#111111] uppercase tracking-tight">
          {routine.name}
        </h1>
        <p className="text-xs text-[#6B7280]">
          {routine.exercises?.length || 0} exercises · ~45 min
          {routine.description && ` · ${routine.description}`}
        </p>

        <div className="pt-4 flex items-center gap-3">
          <button
            onClick={handleStartWorkout}
            className="px-6 py-3 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 active:scale-95 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Workout</span>
          </button>

          <button
            onClick={handleDeleteRoutine}
            className="p-3 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-[#E5E7EB]"
            title="Delete Plan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sequence of Exercises - Clean Editorial Format */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Exercise Sequence
        </h2>

        {routine.exercises?.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-4">No exercises added to this plan yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {routine.exercises?.map((item, index) => (
              <div
                key={item.routine_exercise_id || index}
                className="py-4 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono font-bold text-[#9CA3AF] group-hover:text-[#111111] transition">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <Link
                      to={`/app/exercises/${item.exercise_id}`}
                      className="font-bold text-sm text-[#111111] hover:underline uppercase tracking-tight transition"
                    >
                      {item.name}
                    </Link>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 uppercase">
                      {item.equipment} · {item.primary_muscles?.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-[#111111] font-tabular">
                    {item.target_sets} × {item.target_reps}
                  </span>
                  {item.target_weight > 0 && (
                    <span className="text-[11px] text-[#6B7280] block font-tabular font-medium">
                      @{item.target_weight} kg
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutineDetailPage;
