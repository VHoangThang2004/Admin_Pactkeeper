import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

interface ScrollableDataPanelProps {
  header?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  maxHeightClass?: string;
  goldFrame?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

/**
 * Contained scrollable table/list container with sticky header support,
 * built-in Collapse/Expand control for long datasets, and a compact footer summary bar.
 */
export const ScrollableDataPanel: React.FC<ScrollableDataPanelProps> = ({
  header,
  footerLeft,
  footerRight,
  maxHeightClass,
  goldFrame = false,
  collapsible = true,
  defaultCollapsed = false,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <Card
      padding={0}
      variant="default"
      elevation="low"
      className={`overflow-hidden ${goldFrame ? 'pk-gold-frame' : ''}`}
    >
      {header && (
        <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-background-surface)]">
          {header}
        </div>
      )}

      {!collapsed && (
        <div
          className={`pk-scrollable-panel pk-sticky-table ${maxHeightClass || ''}`}
        >
          {children}
        </div>
      )}

      {(footerLeft || footerRight || collapsible) && (
        <div className="pk-scroll-footer">
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <div>
              {typeof footerLeft === 'string' ? (
                <Text type="supporting" size="sm" color="secondary">
                  {footerLeft}
                </Text>
              ) : (
                footerLeft
              )}
            </div>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <div>
                {typeof footerRight === 'string' ? (
                  <Text type="code" size="sm" color="secondary">
                    {footerRight}
                  </Text>
                ) : (
                  footerRight
                )}
              </div>
              {collapsible && (
                <Button
                  variant="ghost"
                  size="sm"
                  label={collapsed ? 'Expand List' : 'Collapse'}
                  icon={<Icon icon={collapsed ? ChevronDown : ChevronUp} size="sm" />}
                  onClick={() => setCollapsed((prev) => !prev)}
                />
              )}
            </HStack>
          </HStack>
        </div>
      )}
    </Card>
  );
};
