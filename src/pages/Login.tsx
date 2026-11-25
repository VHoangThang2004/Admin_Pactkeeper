import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Moon,
  ScrollText,
  Sun,
  User,
} from 'lucide-react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
import { EmberAtmosphere } from '../components/ui/EmberAtmosphere';
import { useThemeMode } from '../hooks/useThemeMode';
import { recordAuditEvent, recordLoginAttempt } from '../services/adminSecurityService';
import type { AdminPermissionKey, CounselRole } from '../types';
import { extractClaimsFromToken, normalizeCounselRole } from '../utils/authSession';

interface LoginProps {
  onLoginSuccess: (
    token: string,
    username: string,
    role: CounselRole,
    permissions?: AdminPermissionKey[]
  ) => void;
}

type SelectableRole = 'Admin' | 'Moderator' | 'Technical Support';

interface RoleConfig {
  id: SelectableRole;
  label: string;
  icon: typeof Crown;
  defaultUsername: string;
  defaultPasswordHint: string;
}

const ROLE_CONFIGS: Record<SelectableRole, RoleConfig> = {
  Admin: {
    id: 'Admin',
    label: 'Admin',
    icon: Crown,
    defaultUsername: 'admin',
    defaultPasswordHint: 'admin123',
  },
  Moderator: {
    id: 'Moderator',
    label: 'Moderator',
    icon: ScrollText,
    defaultUsername: 'moderator',
    defaultPasswordHint: 'mod123',
  },
  'Technical Support': {
    id: 'Technical Support',
    label: 'Tech Support',
    icon: Activity,
    defaultUsername: 'techsupport',
    defaultPasswordHint: 'tech123',
  },
};

