import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ClipboardList,
  CalendarCheck2,
  Boxes,
  Building2,
  PlusCircle,
  Settings,
  Users,
  FileSpreadsheet,
  ArrowRight,
  Command,
  X,
} from 'lucide-react';
import { cafmDataService } from '../api/supabase';
import { PpmPlan, ppmService } from '../api/ppm';
import { useAuth } from '../context/AuthContext';
import { priorityOf } from '../utils/woFlow';
import { WorkOrder, Asset, Building } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isAdmin, isManager, isSupervisor } = useAuth();
  const lead = isAdmin || isManager || isSupervisor;
  const [query, setQuery] = useState('');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [plans, setPlans] = useState<PpmPlan[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      cafmDataService.getWorkOrders().then(setWorkOrders);
      cafmDataService.getAssets().then(setAssets);
      ppmService.plans().then(setPlans);
      cafmDataService.getBuildings().then(setBuildings);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Static navigation shortcuts
  const navigationItems = [
    { label: 'New work order', path: '/work-orders/new', icon: PlusCircle, category: 'Quick action' },
    { label: 'Work orders', path: '/work-orders', icon: ClipboardList, category: 'Go to' },
    { label: 'PPM plans', path: '/ppm/plans', icon: CalendarCheck2, category: 'Go to' },
    { label: 'PPM planner', path: '/ppm/planner', icon: CalendarCheck2, category: 'Go to' },
    { label: 'Assets', path: '/assets', icon: Boxes, category: 'Go to' },
    { label: 'Facility hierarchy', path: '/facilities', icon: Building2, category: 'Go to' },
    { label: 'Reports & KPIs', path: '/reports', icon: FileSpreadsheet, category: 'Go to' },
    ...(lead ? [{ label: 'Billing', path: '/billing', icon: FileSpreadsheet, category: 'Go to' }] : []),
    ...(isAdmin ? [{ label: 'Users', path: '/users', icon: Users, category: 'Go to' }] : []),
    ...(isAdmin || isManager ? [{ label: 'System settings', path: '/settings', icon: Settings, category: 'Go to' }] : []),
  ];

  // Filtered Results
  const q = query.toLowerCase().trim();

  const matchedNav = navigationItems.filter((item) =>
    item.label.toLowerCase().includes(q)
  );

  const matchedWos = q
    ? workOrders
        .filter(
          (w) =>
            w.wo_number.toLowerCase().includes(q) ||
            (w.problem_description || '').toLowerCase().includes(q) ||
            w.building?.name?.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  const matchedAssets = q
    ? assets
        .filter(
          (a) =>
            a.asset_number.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.manufacturer?.toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];

  const matchedPPM = q
    ? plans.filter((p) => p.ppm_code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const allResults = [
    ...matchedNav.map((n) => ({ type: 'nav', id: n.path, label: n.label, icon: n.icon, path: n.path, sub: n.category })),
    ...matchedWos.map((w) => ({
      type: 'wo',
      id: w.id,
      label: `${w.wo_number} — ${priorityOf(w)} · ${w.status}`,
      sub: (w.problem_description || '').slice(0, 60),
      icon: ClipboardList,
      path: `/work-orders/${w.id}`,
    })),
    ...matchedAssets.map((a) => ({
      type: 'asset',
      id: a.id,
      label: `${a.asset_number} — ${a.name}`,
      sub: `${a.building?.name || ''} | ${a.criticality} Criticality`,
      icon: Boxes,
      path: `/assets/${a.id}`,
    })),
    ...matchedPPM.map((p) => ({
      type: 'ppm',
      id: p.id,
      label: `${p.ppm_code} — ${p.title}`,
      sub: `${p.frequency} · next due ${p.next_due_date}`,
      icon: CalendarCheck2,
      path: `/ppm/plans`,
    })),
  ];

  const handleSelect = (item: { path: string }) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search Work Orders, Assets, PPM, Buildings..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <div className="flex items-center space-x-1 ml-2">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/50">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No matching work orders, assets or commands found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {allResults.map((item, idx) => {
                const IconComp = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}-${idx}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-teal-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{item.label}</div>
                        {item.sub && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            {item.sub}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span>
              Use <kbd className="font-semibold text-slate-600 dark:text-slate-400">↑</kbd> <kbd className="font-semibold text-slate-600 dark:text-slate-400">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-semibold text-slate-600 dark:text-slate-400">↵</kbd> to select
            </span>
          </div>
          <span>OCS Command Palette</span>
        </div>
      </div>
    </div>
  );
};
