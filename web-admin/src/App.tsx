import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Dashboard } from './pages/dashboard/Dashboard';
import { WorkOrdersList } from './pages/work-orders/WorkOrdersList';
import { CreateWorkOrder } from './pages/work-orders/CreateWorkOrder';
import { WorkOrderDetail } from './pages/work-orders/WorkOrderDetail';
import { PPMDashboard } from './pages/ppm/PPMDashboard';
import { PPMSchedulesList } from './pages/ppm/PPMSchedulesList';
import { PPMPlansList } from './pages/ppm/PPMPlansList';
import { PPMChecklists } from './pages/ppm/PPMChecklists';
import { AssetsList } from './pages/assets/AssetsList';
import { AssetDetail } from './pages/assets/AssetDetail';
import { BuildingsList } from './pages/facilities/BuildingsList';
import { MaterialsList } from './pages/materials/MaterialsList';
import { ReportsCenter } from './pages/reports/ReportsCenter';
import { UsersList } from './pages/users/UsersList';
import { SystemSettings } from './pages/settings/SystemSettings';
import { CategoriesList } from './pages/settings/CategoriesList';
import { AuditLogs } from './pages/audit/AuditLogs';

import { ThemeProvider } from './context/ThemeContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected CAFM Portal Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Work Orders */}
              <Route path="work-orders" element={<WorkOrdersList />} />
              <Route path="work-orders/new" element={<CreateWorkOrder />} />
              <Route path="work-orders/:id" element={<WorkOrderDetail />} />

              {/* PPM Module */}
              <Route path="ppm/dashboard" element={<PPMDashboard />} />
              <Route path="ppm/schedules" element={<PPMSchedulesList />} />
              <Route path="ppm/plans" element={<PPMPlansList />} />
              <Route path="ppm/checklists" element={<PPMChecklists />} />

              {/* Assets */}
              <Route path="assets" element={<AssetsList />} />
              <Route path="assets/:id" element={<AssetDetail />} />

              {/* Facilities Hierarchy */}
              <Route path="facilities/buildings" element={<BuildingsList />} />

              {/* Materials */}
              <Route path="materials" element={<MaterialsList />} />

              {/* Reports */}
              <Route path="reports" element={<ReportsCenter />} />

              {/* Administration & Security */}
              <Route path="users" element={<UsersList />} />
              <Route path="settings" element={<SystemSettings />} />
              <Route path="settings/categories" element={<CategoriesList />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
