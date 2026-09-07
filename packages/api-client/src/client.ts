import type {
  Account,
  AnalyticsSummary,
  AuthTokens,
  Category,
  CommandDraft,
  Entitlements,
  ImportPreview,
  ReviewInboxItem,
  Transaction,
  User,
} from "@money-dock/shared-types";

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
      devLogin: () => post<{ user: User } & AuthTokens>("/auth/dev-login"),
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
      create: (input: {
        type: "expense" | "income";
        name: string;
        parentId?: string;
        icon?: string;
      }) => post<Category>("/categories", input),
    },

    transactions: {
      list: (params?: { accountId?: string; limit?: number; offset?: number }) => {
        const query = new URLSearchParams();
        if (params?.accountId) query.set("accountId", params.accountId);
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.offset) query.set("offset", String(params.offset));
        const qs = query.toString();
        return request<Transaction[]>(`/transactions${qs ? `?${qs}` : ""}`);
      },
      create: (input: {
        type: "expense" | "income";
        accountId: string;
        categoryId?: string;
        amountMinor: number;
        currency: string;
        occurredAt?: string;
        merchant?: string;
        note?: string;
        clientId: string;
      }) => post<Transaction>("/transactions", input),
      createTransfer: (input: {
        fromAccountId: string;
        toAccountId: string;
        amountMinor: number;
        currency: string;
        clientId: string;
      }) => post<void>("/transactions/transfer", input),
    },

    analytics: {
      summary: () => request<AnalyticsSummary>("/analytics/summary"),
    },

    reviewInbox: {
      list: () => request<ReviewInboxItem[]>("/review-inbox"),
      resolve: (id: string, action: string, categoryId?: string) =>
        post<void>(`/review-inbox/${id}/resolve`, { action, categoryId }),
    },

    commands: {
      /** Returns a draft for confirmation — the server never saves from a phrase. */
      parse: (text: string, source: "voice" | "text") =>
        post<CommandDraft>("/commands/parse", { text, source }),
    },

    entitlements: {
      get: () => request<Entitlements>("/entitlements"),
    },

    imports: {
      /** `file` is a browser File/Blob; multipart is built here so screens stay dumb. */
      preview: async (accountId: string, file: Blob, fileName: string) => {
        const form = new FormData();
        form.append("file", file, fileName);
        const token = getAccessToken?.();
        const res = await fetch(`${baseUrl}/import/preview/${accountId}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return (await res.json()) as ImportPreview;
      },
      commit: (jobId: string) => post<unknown>(`/import/${jobId}/commit`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
