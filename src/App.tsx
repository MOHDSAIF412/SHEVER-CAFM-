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
import { PPMPlanner } from './pages/ppm/PPMPlanner';
import { PPMPlansList } from './pages/ppm/PPMPlansList';
import { PPMChecklists } from './pages/ppm/PPMChecklists';
import { AssetsList } from './pages/assets/AssetsList';
import { AssetDetail } from './pages/assets/AssetDetail';
import { FacilityTree } from './pages/facilities/FacilityTree';
import { QRLabels } from './pages/facilities/QRLabels';
import { ImportHierarchy } from './pages/facilities/ImportHierarchy';
import { MaterialsList } from './pages/materials/MaterialsList';
import { ReportsCenter } from './pages/reports/ReportsCenter';
import { UsersList } from './pages/users/UsersList';
import { SystemSettings } from './pages/settings/SystemSettings';
import { CostingSettings } from './pages/settings/CostingSettings';
import { JobCostingReport } from './pages/reports/JobCostingReport';
import { BillingHome } from './pages/billing/BillingHome';
import { InvoiceDetail, QuoteDetail } from './pages/billing/BillingDocument';
import { ClientsList } from './pages/billing/ClientsList';
import { CategoriesList } from './pages/settings/CategoriesList';
import { AuditLogs } from './pages/audit/AuditLogs';

import { ThemeProvider } from './context/ThemeContext';
import { RoomScan, AssetScan } from './pages/facilities/ScanPages';
import { JobTypes } from './pages/settings/JobTypes';
import { useLocation } from 'react-router-dom';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!user) {
    // Remember where they were going (a scanned QR label, a link in a
    // notification) and send them back there after signing in.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
};

/** Pages only some roles may open. The database enforces the same rules. */
const RoleRoute: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) {
    return <div className="py-20 text-center text-sm text-slate-500">You do not have access to this page.</div>;
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
              <Route path="ppm/planner" element={<PPMPlanner />} />
              <Route path="ppm/schedules" element={<Navigate to="/ppm/planner" replace />} />
              <Route path="ppm/plans" element={<PPMPlansList />} />
              <Route path="ppm/checklists" element={<PPMChecklists />} />

              {/* Assets */}
              <Route path="assets" element={<AssetsList />} />
              <Route path="assets/:id" element={<AssetDetail />} />

              {/* Facilities Hierarchy */}
              <Route path="facilities" element={<FacilityTree />} />
              <Route path="facilities/labels" element={<QRLabels />} />
              <Route path="facilities/import" element={<ImportHierarchy />} />
              <Route path="facilities/buildings" element={<Navigate to="/facilities" replace />} />

              {/* Materials */}
              <Route path="materials" element={<MaterialsList />} />

              {/* Reports */}
              <Route path="reports" element={<ReportsCenter />} />

              {/* Administration & Security */}
              <Route path="users" element={<RoleRoute roles={['admin']}><UsersList /></RoleRoute>} />
              <Route path="settings" element={<RoleRoute roles={['admin', 'fm_manager']}><SystemSettings /></RoleRoute>} />
              <Route path="settings/categories" element={<RoleRoute roles={['admin', 'fm_manager']}><CategoriesList /></RoleRoute>} />
              <Route path="settings/job-types" element={<RoleRoute roles={['admin', 'fm_manager']}><JobTypes /></RoleRoute>} />
              <Route path="settings/costing" element={<CostingSettings />} />
              <Route path="costing" element={<JobCostingReport />} />
              <Route path="billing" element={<BillingHome />} />
              <Route path="billing/invoices/:id" element={<InvoiceDetail />} />
              <Route path="billing/quotes/:id" element={<QuoteDetail />} />
              <Route path="clients" element={<ClientsList />} />
              <Route path="audit" element={<RoleRoute roles={['admin', 'fm_manager']}><AuditLogs /></RoleRoute>} />
              <Route path="audit-logs" element={<Navigate to="/audit" replace />} />

              {/* QR labels */}
              <Route path="r/:token" element={<RoomScan />} />
              <Route path="a/:code" element={<AssetScan />} />
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
