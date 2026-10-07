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

    // The signed-in user comes from the Supabase Auth session, never from
    // localStorage alone: the database checks the session's token on every
    // request, so a hand-edited local copy cannot grant access.
    const loadProfileFor = async (authUserId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      return data as UserProfile | null;
    };

    const revalidate = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const authUser = sessionData.session?.user;
          const profile = authUser ? await loadProfileFor(authUser.id) : null;
          if (cancelled) return;
          if (profile && profile.is_active !== false) {
            setUser(profile);
            localStorage.setItem('shever_auth_user', JSON.stringify(profile));
          } else {
            if (authUser) await supabase.auth.signOut();
            setUser(null);
            localStorage.removeItem('shever_auth_user');
          }
        } catch (e) {
          // Offline: keep the cached profile; the database still requires the
          // stored session token for any read or write.
        }
      }
      if (!cancelled) setLoading(false);
    };

    revalidate();

    const { data: sub } = isSupabaseConfigured()
      ? supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            localStorage.removeItem('shever_auth_user');
          }
        })
      : { data: null };

    return () => {
      cancelled = true;
      sub?.subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign-in goes through Supabase Auth. The identifier may be an email or an
   * employee ID; an employee ID is turned into its email by cafm_login_email.
   */
  const login = async (identifier: string, inputPassword?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const cleanId = identifier.trim().toLowerCase();

      if (isSupabaseConfigured()) {
        let email = cleanId;
        if (!cleanId.includes('@')) {
          const { data: found } = await supabase.rpc('cafm_login_email', { p_identifier: cleanId });
          if (!found) {
            setError('Incorrect username or password.');
            return false;
          }
          email = String(found);
        }

        const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: inputPassword || '',
        });
        if (signInError || !signIn.user) {
          setError(
            /fetch|network/i.test(signInError?.message || '')
              ? `Sign-in failed: ${signInError?.message}`
              : 'Incorrect username or password.'
          );
          return false;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', signIn.user.id)
          .maybeSingle();

        if (!profile || profile.is_active === false) {
          await supabase.auth.signOut();
          setError('This account does not have access to the CAFM. Contact your administrator.');
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
