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
 * Re-architected to HoYoverse AAA Game Portal standards:
 * - Ambient Dark Astral Obsidian canvas with subtle celestial light meshes
 * - Role-aware Sidebar navigation (Admin / Moderator / Tech Support)
 * - Sleek floating glass header with breadcrumbs and live server cluster health
 * - Fluid, scrollable content canvas with dark glassmorphic cards
 */
export const Layout: React.FC<LayoutProps> = ({ adminName, role, onLogout }) => {
  return (
    <div className="flex min-h-screen bg-[#080a0f] text-[#f8fafc] font-sans antialiased relative selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient Lighting Spheres (Fixed Background Glows) */}
      <div 
        className="fixed pointer-events-none top-[-150px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.06] rounded-full blur-[140px] z-0" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none bottom-[-200px] right-[5%] w-[700px] h-[700px] bg-cyan-500/[0.04] rounded-full blur-[160px] z-0" 
        aria-hidden="true" 
      />

      {/* Sticky Left Navigation Sidebar (Game Launcher Aesthetic) */}
      <Sidebar role={role} onLogout={onLogout} />

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        <Header adminName={adminName} role={role} />
        <main className="flex-1 p-5 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
