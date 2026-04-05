export const DEBUG_QUERY_PARAM = "debug";
export const DEBUG_STORAGE_KEY = "humpback:debug";

function normalizeScope(value: string): string {
  return value.trim().toLowerCase();
}

export function parseDebugScopes(...sources: Array<string | null | undefined>): string[] {
  return [...new Set(
    sources
      .flatMap((source) => (source ?? "").split(","))
      .map(normalizeScope)
      .filter((scope) => scope.length > 0),
  )];
}

export function matchesDebugScope(scope: string, enabledScope: string): boolean {
  const normalizedScope = normalizeScope(scope);
  const normalizedEnabledScope = normalizeScope(enabledScope);

  if (normalizedEnabledScope === "*") {
    return true;
  }

  if (normalizedEnabledScope.endsWith(":*")) {
    const prefix = normalizedEnabledScope.slice(0, -2);
    return (
      normalizedScope === prefix || normalizedScope.startsWith(`${prefix}:`)
    );
  }

  return (
    normalizedScope === normalizedEnabledScope ||
    normalizedScope.startsWith(`${normalizedEnabledScope}:`)
  );
}

function readEnabledScopes(): string[] {
  if (
    typeof window === "undefined" ||
    typeof window.location === "undefined"
  ) {
    return [];
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryScopes = searchParams.getAll(DEBUG_QUERY_PARAM);

  let storageScopes: string[] = [];
  try {
    storageScopes = parseDebugScopes(
      window.localStorage.getItem(DEBUG_STORAGE_KEY),
    );
  } catch {
    storageScopes = [];
  }

  return parseDebugScopes(...queryScopes, ...storageScopes);
}

export function isDebugEnabled(scope: string): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  return readEnabledScopes().some((enabledScope) =>
    matchesDebugScope(scope, enabledScope),
  );
}

export function createDebugLogger(scope: string) {
  return (event: string, details?: Record<string, unknown>): void => {
    if (!isDebugEnabled(scope)) {
      return;
    }

    if (details && Object.keys(details).length > 0) {
      console.debug(`[${scope}] ${event}`, details);
      return;
    }

    console.debug(`[${scope}] ${event}`);
  };
}
