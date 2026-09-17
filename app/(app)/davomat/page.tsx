"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, WifiOff, Lock } from "lucide-react";

import { ChildCard, type ChildCardData } from "@/components/attendance/ChildCard";
import { StatusSheet } from "@/components/attendance/StatusSheet";
import { SyncBar, type SyncState } from "@/components/attendance/SyncBar";
import { CameraSheet } from "@/components/attendance/CameraSheet";
import { StatTile } from "@/components/shared/StatTile";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";
import { getOrCreateDeviceKey } from "@/lib/device";
import { compressPhoto } from "@/lib/media/compress";
import { sha256Hex } from "@/lib/crypto/sha256";
import type { AttendStatus } from "@/lib/db/types";

interface Group {
  id: string;
  name: string;
}

interface DayView {
  day: { id: string; status: "open" | "closed" | "reopened" } | null;
  children: ChildCardData[];
  groups: Group[];
  date: string;
  photo_required: boolean;
}

type Screen = "loading" | "ready" | "empty" | "error" | "offline";

export default function DavomatPage() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [view, setView] = useState<DayView | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [activeChild, setActiveChild] = useState<ChildCardData | null>(null);
  const [cameraChild, setCameraChild] = useState<ChildCardData | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setScreen("offline");
      return;
    }
    setScreen("loading");
    try {
      const data = await apiGet<DayView>("/api/attendance/today");
      setView(data);
      setScreen(data.children.length === 0 ? "empty" : "ready");
    } catch {
      setScreen("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  const filteredChildren = useMemo(() => {
    if (!view) return [];
    if (!groupFilter) return view.children;
    return view.children.filter((c) => (c as { group_id?: string }).group_id === groupFilter);
  }, [view, groupFilter]);

  const counts = useMemo(() => {
    const present = filteredChildren.filter((c) => c.record?.status === "present").length;
    const absent = filteredChildren.filter(
      (c) => c.record && c.record.status !== "present",
    ).length;
    const remaining = filteredChildren.length - present - absent;
    return { present, absent, remaining, total: filteredChildren.length };
  }, [filteredChildren]);

  const isClosed = view?.day?.status === "closed";

  async function mark(child: ChildCardData, status: AttendStatus, photo?: Blob) {
    if (!view || isClosed) return;
    setSyncState("saving");

    const recordId = crypto.randomUUID();

    // Optimistic update
    const previous = view;
    setView({
      ...view,
      children: view.children.map((c) =>
        c.id === child.id
          ? { ...c, record: { status, marked_at: new Date().toISOString() } }
          : c,
      ),
    });

    try {
      const result = await apiPost<{ results: { status: string }[] }>("/api/sync/push", {
        device_key: getOrCreateDeviceKey(),
        ops: [
          {
            op_id: crypto.randomUUID(),
            type: "attendance.mark",
            client_at: new Date().toISOString(),
            payload: { record_id: recordId, day_date: view.date, child_id: child.id, status },
          },
        ],
      });
      if (result.results[0]?.status === "rejected") {
        setView(previous);
        setSyncState("error");
        return;
      }
      if (photo) {
        try {
          await uploadPhoto(child.id, recordId, view.date, photo);
          setSyncState("saved");
        } catch {
          // The attendance record itself is already saved — a failed photo
          // upload isn't a lost mark, just missing evidence for this one.
          setSyncState("error");
        }
      } else {
        setSyncState("saved");
      }
    } catch {
      setView(previous);
      setSyncState(navigator.onLine ? "error" : "offline");
    }
  }

  async function uploadPhoto(childId: string, recordId: string, dayDate: string, rawBlob: Blob) {
    const compressed = await compressPhoto(rawBlob);
    const sha256 = await sha256Hex(compressed);
    const photoId = crypto.randomUUID();

    const sign = await apiPost<{ upload_url: string; path: string; token?: string }>(
      "/api/photos/sign",
      {
        photo_id: photoId,
        record_id: recordId,
        child_id: childId,
        day_date: dayDate,
        sha256,
        bytes: compressed.size,
        mime: "image/webp",
      },
    );

    const uploadRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
      body: compressed,
    });
    if (!uploadRes.ok) throw new Error("upload_failed");

    await apiPost("/api/photos/attach", {
      photo_id: photoId,
      record_id: recordId,
      path: sign.path,
      sha256,
      bytes: compressed.size,
      taken_at: new Date().toISOString(),
    });
  }

  function handleTap(child: ChildCardData) {
    if (isClosed) return;
    if (!child.record) {
      if (view?.photo_required && child.photo_consent) {
        setCameraChild(child);
      } else {
        void mark(child, "present");
      }
    } else {
      setActiveChild(child);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      await apiPost("/api/attendance/close", { day_date: view?.date });
      await load();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Kunni yopib bo'lmadi.");
    } finally {
      setClosing(false);
      setCloseDialogOpen(false);
    }
  }

  if (screen === "loading") {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }

  if (screen === "offline" && !view) {
    return (
      <EmptyState
        icon={<WifiOff className="size-8" aria-hidden />}
        title="Internet yo'q"
        description="Bugungi davomat internet kelganda yuklanadi."
      />
    );
  }

  if (screen === "error") {
    return (
      <EmptyState
        title="Yuklab bo'lmadi"
        description="Hozir ulanib bo'lmadi."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Qayta urinish
          </Button>
        }
      />
    );
  }

  if (screen === "empty") {
    return (
      <EmptyState
        title="Hali bola qo'shilmagan"
        description="Davomat belgilash uchun avval bolalarni qo'shing."
      />
    );
  }

  if (!view) return null;

  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col">
      <SyncBar state={syncState} onRetry={() => void load()} />

      <div className="flex-1 px-4 py-4 sm:px-6">
        {view.groups.length > 1 && (
          <select
            className="mb-4 h-11 w-full rounded-(--r-md) border border-border bg-surface px-3 text-[15px] text-text sm:w-64"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">Barcha guruhlar</option>
            {view.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile label="Keldi" value={counts.present} tone="ok" />
          <StatTile label="Kelmadi" value={counts.absent} tone="warn" />
          <StatTile label="Qoldi" value={counts.remaining} />
        </div>

        {isClosed && (
          <div className="mb-4 flex items-center gap-2 rounded-(--r-md) bg-surface-2 px-3 py-2 text-sm text-text-2">
            <Lock className="size-4" aria-hidden />
            Bu kun yopilgan. O&apos;zgartirish uchun rahbardan qayta ochishni so&apos;rang.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filteredChildren.map((child) => (
            <ChildCard key={child.id} child={child} disabled={isClosed} onTap={() => handleTap(child)} />
          ))}
        </div>
      </div>

      {!isClosed && (
        <div className="sticky bottom-0 border-t border-border bg-surface p-4">
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <Button size="xl" className="w-full" onClick={() => setCloseDialogOpen(true)}>
              Kunni yopish
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kunni yopishni tasdiqlaysizmi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Belgilanmagan {counts.remaining} bola avtomatik &quot;kelmadi&quot; deb
                  belgilanadi. Keyinroq faqat rahbar qayta ochishi mumkin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={closing}>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction
                  disabled={closing}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleClose();
                  }}
                >
                  {closing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Kunni yopish"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeChild && (
        <StatusSheet
          open={!!activeChild}
          onOpenChange={(open) => !open && setActiveChild(null)}
          childName={activeChild.full_name}
          currentStatus={activeChild.record?.status}
          onSelect={(status) => void mark(activeChild, status)}
        />
      )}

      {cameraChild && (
        <CameraSheet
          open={!!cameraChild}
          childName={cameraChild.full_name}
          onClose={() => setCameraChild(null)}
          onSkip={() => {
            const child = cameraChild;
            setCameraChild(null);
            void mark(child, "present");
          }}
          onCapture={(blob) => {
            const child = cameraChild;
            setCameraChild(null);
            void mark(child, "present", blob);
          }}
        />
      )}
    </div>
  );
}
