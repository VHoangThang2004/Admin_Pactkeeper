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

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navItems = [
    { path: '/', label: 'TREASURY OVERVIEW', icon: Gem, tag: 'HIGH COUNSEL' },
    { path: '/players', label: 'HEROES & PLAYERS', icon: Shield, tag: 'RECORD' },
    { path: '/gacha', label: 'SUMMON BANNER', icon: Sparkles, tag: 'BANNER' },
    { path: '/content', label: 'SRPG DEFINITIONS', icon: Scroll, tag: 'ARCHIVES' },
    { path: '/payments', label: 'PAYOS REVENUE', icon: Coins, tag: 'LEDGER' },
    { path: '/support', label: 'COUNSEL BOARD', icon: MessageSquare, tag: 'MISSIVES' },
  ];

  return (
    <aside className="w-64 bg-[#2b1b11] border-r-2 border-[#c89b3c] flex flex-col h-screen sticky top-0 z-30 shadow-2xl text-[#f7f1e1]">
      {/* Brand Header */}
      <div className="p-5 bg-[#3a2518] border-b-2 border-[#c89b3c] flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-[#d4af37] to-[#aa7c11] p-0.5 shadow-md">
          <div className="w-full h-full bg-[#2b1b11] rounded flex items-center justify-center">
            <Crown className="w-5 h-5 text-[#f59e0b]" />
          </div>
        </div>
        <div>
          <h1 className="font-extrabold text-[#ffe082] tracking-wider text-base uppercase font-cinzel">
            PACTKEEPER
          </h1>
          <p className="text-[10px] text-[#c4b49e] font-serif uppercase tracking-widest">
            High Counsel Admin
          </p>
        </div>
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        <div className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#a38f78] font-cinzel flex items-center justify-between border-b border-[#4d3525] pb-1">
          <span>HIGH COUNSEL MODULES</span>
          <ScrollText className="w-3 h-3 text-[#c89b3c]" />
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold font-cinzel transition-all duration-200 ${
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
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#21140c] text-[#c89b3c] border border-[#523725]">
                {item.tag}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Live Server Widget */}
      <div className="p-3.5 mx-3 mb-4 rounded-lg bg-[#21140c] border border-[#c89b3c]/40 text-xs space-y-1.5">
        <div className="flex items-center justify-between font-cinzel font-bold text-[#ffe082]">
          <span>SERVER STATE</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40">
            ONLINE
          </span>
        </div>
        <div className="text-[10px] text-[#b8a690] font-mono space-y-1">
          <div className="flex justify-between">
            <span>Gateway:</span>
            <span className="text-[#ffe082]">:5276</span>
          </div>
          <div className="flex justify-between">
            <span>Realm DB:</span>
            <span className="text-[#34d399]">MongoDB</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 border-t-2 border-[#c89b3c] bg-[#3a2518]">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2b1b11] hover:bg-[#8b1e1e] text-[#f7f1e1] border border-[#c89b3c] text-xs font-bold font-cinzel transition-all shadow-md"
        >
          <LogOut className="w-4 h-4 text-[#c89b3c]" />
          <span>EXIT COUNSEL</span>
        </button>
      </div>
    </aside>
  );
};
