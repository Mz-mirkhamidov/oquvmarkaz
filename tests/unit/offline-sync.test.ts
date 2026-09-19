// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/api/client is mocked before importing anything that transitively
// pulls it in, so every network call in this file is fully controlled —
// no real fetch ever happens.
const apiPostMock = vi.fn();
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiPost: (...args: unknown[]) => apiPostMock(...args) };
});

// queue.ts fires a background `void syncNow()` on every write, which is
// exactly what production code should do — but it turns every write test
// into a race against that background call for no benefit (those tests
// only care about the synchronous local write). Mock syncNow to a no-op
// here; the "syncNow — outbox processing" tests below import and call the
// *real* implementation directly instead of going through this mock.
const syncNowMock = vi.fn(async () => {});
vi.mock("@/lib/offline/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/offline/sync")>("@/lib/offline/sync");
  return { ...actual, syncNow: () => syncNowMock() };
});

// browser-image-compression needs a real canvas encoder, which jsdom
// doesn't have. The mock also lets each test decide what the compressed
// bytes are — which is the whole point of the hash test below: the bytes
// that get uploaded are deliberately NOT the bytes that were captured.
// Returns a fresh Blob rather than echoing the input: a Blob that has
// been round-tripped through fake-indexeddb's structured clone loses its
// arrayBuffer() method, which sha256Hex needs.
const compressMock = vi.fn<(blob: Blob) => Promise<Blob>>(
  async () => new Blob(["compressed"], { type: "image/webp" }),
);
vi.mock("@/lib/media/compress", () => ({
  compressPhoto: (blob: Blob) => compressMock(blob),
}));

const { db } = await import("@/lib/offline/db");
const { markAttendance, correctAttendance, queueDayClose } = await import("@/lib/offline/queue");
const { sha256Hex } = await import("@/lib/crypto/sha256");
// From the mocked module on purpose: it spreads the real one, so this is
// the same class object sync.ts sees and `instanceof` holds.
const { ApiClientError } = await import("@/lib/api/client");
const { syncNow: realSyncNow, retryFailed: realRetryFailed } = await vi.importActual<
  typeof import("@/lib/offline/sync")
>("@/lib/offline/sync");

const child = {
  id: "11111111-1111-1111-1111-111111111111",
  group_id: null,
  full_name: "Test Child",
  avatar_path: null,
  state_system_id: null,
  photo_consent: false,
};

beforeEach(async () => {
  apiPostMock.mockReset();
  syncNowMock.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
  await db.outbox.clear();
  await db.photos.clear();
  await db.records.clear();
  await db.children.clear();
  await db.groups.clear();
  await db.meta.clear();
  compressMock.mockReset();
  compressMock.mockImplementation(async () => new Blob(["compressed"], { type: "image/webp" }));
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  // The backoff clocks live in module scope, so a test that exercises a
  // network failure would otherwise gate the next test's sync. retryFailed
  // is what clears them; on an already-empty database it does nothing else.
  await realRetryFailed();
});

