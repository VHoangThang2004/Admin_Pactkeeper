import React, { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const AUDIT_REASON_PRESETS = [
  {
    value: 'CUSTOM',
    label: 'Custom reason (write below)...',
  },
  {
    value: 'Scheduled server maintenance window',
    label: 'Scheduled server maintenance window',
  },
  {
    value: 'Emergency hotfix / critical incident mitigation',
    label: 'Emergency hotfix / critical incident mitigation',
  },
  {
    value: 'Investigating combat desync, exploit, or abnormal behavior',
    label: 'Investigating combat desync, exploit, or abnormal behavior',
  },
  {
    value: 'Suspicious account activity / security policy enforcement',
    label: 'Suspicious account activity / security policy enforcement',
  },
  {
    value: 'LiveOps balance, gacha, or content rotation update',
    label: 'LiveOps balance, gacha, or content rotation update',
  },
  {
    value: 'Player billing verification or compensation adjustment',
    label: 'Player billing verification or compensation adjustment',
  },
  {
    value: 'Routine QA / staging environment verification',
    label: 'Routine QA / staging environment verification',
  },
];

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
  const [selectedPreset, setSelectedPreset] = useState<string>('CUSTOM');
  const [rationale, setRationale] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const minReasonLength = 5;
  const isCritical = severity === 'CRITICAL';
  const busy = externalLoading || internalLoading;

  const closeHandler = () => {
    if (busy) return;
    setSelectedPreset('CUSTOM');
    setRationale('');
    setKeywordInput('');
    setValidationError(null);
    onCancel?.();
    onClose?.();
  };

  const handlePresetChange = (val: string | number | null) => {
    const next = String(val || 'CUSTOM');
    setSelectedPreset(next);
    if (next !== 'CUSTOM') {
      setRationale(next);
      if (validationError) setValidationError(null);
    }
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
      setSelectedPreset('CUSTOM');
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
      width={520}
      maxHeight="90dvh"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="shrink-0">
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <VStack gap={3}>
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

            <Selector
              label="Quick Audit Reason Preset"
              options={AUDIT_REASON_PRESETS}
              value={selectedPreset}
              onChange={handlePresetChange}
              width="100%"
            />

            <TextArea
              label="Mandatory Audit Reason (min 5 chars)"
              value={rationale}
              onChange={(val) => {
                setRationale(val);
                if (selectedPreset !== 'CUSTOM' && val !== selectedPreset) {
                  setSelectedPreset('CUSTOM');
                }
                if (validationError) setValidationError(null);
              }}
              rows={3}
              isRequired
              placeholder="Select a preset above or explain why this sensitive action is being executed..."
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
          </VStack>
        </div>

        <div className="shrink-0 pt-3 border-t border-[var(--color-border-subtle)]">
          <HStack gap={2} justify="end" wrap="wrap">
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
        </div>
      </form>
    </Dialog>
  );
};

export default SensitiveActionModal;
