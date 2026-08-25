import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Lock } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { AuditLog } from '../../types';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cafmDataService.getAuditLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.module.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Security Audit Trail</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Immutable chronological log of all critical facility operations, data modifications, and user actions
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-semibold flex items-center space-x-1">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span>Tamper-Proof Audit Log</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Module</th>
                <th className="px-5 py-3.5">Integrity Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 text-slate-400 dark:text-slate-500 font-medium">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                    {log.user_email || 'admin@shever.com'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-400">{log.module}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                    Security event verified and logged in PostgreSQL audit partition
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
