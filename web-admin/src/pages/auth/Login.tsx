import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CalendarCheck2,
  Eye,
  EyeOff,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'SLA tracking',
    body: 'Live resolution deadlines, with escalation before a job breaches.',
  },
  {
    icon: Boxes,
    title: 'Asset registry',
    body: 'QR-tagged equipment with its full maintenance history.',
  },
  {
    icon: CalendarCheck2,
    title: 'Planned maintenance',
    body: 'Recurring schedules with technician checklists and sign-off.',
  },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  const { isDark, setTheme } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      if (success) navigate('/dashboard');
      // On failure the reason is already in authError (wrong password vs.
      // database not set up) and is rendered below.
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-slate-900 transition-colors lg:flex-row dark:bg-slate-950 dark:text-slate-100">
      {/* ------------------------------------------------------------------ */}
      {/* Brand panel                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative hidden overflow-hidden border-r border-slate-800/60 bg-slate-950 p-10 text-white lg:flex lg:w-[46%] lg:flex-col xl:p-14">
        {/* Ambient brand light */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-teal-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-sky-500/10 blur-3xl"
        />
        {/* The ascending-bar motif from the mark, used as quiet texture */}
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -right-16 top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 text-teal-400/[0.05]"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x={40 + i * 20}
              y={100 - (i + 1) * 13}
              width="8"
              height={(i + 1) * 26}
              rx="4"
              fill="currentColor"
            />
          ))}
        </svg>

        {/* Brand lockup */}
        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/shever-logo.png"
            alt="Shever Technical Services"
            className="h-12 w-12 rounded-xl object-contain shadow-lg ring-1 ring-white/15"
          />
          <div>
            <span className="block text-[15px] font-bold leading-tight tracking-[0.18em] text-white">
              SHEVER TECHNICAL
            </span>
            <span className="text-[11px] font-medium tracking-wide text-teal-400">
              Facilities Management Platform
            </span>
          </div>
        </div>

        {/* Statement */}
        <div className="relative z-10 my-auto max-w-lg py-10">
          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
            Every asset, work order and
            <span className="text-teal-400"> inspection</span> in one place.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-400">
            The operations platform your engineers, supervisors and clients all work
            from &mdash; from the moment a fault is reported to the signed-off report.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-400/10">
                  <Icon className="h-4 w-4 text-teal-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[12px] text-slate-500">
          <span>Dubai, United Arab Emirates</span>
          <span>&copy; 2026 Shever Technical Services</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sign-in panel                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex w-full flex-col bg-white p-6 transition-colors sm:p-10 lg:w-[54%] xl:p-14 dark:bg-slate-900">
        {/* Mobile brand + theme toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img
              src="/shever-logo.png"
              alt="Shever Technical Services"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="text-sm font-bold tracking-wide text-slate-900 dark:text-white">
              SHEVER TECHNICAL
            </span>
          </div>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="ml-auto rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Form, optically centred in the remaining space */}
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Use your work email or employee ID.
            </p>
          </div>

          {(error || authError) && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-300"
              >
                Email or Employee ID
              </label>
              <div className="relative">
                <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@shevertechnical.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3.5 text-sm text-slate-900 placeholder-slate-400 transition-shadow focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-semibold text-teal-600 hover:underline dark:text-teal-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 transition-shadow focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 pt-0.5 text-[13px] text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-500 hover:shadow-teal-500/25 active:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="border-t border-slate-100 pt-6 text-center text-[12px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          Having trouble signing in? Contact your system administrator.
        </p>
      </div>
    </div>
  );
};
