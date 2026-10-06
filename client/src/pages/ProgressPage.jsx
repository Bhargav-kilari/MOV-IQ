import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import PageHeader from '../components/common/PageHeader';
import { progressService } from '../services/progressService';
import { workoutService } from '../services/workoutService';

export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  return `${mins} min`;
};

export const ProgressPage = () => {
  const navigate = useNavigate();

  const [progressData, setProgressData] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const [progRes, workoutsRes] = await Promise.all([
          progressService.getProgress().catch(() => ({ data: null })),
          workoutService.getWorkouts().catch(() => ({ data: [] })),
        ]);
        setProgressData(progRes.data);
        setWorkouts(workoutsRes.data || []);
      } catch (err) {
        console.error('Error loading progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-xs text-[#6B7280]">Loading progress history...</div>;
  }

  const summary = progressData?.summary || {};

  const weeklyData = progressData?.weekly_activity?.map((w) => ({
    week: w.label || w.week_key,
    workouts: Number(w.workout_count) || 0,
    volume: Math.round(Number(w.weekly_volume) || 0),
  })) || [];

  const totalWeeklySessions = weeklyData.reduce((acc, curr) => acc + curr.workouts, 0);

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2 pb-16 bg-[#FFFFFF]">
      {/* Header */}
      <PageHeader
        title="Training Progress"
        subtitle="Review workout consistency, total volume progression, and history log."
      />

      {/* Key Metric Overview (Single source of truth from completed workouts) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-b border-[#E5E7EB]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Workouts Logged
          </span>
          <span className="text-2xl font-black text-[#111111] font-tabular mt-0.5 block">
            {summary.total_workouts || 0}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Total Tonnage
          </span>
          <span className="text-2xl font-black text-[#111111] font-tabular mt-0.5 block">
            {summary.total_volume_kg
              ? `${Number(summary.total_volume_kg).toLocaleString()} kg`
              : '0 kg'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Completed Sets
          </span>
          <span className="text-2xl font-black text-[#111111] font-tabular mt-0.5 block">
            {summary.total_completed_sets || 0}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
            Total Time
          </span>
          <span className="text-2xl font-black text-[#111111] font-tabular mt-0.5 block">
            {formatDuration(summary.total_seconds)}
          </span>
        </div>
      </div>

      {/* One Strong Chart: Weekly Workout Frequency (Exact 8 Continuous Weekly Buckets) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
            Workout Frequency (Past 8 Weeks)
          </h2>
          <span className="text-[11px] text-[#6B7280] font-tabular font-bold">
            {totalWeeklySessions} {totalWeeklySessions === 1 ? 'session' : 'sessions'} in last 8 weeks
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 h-52 w-full shadow-xs">
          {weeklyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#6B7280]">
              Complete workouts to view weekly activity charts.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="week" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7EB',
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    color: '#111111',
                  }}
                  formatter={(value, name) => [
                    `${value} ${value === 1 ? 'workout' : 'workouts'}`,
                    'Sessions',
                  ]}
                />
                <Bar dataKey="workouts" fill="#111111" radius={[4, 4, 0, 0]} name="Workouts" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Targeted Muscles Breakdown */}
      {progressData?.top_muscles?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
            Muscle Volume Distribution
          </h2>
          <div className="divide-y divide-[#E5E7EB]">
            {progressData.top_muscles.map((m, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-bold text-[#111111] uppercase">{m.muscle}</span>
                <span className="text-[#6B7280] font-tabular font-bold">{m.set_count} sets</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Chronological Workout History */}
      <section className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
          Workout History Log
        </h2>

        {workouts.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-4">No completed workouts logged yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {workouts.map((w) => (
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
                      year: 'numeric',
                    })}{' '}
                    · {w.exercise_count || 0} {w.exercise_count === 1 ? 'exercise' : 'exercises'} ·{' '}
                    {formatDuration(w.duration)}
                    {Number(w.total_volume) > 0 && ` · ${Number(w.total_volume).toLocaleString()} kg`}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#111111] transition" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProgressPage;
