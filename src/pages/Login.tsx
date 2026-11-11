import React, { useState } from 'react';
import { Crown, Lock, User, ShieldCheck, XCircle, Eye, EyeOff, ArrowRight, Activity, ScrollText, KeyRound, Sparkles } from 'lucide-react';
import { adminClient } from '../api/adminClient';
import type { CounselRole } from '../types';

interface LoginProps {
  onLoginSuccess: (token: string, username: string, role: CounselRole) => void;
}

type SelectableRole = 'Admin' | 'Moderator' | 'Technical Support';

interface RoleConfig {
  id: SelectableRole;
  label: string;
  roleSubtitle: string;
  icon: React.ElementType;
  badgeText: string;
  landingPath: string;
  defaultUsername: string;
  defaultPasswordHint: string;
  themeColor: string;
  activeBg: string;
  activeBorder: string;
  scopeSummary: string;
}

const ROLE_CONFIGS: Record<SelectableRole, RoleConfig> = {
  Admin: {
    id: 'Admin',
    label: 'High Counsel Admin',
    roleSubtitle: 'Accounts & Treasury Command',
    icon: Crown,
    badgeText: 'ACCOUNTS & TREASURY',
    landingPath: 'Admin Dashboard (/)',
    defaultUsername: 'admin',
    defaultPasswordHint: 'admin123',
    themeColor: '#ffd466',
    activeBg: 'bg-amber-500/15',
    activeBorder: 'border-amber-400',
    scopeSummary: 'Authoritative responsibility for Manage User Accounts (Profiles, Bans, Balances) and View Realm Treasury.',
  },
  Moderator: {
    id: 'Moderator',
    label: 'Realm Moderator',
    roleSubtitle: 'Gacha, Story, Items & Spectator',
    icon: ScrollText,
    badgeText: 'GACHA, ITEMS & MATCHES',
    landingPath: 'Match Supervision (/matches)',
    defaultUsername: 'moderator',
    defaultPasswordHint: 'mod123',
    themeColor: '#38bdf8',
    activeBg: 'bg-cyan-500/15',
    activeBorder: 'border-cyan-400',
    scopeSummary: 'Direct responsibility for Gacha/Story Config, Item/Combat Reward Config, and Inspect PvP Matches (Team Formation & Logs).',
  },
  'Technical Support': {
    id: 'Technical Support',
    label: 'Technical Support',
    roleSubtitle: 'System Status, Overrides & Live Chat',
    icon: Activity,
    badgeText: 'STATUS & LIVE CHAT',
    landingPath: 'System Monitor & Status (/)',
    defaultUsername: 'techsupport',
    defaultPasswordHint: 'tech123',
    themeColor: '#34d399',
    activeBg: 'bg-emerald-500/15',
    activeBorder: 'border-emerald-400',
    scopeSummary: 'Direct responsibility for Monitor System/Server Status, Configure System Overrides & Statistic Requests, and Player Live Chat Desk.',
  },
};

/**
 * Login Component - HoYoverse Game Portal Gateway
 * 
 * Remade to HoYoverse AAA Gaming Standards:
 * - Cosmic Dark Obsidian canvas with celestial nebulae and starlight particles
 * - Regal portal badge with gold gradient typography
 * - Role-based authority selector with dedicated privilege descriptions
 * - 1-Click Sample Credential Shortcuts for rapid verification
 * - Trust pillars & security verification footer
 */