describe("markAttendance (TZ §8.3)", () => {
  it("writes a local record and an outbox op with matching record_id, before any network call", async () => {
    const recordId = await markAttendance(child, "present", "2026-09-17", null);

    expect(apiPostMock).not.toHaveBeenCalled(); // the local write never touches the network directly

    const record = await db.records.get(recordId);
    expect(record).toMatchObject({ status: "present", synced: false, has_photo: false });

    const outboxOps = await db.outbox.toArray();
    expect(outboxOps).toHaveLength(1);
    expect(outboxOps[0].type).toBe("attendance.mark");
    expect((outboxOps[0].payload as { record_id: string }).record_id).toBe(recordId);
  });

  it("queues a photo alongside the record when one is captured", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/webp" });
    const recordId = await markAttendance(child, "present", "2026-09-17", blob);

    const record = await db.records.get(recordId);
    expect(record?.has_photo).toBe(true);

    const photos = await db.photos.where("record_id").equals(recordId).toArray();
    expect(photos).toHaveLength(1);
    expect(photos[0].status).toBe("queued");
    expect(photos[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("syncNow — outbox processing (T4 idempotency via server response)", () => {
  it("removes an applied op from the outbox and marks the record synced", async () => {
    const recordId = await markAttendance(child, "present", "2026-09-17", null);
    const opId = (await db.outbox.toArray())[0].op_id;
    apiPostMock.mockResolvedValueOnce({
      results: [{ op_id: opId, status: "applied", record_id: recordId }],
    });

    await realSyncNow();

    expect(await db.outbox.count()).toBe(0);
    expect((await db.records.get(recordId))?.synced).toBe(true);
  });

  it("removes a duplicate op the same way as applied", async () => {
    const recordId = await markAttendance(child, "present", "2026-09-17", null);
    const opId = (await db.outbox.toArray())[0].op_id;
    apiPostMock.mockResolvedValueOnce({ results: [{ op_id: opId, status: "duplicate" }] });

    await realSyncNow();

    expect(await db.outbox.count()).toBe(0);
    expect((await db.records.get(recordId))?.synced).toBe(true);
  });

  it("removes a rejected op but records the reason on the local record (e.g. day_closed, T5)", async () => {
    const recordId = await markAttendance(child, "present", "2026-09-17", null);
    const opId = (await db.outbox.toArray())[0].op_id;
    apiPostMock.mockResolvedValueOnce({
      results: [{ op_id: opId, status: "rejected", reason: "day_closed" }],
    });

    await realSyncNow();

    expect(await db.outbox.count()).toBe(0);
    const record = await db.records.get(recordId);
    expect(record?.rejected_reason).toBe("day_closed");
  });

  it("keeps the op queued and increments attempts on a network failure (airplane mode, T2/T3)", async () => {
    await markAttendance(child, "present", "2026-09-17", null);
    apiPostMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await realSyncNow();

    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].attempts).toBe(1);
  });

  it("does nothing while offline — the queued op survives untouched", async () => {
    await markAttendance(child, "present", "2026-09-17", null);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    await realSyncNow();

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(await db.outbox.count()).toBe(1);
  });
});

describe("syncNow — photo upload (TZ §7.7 evidence chain)", () => {
  const captured = new Blob(["original-camera-bytes"], { type: "image/jpeg" });
  const stored = new Blob(["compressed-webp-bytes"], { type: "image/webp" });

  async function queuePhoto() {
    const recordId = await markAttendance(
      { ...child, photo_consent: true },
      "present",
      "2026-09-17",
      captured,
    );
    await db.records.update(recordId, { synced: true });
    return recordId;
  }

  it("sends the hash of the bytes it actually uploads, not of the captured blob", async () => {
    // /api/photos/attach re-hashes the stored object server-side and
    // returns HASH_MISMATCH on any disagreement — which the client treats
    // as permanent. Sending the pre-compression hash therefore failed
    // every upload on its first try and lit the red "N ta yozuv
    // yuborilmadi" bar even though attendance itself had synced fine.
    compressMock.mockResolvedValue(stored);
    const recordId = await queuePhoto();
    const expectedHash = await sha256Hex(stored);
    const capturedHash = await sha256Hex(captured);
    expect(expectedHash).not.toBe(capturedHash);

    apiPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/photos/sign") {
        return { upload_url: "https://storage.test/put", path: "org/x.webp" };
      }
      if (url === "/api/sync/push") return { results: [] };
      return {};
    });

    await realSyncNow();

    const signCall = apiPostMock.mock.calls.find((c) => c[0] === "/api/photos/sign");
    const attachCall = apiPostMock.mock.calls.find((c) => c[0] === "/api/photos/attach");
    expect((signCall?.[1] as { sha256: string }).sha256).toBe(expectedHash);
    expect((attachCall?.[1] as { sha256: string }).sha256).toBe(expectedHash);
    expect((attachCall?.[1] as { bytes: number }).bytes).toBe(stored.size);

    expect((await db.photos.toArray())[0].status).toBe("done");
    expect((await db.records.get(recordId))?.has_photo).toBe(true);
  });

  it("does not burn an attempt when the attendance op hasn't reached the server yet", async () => {
    const recordId = await queuePhoto();
    await db.records.update(recordId, { synced: false });
    apiPostMock.mockRejectedValue(new ApiClientError(404, "RECORD_NOT_FOUND", "yo'q"));

    await realSyncNow();

    const photo = (await db.photos.toArray())[0];
    expect(photo.status).toBe("queued");
    expect(photo.attempts).toBe(0);
  });

  it("a stalled photo never blocks attendance ops from syncing", async () => {
    // One shared backoff clock used to mean a photo that kept failing
    // also froze the outbox — the record is what the bog'cha is legally
    // accountable for, so it must never wait on an image.
    await queuePhoto();
    apiPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/sync/push") {
        const ops = await db.outbox.toArray();
        return { results: ops.map((o) => ({ op_id: o.op_id, status: "applied" as const })) };
      }
      throw new TypeError("Failed to fetch");
    });

    await realSyncNow(); // photo fails, sets its own backoff
    await markAttendance(child, "absent", "2026-09-17", null);
    await realSyncNow();

    expect(await db.outbox.count()).toBe(0);
    expect((await db.photos.toArray())[0].status).toBe("queued");
  });

  it("retryFailed requeues a photo that was already given up on", async () => {
    await queuePhoto();
    const photoId = (await db.photos.toArray())[0].photo_id;
    await db.photos.update(photoId, { status: "failed", attempts: 99 });
    apiPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/photos/sign") {
        return { upload_url: "https://storage.test/put", path: "org/x.webp" };
      }
      if (url === "/api/sync/push") return { results: [] };
      return {};
    });

    await realRetryFailed();

    expect((await db.photos.get(photoId))?.status).toBe("done");
  });
});

describe("correctAttendance / queueDayClose", () => {
  it("queues an attendance.correct op carrying the required correction_note", async () => {
    await correctAttendance(child.id, "2026-09-01", "sick", "davlat tizimi qabul qilmadi");

    const ops = await db.outbox.toArray();
    expect(ops[0].type).toBe("attendance.correct");
    expect((ops[0].payload as { correction_note: string }).correction_note).toBe(
      "davlat tizimi qabul qilmadi",
    );
  });

  it("queues a day.close op", async () => {
    await queueDayClose("2026-09-17");

    const ops = await db.outbox.toArray();
    expect(ops[0].type).toBe("day.close");
    expect(ops[0].payload).toEqual({ day_date: "2026-09-17" });
  });
});
