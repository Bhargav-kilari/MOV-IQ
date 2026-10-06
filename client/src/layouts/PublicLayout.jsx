import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import movIqLogo from '../assets/images/mov-iq-logo.png';

export const PublicLayout = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111111] flex flex-col font-sans selection:bg-[#111111] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-[#FFFFFF]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src={movIqLogo}
              alt="MOV-IQ"
              className="h-10 w-auto object-contain transition group-hover:opacity-90"
            />
          </Link>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/app')}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#111111] hover:bg-[#000000] text-white transition shadow-sm"
              >
                Go to App
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4B5563] hover:text-[#111111] transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#111111] hover:bg-[#000000] text-white transition shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#FFFFFF]">
        <Outlet />
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#E5E7EB] py-6 text-center text-xs text-[#6B7280] bg-[#FFFFFF]">
        <div className="max-w-5xl mx-auto px-4 space-y-1">
          <div className="font-bold text-[#111111] uppercase tracking-wider">MOV-IQ &copy; {new Date().getFullYear()}</div>
          <div className="text-[11px] text-[#6B7280]">Move Smarter. Get Stronger.</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
