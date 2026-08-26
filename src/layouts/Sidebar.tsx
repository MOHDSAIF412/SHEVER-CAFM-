import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarCheck2,
  CalendarDays,
  Boxes,
  Building2,
  Package,
  FileSpreadsheet,
  Gauge,
  Users,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Plus,
  Radio,
  ClipboardCheck,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  /** Drawer state on small screens, where the sidebar sits over the content. */
  mobileOpen?: boolean;
  closeMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, mobileOpen = false, closeMobile }) => {
  const { user, role, isAdmin } = useAuth();

  const navigationGroups = [
    {
      title: 'CORE',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { name: 'Work Orders', path: '/work-orders', icon: ClipboardList },
        { name: 'PPM Schedules', path: '/ppm/schedules', icon: CalendarCheck2 },
        { name: 'PPM Plans', path: '/ppm/plans', icon: CalendarDays },
        { name: 'PPM Checklists', path: '/ppm/checklists', icon: ClipboardCheck },
      ],
    },
    {
      title: 'ASSETS & SITES',
      items: [
        { name: 'Asset Registry', path: '/assets', icon: Boxes },
        { name: 'Facility Hierarchy', path: '/facilities/buildings', icon: Building2 },
        { name: 'Materials & Spares', path: '/materials', icon: Package },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { name: 'Reports & Export', path: '/reports', icon: FileSpreadsheet },
        { name: 'PPM Compliance', path: '/ppm/dashboard', icon: Gauge },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'ADMINISTRATION',
            items: [
              { name: 'Users & Roles', path: '/users', icon: Users },
              { name: 'Trades & Types', path: '/settings/categories', icon: Layers },
              { name: 'System Settings', path: '/settings', icon: Settings },
              { name: 'Audit Trail', path: '/audit', icon: ShieldAlert },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Backdrop, phones only. The sidebar used to be a permanent 240px
          column, which on a 375px screen left the content 135px wide. */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        onClick={(e) => {
          // Tapping a link should close the drawer on a phone.
          if (mobileOpen && (e.target as HTMLElement).closest('a')) closeMobile?.();
        }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-200 select-none dark:bg-slate-950 lg:relative lg:z-30 lg:translate-x-0 lg:transition-all ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-60 lg:w-16' : 'w-60'}`}
      >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-3.5 border-b border-slate-800/80 bg-slate-950/40">
        <NavLink to="/" className="flex items-center space-x-2.5 overflow-hidden">
          <img
            src="/shever-logo.png"
            alt="Shever"
            className="w-7 h-7 rounded-md object-contain shrink-0 bg-white/5 p-0.5 border border-white/10"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold tracking-wider text-white truncate">
                SHEVER
              </span>
              <span className="text-[9px] font-semibold text-teal-400 tracking-wider truncate uppercase">
                CAFM Enterprise
              </span>
            </div>
          )}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <h4 className="px-2.5 text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-teal-500/15 text-teal-400 font-semibold border border-teal-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    } ${collapsed ? 'justify-center' : 'space-x-2.5'}`
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0`} />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom User / Cloud Status Section */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/60">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-teal-600/30 border border-teal-500/40 text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {user?.full_name || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize truncate">
                  {role ? role.replace('_', ' ') : 'Admin'}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1" title="Connected to CAFM Cloud">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`${user?.full_name} (${role})`}>
            <div className="w-7 h-7 rounded-full bg-teal-600/30 border border-teal-500/40 text-teal-300 font-bold text-xs flex items-center justify-center">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        )}
      </div>
      </aside>
    </>
  );
};
