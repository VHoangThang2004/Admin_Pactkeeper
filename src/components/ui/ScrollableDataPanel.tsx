import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

interface ScrollableDataPanelProps {
  header?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  maxHeightClass?: string;
  goldFrame?: boolean;
  children: React.ReactNode;
}

/**
 * Contained scrollable table/list container with sticky header support
 * and a compact footer summary bar (SDK_Pactkeeper parity).
 */
export const ScrollableDataPanel: React.FC<ScrollableDataPanelProps> = ({
  header,
  footerLeft,
  footerRight,
  maxHeightClass,
  goldFrame = false,
  children,
}) => {
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

      <div
        className={`pk-scrollable-panel pk-sticky-table ${maxHeightClass || ''}`}
      >
        {children}
      </div>

      {(footerLeft || footerRight) && (
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
            <div>
              {typeof footerRight === 'string' ? (
                <Text type="code" size="sm" color="secondary">
                  {footerRight}
                </Text>
              ) : (
                footerRight
              )}
            </div>
          </HStack>
        </div>
      )}
    </Card>
  );
};
