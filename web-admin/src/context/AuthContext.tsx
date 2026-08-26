import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { cafmDataService, isSupabaseConfigured, supabase } from '../api/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isTechnician: boolean;
  canDelete: boolean;
  canClose: boolean;
  canEdit: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('shever_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Re-read the signed-in user's profile from the cloud on start-up, so a
    // role, name or deactivation changed on another device takes effect here.
    const revalidate = async () => {
      const cached = localStorage.getItem('shever_auth_user');
      if (cached && isSupabaseConfigured()) {
        try {
          const parsed = JSON.parse(cached);
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', parsed.id)
            .maybeSingle();

          if (cancelled) return;
          if (data && data.is_active === false) {
            localStorage.removeItem('shever_auth_user');
            setUser(null);
          } else if (data) {
            setUser(data as UserProfile);
            localStorage.setItem('shever_auth_user', JSON.stringify(data));
          }
        } catch (e) {
          // Offline: keep the cached session rather than locking the user out.
        }
      }
      if (!cancelled) setLoading(false);
    };

    revalidate();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Credentials are verified by the database (app_login RPC), never in the
   * browser. That is what makes a password change on one device take effect
   * everywhere — and why a stale local copy can no longer let anyone in.
   */
  const login = async (identifier: string, inputPassword?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const cleanId = identifier.trim().toLowerCase();

      if (isSupabaseConfigured()) {
        const { data, error: rpcError } = await supabase.rpc('app_login', {
          p_identifier: cleanId,
          p_password: inputPassword || '',
        });

        if (rpcError) {
          // A missing function means the database migration has not been run.
          const missingFn =
            rpcError.code === 'PGRST202' || /app_login/i.test(rpcError.message || '');
          setError(
            missingFn
              ? 'The server is not set up yet. Run database/05_cloud_sync_fix.sql in the Supabase SQL Editor.'
              : `Sign-in failed: ${rpcError.message}`
          );
          return false;
        }

        const profile = Array.isArray(data) ? data[0] : data;
        if (!profile) {
          setError('Incorrect username or password.');
          return false;
        }

        setUser(profile as UserProfile);
        localStorage.setItem('shever_auth_user', JSON.stringify(profile));
        return true;
      }

      // No cloud connection configured: local-only sign-in for offline demos.
      const users = await cafmDataService.getUsers();
      const matched = users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          (u.employee_id && u.employee_id.toLowerCase() === cleanId) ||
          u.id.toLowerCase() === cleanId
      );

      if (!matched) {
        setError('Incorrect username or password.');
        return false;
      }
      if (matched.password && inputPassword !== matched.password) {
        setError('Incorrect username or password.');
        return false;
      }

      setUser(matched);
      localStorage.setItem('shever_auth_user', JSON.stringify(matched));
      return true;
    } finally {
      setLoading(false);
    }
  };

  /**
   * setRole used to live here. It rewrote role_id in state and localStorage,
   * so anyone signed in could pick "Admin" from a dropdown and gain delete
   * rights - every permission below is derived from this value. Roles now come
   * from the profile row and are changed only on the Users screen.
   */

  const logout = () => {
    setUser(null);
    localStorage.removeItem('shever_auth_user');
    if (isSupabaseConfigured()) {
      supabase.auth.signOut();
    }
  };

  const role = user?.role_id || null;
  const isAdmin = role === 'admin';
  const isManager = role === 'fm_manager';
  const isSupervisor = role === 'supervisor';
  const isTechnician = role === 'technician';

  // Permission Matrix strictly enforcing Admin rights
  const canDelete = isAdmin;
  const canClose = isAdmin;
  const canManageUsers = isAdmin;
  const canEdit = isAdmin || isManager;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        error,
        login,
        logout,
        isAdmin,
        isManager,
        isSupervisor,
        isTechnician,
        canDelete,
        canClose,
        canEdit,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
