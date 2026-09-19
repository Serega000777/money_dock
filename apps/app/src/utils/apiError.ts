import { ApiError } from "@money-dock/api-client";

/** The API's error responses are plain JSON (`{message, ...}`), but `ApiError.message`
 * is that JSON's raw text — this pulls out the human-readable part, same shape
 * OnboardingFlow's own `apiMessage` already relies on. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    try {
      const body = JSON.parse(error.message) as { message?: string };
      if (body.message) return body.message;
    } catch {
      // not JSON — fall through to the fallback below
    }
    return fallback;
  }
  // A plain thrown Error (e.g. a client-side precondition like "add an account first")
  // already carries a readable message — only ApiError's message is raw response JSON.
  if (error instanceof Error) return error.message;
  return fallback;
}

export function isPlanLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
