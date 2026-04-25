function getPathBasename(value: string): string {
  const normalizedPath = value.trim().replace(/^"+|"+$/g, '').replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalizedPath;
}

export function normalizeProcessName(name: string): string {
  const basename = getPathBasename(name);
  return basename
    .replace(/\.app$/i, '')
    .replace(/\.exe$/i, '')
    .toLowerCase();
}

export function extractDetectionExecutables(detection: unknown): string[] {
  const executables = new Set<string>();

  const collect = (value: unknown, key?: string): void => {
    if (typeof value === 'string') {
      if (key === 'executable' || key === 'glob') {
        const basename = getPathBasename(value);
        if (basename && !/[*?[\]{}]/.test(basename)) {
          const normalized = normalizeProcessName(value);
          if (normalized) {
            executables.add(normalized);
          }
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        collect(entry);
      }
      return;
    }

    if (value && typeof value === 'object') {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        collect(nestedValue, nestedKey);
      }
    }
  };

  collect(detection);
  return Array.from(executables);
}
