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
   * Based on Context Diagram and Use Case Diagram:
   * - Technical Support: Lands on System Monitor & Status (/)
   * - Moderator: Lands on Gacha Summon Banners (/gacha)
   * - Admin: Lands on Admin Dashboard (/)
   */
  const getDefaultPath = (): string => {
    switch (role) {
      case 'Technical Support':
      case 'Support':
        return '/';
      case 'Moderator':
        return '/gacha';
      case 'Server':
      case 'Admin':
      default:
        return '/';
    }
  };

  const isTechSupport = role === 'Technical Support' || role === 'Support';
  const isMod = role === 'Moderator';
  const isAdmin = role === 'Admin' || role === 'Server';

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
          {/* Dashboard / System Status: Admin & Technical Support */}
          <Route
            path="/"
            element={!isMod ? <DashboardOverview role={role} /> : <Navigate to="/gacha" replace />}
          />

          {/* User Accounts & Match Inspect: Admin & Moderator */}
          <Route
            path="/players"
            element={!isTechSupport ? <PlayerManagement role={role} /> : <Navigate to="/" replace />}
          />

          {/* Logs, Alerts & Support: Technical Support & Admin */}
          <Route
            path="/support"
            element={!isMod ? <LiveSupport /> : <Navigate to="/gacha" replace />}
          />

          {/* Gacha / Story Config: Moderator & Admin */}
          <Route
            path="/gacha"
            element={!isTechSupport ? <GachaManagement /> : <Navigate to="/" replace />}
          />

          {/* Item & Combat Reward Config (SRPG Definitions): Moderator & Admin */}
          <Route
            path="/content"
            element={!isTechSupport ? <ContentManagement /> : <Navigate to="/" replace />}
          />

          {/* PayOS Financial Ledger: Admin Only */}
          <Route
            path="/payments"
            element={isAdmin ? <PaymentManagement /> : <Navigate to={getDefaultPath()} replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to={getDefaultPath()} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
