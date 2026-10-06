import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings,
  ChevronRight,
  LogOut,
  Check,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { progressService } from '../services/progressService';

export const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [fitnessGoal, setFitnessGoal] = useState(user?.fitness_goal || 'General Fitness');
  const [experienceLevel, setExperienceLevel] = useState(user?.experience_level || 'Beginner');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setFitnessGoal(user.fitness_goal || 'General Fitness');
      setExperienceLevel(user.experience_level || 'Beginner');
    }

    const loadStats = async () => {
      try {
        const res = await progressService.getProgress();
        setSummary(res.data?.summary || null);
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };

    loadStats();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const res = await userService.updateProfile({
        name,
        fitness_goal: fitnessGoal,
        experience_level: experienceLevel,
      });
      updateUser(res.data.user);
      setIsEditing(false);
      setMessage('Profile updated.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-2 pb-16 bg-[#FFFFFF]">
      {/* Header */}
      <PageHeader
        title="Athlete Profile"
        subtitle="Manage your athletic identity, training goals, and preferences."
        action={
          <Link
            to="/app/settings"
            className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] font-semibold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition flex items-center gap-1.5 shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Link>
        }
      />

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {/* Fitness Identity Header */}
      <section className="flex items-start justify-between border-b border-[#E5E7EB] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#111111] flex items-center justify-center font-black text-xl text-white">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-[#111111] uppercase tracking-tight">
              {user?.name || 'Athlete'}
            </h2>
            <p className="text-xs text-[#6B7280]">{user?.email}</p>
            <p className="text-[11px] text-[#111111] font-bold uppercase tracking-wider pt-0.5">
              {user?.fitness_goal || 'General Fitness'} · {user?.experience_level || 'Beginner'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-bold uppercase tracking-wider text-[#111111] hover:underline transition"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </section>

      {/* Edit Profile Form */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                Fitness Focus
              </label>
              <select
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
              >
                <option value="Hypertrophy / Muscle Building">Hypertrophy</option>
                <option value="Strength / Powerlifting">Strength</option>
                <option value="Fat Loss & Conditioning">Conditioning</option>
                <option value="General Fitness">General Fitness</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
              >
                <option value="Beginner">Beginner (&lt; 1 yr)</option>
                <option value="Intermediate">Intermediate (1–3 yrs)</option>
                <option value="Advanced">Advanced (3+ yrs)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Lifetime Fitness Stats */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Career Performance
        </h3>
        <div className="grid grid-cols-3 gap-3 py-1">
          <div className="border border-[#E5E7EB] bg-[#FFFFFF] rounded-xl p-4 shadow-xs">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] block">
              Workouts
            </span>
            <span className="text-xl font-black text-[#111111] font-tabular mt-0.5 block">
              {summary?.total_workouts || 0}
            </span>
          </div>

          <div className="border border-[#E5E7EB] bg-[#FFFFFF] rounded-xl p-4 shadow-xs">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] block">
              Total Volume
            </span>
            <span className="text-xl font-black text-[#111111] font-tabular mt-0.5 block">
              {summary?.total_volume_kg ? `${Number(summary.total_volume_kg).toLocaleString()} kg` : '0 kg'}
            </span>
          </div>

          <div className="border border-[#E5E7EB] bg-[#FFFFFF] rounded-xl p-4 shadow-xs">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] block">
              Time Under Bar
            </span>
            <span className="text-xl font-black text-[#111111] font-tabular mt-0.5 block">
              {summary?.total_minutes || 0} min
            </span>
          </div>
        </div>
      </section>

      {/* Settings Navigation List */}
      <section className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Account & App
        </h3>
        <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          <Link
            to="/app/settings"
            className="py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] px-2 rounded-xl transition"
          >
            <span className="text-xs font-bold text-[#111111] uppercase">Workout & Unit Preferences</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full py-3.5 px-2 flex items-center justify-between text-red-600 hover:bg-red-50 rounded-xl font-bold text-xs uppercase tracking-wider transition"
          >
            <span>Log out</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
