import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Icon } from '@astryxdesign/core/Icon';
import { Heading, Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { resolvePageGuide, type PageGuideDefinition } from '../constants/pageGuides';

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
  /** Optional custom guide override; if omitted, resolves automatically from current route */
  guide?: PageGuideDefinition | null;
  /** Set true to hide the built-in "How Function Works" button on this page */
  hideGuide?: boolean;
  /**
   * When true, the body fills remaining viewport height without outer scrolling
   * so split panes (e.g. Live Support chat, IDE Log Viewer) manage internal scrollports.
   */
  fillBody?: boolean;
  children: React.ReactNode;
}

/**
 * Clean, minimal ConsolePage shell:
 * displays only the page icon, crisp title, primary actions (+ unified "How Function Works" guide),
 * and optional toolbar, maximizing vertical and horizontal space for data tables and controls.
 */
export const ConsolePage: React.FC<ConsolePageProps> = ({
  icon,
  title,
  actions,
  toolbar,
  banner,
  guide,
  hideGuide = false,
  fillBody = false,
  children,
}) => {
  const { pathname } = useLocation();
  const [showGuide, setShowGuide] = useState(false);

  const resolvedGuide = hideGuide ? null : guide !== undefined ? guide : resolvePageGuide(pathname);

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

            {(resolvedGuide || actions) && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {resolvedGuide && (
                  <Button
                    variant={showGuide ? 'primary' : 'secondary'}
                    size="sm"
                    label={showGuide ? 'Hide Guide' : 'How Function Works'}
                    icon={<Icon icon={BookOpen} />}
                    onClick={() => setShowGuide((prev) => !prev)}
                  />
                )}
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

      {resolvedGuide && showGuide && (
        <div className="shrink-0 w-full px-5 sm:px-6 pt-3">
          <Card padding={4}>
            <VStack gap={3}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <HStack gap={2} vAlign="center">
                  <Icon icon={BookOpen} size="sm" />
                  <Heading level={5}>{resolvedGuide.heading}</Heading>
                </HStack>
                <Badge label={resolvedGuide.tag} variant={resolvedGuide.tagVariant} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
                {resolvedGuide.steps.map((step) => (
                  <div
                    key={step.badge}
                    className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
                  >
                    <div>
                      <Badge label={step.badge} variant={step.badgeVariant} />
                    </div>
                    <Text size="xsm" weight="semibold">
                      {step.title}
                    </Text>
                    <Text size="sm" color="secondary">
                      {step.description}
                    </Text>
                  </div>
                ))}
              </div>
            </VStack>
          </Card>
        </div>
      )}

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
