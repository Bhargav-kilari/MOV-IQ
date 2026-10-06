import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import movIqLogo from '../assets/images/mov-iq-logo.png';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const result = await register(name, email, password, confirmPassword);
    setLoading(false);

    if (result.success) {
      navigate('/app', { replace: true });
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-[#FFFFFF]">
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E7EB] p-8 rounded-2xl shadow-sm space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block">
            <img
              src={movIqLogo}
              alt="MOV-IQ"
              className="h-16 w-auto mx-auto object-contain"
            />
          </Link>
          <div className="space-y-0.5">
            <h2 className="text-lg font-black text-[#111111] uppercase tracking-tight">Create Account</h2>
            <p className="text-xs text-[#6B7280]">Join MOV-IQ and start tracking your training</p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9CA3AF]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marcus Aurelius"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-[#111111] placeholder-[#9CA3AF] text-xs focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9CA3AF]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="athlete@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-[#111111] placeholder-[#9CA3AF] text-xs focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9CA3AF]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-[#111111] placeholder-[#9CA3AF] text-xs focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9CA3AF]" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-[#111111] placeholder-[#9CA3AF] text-xs focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#111111] hover:bg-[#000000] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#111111] font-bold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
