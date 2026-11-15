// PactKeeper High Counsel Astryx Theme
// Extends checked editor settings (pactkeeper.settings.ts) with bespoke
// Warm Parchment (Light) + Cosmic Obsidian & Celestial Gold (Dark) tokens.
import {defineTheme} from '@astryxdesign/core/theme';
import {pactkeeperSettings} from './pactkeeper.settings';

export const pactkeeperTheme = defineTheme({
  extends: pactkeeperSettings,
  name: 'pactkeeper',
  typography: {
    body: {
      family: 'Plus Jakarta Sans',
      fallbacks: 'Inter, system-ui, -apple-system, sans-serif',
    },
    heading: {
      family: 'Cinzel',
      fallbacks: 'Georgia, serif',
    },
    code: {
      family: 'JetBrains Mono',
      fallbacks: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    },
  },
  tokens: {
    // Typography weights refined for Cinzel headings
    '--text-heading-1-weight': '700',
    '--text-heading-2-weight': '700',
    '--text-heading-3-weight': '600',
    '--text-heading-4-weight': '600',
    '--text-heading-5-weight': '600',
    '--text-heading-6-weight': '600',
    '--text-display-1-weight': '700',
    '--text-display-2-weight': '700',
    '--text-display-3-weight': '600',

    // Core canvas & surface hierarchy: [Light Parchment/Ivory, Dark Cosmic Obsidian]
    '--color-background-body': ['#f4f0e6', '#070a14'],
    '--color-background-surface': ['#fcfaf5', '#0c1222'],
    '--color-background-card': ['#ffffff', '#11192e'],
    '--color-background-popover': ['#ffffff', '#141e36'],
    '--color-background-muted': ['#ece5d5', '#17213b'],
    '--color-background-inverted': ['#16120b', '#f3efe6'],

    // Ink & text hierarchy (WCAG AAA on respective surfaces)
    '--color-text-primary': ['#18130c', '#f3efe6'],
    '--color-text-secondary': ['#595042', '#9aa6bd'],
    '--color-text-disabled': ['#968c7b', '#5b657a'],
    '--color-icon-primary': ['#18130c', '#f3efe6'],
    '--color-icon-secondary': ['#595042', '#9aa6bd'],
    '--color-icon-disabled': ['#968c7b', '#5b657a'],

    // Signature Royal Gold accent: [Burnished Antique Gold (5.2:1 on white), Celestial Gold #f2bf4e]
    '--color-accent': ['#966100', '#f2bf4e'],
    '--color-on-accent': ['#ffffff', '#090c16'],
    '--color-accent-muted': ['#d99b1e2e', '#f2bf4e29'],
    '--color-text-accent': ['#7d5000', '#f5cb69'],
    '--color-icon-accent': ['#855500', '#f2bf4e'],
    '--focus-outline-color': ['#966100', '#f2bf4e'],

    // Neutral, overlays & borders
    '--color-neutral': ['#6d572814', '#e2e8f014'],
    '--color-overlay': ['#120e0773', '#02040acc'],
    '--color-overlay-hover': ['#6e531b0d', '#f2bf4e12'],
    '--color-overlay-pressed': ['#6e531b1a', '#f2bf4e21'],
    '--color-border': ['#745b2526', '#f2bf4e26'],
    '--color-border-emphasized': ['#bda36f', '#f2bf4e52'],
    '--color-skeleton': ['#e5dcc9', '#1e2947'],
    '--color-track': ['#dcd2bc', '#243154'],

    // Yellow badge/card contrast tuned for gold-themed roles & rarity pills
    '--color-background-yellow': ['#fae7b2', '#3d2f12'],
    '--color-border-yellow': ['#c7931a', '#f2bf4e70'],
    '--color-icon-yellow': ['#754d00', '#f2bf4e'],
    '--color-text-yellow': ['#543600', '#fae09c'],
  },
  components: {
    card: {
      base: {
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-low)',
      },
    },
    section: {
      base: {
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: 'var(--color-border)',
      },
    },
    'top-nav': {
      base: {
        borderBottomStyle: 'solid',
        borderBottomWidth: '1px',
        borderBottomColor: 'var(--color-border)',
      },
    },
    'side-nav': {
      base: {
        borderInlineEndStyle: 'solid',
        borderInlineEndWidth: '1px',
        borderInlineEndColor: 'var(--color-border)',
      },
    },
  },
});
