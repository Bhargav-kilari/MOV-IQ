import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Dumbbell,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import movIqLogo from '../assets/images/mov-iq-logo.png';

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:py-16 text-center max-w-4xl mx-auto space-y-10 bg-[#FFFFFF]">
      {/* Brand Hero Logo */}
      <div className="flex justify-center">
        <img
          src={movIqLogo}
          alt="MOV-IQ"
          className="h-28 sm:h-36 w-auto object-contain"
        />
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[#111111] text-xs font-bold uppercase tracking-wider">
        <Activity className="w-3.5 h-3.5 text-[#111111]" />
        <span>Serious Full-Stack Strength Logging</span>
      </div>

      {/* Main Headline */}
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#111111] max-w-2xl mx-auto leading-[1.1]">
          Move Smarter. <br />
          <span className="text-[#111111]">
            Get Stronger.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-[#6B7280] max-w-xl mx-auto leading-relaxed">
          A high-performance workout tracking platform built for lifters. Streamlined set logging, custom routines, 1,324+ master exercise library, and personal record progression.
        </p>
      </div>

      {/* Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
        {isAuthenticated ? (
          <button
            onClick={() => navigate('/app')}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Open MOV-IQ App</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition"
            >
              Sign In
            </Link>
          </>
        )}
      </div>

      {/* Core Feature Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full pt-6">
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#111111] flex items-center justify-center">
            <Dumbbell className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-tight">Streamlined Workout Mode</h3>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Distraction-free interface with automatic rest timers, 1-tap set completion, and previous session benchmarks.
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#111111] flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-tight">1RM & Volume Analytics</h3>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Track personal records, estimated 1-rep maximums, and weekly training frequency over time.
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#111111] flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-tight">1,324+ Exercise Catalog</h3>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Master exercise catalog with animated demonstrations, muscle filters, and custom exercise creation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
