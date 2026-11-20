import React, { useState } from 'react';
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
  ShieldCheck,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card, type CardVariant } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { StackItem } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { adminClient } from '../api/adminClient';
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
  roleSubtitle: string;
  icon: typeof Crown;
  badgeText: string;
  landingPath: string;
  defaultUsername: string;
  defaultPasswordHint: string;
  badgeVariant: BadgeVariant;
  cardVariant: CardVariant;
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
    badgeVariant: 'yellow',
    cardVariant: 'yellow',
    scopeSummary:
      'Authoritative responsibility for Manage User Accounts (Profiles, Bans, Balances) and View Realm Treasury.',
  },
  Moderator: {
    id: 'Moderator',
    label: 'Realm Moderator',
    roleSubtitle: 'Player Directory, Standing & Moderation',
    icon: ScrollText,
    badgeText: 'PLAYER MODERATION',
    landingPath: 'Player Management (/players)',
    defaultUsername: 'moderator',
    defaultPasswordHint: 'mod123',
    badgeVariant: 'cyan',
    cardVariant: 'cyan',
    scopeSummary:
      'Direct responsibility for Player Directory, Profile Inspection, Ban/Unban Sanctions, and Match Behavior Review (no server/content config).',
  },
  'Technical Support': {
    id: 'Technical Support',
    label: 'Technical Support',
    roleSubtitle: 'System Status, Match Logs & Live Chat',
    icon: Activity,
    badgeText: 'STATUS, LOGS & CHAT',
    landingPath: 'System Monitor & Status (/)',
    defaultUsername: 'techsupport',
    defaultPasswordHint: 'tech123',
    badgeVariant: 'green',
    cardVariant: 'green',
    scopeSummary:
      'Direct responsibility for Monitor System/Server Status, Configure System Overrides, Match Log Diagnostics, and Player Live Chat Desk.',
  },
};

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const isDevMode = import.meta.env.DEV;
  const { mode, toggleMode } = useThemeMode();
  const [selectedRole, setSelectedRole] = useState<SelectableRole>('Admin');
  const [username, setUsername] = useState(isDevMode ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (role: SelectableRole) => {
    setSelectedRole(role);
    const config = ROLE_CONFIGS[role];
    if (isDevMode) {
      setUsername(config.defaultUsername);
      setPassword('');
    }
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

  const activeConfig = ROLE_CONFIGS[selectedRole];

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <Card elevation="high" padding={6}>
          <VStack gap={5}>
            {/* Top Bar + Brand Crest */}
            <VStack gap={3}>
              <HStack justify="between" vAlign="center">
                <Badge label="HIGH COUNSEL GATEWAY" variant="yellow" icon={<Icon icon={Crown} />} />
                <IconButton
                  label={mode === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode'}
                  tooltip={mode === 'light' ? 'Dark Mode' : 'Light Mode'}
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={mode === 'light' ? Moon : Sun} />}
                  onClick={toggleMode}
                />
              </HStack>

              <VStack gap={1.5} hAlign="center">
                <Heading level={1} type="display-2" className="font-cinzel pk-gold-text text-center">
                  TACTICAL SRPG HIGH COUNSEL
                </Heading>
                <HStack gap={2} vAlign="center" hAlign="center" wrap="wrap">
                  <Badge label="v2.4.0" variant="neutral" />
                  <Text type="supporting" size="xsm" weight="medium">
                    REALM GOVERNANCE &amp; OPERATIONS PORTAL
                  </Text>
                </HStack>
              </VStack>
            </VStack>

            <Divider />

            {/* Authority Tier Selector */}
            <VStack gap={3}>
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <Text type="label" size="xsm">
                  Select Target Counsel Authority
                </Text>
                <HStack gap={1.5} vAlign="center">
                  <Text type="supporting" size="xsm">
                    Active Authority:
                  </Text>
                  <Badge label={selectedRole} variant={activeConfig.badgeVariant} />
                </HStack>
              </HStack>

              <Grid columns={{ minWidth: 165, max: 3 }} gap={3}>
                {(Object.keys(ROLE_CONFIGS) as SelectableRole[]).map((roleKey) => {
                  const cfg = ROLE_CONFIGS[roleKey];
                  const isSelected = selectedRole === roleKey;

                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => handleSelectRole(roleKey)}
                      className="text-left rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-primary)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <Card
                        variant={isSelected ? cfg.cardVariant : 'default'}
                        elevation={isSelected ? 'med' : 'none'}
                        padding={3}
                      >
                        <VStack gap={2}>
                          <HStack justify="between" vAlign="center">
                            <Icon icon={cfg.icon} size="sm" />
                            {isSelected ? (
                              <StatusDot variant="accent" isPulsing label="Active" />
                            ) : (
                              <Text type="supporting" size="2xs">
                                Select
                              </Text>
                            )}
                          </HStack>
                          <VStack gap={0.5}>
                            <Text weight="semibold" size="sm" className="font-cinzel">
                              {cfg.label}
                            </Text>
                            <Text type="supporting" size="xsm" maxLines={2}>
                              {cfg.roleSubtitle}
                            </Text>
                          </VStack>
                        </VStack>
                      </Card>
                    </button>
                  );
                })}
              </Grid>
            </VStack>

            {/* Selected Role Scope Card */}
            <Card variant="muted" padding={4}>
              <VStack gap={2}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={ScrollText} size="sm" color="accent" />
                    <Text type="label" size="xsm" className="font-cinzel">
                      AUTHORITY SCOPE
                    </Text>
                  </HStack>
                  <Badge label={activeConfig.badgeText} variant={activeConfig.badgeVariant} />
                </HStack>
                <Text type="supporting" size="sm">
                  {activeConfig.scopeSummary}
                </Text>
                <Divider />
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text type="supporting" size="xsm">
                    Primary Destination
                  </Text>
                  <Text type="code" size="xsm" weight="semibold" color="accent">
                    {activeConfig.landingPath}
                  </Text>
                </HStack>
              </VStack>
            </Card>

            {/* Error Alert */}
            {error && <Banner status="error" title="Authentication Failure" description={error} />}

            {/* Login Credentials Form */}
            <form onSubmit={handleSubmit}>
              <VStack gap={4}>
                <VStack gap={1}>
                  <HStack justify="between" vAlign="center">
                    <Text type="label" size="xsm">
                      Counsel Username ({activeConfig.id})
                    </Text>
                    {isDevMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        label={`Reset: ${activeConfig.defaultUsername}`}
                        onClick={() => {
                          setUsername(activeConfig.defaultUsername);
                          setPassword('');
                        }}
                      />
                    )}
                  </HStack>
                  <TextInput
                    label={`Counsel Username (${activeConfig.id})`}
                    isLabelHidden
                    value={username}
                    onChange={(val) => {
                      setUsername(val);
                      if (usernameError) setUsernameError(null);
                      if (error) setError(null);
                    }}
                    startIcon={User}
                    placeholder={`Enter username (${activeConfig.defaultUsername})`}
                    autoComplete="username"
                    width="100%"
                    status={
                      usernameError
                        ? { type: 'error', message: usernameError }
                        : error
                          ? { type: 'error' }
                          : undefined
                    }
                    isRequired
                  />
                </VStack>

                <InputGroup
                  label={`Secret Passcode (${activeConfig.id})`}
                  isRequired
                  status={
                    passwordError
                      ? { type: 'error', message: passwordError }
                      : error
                        ? { type: 'error' }
                        : undefined
                  }
                >
                  <TextInput
                    label={`Secret Passcode (${activeConfig.id})`}
                    isLabelHidden
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      if (passwordError) setPasswordError(null);
                      if (error) setError(null);
                    }}
                    startIcon={Lock}
                    placeholder="Enter secret passcode..."
                    autoComplete="current-password"
                    width="100%"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    isIconOnly
                    label={showPassword ? 'Hide passcode' : 'Show passcode'}
                    tooltip={showPassword ? 'Hide passcode' : 'Show passcode'}
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
                  icon={<Icon icon={ShieldCheck} />}
                  endContent={<Icon icon={ArrowRight} />}
                  label={
                    loading
                      ? 'Authenticating Credentials...'
                      : `Enter High Counsel as ${selectedRole}`
                  }
                />
              </VStack>
            </form>

            {/* Dev Fast-Fill Credentials */}
            {isDevMode && (
              <Card variant="muted" padding={4}>
                <VStack gap={3}>
                  <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                    <HStack gap={1.5} vAlign="center">
                      <Icon icon={KeyRound} size="sm" color="accent" />
                      <Text type="label" size="xsm">
                        1-Click Fast Fill Test Accounts (Dev)
                      </Text>
                    </HStack>
                    <Text type="code" size="2xs" color="secondary">
                      Pre-populates Passcode
                    </Text>
                  </HStack>

                  <Grid columns={{ minWidth: 140, max: 3 }} gap={2}>
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
                          label={`${roleKey === 'Technical Support' ? 'Support' : roleKey} (${cfg.defaultPasswordHint})`}
                          onClick={() => handleQuickFill(roleKey)}
                        />
                      );
                    })}
                  </Grid>
                </VStack>
              </Card>
            )}

            <Divider />

            {/* Verification Footer */}
            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={1.5} vAlign="center">
                <Icon icon={Sparkles} size="xsm" color="accent" />
                <Text type="code" size="xsm" color="secondary">
                  .NET 9 + SignalR Hubs
                </Text>
              </HStack>
              <StackItem>
                <Text type="code" size="xsm" color="secondary">
                  Security Protocol v2.4
                </Text>
              </StackItem>
            </HStack>
          </VStack>
        </Card>
      </div>
    </div>
  );
};
