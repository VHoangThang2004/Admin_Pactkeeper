import React from 'react';
import { type BadgeVariant } from '@astryxdesign/core/Badge';
import { Heading } from '@astryxdesign/core/Text';
import { HStack } from '@astryxdesign/core/Stack';

export interface ConsolePageProps {
  /** Retained for backwards compatibility; intentionally hidden to keep headers clean */
  badge?: string;
  badgeVariant?: BadgeVariant;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  banner?: React.ReactNode;
  /**
   * When true, the body fills remaining viewport height without outer scrolling
   * so split panes (e.g. Live Support chat, IDE Log Viewer) manage internal scrollports.
   */
  fillBody?: boolean;
  children: React.ReactNode;
}

/**
 * Clean, minimal ConsolePage shell:
 * displays only the page icon, crisp title, primary actions, and optional toolbar,
 * maximizing vertical and horizontal space for data tables and controls.
 */
export const ConsolePage: React.FC<ConsolePageProps> = ({
  icon,
  title,
  actions,
  toolbar,
  banner,
  fillBody = false,
  children,
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Compact Single-Row Page Header */}
      <header className="shrink-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background-surface)]">
        <div className="w-full px-5 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <HStack gap={2} vAlign="center" className="min-w-0 flex-1">
              {icon && (
                <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-background-card))] border border-[color-mix(in_srgb,var(--color-accent)_26%,var(--color-border))] flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <Heading
                level={1}
                weight="bold"
                className="text-xl sm:text-[22px] tracking-tight truncate"
                style={{ fontFamily: 'var(--font-family-body)' }}
              >
                {title}
              </Heading>
            </HStack>

            {actions && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>

          {toolbar && (
            <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border-subtle)]">
              {toolbar}
            </div>
          )}
        </div>
      </header>

      {banner && (
        <div className="shrink-0 w-full px-5 sm:px-6 pt-3">
          {banner}
        </div>
      )}

      {fillBody ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-5 sm:px-6 py-3.5">
          <div className="flex h-full w-full min-h-0 flex-col">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-3.5">
          <div className="w-full pb-5">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
