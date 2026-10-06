import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { CounselRole } from '../types';

interface LayoutProps {
  adminName: string;
  role: CounselRole;
  onLogout: () => void;
}

/**
 * Layout Component for High Counsel Admin Portal
 * 
 * Provides the overarching shell featuring:
 * 1. Role-aware Sidebar navigation (auto-filters modules for Admin / Moderator / Support)
 * 2. High Counsel Header displaying administrator identity, credentials, and role badge
 * 3. Scrollable content canvas with medieval mahogany/parchment color styling
 */
export const Layout: React.FC<LayoutProps> = ({ adminName, role, onLogout }) => {
  return (
    <div className="flex min-h-screen bg-[#1c130d] text-[#f7f1e1] font-sans antialiased">
      {/* Sticky Left Navigation Sidebar */}
      <Sidebar role={role} onLogout={onLogout} />

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header adminName={adminName} role={role} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
