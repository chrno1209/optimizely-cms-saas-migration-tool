import { v4 as uuidv4 } from 'uuid';
import { EnvironmentConfig, EnvironmentGroup } from '../types';

const LEGACY_ENV_KEY = 'optimizelyEnvs';
const GROUPS_KEY = 'optimizelyGroups';
const THEME_KEY = 'optimizelyThemeMode';

export const storageKeys = {
  environmentsLegacy: LEGACY_ENV_KEY,
  groups: GROUPS_KEY,
  theme: THEME_KEY,
} as const;

const parseJsonArray = <T>(raw: string | null): T[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(Boolean) as T[];
  } catch {
    return [];
  }
};

export const loadGroups = (): EnvironmentGroup[] => {
  const groups = parseJsonArray<EnvironmentGroup>(localStorage.getItem(GROUPS_KEY));

  return groups
    .filter((group) => group && typeof group.groupId === 'string' && typeof group.groupName === 'string')
    .map((group) => ({
      ...group,
      environments: Array.isArray(group.environments)
        ? (group.environments.filter(Boolean) as EnvironmentConfig[])
        : [],
    }));
};

export const saveGroups = (groups: EnvironmentGroup[]) => {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
};

export const flattenGroupsToEnvironments = (
  groups: EnvironmentGroup[],
): EnvironmentConfig[] => groups.flatMap((group) => group.environments);

export const migrateLegacyEnvironmentsToGroups = (): {
  migrated: boolean;
  groups: EnvironmentGroup[];
} => {
  const existingGroups = loadGroups();
  if (existingGroups.length > 0) {
    return { migrated: false, groups: existingGroups };
  }

  const legacyEnvironments = parseJsonArray<EnvironmentConfig>(
    localStorage.getItem(LEGACY_ENV_KEY),
  );

  if (legacyEnvironments.length === 0) {
    return { migrated: false, groups: [] };
  }

  const defaultGroup: EnvironmentGroup = {
    groupId: uuidv4(),
    groupName: 'Ungrouped',
    environments: legacyEnvironments,
  };

  saveGroups([defaultGroup]);
  localStorage.removeItem(LEGACY_ENV_KEY);

  return { migrated: true, groups: [defaultGroup] };
};

export const loadThemeMode = (): 'light' | 'dark' => {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === 'dark' ? 'dark' : 'light';
};

export const saveThemeMode = (theme: 'light' | 'dark') => {
  localStorage.setItem(THEME_KEY, theme);
};
