import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Sun,
  Moon,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles,
  CheckCircle2,
  Boxes,
  CalendarCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isDark, setTheme } = useTheme();

  const [identifier, setIdentifier] = useState('admin@shever.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(identifier, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid User ID / Email or Password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Left Showcase Side with Real CAFM Brand Artwork (Natural Aspect Ratio) */}
      <div className="hidden lg:flex lg:w-[56%] bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 relative overflow-hidden flex-col justify-between p-8 xl:p-12 text-white border-r border-slate-800/80">
        {/* Ambient subtle glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Branding Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/shever-logo-Cg3sbF_E.png"
              alt="Shever Technical"
              className="w-10 h-10 rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-md object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <span className="text-base font-extrabold tracking-widest text-white block leading-tight">
                SHEVER TECHNICAL
              </span>
              <span className="text-[10px] font-semibold text-teal-400 tracking-wider uppercase">
                Facilities Management Platform
              </span>
            </div>
          </div>

          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/15 text-xs text-teal-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Enterprise v2.4</span>
          </div>
        </div>

        {/* Center: Beautiful CAFM Artwork Showcase */}
        <div className="relative z-10 my-auto py-6 space-y-5">
          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-slate-900/80 group">
            <img
              src="/login-banner.png"
              alt="Shever CAFM Dashboard Showcase"
              className="w-full h-auto object-contain max-h-[460px] mx-auto transition-transform duration-500 group-hover:scale-[1.01]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-white">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="font-bold">Intelligent Facilities Operations</span>
              </div>
              <span className="text-[11px] text-teal-300 font-semibold bg-teal-950/80 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                100% Asset Uptime
              </span>
            </div>
          </div>

          {/* Value Highlights Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="font-bold text-white flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>99.8% SLA Assurance</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Real-time resolution deadlines</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="font-bold text-white flex items-center space-x-1.5">
                <Boxes className="w-3.5 h-3.5 text-teal-400" />
                <span>QR Asset Registry</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Complete equipment lifecycle</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="font-bold text-white flex items-center space-x-1.5">
                <CalendarCheck2 className="w-3.5 h-3.5 text-teal-400" />
                <span>PPM Automation</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Scheduled preventive checks</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          <span>Dubai, United Arab Emirates</span>
          <span className="text-emerald-400 font-semibold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>All Systems Operational</span>
          </span>
        </div>
      </div>

      {/* 2. Right Side: Clean, Simple & Elegant Sign In Form */}
      <div className="w-full lg:w-[44%] flex flex-col justify-between p-6 sm:p-10 xl:p-14 bg-white dark:bg-slate-900 transition-colors">
        {/* Top Controls with Theme Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 lg:hidden">
            <img
              src="/shever-logo-Cg3sbF_E.png"
              alt="Shever Technical"
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">SHEVER TECHNICAL</span>
          </div>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors ml-auto shadow-2xs"
            title="Toggle Day/Night Mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

        {/* Center: Clean & Simple Sign In Form */}
        <div className="max-w-md w-full mx-auto my-auto py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Sign In
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Welcome back! Please enter your details to sign in.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                User ID or Email
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter User ID or Email"
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-teal-600 dark:text-teal-400 hover:underline font-semibold text-[11px]"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 dark:bg-slate-950 dark:border-slate-800"
                />
                <span className="text-slate-600 dark:text-slate-400">Remember on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 active:from-teal-700 active:to-teal-600 text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
          © 2026 Shever Technical Services. All rights reserved.
        </div>
      </div>
    </div>
  );
};
