import React from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { ThemeModeProvider } from '../context/ThemeModeProvider';
import { useInteractiveFeel } from '../hooks/useInteractiveFeel';
import { useThemeMode } from '../hooks/useThemeMode';
import { RouterLinkAdapter } from './RouterLinkAdapter';

const AstryxThemeBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useThemeMode();
  useInteractiveFeel();

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <LinkProvider component={RouterLinkAdapter}>{children}</LinkProvider>
    </Theme>
  );
};

export const AstryxRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeModeProvider>
      <AstryxThemeBridge>{children}</AstryxThemeBridge>
    </ThemeModeProvider>
  );
};
