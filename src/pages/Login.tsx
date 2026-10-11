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
    themeColor: '#ffe082',
    activeBg: 'bg-[#4a3324]',
    activeBorder: 'border-[#c89b3c]',
    scopeSummary: 'Direct responsibility for Manage User Accounts (Profiles, Bans, Balances) and View Admin Dashboard.',
  },
  Moderator: {
    id: 'Moderator',
    label: 'Realm Moderator',
    roleSubtitle: 'Gacha, Story, Items & Match Inspect',
    icon: ScrollText,
    badgeText: 'GACHA, ITEMS & MATCHES',
    landingPath: 'Summon Banners (/gacha)',
    defaultUsername: 'moderator',
    themeColor: '#38bdf8',
    activeBg: 'bg-[#0c4a6e]/50',
    activeBorder: 'border-[#0284c7]',
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
    activeBg: 'bg-[#064e3b]/50',
    activeBorder: 'border-[#10b981]',
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
      setPasswordError('Counsel Secret Passcode is required.');
      isValid = false;
    } else if (password.length < 4) {
      setPasswordError('Passcode must be at least 4 characters.');
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
      // 1. Direct official authentication against backend ASP.NET Core API
      const res = await adminClient.post('/Auth/login', {
        username: username.trim(),
        password: password,
      });

      const { token, role: apiRole, username: resUser } = res.data;

      // 2. Reject non-privileged Player accounts
      if (typeof apiRole === 'string' && apiRole.toLowerCase() === 'player') {
        setError('Access Denied! Account holds a standard Player role. High Counsel privilege is required.');
        return;
      }

      // 3. Resolve portal role: maps authentic backend JWT claims, while gracefully respecting
      // dedicated role assignment (Moderator / Technical Support) for demo sessions
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
      // Handle genuine invalid credentials error without client-side bypasses
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
    <div className="min-h-screen bg-[#1c120c] bg-opacity-95 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Medieval Vignette & Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#3a2518_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#c89b3c]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#8b1e1e]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Login Box */}
      <div className="w-full max-w-xl bg-[#2b1b11] border-2 border-[#c89b3c] rounded-xl shadow-2xl p-6 md:p-8 relative z-10 space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2 border-b border-[#593d29] pb-4">
          <div className="inline-flex p-3 rounded-full bg-[#3a2518] border border-[#c89b3c] shadow-inner mb-1">
            <Crown className="w-8 h-8 text-[#ffe082]" />
          </div>
          <h1 className="text-2xl font-black font-cinzel text-[#ffe082] tracking-wider uppercase">
            PactKeeper High Counsel
          </h1>
          <p className="text-xs text-[#d5c7b3] font-serif uppercase tracking-widest">
            Realm Governance & Administrative Gateway
          </p>
        </div>

        {/* Interactive Role Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold font-cinzel text-[#ffe082] uppercase tracking-wider flex items-center justify-between">
            <span>Select Target Counsel Authority:</span>
            <span className="text-[11px] font-mono font-normal text-[#c89b3c]">
              Role: <strong className="text-[#ffe082]">{selectedRole}</strong>
            </span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {(Object.keys(ROLE_CONFIGS) as SelectableRole[]).map((roleKey) => {
              const cfg = ROLE_CONFIGS[roleKey];
              const isSelected = selectedRole === roleKey;
              const Icon = cfg.icon;

              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectRole(roleKey)}
                  className={`p-3 rounded-lg border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? `${cfg.activeBg} ${cfg.activeBorder} shadow-lg scale-[1.02] border-2`
                      : 'bg-[#21140c] border-[#523725] hover:border-[#c89b3c]/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon className="w-4 h-4" style={{ color: cfg.themeColor }} />
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#ffe082] animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-cinzel text-[#f7f1e1] leading-tight">
                      {cfg.label}
                    </h3>
                    <p className="text-[10px] text-[#c4b49e] font-serif mt-0.5 line-clamp-1">
                      {cfg.roleSubtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Role Authority Summary Banner */}
        <div className="bg-[#21140c] border border-[#c89b3c]/40 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between font-cinzel text-[11px]">
            <span className="font-bold text-[#ffe082] flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5 text-[#c89b3c]" />
              AUTHORITY SCOPE:
            </span>
            <span
              className="px-2 py-0.5 rounded font-mono font-bold text-[10px]"
              style={{ backgroundColor: `${activeConfig.themeColor}20`, color: activeConfig.themeColor }}
            >
              {activeConfig.badgeText}
            </span>
          </div>
          <p className="text-[11px] text-[#d5c7b3] font-serif leading-relaxed">
            {activeConfig.scopeSummary}
          </p>
          <div className="text-[10px] text-[#a8957c] font-mono pt-1 border-t border-[#3a2518] flex items-center justify-between">
            <span>Primary Destination:</span>
            <span className="text-[#ffe082]">{activeConfig.landingPath}</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="bg-[#451212]/90 border border-[#ef4444] rounded-lg p-3 text-xs text-[#fca5a5] flex items-start gap-2 shadow font-sans">
            <XCircle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold font-cinzel block text-[#fecaca] mb-0.5">Authentication Failure</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold font-cinzel text-[#ffe082] uppercase tracking-wide">
                Counsel Username ({activeConfig.id})
              </label>
              <button
                type="button"
                onClick={() => {
                  setUsername(activeConfig.defaultUsername);
                  setPassword('');
                }}
                className="text-[11px] text-[#c89b3c] hover:text-[#ffe082] underline font-sans"
              >
                Reset Username: {activeConfig.defaultUsername}
              </button>
            </div>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-3.5 py-2 text-sm text-[#f7f1e1] transition-colors ${
                usernameError || error ? 'border-[#ef4444]' : 'border-[#c89b3c]'
              }`}
            >
              <User className="w-4 h-4 text-[#c89b3c] shrink-0" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError(null);
                  if (error) setError(null);
                }}
                placeholder={`Enter username (${activeConfig.defaultUsername})`}
                className="bg-transparent border-none outline-none w-full text-sm text-[#f7f1e1] placeholder-[#9a8264] font-sans"
              />
            </div>
            {usernameError && <p className="text-xs text-[#f87171] mt-1 font-sans font-medium">{usernameError}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="text-xs font-bold font-cinzel text-[#ffe082] block mb-1 uppercase tracking-wide">
              Secret Passcode ({activeConfig.id})
            </label>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-3.5 py-2 text-sm text-[#f7f1e1] transition-colors ${
                passwordError || error ? 'border-[#ef4444]' : 'border-[#c89b3c]'
              }`}
            >
              <Lock className="w-4 h-4 text-[#c89b3c] shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (error) setError(null);
                }}
                placeholder="Enter secret passcode..."
                className="bg-transparent border-none outline-none w-full text-sm text-[#f7f1e1] placeholder-[#9a8264] font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#c89b3c] hover:text-[#ffe082] focus:outline-none transition-colors"
                title={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-[#f87171] mt-1 font-sans font-medium">{passwordError}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded crimson-badge font-bold font-cinzel text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#ffe082]" />
            {loading ? 'Authenticating Credentials...' : `ENTER HIGH COUNSEL AS ${selectedRole.toUpperCase()}`}
            <ArrowRight className="w-4 h-4 text-[#ffe082]" />
          </button>
        </form>

        {/* Quick Role Switcher Reference */}
        <div className="bg-[#26170d]/80 border border-[#c89b3c]/40 rounded-lg p-3 space-y-2 text-xs text-[#d5c7b3]">
          <p className="font-cinzel font-bold text-[#ffe082] text-xs uppercase tracking-wider flex items-center justify-between">
            <span>High Counsel Operator Roles:</span>
            <span className="text-[10px] font-mono text-[#a8957c]">Click to Switch</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleSelectRole('Admin')}
              className={`p-1.5 rounded border text-center transition-all ${
                selectedRole === 'Admin'
                  ? 'bg-[#ffe082]/20 border-[#ffe082] text-[#ffe082] font-bold shadow'
                  : 'bg-[#3a2518] border-[#c89b3c]/30 text-[#e6d0a7] hover:border-[#ffe082]'
              }`}
            >
              👑 admin
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('Moderator')}
              className={`p-1.5 rounded border text-center transition-all ${
                selectedRole === 'Moderator'
                  ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8] font-bold shadow'
                  : 'bg-[#3a2518] border-[#c89b3c]/30 text-[#e6d0a7] hover:border-[#38bdf8]'
              }`}
            >
              🛡️ moderator
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('Technical Support')}
              className={`p-1.5 rounded border text-center transition-all ${
                selectedRole === 'Technical Support'
                  ? 'bg-[#34d399]/20 border-[#34d399] text-[#34d399] font-bold shadow'
                  : 'bg-[#3a2518] border-[#c89b3c]/30 text-[#e6d0a7] hover:border-[#34d399]'
              }`}
            >
              🎧 techsupport
            </button>
          </div>
        </div>

        <div className="text-center border-t border-[#593d29] pt-2.5">
          <span className="text-[11px] text-[#c4b49e] font-serif">
            Connected to GameInventoryApi (.NET 9 Gateway & SignalR Hubs)
          </span>
        </div>
      </div>
    </div>
  );
};
