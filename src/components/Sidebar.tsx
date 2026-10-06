import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Gem,
  Shield,
  Sparkles,
  Scroll,
  Coins,
  MessageSquare,
  LogOut,
  Crown,
  ScrollText
} from 'lucide-react';
import type { CounselRole } from '../types';

interface SidebarProps {
  role: CounselRole;
  onLogout: () => void;
}

/**
 * Sidebar Navigation Component for PactKeeper High Counsel
 * 
 * Features:
 * 1. Role-Based Access Control (RBAC): Automatically filters navigation modules
 *    according to the authenticated role (Admin / Moderator / Support).
 * 2. Medieval RPG visual identity (Cinzel typography, mahogany textures, gold borders).
 * 3. Real-time server gateway & database status indicator with active role readout.
 */
export const Sidebar: React.FC<SidebarProps> = ({ role, onLogout }) => {
  // Navigation matrix with strict role access mapping
  const allNavItems = [
    { 
      path: '/', 
      label: 'TREASURY OVERVIEW', 
      icon: Gem, 
      tag: 'OVERVIEW', 
      allowedRoles: ['Admin', 'Server'] 
    },
    { 
      path: '/players', 
      label: 'HEROES & PLAYERS', 
      icon: Shield, 
      tag: 'RECORDS', 
      allowedRoles: ['Admin', 'Server', 'Moderator', 'Support'] 
    },
    { 
      path: '/gacha', 
      label: 'SUMMON BANNER', 
      icon: Sparkles, 
      tag: 'BANNER', 
      allowedRoles: ['Admin', 'Server'] 
    },
    { 
      path: '/content', 
      label: 'SRPG DEFINITIONS', 
      icon: Scroll, 
      tag: 'ARCHIVES', 
      allowedRoles: ['Admin', 'Server'] 
    },
    { 
      path: '/payments', 
      label: 'PAYOS REVENUE', 
      icon: Coins, 
      tag: 'LEDGER', 
      allowedRoles: ['Admin', 'Server'] 
    },
    { 
      path: '/support', 
      label: 'COUNSEL BOARD', 
      icon: MessageSquare, 
      tag: 'MISSIVES', 
      allowedRoles: ['Admin', 'Server', 'Moderator', 'Support'] 
    },
  ];

  // Filter modules strictly for the authenticated user's role
  const visibleNavItems = allNavItems.filter((item) => item.allowedRoles.includes(role));

  // Dynamic module section header based on role privileges
  const getSectionTitle = () => {
    switch (role) {
      case 'Support':
        return 'CUSTOMER SUPPORT MODULES';
      case 'Moderator':
        return 'REALM MODERATION MODULES';
      default:
        return 'HIGH COUNSEL MODULES';
    }
  };

  return (
    <aside className="w-64 bg-[#2b1b11] border-r-2 border-[#c89b3c] flex flex-col h-screen sticky top-0 z-30 shadow-2xl text-[#f7f1e1] select-none">
      {/* Brand Header */}
      <div className="p-5 bg-[#3a2518] border-b-2 border-[#c89b3c] flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-[#d4af37] to-[#aa7c11] p-0.5 shadow-md shrink-0">
          <div className="w-full h-full bg-[#2b1b11] rounded flex items-center justify-center">
            <Crown className="w-5 h-5 text-[#f59e0b]" />
          </div>
        </div>
        <div>
          <h1 className="font-extrabold text-[#ffe082] tracking-wider text-base uppercase font-cinzel leading-tight">
            PACTKEEPER
          </h1>
          <p className="text-xs text-[#d5c7b3] font-serif uppercase tracking-wider mt-0.5">
            High Counsel
          </p>
        </div>
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2.5 text-xs font-bold uppercase tracking-wider text-[#c89b3c] font-cinzel flex items-center justify-between border-b border-[#4d3525] pb-1.5">
          <span>{getSectionTitle()}</span>
          <ScrollText className="w-3.5 h-3.5 text-[#c89b3c]" />
        </div>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-semibold font-cinzel transition-all duration-200 tracking-wide ${
                  isActive
                    ? 'bg-gradient-to-r from-[#4a3324] to-[#3a2518] text-[#ffe082] border-2 border-[#c89b3c] shadow-lg'
                    : 'text-[#d4c5b0] hover:text-[#ffffff] hover:bg-[#3d2719] border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-[#c89b3c] group-hover:scale-110 transition-transform" />
                <span>{item.label}</span>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[#21140c] text-[#c89b3c] border border-[#523725]">
                {item.tag}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Live Server Widget */}
      <div className="p-3.5 mx-3 mb-4 rounded-lg bg-[#21140c] border border-[#c89b3c]/40 text-xs space-y-2">
        <div className="flex items-center justify-between font-cinzel font-bold text-[#ffe082]">
          <span>SERVER STATE</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40 font-semibold">
            ONLINE
          </span>
        </div>
        <div className="text-xs text-[#d5c7b3] font-sans space-y-1.5">
          <div className="flex justify-between">
            <span>Gateway:</span>
            <span className="text-[#ffe082] font-mono font-medium">:5276</span>
          </div>
          <div className="flex justify-between">
            <span>Realm DB:</span>
            <span className="text-[#34d399] font-mono font-medium">MongoDB</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-[#3a2518]">
            <span>Active Role:</span>
            <span className="text-[#ffe082] uppercase font-bold font-mono">{role}</span>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t-2 border-[#c89b3c] bg-[#3a2518]">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2b1b11] hover:bg-[#8b1e1e] text-[#f7f1e1] border border-[#c89b3c] text-xs font-bold font-cinzel tracking-wider transition-all shadow-md active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4 text-[#c89b3c]" />
          <span>EXIT COUNSEL</span>
        </button>
      </div>
    </aside>
  );
};
