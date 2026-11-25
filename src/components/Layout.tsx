import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@astryxdesign/core/AppShell';
import type { AdminPermissionKey } from '../types';
import Header from './Header';
import Sidebar from './Sidebar';

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

  return (
    <>
      <div key={`route-bar-${location.pathname}`} className="pk-route-bar" aria-hidden="true" />
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
          className="h-full w-full min-h-0 flex flex-col overflow-hidden pk-page-enter"
        >
          <Outlet />
        </div>
      </AppShell>
    </>
  );
};

export default Layout;
