import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Gem,
  Shield,
  Sparkles,
  Scroll,
  Coins,
  LogOut,
  Crown,
  Activity,
  Swords,
  MessageSquare,
  Radio
} from 'lucide-react';
import type { CounselRole } from '../types';

interface SidebarProps {
  role: CounselRole;
  onLogout: () => void;
}

/**
 * Sidebar Navigation Component for PactKeeper High Counsel
 * 
 * Re-architected in accordance with HoYoverse Game Launcher & SRS Report 3 RBAC Matrix:
 * - Admin: View Admin Dashboard, Manage User Accounts, PayOS Revenue Ledger
 * - Moderator: Gacha/Story Config, Item/Combat Reward Config, Inspect PvP Match & Teams
 * - Technical Support: Monitor System Status, Configure System Overrides & Live Support
 */
export const Sidebar: React.FC<SidebarProps> = ({ role, onLogout }) => {
  const isTechSupport = role === 'Technical Support' || role === 'Support';

  // Navigation matrix with strict role access mapping from SRS Report 3
  const allNavItems = [
    { 
      path: '/', 
      label: isTechSupport ? 'System Status & Monitor' : 'Command Dashboard', 
      icon: isTechSupport ? Activity : Gem, 
      tag: isTechSupport ? 'TELEMETRY' : 'OVERVIEW', 
      allowedRoles: ['Admin', 'Server', 'Technical Support', 'Support'] 
    },
    { 
      path: '/players', 
      label: role === 'Moderator' ? 'User Directory' : 'Manage User Accounts', 
      icon: Shield, 
      tag: role === 'Moderator' ? 'PLAYERS' : 'ACCOUNTS', 
      allowedRoles: ['Admin', 'Server', 'Moderator'] 
    },
    { 
      path: '/matches', 
      label: 'Match Supervision', 
      icon: Swords, 
      tag: 'SPECTATOR', 
      allowedRoles: ['Admin', 'Server', 'Moderator'] 
    },
    { 
      path: '/gacha', 
      label: 'Gacha / Story Banner', 
      icon: Sparkles, 
      tag: 'BANNERS', 
      allowedRoles: ['Moderator', 'Admin', 'Server'] 
    },
    { 
      path: '/content', 
      label: 'Item & Reward Config', 
      icon: Scroll, 
      tag: 'ARMORY', 
      allowedRoles: ['Moderator', 'Admin', 'Server'] 
    },
    { 
      path: '/payments', 
      label: 'PayOS Revenue Ledger', 
      icon: Coins, 
      tag: 'LEDGER', 
      allowedRoles: ['Admin', 'Server'] 
    },
    { 
      path: '/support', 
      label: 'Player Support Desk', 
      icon: MessageSquare, 
      tag: 'LIVE CHAT', 
      allowedRoles: ['Technical Support', 'Support', 'Admin', 'Server'] 
    },
  ];

  // Filter modules strictly for the authenticated user's role
  const visibleNavItems = allNavItems.filter((item) => item.allowedRoles.includes(role));

  // Dynamic module section header based on role privileges
  const getSectionTitle = () => {
    switch (role) {
      case 'Technical Support':
      case 'Support':
        return 'TECHNICAL OPERATIONS';
      case 'Moderator':
        return 'MODERATOR JURISDICTION';
      default:
        return 'HIGH COUNSEL SANCTUM';
    }
  };

  return (
    <aside className="w-68 bg-[#0b0e17]/90 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col h-screen sticky top-0 z-30 shadow-[4px_0_30px_rgba(0,0,0,0.7)] text-[#f8fafc] select-none">
      {/* Brand Launcher Header */}
      <div className="p-5 border-b border-white/[0.08] flex items-center gap-3.5 bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="relative group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.25)] shrink-0 transition-transform duration-300 group-hover:scale-105">
            <div className="w-full h-full bg-[#0b0e17] rounded-[10px] flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            </div>
          </div>
          {/* Subtle Online Pulse Ring */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#0b0e17]" />
          </span>
        </div>

        <div className="min-w-0">
          <h1 className="font-extrabold tracking-wider text-base uppercase font-cinzel leading-none gold-gradient-text">
            PACTKEEPER
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.08]">
              v2.4.0
            </span>
            <span className="text-[11px] text-slate-400 uppercase tracking-wide font-sans truncate">
              High Counsel
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 font-cinzel">
          <span>{getSectionTitle()}</span>
          <span className="text-amber-500/70 text-xs">❖</span>
        </div>

        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 tracking-wide ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent text-amber-300 font-semibold border-l-2 border-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors group-hover:scale-110 duration-200" />
                <span className="truncate">{item.label}</span>
              </div>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-white/[0.06] group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                {item.tag}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Dedicated Server Cluster Status Card */}
      <div className="p-3.5 mx-3 mb-3 rounded-xl bg-[#0e1320]/80 border border-white/[0.08] shadow-inner text-xs space-y-2">
        <div className="flex items-center justify-between font-semibold">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>REALM CLUSTER</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
            ONLINE
          </span>
        </div>
        
        <div className="text-[11px] text-slate-400 space-y-1 font-mono pt-1 border-t border-white/[0.06]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-sans">NGO Instance:</span>
            <span className="text-slate-200">Ports 7777–7800</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-sans">Active Role:</span>
            <span className="text-amber-400 uppercase font-bold">{role}</span>
          </div>
        </div>
      </div>

      {/* Logout Action */}
      <div className="p-3.5 border-t border-white/[0.08] bg-black/30">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-rose-950/40 text-slate-300 hover:text-rose-200 border border-white/[0.08] hover:border-rose-500/40 text-xs font-semibold tracking-wider transition-all duration-200 shadow active:scale-[0.98]"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-300" />
          <span>EXIT COUNSEL</span>
        </button>
      </div>
    </aside>
  );
};
