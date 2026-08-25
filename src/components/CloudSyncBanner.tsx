import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff } from 'lucide-react';
import { cloudSync, isSupabaseConfigured } from '../api/supabase';

/**
 * Shows a banner whenever changes are NOT reaching the database, so a failed
 * save can never look like a successful one. Renders nothing while sync is
 * healthy.
 */
export const CloudSyncBanner: React.FC = () => {
  const [, force] = useState(0);

  useEffect(() => {
    const unsubscribe = cloudSync.subscribe(() => force((n) => n + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Not connected to the database.</strong> Changes are saved only in this
          browser and will not appear on other devices. Set{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your Vercel project
          settings, then redeploy.
        </span>
      </div>
    );
  }

  if (cloudSync.lastError) {
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Database sync problem.</strong> {cloudSync.lastError}
        </span>
      </div>
    );
  }

  return null;
};
