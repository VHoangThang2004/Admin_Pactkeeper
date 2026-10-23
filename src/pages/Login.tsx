import React, { useState } from 'react';
import { Crown, Lock, User, ShieldCheck, XCircle, Eye, EyeOff, ArrowRight, Activity, ScrollText } from 'lucide-react';
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
  themeColor: string;
  activeBg: string;
  activeBorder: string;
  scopeSummary: string;
}

const ROLE_CONFIGS: Record<SelectableRole, RoleConfig> = {
  Admin: {
    id: 'Admin',
    label: 'High Counsel Admin',
    roleSubtitle: 'Accounts & Admin Dashboard',
    icon: Crown,
    badgeText: 'ACCOUNTS & DASHBOARD',
    landingPath: 'Admin Dashboard (/)',
    defaultUsername: 'admin',
    themeColor: '#fbbf24',
    activeBg: 'bg-amber-500/15',
    activeBorder: 'border-amber-400',
    scopeSummary: 'Direct responsibility for Manage User Accounts (Profiles, Bans, Balances) and View Admin Dashboard.',
  },
  Moderator: {
    id: 'Moderator',
    label: 'Realm Moderator',
    roleSubtitle: 'Gacha, Story, Items & Match Inspect',
    icon: ScrollText,
    badgeText: 'GACHA, ITEMS & MATCHES',
    landingPath: 'Match Supervision (/matches)',
    defaultUsername: 'moderator',
    themeColor: '#38bdf8',
    activeBg: 'bg-cyan-500/15',
    activeBorder: 'border-cyan-400',
    scopeSummary: 'Direct responsibility for Gacha/Story Config, Item/Combat Reward Config, and Inspect PvP Matches (Team Formation & Logs).',
  },
  'Technical Support': {
    id: 'Technical Support',
    label: 'Technical Support',
    roleSubtitle: 'System Status, Overrides & Alerts',
    icon: Activity,
    badgeText: 'SYSTEM STATUS & ALERTS',
    landingPath: 'System Monitor & Status (/)',
    defaultUsername: 'techsupport',
    themeColor: '#34d399',
    activeBg: 'bg-emerald-500/15',
    activeBorder: 'border-emerald-400',
    scopeSummary: 'Direct responsibility for Monitor System/Server Status, Configure System Overrides & Statistic Requests, and View Logs & Alerts.',
  },
};

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

      // 3. Resolve portal role
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
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Celestial Mesh Orbs */}
      <div 
        className="fixed pointer-events-none -top-40 -left-40 w-[600px] h-[600px] bg-amber-500/[0.07] rounded-full blur-[140px]" 
        aria-hidden="true" 
      />
      <div 
        className="fixed pointer-events-none -bottom-40 -right-40 w-[700px] h-[700px] bg-cyan-500/[0.05] rounded-full blur-[160px]" 
        aria-hidden="true" 
      />

      {/* Login Box (Dark Glassmorphic Portal) */}
      <div className="w-full max-w-xl glass-panel border border-white/[0.1] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 md:p-8 relative z-10 space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2 border-b border-white/[0.08] pb-5">
          <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-white/[0.1] shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-1">
            <Crown className="w-8 h-8 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          </div>
          <h1 className="text-2xl font-black font-cinzel tracking-wider uppercase gold-gradient-text">
            PACTKEEPER HIGH COUNSEL
          </h1>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest font-mono">
            Realm Governance & Administrative Gateway
          </p>
        </div>

        {/* Interactive Role Selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Select Target Authority:</span>
            <span className="text-[11px] font-mono font-normal text-slate-400">
              Role: <strong className="text-amber-300">{selectedRole}</strong>
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
                      ? `${cfg.activeBg} ${cfg.activeBorder} shadow-lg scale-[1.02] border-2`
                      : 'bg-black/40 border-white/[0.06] hover:border-white/[0.15] opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
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
        <div className="bg-slate-950/70 border border-white/[0.08] rounded-xl p-3.5 space-y-1.5 text-xs">
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
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {activeConfig.scopeSummary}
          </p>
          <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
            <span>Default Destination:</span>
            <span className="text-amber-300 font-semibold">{activeConfig.landingPath}</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 flex items-start gap-2.5 shadow font-sans backdrop-blur-md">
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
              className={`flex items-center gap-3 bg-slate-950/80 border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors ${
                usernameError || error ? 'border-rose-500' : 'border-white/[0.1] focus-within:border-amber-400'
              }`}
            >
              <User className="w-4 h-4 text-slate-500 shrink-0" />
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
              className={`flex items-center gap-3 bg-slate-950/80 border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors ${
                passwordError || error ? 'border-rose-500' : 'border-white/[0.1] focus-within:border-amber-400'
              }`}
            >
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
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
                className="text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
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
            className="btn-primary-gold w-full py-3 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2"
          >
            <ShieldCheck className="w-4 h-4 text-slate-950" />
            <span>{loading ? 'Authenticating Credentials...' : `ENTER HIGH COUNSEL AS ${selectedRole.toUpperCase()}`}</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </form>

        {/* Quick Role Switcher Reference */}
        <div className="bg-slate-950/70 border border-white/[0.08] rounded-xl p-3.5 space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Quick Credential Shortcuts:</span>
            <span className="text-[10px] font-mono text-slate-500">Click to Select</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleSelectRole('Admin')}
              className={`p-2 rounded-lg border text-center transition-all ${
                selectedRole === 'Admin'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-amber-400/40'
              }`}
            >
              👑 admin
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('Moderator')}
              className={`p-2 rounded-lg border text-center transition-all ${
                selectedRole === 'Moderator'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-cyan-400/40'
              }`}
            >
              🛡️ moderator
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('Technical Support')}
              className={`p-2 rounded-lg border text-center transition-all ${
                selectedRole === 'Technical Support'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-emerald-400/40'
              }`}
            >
              🎧 techsupport
            </button>
          </div>
        </div>

        <div className="text-center border-t border-white/[0.08] pt-3">
          <span className="text-[11px] text-slate-500 font-mono">
            Connected to GameInventoryApi (.NET 9 Gateway & SignalR Hubs)
          </span>
        </div>
      </div>
    </div>
  );
};
