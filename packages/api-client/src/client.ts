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

    return (await res.json()) as T;
  }

  return {
    health: () => request<HealthResponse>("/health"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