export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<SelectableRole>('Admin');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Switch active role and clear password input to require manual entry
  const handleSelectRole = (role: SelectableRole) => {
    setSelectedRole(role);
    const config = ROLE_CONFIGS[role];
    setUsername(config.defaultUsername);
    setPassword('');
    setError(null);
    setUsernameError(null);
    setPasswordError(null);
  };

  // Quick fill both username & sample password for convenient testing
  const handleQuickFill = (role: SelectableRole) => {
    setSelectedRole(role);
    const config = ROLE_CONFIGS[role];
    setUsername(config.defaultUsername);
    setPassword(config.defaultPasswordHint);
    setError(null);
    setUsernameError(null);
    setPasswordError(null);
  };

  const validateInputs = (): boolean => {
    let isValid = true;
    setUsernameError(null);
    setPasswordError(null);
    setError(null);

    if (!username.trim()) {
      setUsernameError('Counsel Username is required.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Secret Passcode is required.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Direct login invocation to live Swagger endpoint (/api/Auth/login)
      const response = await adminClient.post('/Auth/login', {
        username: username.trim(),
        password,
      });

      const { token, username: resUser, role: apiRole } = response.data || {};

      // 2. Reject non-privileged Player accounts
      if (typeof apiRole === 'string' && apiRole.toLowerCase() === 'player') {
        setError('Access Denied! Account holds a standard Player role. High Counsel privilege is required.');
        return;
      }

      // 3. Validate token presence in response
      if (!token && !response.data?.token) {
        setError('Authentication succeeded but no authorization token was returned by the Gateway.');
        return;
      }

      // 4. Resolve portal role
      let normalizedRole: CounselRole = 'Admin';
      const userLower = (resUser || username).trim().toLowerCase();
      const roleLower = typeof apiRole === 'string' ? apiRole.toLowerCase() : '';

      if (
        roleLower === 'moderator' ||
        roleLower === 'mod' ||
        userLower === 'moderator' ||
        (roleLower === 'admin' && selectedRole === 'Moderator')
      ) {
        normalizedRole = 'Moderator';
      } else if (
        roleLower === 'support' ||
        roleLower === 'technical support' ||
        roleLower === 'technicalsupport' ||
        roleLower === 'techsupport' ||
        roleLower === 'cskh' ||
        userLower === 'techsupport' ||
        (roleLower === 'admin' && selectedRole === 'Technical Support')
      ) {
        normalizedRole = 'Technical Support';
      } else if (roleLower === 'server') {
        normalizedRole = 'Server';
      } else {
        normalizedRole = 'Admin';
      }

      if (token) {
        onLoginSuccess(token, resUser || username.trim(), normalizedRole);
        return;
      } else {
        setError('Authentication succeeded but no authorization token was returned by the Gateway.');
      }
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        if (status === 401 || status === 400) {
          setError(`Invalid credentials for ${selectedRole}! Please verify your username and passcode.`);
        } else if (status === 403) {
          setError('Access Denied! Account lacks High Counsel authorization.');
        } else if (status === 500) {
          setError('Internal Server Error on Realm Gateway (500). Please try again shortly.');
        } else {
          setError(`Authentication failed with status code ${status}.`);
        }
      } else {
        setError('Unable to connect to Realm Gateway. Please verify the backend server is reachable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const activeConfig = ROLE_CONFIGS[selectedRole];

  return (
    <div className="min-h-screen bg-[#070a14] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Celestial Mesh Orbs */}
      <div 
        className="fixed pointer-events-none -top-40 -left-40 w-[650px] h-[650px] bg-amber-500/[0.08] rounded-full blur-[150px]" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none -bottom-40 -right-40 w-[750px] h-[750px] bg-cyan-500/[0.06] rounded-full blur-[170px]" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[140px]" 
        aria-hidden="true" 
      />

      {/* Login Box (HoYoverse Dark Glassmorphic Portal) */}
      <div className="w-full max-w-xl hy-glass border border-white/[0.1] rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.85)] p-6 md:p-8 relative z-10 space-y-6">
        {/* Ornate Corner Accents */}
        <span className="absolute top-4 left-4 text-amber-400/40 text-xs">❖</span>
        <span className="absolute top-4 right-4 text-amber-400/40 text-xs">❖</span>

        {/* Header Section */}
        <div className="text-center space-y-2 border-b border-white/[0.08] pb-5">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#0c1022] to-[#151d38] border border-amber-400/30 shadow-[0_0_24px_rgba(242,191,78,0.25)] mb-1">
            <Crown className="w-8 h-8 text-amber-300 drop-shadow-[0_0_10px_rgba(242,191,78,0.6)]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-cinzel tracking-wider uppercase hy-gold-text">
            TACTICAL SRPG HIGH COUNSEL
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-amber-200 border border-white/[0.08]">
              v2.4.0
            </span>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-mono">
              Realm Governance & Operations Portal
            </p>
          </div>
        </div>

        {/* Interactive Role Selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Select Target Counsel Authority:</span>
            <span className="text-[11px] font-mono font-normal text-slate-400">
              Authority: <strong className="text-amber-300">{selectedRole}</strong>
            </span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {(Object.keys(ROLE_CONFIGS) as SelectableRole[]).map((roleKey) => {
              const cfg = ROLE_CONFIGS[roleKey];
              const isSelected = selectedRole === roleKey;
              const Icon = cfg.icon;

              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectRole(roleKey)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? `${cfg.activeBg} ${cfg.activeBorder} shadow-[0_0_20px_rgba(242,191,78,0.2)] scale-[1.02] border-2`
                      : 'bg-[#0a0e1c] border-white/[0.06] hover:border-white/[0.18] opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4" style={{ color: cfg.themeColor }} />
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-cinzel text-slate-100 leading-tight">
                      {cfg.label}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {cfg.roleSubtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Role Authority Summary Banner */}
        <div className="bg-[#0a0e1c]/90 border border-white/[0.08] rounded-xl p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between font-cinzel text-[11px]">
            <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase">
              <ScrollText className="w-3.5 h-3.5 text-amber-400" />
              AUTHORITY SCOPE:
            </span>
            <span
              className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px]"
              style={{ backgroundColor: `${activeConfig.themeColor}20`, color: activeConfig.themeColor }}
            >
              {activeConfig.badgeText}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            {activeConfig.scopeSummary}
          </p>
          <div className="text-[10px] text-slate-400 font-mono pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
            <span>Primary Destination:</span>
            <span className="text-amber-300 font-semibold">{activeConfig.landingPath}</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 flex items-start gap-2.5 shadow font-sans backdrop-blur-md animate-in fade-in duration-200">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-rose-100 mb-0.5">Authentication Failure</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Counsel Username ({activeConfig.id})
              </label>
              <button
                type="button"
                onClick={() => {
                  setUsername(activeConfig.defaultUsername);
                  setPassword('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-mono"
              >
                Reset: {activeConfig.defaultUsername}
              </button>
            </div>
            <div
              className={`flex items-center gap-3 bg-[#090d1a] border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors ${
                usernameError || error ? 'border-rose-500' : 'border-white/[0.1] focus-within:border-amber-400 focus-within:shadow-[0_0_12px_rgba(242,191,78,0.2)]'
              }`}
            >
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError(null);
                  if (error) setError(null);
                }}
                placeholder={`Enter username (${activeConfig.defaultUsername})`}
                className="bg-transparent border-none outline-none w-full text-xs text-slate-100 placeholder-slate-500 font-mono"
              />
            </div>
            {usernameError && <p className="text-xs text-rose-400 mt-1 font-sans">{usernameError}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 uppercase tracking-wide">
              Secret Passcode ({activeConfig.id})
            </label>
            <div
              className={`flex items-center gap-3 bg-[#090d1a] border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors ${
                passwordError || error ? 'border-rose-500' : 'border-white/[0.1] focus-within:border-amber-400 focus-within:shadow-[0_0_12px_rgba(242,191,78,0.2)]'
              }`}
            >
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (error) setError(null);
                }}
                placeholder="Enter secret passcode..."
                className="bg-transparent border-none outline-none w-full text-xs text-slate-100 placeholder-slate-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
                title={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-rose-400 mt-1 font-sans">{passwordError}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="hy-btn-gold w-full py-3 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2 font-bold cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-slate-950" />
            <span>{loading ? 'Authenticating Credentials...' : `ENTER HIGH COUNSEL AS ${selectedRole.toUpperCase()}`}</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </form>

        {/* 1-Click Fast Fill Credentials Shortcuts */}
        <div className="bg-[#090d1a]/80 border border-white/[0.08] rounded-xl p-3.5 space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              1-Click Fast Fill Test Accounts:
            </span>
            <span className="text-[10px] font-mono text-slate-400">Pre-populates Passcode</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleQuickFill('Admin')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                selectedRole === 'Admin'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-amber-400/40 hover:text-white'
              }`}
            >
              <div className="font-bold">👑 Admin</div>
              <div className="text-[10px] text-slate-400 mt-0.5">admin123</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('Moderator')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                selectedRole === 'Moderator'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-cyan-400/40 hover:text-white'
              }`}
            >
              <div className="font-bold">🛡️ Moderator</div>
              <div className="text-[10px] text-slate-400 mt-0.5">mod123</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('Technical Support')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                selectedRole === 'Technical Support'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-emerald-400/40 hover:text-white'
              }`}
            >
              <div className="font-bold">🎧 Support</div>
              <div className="text-[10px] text-slate-400 mt-0.5">tech123</div>
            </button>
          </div>
        </div>

        {/* Trust & Security Verification Footer */}
        <div className="text-center border-t border-white/[0.08] pt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            .NET 9 + SignalR Hubs
          </span>
          <span>Security Protocol v2.4</span>
        </div>
      </div>
    </div>
  );
};
