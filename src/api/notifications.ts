import { supabase, isSupabaseConfigured, loadStore, saveStore } from './supabase';

/**
 * In-app notifications. The database writes them (database/16_notifications_audit.sql):
 * job assigned / sent back / cancelled for technicians; new P1, ready to
 * verify and SLA breached for supervisors and managers. Each user can only
 * read and update their own.
 */

export interface AppNotification {
  id: string;
  user_id: string;
  kind: 'info' | 'alert' | 'success' | 'warning';
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}

const KEY = 'shever_notifications';

export const notificationService = {
  async mine(limit = 30): Promise<AppNotification[]> {
    if (!isSupabaseConfigured()) return loadStore<AppNotification[]>(KEY, []);
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) return [];
    return (data || []) as AppNotification[];
  },

  async markRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    if (!isSupabaseConfigured()) {
      saveStore(KEY, loadStore<AppNotification[]>(KEY, []).map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
      return;
    }
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  },
};

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
