const DEV_USER_KEY = "humpback-dev-user";
const DEV_ROLE_KEY = "humpback-dev-role";

export function getDevUser(): { userId: string; role: string } {
  return {
    userId: localStorage.getItem(DEV_USER_KEY) ?? "dev_user_1",
    role: localStorage.getItem(DEV_ROLE_KEY) ?? "annotator",
  };
}

export function setDevUser(userId: string, role: string): void {
  localStorage.setItem(DEV_USER_KEY, userId);
  localStorage.setItem(DEV_ROLE_KEY, role);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { userId, role } = getDevUser();

  const res = await fetch(path, {
    ...init,
    headers: {
      "x-dev-user": userId,
      "x-dev-role": role,
      ...init?.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? res.statusText,
    );
  }

  return res.json() as Promise<T>;
}
