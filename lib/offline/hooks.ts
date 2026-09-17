"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import { MAX_SYNC_ATTEMPTS } from "@/lib/offline/constants";

export function useOutboxCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0) ?? 0;
}

export function usePendingPhotoCount(): number {
  return (
    useLiveQuery(
      () => db.photos.where("status").anyOf(["queued", "uploading"]).count(),
      [],
      0,
    ) ?? 0
  );
}

export function useFailedCount(): number {
  return (
    useLiveQuery(
      async () => {
        const outboxFailed = await db.outbox
          .filter((o) => o.attempts > MAX_SYNC_ATTEMPTS)
          .count();
        const photosFailed = await db.photos.where("status").equals("failed").count();
        return outboxFailed + photosFailed;
      },
      [],
      0,
    ) ?? 0
  );
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useLocalRecords(dayDate: string) {
  return useLiveQuery(
    () => db.records.where("day_date").equals(dayDate).toArray(),
    [dayDate],
    [],
  );
}

export function useCachedChildren() {
  return useLiveQuery(
    async () => {
      const children = await db.children.toArray();
      return children.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    [],
    [],
  );
}

export function useCachedGroups() {
  return useLiveQuery(() => db.groups.toArray(), [], []);
}

export function useMeta<T>(key: string, fallback: T): T {
  const value = useLiveQuery(() => db.meta.get(key), [key]);
  return (value?.value as T | undefined) ?? fallback;
}
