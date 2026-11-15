import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  Clock,
  Crown,
  ExternalLink,
  KeyRound,
  LogOut,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { WEB_TOPUP_URL } from '../constants/links';
import { formatRemainingDuration, getTokenExpiryMs } from '../utils/authSession';
import { hasPermission } from '../utils/permissions';
import type { AdminPermissionKey, CounselRole } from '../types';

interface HeaderProps {
  adminName: string;
  role: CounselRole;
  permissions?: AdminPermissionKey[];
  onLogout?: () => void;
}

/**
 * Header Component for High Counsel Admin Portal
 */
export const Header: React.FC<HeaderProps> = ({
  adminName,
  role,
  permissions = [],
  onLogout,
}) => {
  const navigate = useNavigate();
  const [serverTime, setServerTime] = useState<string>('--:--:--');
  const [sessionTtl, setSessionTtl] = useState<string>('Active');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canSecurity =
    hasPermission(role, 'security.accounts', permissions) ||
    hasPermission(role, 'security.roles', permissions) ||
    hasPermission(role, 'security.audit', permissions);

  useEffect(() => {
    const updateClockAndSession = () => {
      const now = new Date();
      setServerTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      const expiryMs = getTokenExpiryMs(sessionStorage.getItem('adminToken'));
      if (expiryMs) {
        setSessionTtl(formatRemainingDuration(expiryMs - now.getTime()));
      } else {
        setSessionTtl('Session Token');
      }
    };

    const initTimer = window.setTimeout(updateClockAndSession, 0);
    const interval = window.setInterval(updateClockAndSession, 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = () => {
    switch (role) {
      case 'Technical Support':
      case 'Support':
        return {
          title: 'Technical Support',
          subtitle: 'Server Nodes & Telemetry',
          icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-500/35 bg-emerald-500/10',
        };
      case 'Moderator':
        return {
          title: 'Realm Moderator',
          subtitle: 'Matches, Gacha & Content',
          icon: <ScrollText className="w-3.5 h-3.5 text-cyan-400" />,
          colorClass: 'text-cyan-300',
          borderClass: 'border-cyan-500/35 bg-cyan-500/10',
        };
      case 'Server':
      case 'Admin':
      default:
        return {
          title: 'High Counsel Admin',
          subtitle: 'Full Counsel Authority',
          icon: <Crown className="w-3.5 h-3.5 text-amber-300" />,
          colorClass: 'text-amber-300',
          borderClass: 'border-amber-400/35 bg-amber-500/10',
        };
    }
  };

  const badge = getRoleBadge();

  return (
    <>
      <header className="h-16 px-5 md:px-7 backdrop-blur-2xl bg-[#070a14]/85 border-b border-white/[0.08] flex items-center justify-between sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.65)] select-none">
        {/* Title & Realm Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-[0_0_16px_rgba(242,191,78,0.3)] flex items-center justify-center transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-[#0c1022] rounded-[10px] flex items-center justify-center text-amber-300">
                <span className="font-cinzel text-base leading-none">❖</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold font-cinzel tracking-wider uppercase hy-gold-text leading-tight">
                TACTICAL SRPG HIGH COUNSEL
              </h2>
              <span className="hidden xl:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                PORTAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide hidden sm:block">
              Authoritative Operations &amp; Player Care Center
            </p>
          </div>
        </div>

        {/* Center Server Telemetry & Clock (Desktop) */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#12182e]/80 border border-white/[0.08] text-xs font-mono shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-slate-400 text-[11px]">Server:</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Asia-01 • Port 7777</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12182e]/80 border border-white/[0.08] text-xs font-mono text-slate-300 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-300">{serverTime}</span>
            <span className="text-[10px] text-slate-500">UTC+7</span>
          </div>

          <a
            href={WEB_TOPUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Web Top-Up Center (SDK)"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 text-xs font-semibold transition-all hover:scale-105"
          >
            <span>Web Top-Up</span>
            <ExternalLink className="w-3 h-3 text-amber-400" />
          </a>
        </div>

        {/* High Counsel Profile & Security Account Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-2xl px-2 py-1 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer"
            aria-expanded={menuOpen}
            aria-label="Open operator account menu"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-[0_0_14px_rgba(242,191,78,0.3)] flex items-center justify-center">
                <div className="w-full h-full bg-[#0c1022] rounded-full flex items-center justify-center text-amber-300 font-bold text-xs font-cinzel">
                  {adminName.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#070a14] rounded-full" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">{adminName}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div
                className={`text-[10px] font-medium tracking-wide flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-full border ${badge.borderClass}`}
              >
                {badge.icon}
                <span className={badge.colorClass}>{badge.title}</span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl hy-glass border border-amber-400/25 shadow-2xl p-2 space-y-1 z-40">
              <div className="px-3 py-2 border-b border-white/10 text-xs">
                <div className="font-semibold text-slate-100 font-mono">{adminName}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Session TTL:</span>
                  <span className="font-mono text-emerald-300">{sessionTtl}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setIsPasswordModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-amber-500/15 hover:text-amber-200 transition-colors text-left"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Change Passcode</span>
              </button>

              {canSecurity && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/security');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-cyan-500/15 hover:text-cyan-200 transition-colors text-left"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Security &amp; Audit Center</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-300 hover:bg-rose-500/15 transition-colors text-left border-t border-white/10 mt-1 pt-2.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        username={adminName}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
};
