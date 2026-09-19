// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, ApiClientError } from "@/lib/api/client";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch error handling", () => {
  it("unwraps this app's { ok, error } envelope", async () => {
    respond(403, { ok: false, error: { code: "DEVICE_BLOCKED", message: "Bu qurilma bloklangan." } });

    await expect(apiGet("/api/x")).rejects.toMatchObject({
      code: "DEVICE_BLOCKED",
      message: "Bu qurilma bloklangan.",
      status: 403,
    });
  });

  it("also handles a bare { code, message } body", async () => {
    // Better Auth's own middleware answers this way — its sessionMiddleware
    // 401 is the one the password screen actually hits. Reading
    // body.error.code on it used to throw a TypeError, which is not an
    // ApiClientError, so every caller's `instanceof` branch was skipped
    // and the real code was lost.
    respond(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

    const err = await apiGet("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("falls back to NETWORK_ERROR for an error body with no code at all", async () => {
    respond(500, { ok: false });

    const err = await apiGet("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("NETWORK_ERROR");
  });

  it("returns data on success", async () => {
    respond(200, { ok: true, data: { has_password: true } });

    await expect(apiGet("/api/x")).resolves.toEqual({ has_password: true });
  });
});
