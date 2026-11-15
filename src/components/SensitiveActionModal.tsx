import React, { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export interface SensitiveActionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: (rationale: string) => Promise<void> | void;
  title: string;
  description: string;
  targetSummary?: string;
  targetLabel?: string;
  targetValue?: string;
  actionLabel?: string;
  severity?: 'HIGH' | 'CRITICAL';
  requireKeyword?: string;
  loading?: boolean;
  error?: string | null;
  externalError?: string | null;
}

export const SensitiveActionModal: React.FC<SensitiveActionModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  targetSummary,
  targetLabel = 'Target',
  targetValue,
  actionLabel = 'Confirm Action',
  severity = 'HIGH',
  requireKeyword,
  loading: externalLoading = false,
  error: propError,
  externalError,
}) => {
  const [rationale, setRationale] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const minReasonLength = 5;
  const isCritical = severity === 'CRITICAL';
  const busy = externalLoading || internalLoading;

  const closeHandler = () => {
    if (busy) return;
    setRationale('');
    setKeywordInput('');
    setValidationError(null);
    onCancel?.();
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = rationale.trim();
    if (trimmedReason.length < minReasonLength) {
      setValidationError(`Audit reason must be at least ${minReasonLength} characters.`);
      return;
    }
    if (requireKeyword && keywordInput.trim().toUpperCase() !== requireKeyword.toUpperCase()) {
      setValidationError(`Please type "${requireKeyword}" to confirm this critical action.`);
      return;
    }

    setValidationError(null);
    setInternalLoading(true);
    try {
      await onConfirm(trimmedReason);
      setRationale('');
      setKeywordInput('');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      setValidationError(
        errObj?.response?.data?.message || errObj?.message || 'Action execution failed.'
      );
    } finally {
      setInternalLoading(false);
    }
  };

  const activeError = validationError || propError || externalError;
  const displayTarget = targetSummary || targetValue;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) closeHandler();
      }}
      purpose="form"
      width={500}
    >
      <VStack gap={4}>
        <DialogHeader
          title={title}
          subtitle={isCritical ? 'CRITICAL GOVERNANCE ACTION' : 'HIGH SENSITIVITY ACTION'}
          startContent={
            isCritical ? (
              <ShieldAlert className="w-5 h-5 text-[var(--color-icon-error)]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[var(--color-icon-warning)]" />
            )
          }
          onOpenChange={(open) => {
            if (!open) closeHandler();
          }}
        />

        <Banner
          status={isCritical ? 'error' : 'warning'}
          title={isCritical ? 'Irreversible / Realm-Wide Impact' : 'Audit Logged Operation'}
          description={description}
          collapsible={false}
        />

        {displayTarget && (
          <Card variant="muted" padding={3}>
            <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
              <Text type="supporting" size="sm" color="secondary">
                {targetLabel}
              </Text>
              <Text type="code" size="sm" weight="bold" color="primary">
                {displayTarget}
              </Text>
            </HStack>
          </Card>
        )}

        {activeError && (
          <Banner status="error" title="Authorization Blocked" description={activeError} collapsible={false} />
        )}

        <form onSubmit={handleSubmit}>
          <VStack gap={3}>
            <TextArea
              label="Mandatory Audit Reason (min 5 chars)"
              value={rationale}
              onChange={(val) => {
                setRationale(val);
                if (validationError) setValidationError(null);
              }}
              rows={3}
              isRequired
              placeholder="Explain why this sensitive action is being executed (recorded to Security Audit Log)..."
            />

            {requireKeyword && (
              <TextInput
                label={`Type "${requireKeyword}" to authorize`}
                value={keywordInput}
                onChange={(val) => {
                  setKeywordInput(val);
                  if (validationError) setValidationError(null);
                }}
                placeholder={requireKeyword}
                isRequired
              />
            )}

            <HStack gap={2} justify="end" paddingBlockStart={2}>
              <Button
                variant="secondary"
                label="Cancel"
                onClick={closeHandler}
                isDisabled={busy}
              />
              <Button
                type="submit"
                variant={isCritical ? 'destructive' : 'primary'}
                label={busy ? 'Executing...' : actionLabel}
                isLoading={busy}
              />
            </HStack>
          </VStack>
        </form>
      </VStack>
    </Dialog>
  );
};

export default SensitiveActionModal;
