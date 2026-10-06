import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Check,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [weightUnit, setWeightUnit] = useState('kg');
  const [defaultRest, setDefaultRest] = useState('90');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-2 pb-16 bg-[#FFFFFF]">
      {/* Header */}
      <PageHeader
        title="Settings"
        subtitle="Manage your workout preferences, unit systems, and security."
      />

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* 1. Account Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Account
        </h2>
        <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          <div className="py-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Name</span>
            <span className="font-bold text-[#111111]">{user?.name}</span>
          </div>
          <div className="py-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Email</span>
            <span className="font-bold text-[#111111]">{user?.email}</span>
          </div>
          <Link
            to="/app/profile"
            className="py-3 px-2 flex items-center justify-between hover:bg-[#F9FAFB] rounded-xl transition text-xs"
          >
            <span className="font-bold text-[#111111] uppercase">Edit Profile Information</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </Link>
        </div>
      </section>

      {/* 2. Workout Preferences Section */}
      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Workout Preferences
        </h2>

        <div className="space-y-3 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB] py-1">
          <div className="pt-2 px-2 flex items-center justify-between text-xs">
            <span className="text-[#4B5563] font-medium">Weight Units</span>
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
              className="bg-[#FFFFFF] border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-xs font-bold text-[#111111] focus:outline-none focus:border-[#111111]"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </div>

          <div className="pt-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#4B5563] font-medium">Default Rest Timer</span>
            <select
              value={defaultRest}
              onChange={(e) => setDefaultRest(e.target.value)}
              className="bg-[#FFFFFF] border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-xs font-bold text-[#111111] focus:outline-none focus:border-[#111111]"
            >
              <option value="60">60s (1 min)</option>
              <option value="90">90s (1.5 min)</option>
              <option value="120">120s (2 min)</option>
              <option value="180">180s (3 min)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* 3. Appearance */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Appearance
        </h2>
        <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          <div className="py-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Theme</span>
            <span className="font-bold text-[#111111]">Premium White & Black (Active)</span>
          </div>
        </div>
      </section>

      {/* 4. Privacy & System */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Privacy & Database
        </h2>
        <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          <div className="py-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Database Engine</span>
            <span className="font-bold text-[#111111]">PostgreSQL (Relational)</span>
          </div>
          <div className="py-3 px-2 flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Catalog Size</span>
            <span className="font-bold text-[#111111]">1,334 Exercises</span>
          </div>
        </div>
      </section>

      {/* 5. Account Actions / Logout */}
      <section className="space-y-3 pt-2">
        <div className="border-t border-[#E5E7EB] pt-4">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-red-200 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out of MOV-IQ</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
