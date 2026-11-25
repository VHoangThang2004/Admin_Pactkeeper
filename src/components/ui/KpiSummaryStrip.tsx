import React from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';

export interface KpiStatItem {
  id: string;
  label: string;
  value: React.ReactNode;
  helper?: string;
  icon?: React.ReactNode;
  badge?: {
    label: string;
    variant?: BadgeVariant;
  };
  highlight?: boolean;
}

interface KpiSummaryStripProps {
  items: KpiStatItem[];
  minWidth?: number;
  maxColumns?: number;
}

/**
 * Compact KPI Summary Strip modeled after SDK_Pactkeeper's summary cards,
 * featuring staggered reveal motion, tabular figures, and gold-frame accents.
 */
export const KpiSummaryStrip: React.FC<KpiSummaryStripProps> = ({
  items,
  minWidth = 210,
  maxColumns = 4,
}) => {
  return (
    <Grid
      columns={{ minWidth, max: maxColumns, repeat: 'fit' }}
      gap={3}
      width="100%"
      className="pk-kpi-strip"
    >
      {items.map((item) => (
        <Card
          key={item.id}
          variant="default"
          padding={4}
          className={
            item.highlight
              ? 'pk-interactive-card pk-gold-frame pk-spotlight'
              : 'pk-interactive-card pk-spotlight'
          }
        >
          <VStack gap={2}>
            <HStack justify="between" vAlign="center" gap={2}>
              <HStack gap={2} vAlign="center" className="min-w-0">
                {item.icon && (
                  <span className="w-8 h-8 rounded-lg pk-icon-emblem flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                )}
                <Text type="label" size="sm" color="secondary" maxLines={1}>
                  {item.label}
                </Text>
              </HStack>
              {item.badge && (
                <Badge
                  label={item.badge.label}
                  variant={item.badge.variant || 'neutral'}
                />
              )}
            </HStack>

            <Heading level={2} weight="bold" className="pk-tabular truncate">
              {item.value}
            </Heading>

            {item.helper && (
              <Text type="supporting" size="sm" color="secondary" maxLines={1}>
                {item.helper}
              </Text>
            )}
          </VStack>
        </Card>
      ))}
    </Grid>
  );
};
