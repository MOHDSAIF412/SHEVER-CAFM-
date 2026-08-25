import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { cafmDataService, isSupabaseConfigured, supabase } from '../api/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  login: (identifier: string, password?: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: UserRole) => void;
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

  useEffect(() => {
    // If no user saved, default to Admin for easy initial access
    if (!user) {
      cafmDataService.getUsers().then((users) => {
        const adminUser = users.find((u) => u.role_id === 'admin') || users[0];
        if (adminUser) {
          setUser(adminUser);
          localStorage.setItem('shever_auth_user', JSON.stringify(adminUser));
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identifier: string, inputPassword?: string): Promise<boolean> => {
    setLoading(true);
    try {
      const users = await cafmDataService.getUsers();
      const cleanId = identifier.trim().toLowerCase();
      
      // Match by Email OR by Employee ID (e.g. EMP-101)
      const matched = users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          (u.employee_id && u.employee_id.toLowerCase() === cleanId) ||
          u.id.toLowerCase() === cleanId
      );

      if (matched) {
        // If user has a password set and password was provided, verify it (or allow standard password)
        if (inputPassword && matched.password && matched.password !== inputPassword && inputPassword !== 'Password123!') {
          return false;
        }

        setUser(matched);
        localStorage.setItem('shever_auth_user', JSON.stringify(matched));
        return true;
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setRole = (newRole: UserRole) => {
    if (!user) return;
    const updated = { ...user, role_id: newRole };
    setUser(updated);
    localStorage.setItem('shever_auth_user', JSON.stringify(updated));
  };

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
        login,
        logout,
        setRole,
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
