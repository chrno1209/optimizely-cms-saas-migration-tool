const createIgnoredPropertySet = (ignoredProperties: string[] = []): Set<string> => {
  return new Set(
    ignoredProperties
      .map((property) => property.trim().toLowerCase())
      .filter(Boolean),
  );
};

export const stableStringify = (input: unknown, ignoredProperties: string[] = []): string => {
  const ignoredSet = createIgnoredPropertySet(ignoredProperties);

  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sortedKeys = Object.keys(obj).sort();
      const next: Record<string, unknown> = {};
      sortedKeys.forEach((key) => {
        if (!ignoredSet.has(key.toLowerCase())) {
          next[key] = normalize(obj[key]);
        }
      });
      return next;
    }

    return value;
  };

  return JSON.stringify(normalize(input), null, 2);
};

export const isDeepEqual = (a: unknown, b: unknown): boolean => {
  return stableStringify(a) === stableStringify(b);
};

export const isDeepEqualIgnoring = (
  a: unknown,
  b: unknown,
  ignoredProperties: string[] = [],
): boolean => {
  return stableStringify(a, ignoredProperties) === stableStringify(b, ignoredProperties);
};

export const getEntityName = (entity: Record<string, unknown> | undefined, fallback: string): string => {
  if (!entity) {
    return fallback;
  }

  const candidate =
    entity.name ??
    entity.displayName ??
    entity.title ??
    entity.key;

  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
};

export const stripReadonlyFields = (entity: Record<string, unknown>): Record<string, unknown> => {
  const excluded = new Set([
    'id',
    'created',
    'modified',
    'published',
    'saved',
    '_links',
    '_embedded',
    'url',
  ]);

  const next: Record<string, unknown> = {};

  Object.entries(entity).forEach(([key, value]) => {
    if (!excluded.has(key)) {
      next[key] = value;
    }
  });

  return next;
};
