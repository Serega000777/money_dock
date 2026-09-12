import type {
  Account,
  AnalyticsSummary,
  AuthTokens,
  Category,
  CommandDraft,
  DailySummary,
  Entitlements,
  ImportPreview,
  Insight,
  Note,
  RecurringPayment,
  ReviewInboxItem,
  SavingsGoal,
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
  /**
   * Called once when a request comes back 401, to obtain a fresh access token. Access
   * tokens are deliberately short-lived, so without this every session would break a
   * quarter-hour in. Return null to give up and let the 401 surface.
   */
  onUnauthorized?: () => Promise<string | null>;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

export function createApiClient({ baseUrl, getAccessToken, onUnauthorized }: ApiClientOptions) {
  /** Shared so a burst of parallel 401s triggers a single refresh, not one per request. */
  let refreshInFlight: Promise<string | null> | null = null;

  function refreshOnce(): Promise<string | null> {
    if (!onUnauthorized) return Promise.resolve(null);
    refreshInFlight ??= onUnauthorized().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function send(path: string, token: string | null | undefined, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res = await send(path, getAccessToken?.(), init);

    // The auth endpoints are how we recover from a 401; retrying them would loop.
    if (res.status === 401 && !path.startsWith("/auth/")) {
      const refreshed = await refreshOnce();
      if (refreshed) res = await send(path, refreshed, init);
    }

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
      /** Scaffold — the server returns 501 until a real Yandex OAuth app is wired. */
      loginWithYandex: (code: string, redirectUri: string) =>
        post<{ user: User } & AuthTokens>("/auth/yandex", { code, redirectUri }),
      /** Scaffold — the server returns 501 until a real VK ID app is wired. */
      loginWithVk: (code: string, redirectUri: string) =>
        post<{ user: User } & AuthTokens>("/auth/vk", { code, redirectUri }),
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
        color?: string;
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
      update: (
        id: string,
        input: {
          type?: "expense" | "income";
          accountId?: string;
          categoryId?: string;
          amountMinor?: number;
          currency?: string;
          occurredAt?: string;
          merchant?: string;
          note?: string;
        },
      ) =>
        request<Transaction>(`/transactions/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      /** Soft delete — the server keeps the row so `restore` can bring it back. */
      remove: (id: string) => request<void>(`/transactions/${id}`, { method: "DELETE" }),
      restore: (id: string) => post<Transaction>(`/transactions/${id}/restore`),
    },

    notes: {
      list: () => request<Note[]>("/notes"),
      create: (input: { title: string; body?: string; colorIndex?: number; pinned?: boolean }) =>
        post<Note>("/notes", input),
      update: (
        id: string,
        input: { title?: string; body?: string; colorIndex?: number; pinned?: boolean },
      ) => request<Note>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
      remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
    },

    recurringPayments: {
      list: () => request<RecurringPayment[]>("/recurring-payments"),
      create: (input: {
        accountId: string;
        categoryId?: string;
        name: string;
        amountMinor: number;
        currency: string;
        dueDay?: number;
        reminderDaysBefore?: number;
      }) => post<RecurringPayment>("/recurring-payments", input),
      pay: (id: string) =>
        post<{ payment: RecurringPayment; transaction: Transaction }>(
          `/recurring-payments/${id}/pay`,
        ),
      remove: (id: string) => request<void>(`/recurring-payments/${id}`, { method: "DELETE" }),
    },

    goals: {
      list: () => request<SavingsGoal[]>("/goals"),
      create: (input: {
        name: string;
        icon?: string;
        targetMinor: number;
        currency: string;
        deadline?: string;
      }) => post<SavingsGoal>("/goals", input),
      /** Positive puts money aside, negative takes it back; never below zero. */
      contribute: (id: string, amountMinor: number) =>
        post<SavingsGoal>(`/goals/${id}/contribute`, { amountMinor }),
      remove: (id: string) => request<void>(`/goals/${id}`, { method: "DELETE" }),
    },

    analytics: {
      summary: () => request<AnalyticsSummary>("/analytics/summary"),
    },

    insights: {
      dailySummary: () => request<DailySummary>("/insights/daily-summary"),
      list: () => request<Insight[]>("/insights"),
      markRead: (id: string) => post<void>(`/insights/${id}/read`),
    },

    exports: {
      /** The full-account JSON dump from POST /exports (spec §6 Export). The caller
       * decides what to do with it — the home screen turns it into a file download. */
      generate: () => post<Record<string, unknown>>("/exports"),
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
      /** Saves without confirmation — used by Siri and the widget, not by the screens. */
      capture: (text: string, source: "voice" | "text", clientId: string) =>
        post<Transaction>("/commands/capture", { text, source, clientId }),
    },

    entitlements: {
      get: () => request<Entitlements>("/entitlements"),
    },

    imports: {
      /** `file` is a browser File/Blob; multipart is built here so screens stay dumb. */
      preview: async (accountId: string, file: Blob, fileName: string) => {
        const form = new FormData();
        form.append("file", file, fileName);
        // Multipart can't go through request(): setting Content-Type by hand would drop
        // the boundary. The 401-refresh handling is mirrored here instead.
        const upload = (token: string | null | undefined) =>
          fetch(`${baseUrl}/import/preview/${accountId}`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,
          });

        let res = await upload(getAccessToken?.());
        if (res.status === 401) {
          const refreshed = await refreshOnce();
          if (refreshed) res = await upload(refreshed);
        }
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return (await res.json()) as ImportPreview;
      },
      commit: (jobId: string) => post<unknown>(`/import/${jobId}/commit`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
