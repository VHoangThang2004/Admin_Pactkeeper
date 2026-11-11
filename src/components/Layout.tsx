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
 * Remade to HoYoverse AAA Game Portal standards:
 * - Ambient Dark Cosmic Obsidian canvas with ethereal celestial stardust meshes
 * - Role-aware Sidebar navigation (Admin / Moderator / Tech Support)
 * - Sleek floating glass header with breadcrumbs and live server cluster health
 * - Fluid, scrollable content canvas with dark glassmorphic cards
 */
export const Layout: React.FC<LayoutProps> = ({ adminName, role, onLogout }) => {
  return (
    <div className="flex min-h-screen bg-[#070a14] text-[#f8fafc] font-sans antialiased relative selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient Lighting Spheres (Fixed Background Cosmic Glows) */}
      <div 
        className="fixed pointer-events-none top-[-150px] left-[15%] w-[650px] h-[650px] bg-amber-500/[0.07] rounded-full blur-[150px] z-0" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none bottom-[-200px] right-[5%] w-[750px] h-[750px] bg-cyan-500/[0.05] rounded-full blur-[170px] z-0" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none top-[40%] right-[30%] w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[140px] z-0" 
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
