import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { routineService } from '../services/routineService';
import { workoutService } from '../services/workoutService';
import { progressService } from '../services/progressService';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  return `${mins} min`;
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [routines, setRoutines] = useState([]);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [progressSummary, setProgressSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [routinesRes, workoutsRes, progRes] = await Promise.all([
          routineService.getRoutines().catch(() => ({ data: [] })),
          workoutService.getWorkouts().catch(() => ({ data: [] })),
          progressService.getProgress().catch(() => ({ data: null })),
        ]);

        setRoutines(routinesRes.data || []);
        setRecentWorkouts((workoutsRes.data || []).slice(0, 3));
        setProgressSummary(progRes.data?.summary || null);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const todayRoutine = routines[0] || null;

  const handleStartWorkout = async (routineId) => {
    try {
      const res = await workoutService.createWorkout({
        routine_id: routineId || undefined,
        name: todayRoutine ? todayRoutine.name : `Workout • ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
      });
      navigate(`/app/workout/${res.data.id}`);
    } catch (err) {
      console.error('Error starting workout:', err);
    }
  };

  const streakDays = progressSummary?.streak_days !== undefined
    ? progressSummary.streak_days
    : (recentWorkouts.length > 0 ? 1 : 0);

  return (
    <div className="space-y-10 max-w-2xl mx-auto py-2 bg-[#FFFFFF]">
      {/* 1. Greeting & Hero Focus */}
      <div className="space-y-1">
        <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
          {getGreeting()}, {user?.name?.split(' ')[0] || 'Athlete'}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111111] uppercase">
          Ready for today's workout?
        </h1>
      </div>

      {/* 2. Today's Workout Hero Focus */}
      <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">
              Today's Session
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] tracking-tight uppercase">
              {todayRoutine ? todayRoutine.name : 'Full Body Strength'}
            </h2>
            <p className="text-xs text-[#6B7280]">
              {todayRoutine
                ? `${todayRoutine.exercise_count || 4} exercises · ~45 min`
                : 'Custom strength session · ~45 min'}
            </p>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-full border border-[#FDE68A]">
            <Flame className="w-3.5 h-3.5 fill-[#D97706]" />
            <span>{streakDays}d Streak</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => handleStartWorkout(todayRoutine?.id)}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Workout</span>
          </button>

          {todayRoutine && (
            <Link
              to={`/app/routines/${todayRoutine.id}`}
              className="w-full sm:w-auto px-5 py-3.5 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] font-semibold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition text-center"
            >
              Review Plan
            </Link>
          )}
        </div>
      </section>

      {/* 3. Recent Workouts List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
          <h3 className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
            Recent
          </h3>
          <Link
            to="/app/progress"
            className="text-xs font-bold text-[#111111] hover:underline transition"
          >
            View all
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-3">
            Complete your first workout to start building your history.
          </p>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {recentWorkouts.map((w) => (
              <div
                key={w.id}
                onClick={() => navigate(`/app/workout/${w.id}`)}
                className="py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] px-2 rounded-xl cursor-pointer transition group"
              >
                <div>
                  <h4 className="font-bold text-sm text-[#111111] group-hover:text-[#000000] uppercase tracking-tight transition">
                    {w.name}
                  </h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {new Date(w.completed_at || w.started_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {formatDuration(w.duration)} · {w.exercise_count || 0} {w.exercise_count === 1 ? 'exercise' : 'exercises'}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#111111] transition" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Progress Summary */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
          <h3 className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
            Progress Snapshot
          </h3>
          <Link
            to="/app/progress"
            className="text-xs font-bold text-[#111111] hover:underline transition"
          >
            Analytics
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-1">
          <div>
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
              Volume Lifted
            </span>
            <span className="text-lg font-black text-[#111111] font-tabular">
              {progressSummary?.total_volume_kg
                ? `${Number(progressSummary.total_volume_kg).toLocaleString()} kg`
                : '0 kg'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
              Total Sessions
            </span>
            <span className="text-lg font-black text-[#111111] font-tabular">
              {progressSummary?.total_workouts || 0}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
              Time Under Bar
            </span>
            <span className="text-lg font-black text-[#111111] font-tabular">
              {formatDuration(progressSummary?.total_seconds)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
