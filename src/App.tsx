import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { PlayerManagement } from './pages/PlayerManagement';
import { GachaManagement } from './pages/GachaManagement';
import { ContentManagement } from './pages/ContentManagement';
import { PaymentManagement } from './pages/PaymentManagement';
import { LiveSupport } from './pages/LiveSupport';
import type { CounselRole } from './types';

/**
 * Main Application Root & Router Provider
 * 
 * Features:
 * 1. Session & Token State Management:
 *    - Persists JWT Bearer token ('adminToken'), display name ('adminName'),
 *      and authenticated role ('adminRole') in localStorage.
 * 2. Role-Based Access Control (RBAC) Route Guards:
 *    - Support (CSKH): Automatically redirected to Counsel Board (/support) on login;
 *      restricted from accessing financial, gacha, and definition modules.
 *    - Moderator: Automatically redirected to Heroes & Players (/players) on login;
 *      restricted from modifying server economy and SRPG definitions.
 *    - Admin / Server: Full access to treasury overview and all configuration modules.
 * 3. Graceful Fallback: Any unauthorized or non-existent route safely navigates
 *    to the role's permitted landing page.
 */
export const App: React.FC = () => {
  // Session authentication states loaded from persistent browser storage
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [adminName, setAdminName] = useState<string>(localStorage.getItem('adminName') || 'System Admin');
  const [role, setRole] = useState<CounselRole>(
    (localStorage.getItem('adminRole') as CounselRole) || 'Admin'
  );

  /**
   * Commits session credentials and role authority upon successful authentication.
   */
  const handleLoginSuccess = (newToken: string, name: string, newRole: CounselRole) => {
    localStorage.setItem('adminToken', newToken);
    localStorage.setItem('adminName', name);
    localStorage.setItem('adminRole', newRole);
    setToken(newToken);
    setAdminName(name);
    setRole(newRole);
  };

  /**
   * Clears session credentials and resets authentication state.
   */
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminRole');
    setToken(null);
  };

  /**
   * Resolves the primary landing path tailored to the user's privilege tier.
   */
  const getDefaultPath = (): string => {
    switch (role) {
      case 'Support':
        return '/support';
      case 'Moderator':
        return '/players';
      case 'Server':
      case 'Admin':
      default:
        return '/';
    }
  };

  /**
   * High Counsel Administrator Route Guard.
   * Restricts sensitive economy and definition routes to Administrator roles.
   */
  const requireAdmin = (element: React.ReactElement) => {
    if (role === 'Admin' || role === 'Server') {
      return element;
    }
    return <Navigate to={getDefaultPath()} replace />;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!token ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to={getDefaultPath()} replace />}
        />
        <Route
          element={
            token ? (
              <Layout adminName={adminName} role={role} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Overview is only for Admin & Server, others redirect to their home */}
          <Route
            path="/"
            element={role === 'Admin' || role === 'Server' ? <DashboardOverview role={role} /> : <Navigate to={getDefaultPath()} replace />}
          />
          <Route path="/players" element={<PlayerManagement role={role} />} />
          <Route path="/support" element={<LiveSupport />} />

          {/* High Counsel Admin Only Routes */}
          <Route path="/gacha" element={requireAdmin(<GachaManagement />)} />
          <Route path="/content" element={requireAdmin(<ContentManagement />)} />
          <Route path="/payments" element={requireAdmin(<PaymentManagement />)} />
        </Route>
        <Route path="*" element={<Navigate to={getDefaultPath()} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
