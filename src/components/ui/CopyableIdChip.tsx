import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyableIdChipProps {
  value: string;
  displayValue?: string;
  prefix?: string;
  title?: string;
}

/**
 * Monospace 1-click copy chip for technical identifiers (Player GUID, Match ID,
 * Order Code, API routes) with instant tactile check feedback.
 */
export const CopyableIdChip: React.FC<CopyableIdChipProps> = ({
  value,
  displayValue,
  prefix,
  title = 'Click to copy',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `${title}: ${value}`}
      className="pk-id-chip inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background-muted)_60%,transparent)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
    >
      {prefix && (
        <span className="text-[var(--color-text-secondary)] select-none">{prefix}</span>
      )}
      <span className="pk-tabular truncate max-w-[14rem]">{displayValue || value}</span>
      {copied ? (
        <Check size={12} className="text-emerald-500 shrink-0 pk-status-pop" />
      ) : (
        <Copy size={12} className="text-[var(--color-text-secondary)] shrink-0 opacity-75" />
      )}
    </button>
  );
};