const LOGIN_SCENES = [
  { id: 'awaken', num: '01', src: '/game-assets/hero-awaken.png', label: 'The Awakening' },
  { id: 'briefing', num: '02', src: '/game-assets/hero-briefing.png', label: 'War Counsel' },
  { id: 'eye', num: '03', src: '/game-assets/hero-eye.png', label: 'Heavenly Eye' },
  { id: 'ambush', num: '04', src: '/game-assets/hero-ambush.png', label: 'Frontier Ambush' },
] as const;

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const isDevMode = import.meta.env.DEV;
  const { mode, toggleMode } = useThemeMode();
  const [selectedRole, setSelectedRole] = useState<SelectableRole>('Admin');
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSceneIndex((prev) => (prev + 1) % LOGIN_SCENES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSelectRole = (role: SelectableRole) => {
    setSelectedRole(role);
    setError(null);
    setUsernameError(null);
    setPasswordError(null);
  };

  const handleQuickFill = (role: SelectableRole) => {
    if (!isDevMode) return;
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
      setUsernameError('Username is required.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setLoading(true);
    setError(null);

    const attemptedUsername = username.trim();

    try {
      const response = await adminClient.post('/Auth/login', {
        username: attemptedUsername,
        password,
        attemptedRole: selectedRole,
      });

      const {
        token,
        username: resUser,
        role: apiRole,
        permissions: apiPermissions,
      } = response.data || {};
      const resolvedUser = (typeof resUser === 'string' && resUser.trim()) || attemptedUsername;
      const claims = extractClaimsFromToken(token);
      const rawRoleString = String(claims?.role || apiRole || '').trim();
      const roleLower = rawRoleString.toLowerCase();

      if (roleLower === 'player') {
        const denyMsg =
          'Access Denied! Account holds a standard Player role. High Counsel privilege is required.';
        recordLoginAttempt({
          username: attemptedUsername,
          attemptedRole: selectedRole,
          resolvedRole: 'Player',
          status: 'DENIED_PLAYER',
          reason: denyMsg,
        });
        void recordAuditEvent({
          action: 'PLAYER_PORTAL_ACCESS_DENIED',
          category: 'AUTH',
          severity: 'HIGH',
          targetType: 'Account',
          targetLabel: attemptedUsername,
          rationale: denyMsg,
          status: 'FAILED',
          errorMessage: denyMsg,
          actorUsername: attemptedUsername,
          actorRole: 'Player',
        });
        setError(denyMsg);
        return;
      }

      if (!token) {
        const noTokenMsg =
          'Authentication succeeded but no authorization token was returned by the Gateway.';
        recordLoginAttempt({
          username: attemptedUsername,
          attemptedRole: selectedRole,
          status: 'FAILED',
          reason: noTokenMsg,
        });
        setError(noTokenMsg);
        return;
      }

      const explicitPermissions = (
        Array.isArray(apiPermissions) ? apiPermissions : claims?.permissions || []
      ) as AdminPermissionKey[];

      const serverRole = normalizeCounselRole(rawRoleString);
      if (!serverRole && explicitPermissions.length === 0) {
        const unauthorizedMsg =
          'Access Denied! Account role does not hold High Counsel portal permissions.';
        recordLoginAttempt({
          username: resolvedUser,
          attemptedRole: selectedRole,
          resolvedRole: rawRoleString || 'Unknown',
          status: 'FAILED',
          reason: unauthorizedMsg,
        });
        setError(unauthorizedMsg);
        return;
      }

      let normalizedRole: CounselRole = serverRole || ((rawRoleString as CounselRole) || 'Moderator');
      if (isDevMode && (serverRole === 'Admin' || serverRole === 'Server')) {
        if (selectedRole === 'Moderator' || resolvedUser.toLowerCase() === 'moderator') {
          normalizedRole = 'Moderator';
        } else if (
          selectedRole === 'Technical Support' ||
          resolvedUser.toLowerCase() === 'techsupport'
        ) {
          normalizedRole = 'Technical Support';
        }
      }

      recordLoginAttempt({
        username: resolvedUser,
        attemptedRole: selectedRole,
        resolvedRole: normalizedRole,
        status: 'SUCCESS',
        reason: 'Authenticated via POST /api/Auth/login',
      });
      void recordAuditEvent({
        action: 'ADMIN_LOGIN',
        category: 'AUTH',
        severity: 'LOW',
        targetType: 'Session',
        targetLabel: resolvedUser,
        afterState: { resolvedRole: normalizedRole },
        actorUsername: resolvedUser,
        actorRole: normalizedRole,
      });

      onLoginSuccess(token, resolvedUser, normalizedRole, explicitPermissions);
      return;
    } catch (err: any) {
      let failureMsg =
        'Unable to connect to Realm Gateway. Please verify the backend server is reachable.';
      if (err.response) {
        const status = err.response.status;
        const apiMessage =
          typeof err.response.data?.message === 'string' && err.response.data.message.trim()
            ? err.response.data.message.trim()
            : null;
        if (status === 401 || status === 400) {
          failureMsg =
            apiMessage ||
            `Invalid credentials for ${selectedRole}! Please verify your username and passcode.`;
        } else if (status === 403) {
          failureMsg = apiMessage || 'Access Denied! Account lacks High Counsel authorization.';
        } else if (status === 500) {
          failureMsg = 'Internal Server Error on Realm Gateway (500). Please try again shortly.';
        } else {
          failureMsg = apiMessage || `Authentication failed with status code ${status}.`;
        }
      }
      recordLoginAttempt({
        username: attemptedUsername || '(empty)',
        attemptedRole: selectedRole,
        status: 'FAILED',
        reason: failureMsg,
      });
      setError(failureMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pk-login-stage min-h-dvh text-[var(--color-text-primary)] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Unity_Pactkeeper Ken Burns Key-Art Backdrop */}
      <div className="pk-login-bg-layer" aria-hidden="true">
        {LOGIN_SCENES.map((scene, idx) => (
          <img
            key={scene.id}
            src={scene.src}
            alt=""
            className={
              idx === activeSceneIndex
                ? 'pk-login-bg-img pk-login-bg-img-active'
                : 'pk-login-bg-img'
            }
          />
        ))}
      </div>
      <div className="pk-login-scrim" aria-hidden="true" />
      <EmberAtmosphere />

      <div className="relative z-10 w-full max-w-lg pk-page-enter flex flex-col gap-3">
        <Card elevation="high" padding={5} className="pk-login-card pk-spotlight">
          <VStack gap={4}>
            {/* Brand Header + Theme Toggle */}
            <div className="relative">
              <div className="absolute right-0 top-0">
                <IconButton
                  label={mode === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode'}
                  tooltip={mode === 'light' ? 'Dark Mode' : 'Light Mode'}
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={mode === 'light' ? Moon : Sun} />}
                  onClick={toggleMode}
                />
              </div>

              <VStack gap={1.5} hAlign="center">
                <img
                  src="/logo.png"
                  alt="PactKeeper Emblem"
                  className="pk-brand-logo-login"
                />
                <Heading level={1} type="display-2" className="font-cinzel pk-gold-text text-center">
                  Pactkeeper Game Management
                </Heading>
              </VStack>
            </div>

            <Divider />

            {/* Role Selector */}
            <VStack gap={2}>
              <Text type="label" size="sm">
                Select Role
              </Text>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(ROLE_CONFIGS) as SelectableRole[]).map((roleKey) => {
                  const cfg = ROLE_CONFIGS[roleKey];
                  const isSelected = selectedRole === roleKey;
                  const RoleIcon = cfg.icon;

                  return (
                    <button
                      key={roleKey}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectRole(roleKey)}
                      className={`flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-semibold whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                        isSelected
                          ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] border-[var(--color-accent)] shadow-sm'
                          : 'bg-[var(--color-background-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <RoleIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </VStack>

            {/* Error Alert */}
            {error && <Banner status="error" title="Login Failed" description={error} />}

            {/* Login Credentials Form */}
            <form onSubmit={handleSubmit}>
              <VStack gap={3}>
                <VStack gap={1}>
                  <Text type="label" size="sm">
                    Username
                  </Text>
                  <TextInput
                    label="Username"
                    isLabelHidden
                    value={username}
                    onChange={(val) => {
                      setUsername(val);
                      if (usernameError) setUsernameError(null);
                      if (error) setError(null);
                    }}
                    startIcon={User}
                    placeholder="Enter username"
                    autoComplete="username"
                    width="100%"
                    status={
                      usernameError
                        ? { type: 'error', message: usernameError }
                        : error
                          ? { type: 'error' }
                          : undefined
                    }
                  />
                </VStack>

                <InputGroup
                  label="Password"
                  status={
                    passwordError
                      ? { type: 'error', message: passwordError }
                      : error
                        ? { type: 'error' }
                        : undefined
                  }
                >
                  <TextInput
                    label="Password"
                    isLabelHidden
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      if (passwordError) setPasswordError(null);
                      if (error) setError(null);
                    }}
                    startIcon={Lock}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    width="100%"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    isIconOnly
                    label={showPassword ? 'Hide password' : 'Show password'}
                    tooltip={showPassword ? 'Hide password' : 'Show password'}
                    icon={<Icon icon={showPassword ? EyeOff : Eye} />}
                    onClick={() => setShowPassword((prev) => !prev)}
                  />
                </InputGroup>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  width="100%"
                  isLoading={loading}
                  endContent={<Icon icon={ArrowRight} />}
                  label={loading ? 'Logging in...' : 'Login'}
                />
              </VStack>
            </form>

            {/* Dev Fast-Fill Credentials */}
            {isDevMode && (
              <Card variant="muted" padding={3}>
                <VStack gap={2}>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={KeyRound} size="sm" color="accent" />
                    <Text type="label" size="xsm" color="secondary">
                      Quick Fill (Dev)
                    </Text>
                  </HStack>

                  <Grid columns={{ minWidth: 110, max: 3 }} gap={2}>
                    {(Object.keys(ROLE_CONFIGS) as SelectableRole[]).map((roleKey) => {
                      const cfg = ROLE_CONFIGS[roleKey];
                      const active = selectedRole === roleKey;
                      return (
                        <Button
                          key={roleKey}
                          type="button"
                          variant={active ? 'primary' : 'secondary'}
                          size="sm"
                          width="100%"
                          icon={<Icon icon={cfg.icon} />}
                          label={cfg.label}
                          onClick={() => handleQuickFill(roleKey)}
                        />
                      );
                    })}
                  </Grid>
                </VStack>
              </Card>
            )}
          </VStack>
        </Card>
      </div>
    </div>
  );
};
