import React from 'react';
import { ShieldCheck, Crown, Activity, ScrollText } from 'lucide-react';
import type { CounselRole } from '../types';

interface HeaderProps {
  adminName: string;
  role: CounselRole;
}

/**
 * Header Component for High Counsel Admin Portal
 * 
 * Re-architected to HoYoverse AAA Gaming Standards:
 * - Floating dark glass bar with subtle blur and 1px borders
 * - Real-time cluster status pill with pulse indicator
 * - Role-based prestige badges (Admin Gold, Moderator Cyan, Tech Support Emerald)
 * - Administrator identity and security verification status
 */
export const Header: React.FC<HeaderProps> = ({ adminName, role }) => {
  // Compute theme badge metadata based on authenticated role
  const getRoleBadge = () => {
    switch (role) {
      case 'Technical Support':
      case 'Support':
        return {
          title: 'Technical Support',
          subtitle: 'Server Nodes & Telemetry',
          icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
          colorClass: 'text-emerald-400',
          borderClass: 'border-emerald-500/30 bg-emerald-500/10',
        };
      case 'Moderator':
        return {
          title: 'Realm Moderator',
          subtitle: 'Matches, Gacha & Content',
          icon: <ScrollText className="w-3.5 h-3.5 text-cyan-400" />,
          colorClass: 'text-cyan-400',
          borderClass: 'border-cyan-500/30 bg-cyan-500/10',
        };
      case 'Server':
      case 'Admin':
      default:
        return {
          title: 'High Counsel Admin',
          subtitle: 'Full Counsel Authority',
          icon: <Crown className="w-3.5 h-3.5 text-amber-400" />,
          colorClass: 'text-amber-300',
          borderClass: 'border-amber-500/30 bg-amber-500/10',
        };
    }
  };

  const badge = getRoleBadge();

  return (
    <header className="h-16 px-6 backdrop-blur-xl bg-[#090b11]/85 border-b border-white/[0.08] flex items-center justify-between sticky top-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Title & Realm Identity */}
      <div className="flex items-center gap-3.5">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-amber-400 shadow-inner">
          <span className="font-cinzel text-sm leading-none">❖</span>
        </div>
        <div>
          <h2 className="text-sm font-bold font-cinzel tracking-wider uppercase gold-gradient-text leading-tight">
            TACTICAL SRPG HIGH COUNSEL
          </h2>
          <p className="text-[11px] text-slate-400 font-sans tracking-wide hidden sm:block">
            Authoritative Operations & Player Care Center
          </p>
        </div>
      </div>

      {/* Cluster Telemetry Pill (Desktop) */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-white/[0.08] text-xs font-mono">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-slate-400 text-[11px]">NGO Cluster:</span>
        <span className="text-emerald-400 font-semibold text-[11px]">EU-Central 1 • Active</span>
      </div>

      {/* High Counsel Profile & Role Indicator */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 p-0.5 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center justify-center">
            <div className="w-full h-full bg-[#090b11] rounded-full flex items-center justify-center text-amber-300 font-bold text-xs font-cinzel">
              {adminName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="text-left hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-200">{adminName}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className={`text-[10px] font-medium tracking-wide flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-full border ${badge.borderClass}`}>
            {badge.icon}
            <span className={badge.colorClass}>{badge.title}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
