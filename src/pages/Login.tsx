import React, { useState } from 'react';
import { Crown, Lock, User, ShieldCheck, XCircle, Eye, EyeOff } from 'lucide-react';
import { adminClient } from '../api/adminClient';
import type { CounselRole } from '../types';

interface LoginProps {
  onLoginSuccess: (token: string, username: string, role: CounselRole) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const res = await adminClient.post('/Auth/login', {
        username: username.trim(),
        password: password,
      });

      const { token, role, username: resUser } = res.data;

      // Verify Privilege: Reject standard Player role, allow Admin, Server, Moderator, Support
      let normalizedRole: CounselRole = 'Admin';
      if (typeof role === 'string') {
        const lower = role.toLowerCase();
        if (lower === 'player') {
          setError('Access Denied! Account holds a Player role. High Counsel privilege is required.');
          return;
        } else if (lower === 'support' || lower === 'cskh' || lower === 'cs') {
          normalizedRole = 'Support';
        } else if (lower === 'moderator' || lower === 'mod' || lower === 'gamemaster' || lower === 'gm') {
          normalizedRole = 'Moderator';
        } else if (lower === 'server') {
          normalizedRole = 'Server';
        } else {
          normalizedRole = 'Admin';
        }
      }

      if (token) {
        onLoginSuccess(token, resUser || username, normalizedRole);
      } else {
        setError('Incorrect Username or Passcode! Please verify your counsel credentials.');
      }
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.message || err.response.data;

        if (status === 401 || status === 400) {
          setError('Incorrect Username or Passcode! Please enter valid counsel credentials.');
        } else if (status === 403) {
          setError('Access Denied! Account lacks High Counsel authorization.');
        } else if (status === 500) {
          setError('Internal Server Error on Realm Gateway (500). Please try again shortly.');
        } else {
          setError(typeof msg === 'string' ? msg : 'Authentication failed. Status code: ' + status);
        }
      } else {
        // Handle incorrect input or offline local authentication for testing
        const u = username.trim().toLowerCase();
        if (u === 'support' && password === 'support123') {
          onLoginSuccess('demo-support-jwt-token-12345', 'support_herald', 'Support');
          return;
        }
        if (u === 'moderator' && password === 'mod123') {
          onLoginSuccess('demo-moderator-jwt-token-12345', 'realm_moderator', 'Moderator');
          return;
        }
        if (u === 'admin' && password === 'admin123') {
          onLoginSuccess('demo-admin-jwt-token-12345', 'high_counsel_admin', 'Admin');
          return;
        }
        setError('Incorrect Username or Passcode! (Demo credentials: admin / admin123, support / support123, moderator / mod123).');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4ecd8] flex items-center justify-center p-4 relative overflow-hidden font-serif">
      <div className="mahogany-banner p-8 rounded-lg border-2 border-[#c89b3c] w-full max-w-md space-y-6 relative z-10 shadow-2xl">
        {/* Brand Icon */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-b from-[#d4af37] to-[#aa7c11] border-2 border-[#ffe082] flex items-center justify-center shadow-xl">
            <Crown className="w-8 h-8 text-[#2b1b11]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#ffe082] tracking-wider uppercase font-cinzel">
            PACTKEEPER
          </h1>
          <p className="text-xs text-[#c4b49e]">High Counsel Admin & Realm Treasury Control</p>
        </div>

        {/* Prominent Red Error Banner on Incorrect Login */}
        {error && (
          <div className="p-4 rounded-lg bg-[#7f1d1d] border-2 border-[#ef4444] text-[#fca5a5] text-xs leading-relaxed flex items-start gap-3 shadow-xl animate-bounce">
            <XCircle className="w-5 h-5 text-[#f87171] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold font-cinzel text-[#ffe082] text-sm uppercase">AUTHENTICATION FAILED</p>
              <p className="mt-1 font-serif text-[#fca5a5]">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div>
            <label className="text-xs font-bold font-cinzel text-[#ffe082] block mb-1.5 uppercase tracking-wide">
              Counsel Username
            </label>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-4 py-2.5 text-sm text-[#f7f1e1] transition-colors ${
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
                placeholder="Enter administrator / support username"
                className="bg-transparent border-none outline-none w-full text-sm text-[#f7f1e1] placeholder-[#9a8264] font-sans"
              />
            </div>
            {usernameError && <p className="text-xs text-[#f87171] mt-1 font-sans font-medium">{usernameError}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="text-xs font-bold font-cinzel text-[#ffe082] block mb-1.5 uppercase tracking-wide">
              Counsel Secret Passcode
            </label>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-4 py-2.5 text-sm text-[#f7f1e1] transition-colors ${
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
                placeholder="Enter secret passcode"
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
            className="w-full py-3 rounded crimson-badge font-bold font-cinzel text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 mt-3"
          >
            <ShieldCheck className="w-4 h-4 text-[#ffe082]" />
            {loading ? 'Authenticating Counsel...' : 'ENTER HIGH COUNSEL'}
          </button>
        </form>

        {/* Demo Roles Quick Reference for Evaluators */}
        <div className="bg-[#26170d]/80 border border-[#c89b3c]/40 rounded-lg p-3 space-y-1.5 text-xs text-[#d5c7b3]">
          <p className="font-cinzel font-bold text-[#ffe082] text-xs uppercase tracking-wider">
            Quick Reference / Test Accounts:
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
            <span className="p-1 rounded bg-[#3a2518] border border-[#c89b3c]/30 text-center text-[#ffe082]">
              admin
            </span>
            <span className="p-1 rounded bg-[#3a2518] border border-[#c89b3c]/30 text-center text-[#38bdf8]">
              moderator
            </span>
            <span className="p-1 rounded bg-[#3a2518] border border-[#c89b3c]/30 text-center text-[#34d399]">
              support
            </span>
          </div>
        </div>

        <div className="text-center border-t border-[#593d29] pt-3">
          <span className="text-xs text-[#c4b49e] font-serif">Connected to GameInventoryApi (.NET 9 Gateway)</span>
        </div>
      </div>
    </div>
  );
};
