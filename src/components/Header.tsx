import React from 'react';
import { ShieldCheck, Scroll } from 'lucide-react';

interface HeaderProps {
  adminName: string;
}

export const Header: React.FC<HeaderProps> = ({ adminName }) => {
  return (
    <header className="h-16 mahogany-banner px-6 flex items-center justify-between sticky top-0 z-20 shadow-xl border-b border-[#c89b3c]">
      {/* Title / Counsel Brand */}
      <div className="flex items-center gap-3">
        <span className="text-[#c89b3c] font-cinzel text-lg">❖</span>
        <h2 className="text-sm font-bold font-cinzel text-[#ffe082] uppercase tracking-widest">
          TACTICAL SRPG HIGH COUNSEL
        </h2>
      </div>

      {/* High Counsel Profile */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#d4af37] to-[#aa7c11] border border-[#fef08a] flex items-center justify-center text-[#2b1b11] font-bold text-xs font-cinzel shadow-md">
          {adminName.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold font-cinzel text-[#ffe082] flex items-center gap-1">
            {adminName}
            <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
          </p>
          <p className="text-[10px] text-[#c4b49e] font-serif uppercase tracking-wider flex items-center gap-1">
            <Scroll className="w-3 h-3 text-[#c89b3c]" /> Keeper of Records
          </p>
        </div>
      </div>
    </header>
  );
};
