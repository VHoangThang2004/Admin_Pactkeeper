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
import { BalanceAnalytics } from './pages/BalanceAnalytics';
import { RewardManagement } from './pages/RewardManagement';
import { SecurityGovernance } from './pages/SecurityGovernance';
import { logoutAdminSession, recordLoginAttempt } from './services/adminSecurityService';
import { stopPresenceSync } from './services/playerPresenceService';
import {
  clearAdminSession,
  getStoredPermissions,
  isTokenExpired,
  setStoredPermissions,
} from './utils/authSession';
import { getDefaultLandingPath, hasPermission } from './utils/permissions';
import type { AdminPermissionKey, CounselRole } from './types';

/**
 * Main Application Root & Router Provider
 * 
 * Features:
 * 1. Session & Token State Management:
 *    - Stores JWT Bearer token ('adminToken'), display name ('adminName'),
 *      and authenticated role ('adminRole') in sessionStorage (cleared upon tab close).
 * 2. Role-Based Access Control (RBAC) Route Guards:
 *    - Technical Support: Lands on System Monitor & Status (/) by default.
 *    - Moderator: Lands on Player Management (/players) by default;
 *      restricted from server/economy/content defaults unless granted by Admin.
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
    stopPresenceSync();
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
        stopPresenceSync();
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
   * Resolves the primary landing path tailored to the user's privilege tier and active permissions.
   * - Moderator: Lands on Player Management (/players)
   * - Technical Support: Lands on System Monitor & Status (/)
   * - Admin: Lands on Admin Dashboard (/)
   */
  const defaultLandingPath = getDefaultLandingPath(role, permissions);

  const canAccess = (perm: AdminPermissionKey) => hasPermission(role, perm, permissions);
  const canSecurity =
    canAccess('security.accounts') || canAccess('security.roles') || canAccess('security.audit');

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!token ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to={defaultLandingPath} replace />}
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
            element={
              canAccess('dashboard.view') ? (
                <DashboardOverview role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* User Accounts & Directory: Admin & Moderator (or custom-granted roles) */}
          <Route
            path="/players"
            element={
              canAccess('players.view') ? (
                <PlayerManagement role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* Match Supervision & Combat Action Logs: Admin, Moderator (view) & Technical Support */}
          <Route
            path="/matches"
            element={
              canAccess('matches.view') ? (
                <MatchSupervision role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* Flow 5: Match Telemetry, AI Balance Advisor & Game Version Releases */}
          <Route
            path="/balance"
            element={
              canAccess('balance.view') || canAccess('balance.manage') ? (
                <BalanceAnalytics role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* Quests & Reward Rules Management */}
          <Route
            path="/rewards"
            element={
              canAccess('rewards.view') || canAccess('rewards.manage') ? (
                <RewardManagement role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* Logs, Alerts & Support: Technical Support & Admin (or custom-granted roles) */}
          <Route
            path="/support"
            element={canAccess('support.chat') ? <LiveSupport /> : <Navigate to={defaultLandingPath} replace />}
          />

          {/* Gacha / Story Config: Admin (or custom-granted roles) */}
          <Route
            path="/gacha"
            element={canAccess('gacha.manage') ? <GachaManagement /> : <Navigate to={defaultLandingPath} replace />}
          />

          {/* Item & Combat Reward Config (SRPG Definitions): Admin (or custom-granted roles) */}
          <Route
            path="/content"
            element={canAccess('content.manage') ? <ContentManagement /> : <Navigate to={defaultLandingPath} replace />}
          />

          {/* PayOS Financial Ledger: Admin Only (or custom-granted roles) */}
          <Route
            path="/payments"
            element={
              canAccess('payments.view') ? (
                <PaymentManagement role={role} permissions={permissions} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />

          {/* Admin Accounts, Roles & Security Audit Center: Admin / Security Roles */}
          <Route
            path="/security"
            element={
              canSecurity ? (
                <SecurityGovernance currentUsername={adminName} currentRole={role} />
              ) : (
                <Navigate to={defaultLandingPath} replace />
              )
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={defaultLandingPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
