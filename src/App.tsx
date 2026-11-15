import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { PlayerManagement } from './pages/PlayerManagement';
import { GachaManagement } from './pages/GachaManagement';
import { ContentManagement } from './pages/ContentManagement';
import { PaymentManagement } from './pages/PaymentManagement';
import { LiveSupport } from './pages/LiveSupport';
import { MatchSupervision } from './pages/MatchSupervision';
import { SecurityGovernance } from './pages/SecurityGovernance';
import { logoutAdminSession, recordLoginAttempt } from './services/adminSecurityService';
import {
  clearAdminSession,
  getStoredPermissions,
  isTokenExpired,
  setStoredPermissions,
} from './utils/authSession';
import { hasPermission } from './utils/permissions';
import type { AdminPermissionKey, CounselRole } from './types';

/**
 * Main Application Root & Router Provider
 * 
 * Features:
 * 1. Session & Token State Management:
 *    - Stores JWT Bearer token ('adminToken'), display name ('adminName'),
 *      and authenticated role ('adminRole') in sessionStorage (cleared upon tab close).
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
  // Session authentication states loaded from tab session storage
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('adminToken'));
  const [adminName, setAdminName] = useState<string>(sessionStorage.getItem('adminName') || 'System Admin');
  const [role, setRole] = useState<CounselRole>(
    (sessionStorage.getItem('adminRole') as CounselRole) || 'Admin'
  );
  const [permissions, setPermissions] = useState<AdminPermissionKey[]>(() => getStoredPermissions());

  /**
   * Commits session credentials and role authority upon successful authentication.
   */
  const handleLoginSuccess = (
    newToken: string,
    name: string,
    newRole: CounselRole,
    nextPermissions: AdminPermissionKey[] = []
  ) => {
    sessionStorage.setItem('adminToken', newToken);
    sessionStorage.setItem('adminName', name);
    sessionStorage.setItem('adminRole', newRole);
    sessionStorage.setItem('adminLoginAt', new Date().toISOString());
    setStoredPermissions(nextPermissions);
    setToken(newToken);
    setAdminName(name);
    setRole(newRole);
    setPermissions(nextPermissions);
  };

  /**
   * Clears session credentials, notifies optional backend logout endpoint, and resets authentication state.
   */
  const handleLogout = () => {
    void logoutAdminSession(adminName, role);
    clearAdminSession();
    setToken(null);
    setPermissions([]);
  };

  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      if (isTokenExpired(token)) {
        recordLoginAttempt({
          username: adminName,
          resolvedRole: role,
          status: 'SESSION_EXPIRED',
          reason: 'JWT token expiration reached in active portal session',
        });
        clearAdminSession();
        setToken(null);
        setPermissions([]);
      }
    };

    const initialTimer = window.setTimeout(checkExpiry, 0);
    const interval = window.setInterval(checkExpiry, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [token, adminName, role]);

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
        return '/matches';
      case 'Server':
      case 'Admin':
      default:
        return '/';
    }
  };

  const canAccess = (perm: AdminPermissionKey) => hasPermission(role, perm, permissions);
  const canSecurity =
    canAccess('security.accounts') || canAccess('security.roles') || canAccess('security.audit');

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
              <Layout adminName={adminName} role={role} permissions={permissions} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Dashboard / System Status: Admin & Technical Support */}
          <Route
            path="/"
            element={canAccess('dashboard.view') ? <DashboardOverview role={role} /> : <Navigate to="/matches" replace />}
          />

          {/* User Accounts & Directory: Admin & Moderator */}
          <Route
            path="/players"
            element={canAccess('players.view') ? <PlayerManagement role={role} /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* Match Supervision & Combat Action Logs: Admin, Moderator & Technical Support (Screen 33 & 34) */}
          <Route
            path="/matches"
            element={canAccess('matches.view') ? <MatchSupervision /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* Logs, Alerts & Support: Technical Support & Admin */}
          <Route
            path="/support"
            element={canAccess('support.chat') ? <LiveSupport /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* Gacha / Story Config: Moderator & Admin */}
          <Route
            path="/gacha"
            element={canAccess('gacha.manage') ? <GachaManagement /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* Item & Combat Reward Config (SRPG Definitions): Moderator & Admin */}
          <Route
            path="/content"
            element={canAccess('content.manage') ? <ContentManagement /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* PayOS Financial Ledger: Admin Only */}
          <Route
            path="/payments"
            element={canAccess('payments.view') ? <PaymentManagement /> : <Navigate to={getDefaultPath()} replace />}
          />

          {/* Admin Accounts, Roles & Security Audit Center: Admin / Security Roles */}
          <Route
            path="/security"
            element={
              canSecurity ? (
                <SecurityGovernance currentUsername={adminName} currentRole={role} />
              ) : (
                <Navigate to={getDefaultPath()} replace />
              )
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={getDefaultPath()} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
