import React from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  Dumbbell,
  TrendingUp,
  User,
  Settings,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import movIqLogo from '../assets/images/mov-iq-logo.png';

export const AppLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const primaryNav = [
    { name: 'Home', path: '/app', icon: Home, end: true },
    { name: 'AI Assistance', path: '/app/ai-assistance', icon: Sparkles },
    { name: 'Routines', path: '/app/routines', icon: ClipboardList },
    { name: 'Exercises', path: '/app/exercises', icon: Dumbbell },
    { name: 'Progress', path: '/app/progress', icon: TrendingUp },
  ];

  const secondaryNav = [
    { name: 'Profile', path: '/app/profile', icon: User },
    { name: 'Settings', path: '/app/settings', icon: Settings },
  ];

  const mobileNav = [
    { name: 'Home', path: '/app', icon: Home, end: true },
    { name: 'AI Coach', path: '/app/ai-assistance', icon: Sparkles },
    { name: 'Routines', path: '/app/routines', icon: ClipboardList },
    { name: 'Exercises', path: '/app/exercises', icon: Dumbbell },
    { name: 'Progress', path: '/app/progress', icon: TrendingUp },
    { name: 'Profile', path: '/app/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111111] flex flex-col md:flex-row font-sans selection:bg-[#111111] selection:text-white">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#E5E7EB] bg-[#FFFFFF] p-5 sticky top-0 h-screen shrink-0">
        {/* Brand / Logo */}
        <div className="mb-6 px-1">
          <Link to="/app" className="flex items-center gap-3 group">
            <img
              src={movIqLogo}
              alt="MOV-IQ"
              className="h-12 w-auto object-contain transition group-hover:opacity-90"
            />
          </Link>
        </div>

        {/* Quick Workout Button (Black Primary Action) */}
        <button
          onClick={() => navigate('/app/workout/new')}
          className="w-full mb-6 py-2.5 px-3.5 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Quick Workout</span>
        </button>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                    isActive
                      ? 'bg-[#F3F4F6] text-[#111111] border border-[#E5E7EB]'
                      : 'text-[#4B5563] hover:text-[#111111] hover:bg-[#F9FAFB]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Lower Navigation (Profile & Settings) */}
        <div className="pt-6 mt-auto border-t border-[#E5E7EB] space-y-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                    isActive
                      ? 'bg-[#F3F4F6] text-[#111111] font-bold border border-[#E5E7EB]'
                      : 'text-[#4B5563] hover:text-[#111111] hover:bg-[#F9FAFB]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          <div className="pt-3 px-3 flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="truncate font-medium">{user?.name || 'Athlete'}</span>
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden border-b border-[#E5E7EB] bg-[#FFFFFF]/95 backdrop-blur px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <Link to="/app" className="flex items-center gap-2">
          <img
            src={movIqLogo}
            alt="MOV-IQ"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <button
          onClick={() => navigate('/app/workout/new')}
          className="px-2.5 py-1 bg-[#111111] text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1"
        >
          <Plus className="w-3 h-3 stroke-[2.5]" />
          <span>Workout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 md:pb-8 bg-[#FFFFFF]">
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF]/95 backdrop-blur border-t border-[#E5E7EB] px-3 py-2 flex items-center justify-between pb-safe">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 text-[10px] uppercase tracking-wider font-semibold transition ${
                  isActive
                    ? 'text-[#111111] font-bold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default AppLayout;
