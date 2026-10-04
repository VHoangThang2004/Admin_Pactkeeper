import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Database,
  CreditCard,
  Headphones,
  ShieldAlert,
  LogOut,
  Swords
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navItems = [
    { path: '/', label: 'Overview & Server', icon: LayoutDashboard },
    { path: '/players', label: 'Player Moderation', icon: Users },
    { path: '/gacha', label: 'Gacha Banners', icon: Sparkles },
    { path: '/content', label: 'Game Content & CMS', icon: Database },
    { path: '/payments', label: 'Payments & Revenue', icon: CreditCard },
    { path: '/support', label: 'Live Support Chat', icon: Headphones },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white tracking-wide text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            SRPG Admin
          </h1>
          <span className="text-xs text-indigo-400 font-medium">Control Center</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Main Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Emergency Status Banner */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2 mb-1.5 text-amber-400 text-xs font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Server Status</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Matchmaking:</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
          </span>
        </div>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800/60">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/50 hover:border-rose-500/30 text-sm font-medium transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};
