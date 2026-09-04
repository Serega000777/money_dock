import type { Account, AuthTokens, Category, User } from "@money-dock/shared-types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getAccessToken?.();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  const post = <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    health: () => request<HealthResponse>("/health"),

    auth: {
      loginWithTelegram: (initData: string) =>
        post<{ user: User } & AuthTokens>("/auth/telegram", { initData }),
      refresh: (refreshToken: string) => post<AuthTokens>("/auth/refresh", { refreshToken }),
      logout: (refreshToken: string) => post<void>("/auth/logout", { refreshToken }),
    },

    users: {
      me: () => request<User>("/users/me"),
    },

    accounts: {
      list: () => request<Account[]>("/accounts"),
    },

    categories: {
      list: () => request<Category[]>("/categories"),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
