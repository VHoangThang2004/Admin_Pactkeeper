import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

interface ImageLightboxModalProps {
  src: string | null;
  title?: string;
  onClose: () => void;
}

/**
 * Lightweight frosted-backdrop lightbox modal for inspecting support attachments,
 * banner previews, and game art without leaving the console.
 */
export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  src,
  title = 'Attachment Preview',
  onClose,
}) => {
  useEffect(() => {
    if (!src) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pk-gold-frame pk-status-pop flex max-h-[90dvh] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-[var(--color-background-card)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3">
          <Text type="label" size="base" weight="semibold" maxLines={1}>
            {title}
          </Text>
          <HStack gap={2} vAlign="center">
            <Button
              variant="secondary"
              size="sm"
              label="Open Original"
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              icon={<Icon icon={ExternalLink} size="sm" />}
            />
            <IconButton
              variant="ghost"
              size="sm"
              label="Close preview"
              icon={<Icon icon={X} size="sm" />}
              onClick={onClose}
            />
          </HStack>
        </div>

        <div className="flex items-center justify-center overflow-auto bg-black/30 p-4">
          <img
            src={src}
            alt={title}
            className="max-h-[75dvh] max-w-[85vw] rounded-lg object-contain"
          />
        </div>
      </div>
    </div>,
    document.querySelector('[data-astryx-theme]') ?? document.body,
  );
};
