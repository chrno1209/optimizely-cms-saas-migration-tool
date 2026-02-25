import { EnvironmentConfig } from '../types';

const ENV_KEY = 'optimizelyEnvs';
const THEME_KEY = 'optimizelyThemeMode';

export const storageKeys = {
  environments: ENV_KEY,
  theme: THEME_KEY,
} as const;

export const loadEnvironments = (): EnvironmentConfig[] => {
  try {
    const raw = localStorage.getItem(ENV_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(Boolean) as EnvironmentConfig[];
  } catch {
    return [];
  }
};

export const saveEnvironments = (environments: EnvironmentConfig[]) => {
  localStorage.setItem(ENV_KEY, JSON.stringify(environments));
};

export const loadThemeMode = (): 'light' | 'dark' => {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === 'dark' ? 'dark' : 'light';
};

export const saveThemeMode = (theme: 'light' | 'dark') => {
  localStorage.setItem(THEME_KEY, theme);
};
