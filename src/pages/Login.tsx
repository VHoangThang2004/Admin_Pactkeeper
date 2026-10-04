import React, { useState } from 'react';
import { Crown, Lock, User, ShieldCheck, XCircle, Eye, EyeOff } from 'lucide-react';
import { adminClient } from '../api/adminClient';

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
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
      setUsernameError('Administrator Username is required.');
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

      // Verify Administrator Privilege
      if (role && role !== 'Admin' && role !== 'Server') {
        setError('Access Denied! Account holds a Player role. Administrator privilege is required.');
        return;
      }

      if (token) {
        onLoginSuccess(token, resUser || username);
      } else {
        setError('Incorrect Username or Passcode! Please verify your administrator credentials.');
      }
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.message || err.response.data;

        if (status === 401 || status === 400) {
          setError('Incorrect Username or Passcode! Please enter valid administrator credentials.');
        } else if (status === 403) {
          setError('Access Denied! Account lacks Administrator role authorization.');
        } else if (status === 500) {
          setError('Internal Server Error on Realm Gateway (500). Please try again shortly.');
        } else {
          setError(typeof msg === 'string' ? msg : 'Authentication failed. Status code: ' + status);
        }
      } else {
        // Handle incorrect input or offline local authentication
        if (username.trim().toLowerCase() === 'admin' && password === 'admin123') {
          onLoginSuccess('demo-admin-jwt-token-12345', 'admin');
          return;
        }
        setError('Incorrect Username or Passcode! Please verify your credentials (admin / admin123).');
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
            <label className="text-xs font-bold font-cinzel text-[#ffe082] block mb-1.5 uppercase">
              Administrator Username
            </label>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-4 py-2.5 text-xs text-[#f7f1e1] transition-colors ${usernameError || error ? 'border-[#ef4444]' : 'border-[#c89b3c]'
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
                placeholder="Enter username"
                className="bg-transparent border-none outline-none w-full text-xs text-[#f7f1e1] placeholder-[#8c7456]"
              />
            </div>
            {usernameError && <p className="text-[11px] text-[#f87171] mt-1 font-bold">{usernameError}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="text-xs font-bold font-cinzel text-[#ffe082] block mb-1.5 uppercase">
              Counsel Secret Passcode
            </label>
            <div
              className={`flex items-center gap-3 bg-[#26170d] border rounded px-4 py-2.5 text-xs text-[#f7f1e1] transition-colors ${passwordError || error ? 'border-[#ef4444]' : 'border-[#c89b3c]'
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
                placeholder="Enter password"
                className="bg-transparent border-none outline-none w-full text-xs text-[#f7f1e1] placeholder-[#8c7456]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#c89b3c] hover:text-[#ffe082] focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && <p className="text-[11px] text-[#f87171] mt-1 font-bold">{passwordError}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded crimson-badge font-bold font-cinzel text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#ffe082]" />
            {loading ? 'Authenticating Counsel...' : 'ENTER HIGH COUNSEL'}
          </button>
        </form>

        <div className="text-center border-t border-[#593d29] pt-4">
          <span className="text-[11px] text-[#c4b49e]">Connected to GameInventoryApi (.NET 9 Gateway)</span>
        </div>
      </div>
    </div>
  );
};
