import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  Laptop,
  ChevronDown,
  Menu,
  LogOut,
  User,
  Shield,
  ClipboardList,
  CalendarDays,
  Boxes,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cafmDataService } from '../api/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';

interface NavbarProps {
  onOpenCommandPalette: () => void;
  /** Opens the navigation drawer on small screens. */
  onOpenMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCommandPalette, onOpenMenu }) => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Profile and credential states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [myName, setMyName] = useState(user?.full_name || 'Admin');
  const [myId, setMyId] = useState(user?.employee_id || '');
  const [myEmail, setMyEmail] = useState(user?.email || 'admin@shever.com');
  const [myPassword, setMyPassword] = useState('');
  const [myConfirmPassword, setMyConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setMyName(user.full_name);
      setMyId(user.employee_id || '');
      setMyEmail(user.email);
    }
  }, [user]);

  /**
   * Saves your own profile.
   *
   * This used to write the new name, email and password to localStorage and
   * nothing else, then report success. The database kept the old values, so
   * signing in anywhere - another browser, a phone, or here after clearing the
   * session - still needed the OLD email and password, and the new ones simply
   * did not work. It now goes through the data service like every other write.
   */
  const handleUpdateMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    if (myPassword && myPassword.length < 6) {
      setProfileError('Password must be at least 6 characters.');
      return;
    }
    if (myPassword && myPassword !== myConfirmPassword) {
      setProfileError('Passwords do not match.');
      return;
    }
    if (!user) return;

    setProfileSaving(true);
    try {
      await cafmDataService.updateUser(user.id, {
        full_name: myName.trim(),
        employee_id: myId.trim() || undefined,
        email: myEmail.trim().toLowerCase(),
        ...(myPassword ? { password: myPassword } : {}),
      });

      setMyPassword('');
      setMyConfirmPassword('');
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        setShowProfileModal(false);
        // Re-read the session so the header reflects what was actually saved.
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setProfileError(
        err?.message || 'Could not save your profile to the database. Nothing was changed.'
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const quickCreateRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setShowQuickCreate(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = [
    { id: 1, title: 'Emergency WO-2026-000003 logged', time: '10m ago', type: 'alert' },
    { id: 2, title: 'Rashid Khan completed AHU-001 PPM', time: '25m ago', type: 'success' },
    { id: 3, title: 'Chiller Unit #1 Quarterly PPM due today', time: '1h ago', type: 'warning' },
  ];

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-20 transition-colors">
      {/* Left: Global Command Search Button */}
      <div className="flex items-center space-x-2 max-w-xs w-full">
        {/* Drawer trigger - phones and tablets only */}
        <button
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700/60 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Center: Shifted Facilities Command Greeting & Status */}
      <div className="hidden md:flex items-center space-x-3 text-xs bg-slate-50 dark:bg-slate-800/60 py-1.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Good Day, {user?.full_name?.replace(/\s*\([^)]*\)/g, '') || 'Saif Al-Nuaimi'}</span>
          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 rounded border border-teal-200/50 dark:border-teal-800/50">
            {user?.role_id ? user.role_id.replace('_', ' ').toUpperCase() : 'ADMIN'}
          </span>
        </div>
        {/* "Portfolio Health: 98.5% SLA" used to sit here as a hard-coded
            figure, shown even on an empty system. Removed rather than faked -
            the real SLA number is on the dashboard, measured from the data. */}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2">
        {/* Quick Create Dropdown */}
        <div className="relative" ref={quickCreateRef}>
          <button
            onClick={() => setShowQuickCreate(!showQuickCreate)}
            className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {showQuickCreate && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <Link
                to="/work-orders/new"
                onClick={() => setShowQuickCreate(false)}
                className="flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ClipboardList className="w-4 h-4 text-teal-600 mr-2.5" />
                <div>
                  <div className="font-semibold">New Work Order</div>
                  <div className="text-[10px] text-slate-400">Log reactive service ticket</div>
                </div>
              </Link>
              <Link
                to="/ppm/plans"
                onClick={() => setShowQuickCreate(false)}
                className="flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <CalendarDays className="w-4 h-4 text-indigo-600 mr-2.5" />
                <div>
                  <div className="font-semibold">New PPM Plan</div>
                  <div className="text-[10px] text-slate-400">Define preventive schedule</div>
                </div>
              </Link>
              <Link
                to="/assets"
                onClick={() => setShowQuickCreate(false)}
                className="flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Boxes className="w-4 h-4 text-amber-600 mr-2.5" />
                <div>
                  <div className="font-semibold">Register Asset</div>
                  <div className="text-[10px] text-slate-400">Equipment QR tag registry</div>
                </div>
              </Link>
              <Link
                to="/users"
                onClick={() => setShowQuickCreate(false)}
                className="flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <UserPlus className="w-4 h-4 text-purple-600 mr-2.5" />
                <div>
                  <div className="font-semibold">Add User</div>
                  <div className="text-[10px] text-slate-400">Staff role access</div>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Day / Night Theme Toggle */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">Live Notifications</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold cursor-pointer">
                  Mark all read
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-start space-x-2.5"
                  >
                    {n.type === 'alert' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                    {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                    {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                    <div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{n.title}</div>
                      <div className="text-[10px] text-slate-400">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* A role switcher used to sit here. It let anyone signed in pick
            "Admin" and immediately gain delete rights, because every
            permission check reads that value. Your role now comes from your
            profile and cannot be changed from the interface. */}
        <div className="hidden md:flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
          <span
            className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="Your role is set by an administrator on the Users screen"
          >
            {(role || '').replace('_', ' ').toUpperCase() || 'USER'}
          </span>
        </div>

        {/* Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2 p-1 pl-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-slate-100">{user?.full_name || 'Admin'}</div>
                <div className="text-[10px] text-slate-400">{user?.email || 'admin@shever.com'}</div>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfileModal(true);
                }}
                className="w-full flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
              >
                <User className="w-4 h-4 text-teal-600 mr-2" />
                <span>My Profile & ID</span>
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfileModal(true);
                }}
                className="w-full flex items-center px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
              >
                <Shield className="w-4 h-4 text-amber-500 mr-2" />
                <span>Change Password</span>
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* My Profile & Password Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <User className="w-4 h-4 text-teal-600" />
                <span>My Profile & Credentials</span>
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <LogOut className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {profileSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                  Profile & Password Updated!
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Your changes have been saved to your active session.
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateMyProfile} className="space-y-3 text-xs">
                {profileError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs">
                    {profileError}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">User ID / Employee Code</label>
                  <input
                    type="text"
                    value={myId}
                    onChange={(e) => setMyId(e.target.value)}
                    placeholder="e.g. EMP-101"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Login Email / Username</label>
                  <input
                    type="email"
                    required
                    value={myEmail}
                    onChange={(e) => setMyEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-2">
                    Change Password (optional)
                  </span>
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="New password (leave blank to keep current)"
                      value={myPassword}
                      onChange={(e) => setMyPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    />
                    {myPassword && (
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={myConfirmPassword}
                        onChange={(e) => setMyConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow transition-colors"
                  >
                    {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
