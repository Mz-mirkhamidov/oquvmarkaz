import type { ApiResponse } from "@/lib/api/response";

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thin fetch wrapper that unwraps { ok, data } / { ok, error } (TZ §7.1.3). */
export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });

  let body: ApiResponse<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError(res.status, "NETWORK_ERROR", "Hozir ulanib bo'lmadi.");
  }

  if (!body.ok) {
    // Not every error body is this app's { ok, error } envelope. Better
    // Auth's own middleware answers with a bare { code, message } — its
    // sessionMiddleware 401 being the one the UI actually hits — and
    // reading body.error.code on that threw a TypeError, which is not an
    // ApiClientError, so every caller's `err instanceof ApiClientError`
    // branch was skipped and the real code was lost.
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } }).error;
    const fallback = body as unknown as { code?: string; message?: string };
    throw new ApiClientError(
      res.status,
      err?.code ?? fallback.code ?? "NETWORK_ERROR",
      err?.message ?? fallback.message ?? "Hozir ulanib bo'lmadi.",
      err?.details,
    );
  }
  return body.data;
}

export function apiPost<T>(url: string, payload: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "POST", body: JSON.stringify(payload) });
}

export function apiPatch<T>(url: string, payload: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "PATCH", body: JSON.stringify(payload) });
}

export function apiPut<T>(url: string, payload: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "PUT", body: JSON.stringify(payload) });
}

export function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "GET" });
}

export function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "DELETE" });
}
