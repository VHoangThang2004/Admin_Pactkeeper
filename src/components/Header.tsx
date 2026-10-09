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
 * Displays:
 * 1. Tactical SRPG Realm branding and counsel portal status
 * 2. Active administrator credentials and high counsel avatar
 * 3. Role-based badge with distinct iconography and colors for Admin, Moderator, and Technical Support
 */
export const Header: React.FC<HeaderProps> = ({ adminName, role }) => {
  // Compute theme badge metadata based on authenticated role
  const getRoleBadge = () => {
    switch (role) {
      case 'Technical Support':
      case 'Support':
        return {
          title: 'Technical Support (Status & Alerts)',
          icon: <Activity className="w-3.5 h-3.5 text-[#34d399]" />,
          colorClass: 'text-[#34d399]',
          borderClass: 'border-[#10b981]/50 bg-[#064e3b]/40',
        };
      case 'Moderator':
        return {
          title: 'Realm Moderator (Gacha, Items & Inspect)',
          icon: <ScrollText className="w-3.5 h-3.5 text-[#38bdf8]" />,
          colorClass: 'text-[#38bdf8]',
          borderClass: 'border-[#0284c7]/50 bg-[#0c4a6e]/40',
        };
      case 'Server':
      case 'Admin':
      default:
        return {
          title: 'High Counsel Admin (Accounts & Dashboard)',
          icon: <Crown className="w-3.5 h-3.5 text-[#f59e0b]" />,
          colorClass: 'text-[#ffe082]',
          borderClass: 'border-[#c89b3c]/60 bg-[#3a2518]',
        };
    }
  };

  const badge = getRoleBadge();

  return (
    <header className="h-16 mahogany-banner px-6 flex items-center justify-between sticky top-0 z-20 shadow-xl border-b border-[#c89b3c]">
      {/* Title / Counsel Brand */}
      <div className="flex items-center gap-3">
        <span className="text-[#c89b3c] font-cinzel text-lg">❖</span>
        <div>
          <h2 className="text-sm font-bold font-cinzel text-[#ffe082] uppercase tracking-wider">
            TACTICAL SRPG HIGH COUNSEL
          </h2>
          <p className="text-xs text-[#d5c7b3] font-serif uppercase tracking-wider hidden sm:block">
            Authoritative Operations & Player Care Portal
          </p>
        </div>
      </div>

      {/* High Counsel Profile with Role Badge */}
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#d4af37] to-[#aa7c11] border border-[#fef08a] flex items-center justify-center text-[#2b1b11] font-bold text-xs font-cinzel shadow-md">
          {adminName.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold font-cinzel text-[#ffe082] flex items-center gap-1.5">
            {adminName}
            <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
          </p>
          <div className={`text-xs font-sans font-medium tracking-wide flex items-center gap-1.5 px-2.5 py-0.5 mt-0.5 rounded border shadow-sm ${badge.borderClass}`}>
            {badge.icon}
            <span className={badge.colorClass}>{badge.title}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
