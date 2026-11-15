import React, { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { changeOwnPassword } from '../services/adminSecurityService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  role: string;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  username,
  role,
  onSuccess,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasMinLen = newPassword.length >= 8;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const differsFromCurrent = !currentPassword || newPassword !== currentPassword;
  const matchesConfirm = newPassword.length > 0 && newPassword === confirmPassword;

  const resetState = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
    setSubmitting(false);
    setShowPasswords(false);
  };

  const handleClose = () => {
    if (submitting) return;
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setError('Current passcode is required.');
      return;
    }
    if (!hasMinLen || !hasMixedCase || !hasDigit) {
      setError('New passcode must be at least 8 characters and include upper, lower, and a digit.');
      return;
    }
    if (!differsFromCurrent) {
      setError('New passcode must differ from your current passcode.');
      return;
    }
    if (!matchesConfirm) {
      setError('Passcode confirmation does not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await changeOwnPassword({ currentPassword, newPassword });
      setSuccessMsg(result.message || 'Passcode updated and recorded to Security Audit.');
      onSuccess?.();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        errObj?.response?.data?.message ||
        errObj?.message ||
        'Unable to change passcode right now.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      purpose="form"
      width={480}
    >
      <VStack gap={4}>
        <DialogHeader
          title="Change Own Passcode"
          subtitle={`${username} (${role})`}
          startContent={<KeyRound className="w-5 h-5 text-[var(--color-icon-accent)]" />}
          onOpenChange={(open) => {
            if (!open) handleClose();
          }}
        />

        {error && (
          <Banner status="error" title="Passcode validation error" description={error} collapsible={false} />
        )}

        {successMsg && (
          <Banner status="success" title="Passcode updated" description={successMsg} collapsible={false} />
        )}

        <form onSubmit={handleSubmit}>
          <VStack gap={3}>
            <TextInput
              label="Current Passcode"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(val) => setCurrentPassword(val)}
              placeholder="Enter current passcode"
              isRequired
            />

            <TextInput
              label="New Passcode"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(val) => setNewPassword(val)}
              placeholder="At least 8 chars, mixed case + digit"
              isRequired
            />

            <TextInput
              label="Confirm New Passcode"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(val) => setConfirmPassword(val)}
              placeholder="Re-enter new passcode"
              isRequired
            />

            <CheckboxInput
              label="Reveal passcodes while typing"
              value={showPasswords}
              onChange={(checked) => setShowPasswords(checked)}
              size="sm"
            />

            <Card variant="muted" padding={3}>
              <VStack gap={1.5}>
                <Text type="supporting" size="xsm" weight="semibold" color="secondary">
                  SECURITY REQUIREMENTS
                </Text>
                {[
                  { ok: hasMinLen, text: 'Minimum 8 characters' },
                  { ok: hasMixedCase, text: 'Contains uppercase and lowercase letters' },
                  { ok: hasDigit, text: 'Contains at least one number' },
                  { ok: matchesConfirm, text: 'Matches confirmation field' },
                ].map((rule) => (
                  <HStack key={rule.text} gap={1.5} vAlign="center">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        rule.ok
                          ? 'text-[var(--color-icon-success)]'
                          : 'text-[var(--color-icon-disabled)]'
                      }`}
                    />
                    <Text
                      type="supporting"
                      size="sm"
                      color={rule.ok ? 'primary' : 'secondary'}
                    >
                      {rule.text}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Card>

            <HStack gap={2} justify="end" paddingBlockStart={2}>
              <Button
                variant="secondary"
                label="Close"
                onClick={handleClose}
                isDisabled={submitting}
              />
              <Button
                type="submit"
                variant="primary"
                label="Update Passcode"
                icon={<Icon icon={KeyRound} />}
                isLoading={submitting}
              />
            </HStack>
          </VStack>
        </form>
      </VStack>
    </Dialog>
  );
};

export default ChangePasswordModal;
