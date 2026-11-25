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

function resolveRealmBackdrop(pathname: string): string {
  if (pathname.startsWith('/players') || pathname.startsWith('/matches') || pathname.startsWith('/balance')) {
    return '/game-assets/hall-bg.png';
  }
  return '/game-assets/mainmenu-bg.jpg';
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
  const backdropSrc = resolveRealmBackdrop(location.pathname);

  return (
    <>
      {/* Subtle PactKeeper Realm Backdrop */}
      <div className="pk-realm-backdrop" aria-hidden="true">
        <img src={backdropSrc} alt="" className="pk-realm-backdrop-img" />
        <div className="pk-realm-backdrop-vignette" />
      </div>

      {/* Optional Ambient Game FX (toggleable in Ctrl+K; off by default for distraction-free engineering) */}
      {ambientFx && <EmberAtmosphere />}

      {/* Snappy Route Hairline Progress Bar */}
      <div key={`route-bar-${location.pathname}`} className="pk-route-bar" aria-hidden="true" />
      {ambientFx && (
        <div key={`scene-sweep-${location.pathname}`} className="pk-scene-sweep" aria-hidden="true" />
      )}

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
