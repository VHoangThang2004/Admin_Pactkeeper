import React from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Heading, Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';

export interface ConsolePageProps {
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
 * Shared workspace shell for Admin Portal pages: keeps the title, action bar,
 * and tab/filter toolbar pinned below TopNav while scrolling page content below.
 */
export const ConsolePage: React.FC<ConsolePageProps> = ({
  badge,
  badgeVariant = 'yellow',
  meta,
  icon,
  title,
  subtitle,
  actions,
  toolbar,
  banner,
  fillBody = false,
  children,
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Pinned Top Command Header */}
      <header className="shrink-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-background-surface)] shadow-xs">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pt-3 pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <HStack gap={3} vAlign="center" className="min-w-0 flex-1">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <VStack gap={0.5} className="min-w-0">
                {(badge || meta) && (
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    {badge && <Badge label={badge} variant={badgeVariant} />}
                    {meta}
                  </HStack>
                )}
                <Heading level={1} type="display-3" className="font-cinzel pk-gold-text truncate">
                  {title}
                </Heading>
                {subtitle && (
                  <Text type="supporting" size="xsm" maxLines={1}>
                    {subtitle}
                  </Text>
                )}
              </VStack>
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
        <div className="shrink-0 mx-auto w-full max-w-[1600px] px-4 sm:px-6 pt-3">
          {banner}
        </div>
      )}

      {fillBody ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 sm:px-6 py-4">
          <div className="mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-col">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="mx-auto w-full max-w-[1600px] pb-6">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
