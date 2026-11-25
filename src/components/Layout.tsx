import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@astryxdesign/core/AppShell';
import { useWorkspacePrefs } from '../context/WorkspacePrefsContext';
import type { AdminPermissionKey } from '../types';
import Header from './Header';
import Sidebar from './Sidebar';
import { EmberAtmosphere } from './ui/EmberAtmosphere';

interface LayoutProps {
  role: string;
  permissions: AdminPermissionKey[];
  adminName?: string;
  adminToken?: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  role,
  permissions,
  adminName = 'Admin',
  adminToken,
  onLogout,
}) => {
  const location = useLocation();
  const { ambientFx } = useWorkspacePrefs();

  return (
    <>
      {/* Optional Ambient FX (off by default for a clean, distraction-free workspace) */}
      {ambientFx && <EmberAtmosphere />}

      {/* Snappy Route Hairline Progress Bar */}
      <div key={`route-bar-${location.pathname}`} className="pk-route-bar" aria-hidden="true" />

      <div className="relative z-10 h-dvh w-full">
        <AppShell
          height="fill"
          variant="surface"
          contentPadding={0}
          topNav={
            <Header
              role={role}
              permissions={permissions}
              adminName={adminName}
              adminToken={adminToken}
              onLogout={onLogout}
            />
          }
          sideNav={
            <Sidebar
              role={role}
              permissions={permissions}
              onLogout={onLogout}
            />
          }
        >
          <div
            key={`page-shell-${location.pathname}`}
            className="h-full w-full min-h-0 flex flex-col overflow-hidden pk-page-scene-enter"
          >
            <Outlet />
          </div>
        </AppShell>
      </div>
    </>
  );
};

export default Layout;
