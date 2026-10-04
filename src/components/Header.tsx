import React from 'react';
import { Bell, ShieldCheck, Search, Activity } from 'lucide-react';

interface HeaderProps {
  adminName: string;
}

export const Header: React.FC<HeaderProps> = ({ adminName }) => {
  return (
    <header className="h-16 border-b border-slate-800 glass-panel px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Global Quick Search */}
      <div className="flex items-center gap-3 w-96 bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-400 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Quick search players, items, tickets..."
          className="bg-transparent border-none outline-none w-full text-slate-200 placeholder-slate-500 text-xs"
        />
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-4">
        {/* Real-time Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>API Connected (net9.0)</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/40 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
        </button>

        {/* Admin Badge */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-semibold text-xs">
            {adminName.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-200 flex items-center gap-1">
              {adminName}
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            </p>
            <p className="text-[10px] text-slate-400">System Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
};
