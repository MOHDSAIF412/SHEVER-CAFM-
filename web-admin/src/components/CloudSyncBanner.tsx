import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff } from 'lucide-react';
import { cloudSync, isSupabaseConfigured, supabaseHost } from '../api/supabase';

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

  if (supabaseHost.includes('vercel.app')) {
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Incorrect Supabase URL configured.</strong> You entered your Vercel website URL (
          <code className="font-mono">{supabaseHost}</code>) instead of your Supabase Project URL.
          <br />
          <span className="opacity-90 mt-0.5 block">
            👉 In Vercel Project Settings ➜ Environment Variables, change <code className="font-mono">VITE_SUPABASE_URL</code> to your Supabase project URL (e.g.{' '}
            <code className="font-mono">https://xxxxxxxxxxxx.supabase.co</code> from Supabase Dashboard ➜ Project Settings ➜ API).
          </span>
        </span>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Not connected to cloud database.</strong> Changes are saved in this browser only. Set{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your Vercel project settings, then redeploy.
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
          <br />
          <span className="opacity-70">
            Connected to <code className="font-mono">{supabaseHost}</code> — check this is
            your Supabase project URL.
          </span>
        </span>
      </div>
    );
  }

  return null;
};
