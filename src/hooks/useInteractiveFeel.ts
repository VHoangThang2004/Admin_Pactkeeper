import { useEffect } from 'react';

const RIPPLE_SELECTOR =
  'button:not(:disabled), [role="button"]:not([aria-disabled="true"]), [role="tab"]:not([aria-disabled="true"]), nav[aria-label="Admin Portal Navigation"] a';

/**
 * Global lightweight interactive feel enhancer:
 * 1. Spawns a crisp tactile click ripple wave on buttons/tabs/nav items.
 * 2. Updates --pk-mx / --pk-my CSS vars on `.pk-spotlight` surfaces for
 *    smooth mouse-follow spotlight lighting (rAF-throttled, 60fps).
 */
export function useInteractiveFeel(): void {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches) return;

    let rafId = 0;
    let pendingTarget: HTMLElement | null = null;
    let pendingX = 0;
    let pendingY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('.pk-spotlight');
      if (!target) return;

      pendingTarget = target;
      pendingX = event.clientX;
      pendingY = event.clientY;

      if (!rafId) {
        rafId = window.requestAnimationFrame(() => {
          rafId = 0;
          if (!pendingTarget) return;
          const rect = pendingTarget.getBoundingClientRect();
          pendingTarget.style.setProperty('--pk-mx', `${pendingX - rect.left}px`);
          pendingTarget.style.setProperty('--pk-my', `${pendingY - rect.top}px`);
        });
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const host = (event.target as HTMLElement | null)?.closest<HTMLElement>(RIPPLE_SELECTOR);
      if (!host) return;

      // Skip inputs or tiny checkbox-like elements
      const rect = host.getBoundingClientRect();
      if (rect.width < 18 || rect.height < 18) return;

      const computedPos = window.getComputedStyle(host).position;
      if (computedPos === 'static') {
        host.classList.add('pk-ripple-host');
      } else if (window.getComputedStyle(host).overflow !== 'hidden') {
        host.style.overflow = 'hidden';
      }

      const size = Math.max(rect.width, rect.height) * 0.9;
      const wave = document.createElement('span');
      wave.className = 'pk-ripple-wave';
      wave.style.width = `${size}px`;
      wave.style.height = `${size}px`;
      wave.style.left = `${event.clientX - rect.left}px`;
      wave.style.top = `${event.clientY - rect.top}px`;

      host.appendChild(wave);
      window.setTimeout(() => {
        wave.remove();
      }, 480);
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);
}
