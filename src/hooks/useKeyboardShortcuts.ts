import { useEffect } from 'react';

const SEARCH_INPUT_SELECTOR =
  'main input[type="search"]:not(:disabled), main input[placeholder*="Search" i]:not(:disabled), main input[placeholder*="Filter" i]:not(:disabled), input[type="search"]:not(:disabled), input[placeholder*="Search" i]:not(:disabled), input[placeholder*="Filter" i]:not(:disabled)';

/**
 * Global engineer keyboard ergonomics:
 * - Pressing `/` outside of text inputs focuses the active page's primary search/filter input.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        active?.isContentEditable
      ) {
        return;
      }

      const searchInput = document.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);
      if (searchInput) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
