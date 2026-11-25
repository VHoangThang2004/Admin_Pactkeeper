import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type WorkspaceDensity = 'comfortable' | 'compact';

interface WorkspacePrefsContextValue {
  density: WorkspaceDensity;
  setDensity: (next: WorkspaceDensity) => void;
  toggleDensity: () => void;
  ambientFx: boolean;
  setAmbientFx: (next: boolean) => void;
  toggleAmbientFx: () => void;
}

const DENSITY_STORAGE_KEY = 'pk_admin_density';
const AMBIENT_FX_STORAGE_KEY = 'pk_admin_ambient_fx';

const WorkspacePrefsContext = createContext<WorkspacePrefsContextValue | null>(null);

export const WorkspacePrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [density, setDensityState] = useState<WorkspaceDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      return saved === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const [ambientFx, setAmbientFxState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AMBIENT_FX_STORAGE_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      // Ignore storage quota errors
    }
  }, [density]);

  useEffect(() => {
    try {
      localStorage.setItem(AMBIENT_FX_STORAGE_KEY, String(ambientFx));
    } catch {
      // Ignore storage quota errors
    }
  }, [ambientFx]);

  const setDensity = useCallback((next: WorkspaceDensity) => {
    setDensityState(next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  }, []);

  const setAmbientFx = useCallback((next: boolean) => {
    setAmbientFxState(next);
  }, []);

  const toggleAmbientFx = useCallback(() => {
    setAmbientFxState((prev) => !prev);
  }, []);

  return (
    <WorkspacePrefsContext.Provider
      value={{
        density,
        setDensity,
        toggleDensity,
        ambientFx,
        setAmbientFx,
        toggleAmbientFx,
      }}
    >
      {children}
    </WorkspacePrefsContext.Provider>
  );
};

export function useWorkspacePrefs(): WorkspacePrefsContextValue {
  const ctx = useContext(WorkspacePrefsContext);
  if (!ctx) {
    throw new Error('useWorkspacePrefs must be used inside WorkspacePrefsProvider');
  }
  return ctx;
}
