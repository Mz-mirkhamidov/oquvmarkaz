"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import { ChildCard, type ChildCardData } from "@/components/attendance/ChildCard";
import { StatusSheet } from "@/components/attendance/StatusSheet";
import { SyncBar } from "@/components/attendance/SyncBar";
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
import { ApiClientError } from "@/lib/api/client";
import { markAttendance, queueDayClose } from "@/lib/offline/queue";
import { syncNow, setupAutoSync } from "@/lib/offline/sync";
import { pullAndCache } from "@/lib/offline/pull";
import {
  useCachedChildren,
  useCachedGroups,
  useLocalRecords,
  useMeta,
  useOnlineStatus,
} from "@/lib/offline/hooks";
import { todayInTashkent } from "@/lib/utils/date";
import type { AttendStatus } from "@/lib/db/types";

type Screen = "loading" | "ready" | "no_data";

export default function DavomatPage() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [activeChild, setActiveChild] = useState<ChildCardData | null>(null);
  const [cameraChild, setCameraChild] = useState<ChildCardData | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const online = useOnlineStatus();
  const today = useMeta("today", todayInTashkent());
  const dayStatus = useMeta<"open" | "closed" | "reopened">("day_status", "open");
  const photoRequired = useMeta("photo_required", true);
  // These hooks already default to [] via useLiveQuery's third argument —
  // no `?? []` here, so the reference stays stable across renders.
  const groups = useCachedGroups();
  const cachedChildren = useCachedChildren();
  const localRecords = useLocalRecords(today);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Promise.resolve();
      try {
        await pullAndCache();
      } catch {
        // Fine offline — we fall back to whatever's already cached below.
      }
      if (!cancelled) setScreen("ready");
    }
    void init();
    const stopAutoSync = setupAutoSync();
    return () => {
      cancelled = true;
      stopAutoSync();
    };
  }, []);

  const recordByChild = useMemo(
    () => new Map(localRecords.map((r) => [r.child_id, r])),
    [localRecords],
  );

  const children: ChildCardData[] = useMemo(
    () =>
      cachedChildren.map((c) => {
        const r = recordByChild.get(c.id);
        return {
          id: c.id,
          full_name: c.full_name,
          group_id: c.group_id,
          photo_consent: c.photo_consent,
          record: r ? { status: r.status, marked_at: r.client_marked_at } : null,
        };
      }),
    [cachedChildren, recordByChild],
  );

  const filteredChildren = useMemo(
    () => (groupFilter ? children.filter((c) => c.group_id === groupFilter) : children),
    [children, groupFilter],
  );

  const counts = useMemo(() => {
    const present = filteredChildren.filter((c) => c.record?.status === "present").length;
    const absent = filteredChildren.filter(
      (c) => c.record && c.record.status !== "present",
    ).length;
    return { present, absent, remaining: filteredChildren.length - present - absent };
  }, [filteredChildren]);

  const isClosed = dayStatus === "closed";

  async function mark(child: ChildCardData, status: AttendStatus, photo?: Blob) {
    if (isClosed) return;
    const cached = cachedChildren.find((c) => c.id === child.id);
    if (!cached) return;
    await markAttendance(cached, status, today, photo ?? null);
  }

  function handleTap(child: ChildCardData) {
    if (isClosed) return;
    if (!child.record) {
      if (photoRequired && child.photo_consent) {
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
      await queueDayClose(today);
      if (online) await syncNow();
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

  if (cachedChildren.length === 0) {
    return online ? (
      <EmptyState
        title="Hali bola qo'shilmagan"
        description="Davomat belgilash uchun avval bolalarni qo'shing."
      />
    ) : (
      <EmptyState
        title="Ma'lumot hali yuklanmagan"
        description="Bu qurilmada birinchi marta ishlatilmoqda — davomatni boshlash uchun bir marta internetga ulaning."
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col">
      <SyncBar onRetry={() => void syncNow()} />

      <div className="flex-1 px-4 py-4 sm:px-6">
        {groups.length > 1 && (
          <select
            className="mb-4 h-11 w-full rounded-(--r-md) border border-border bg-surface px-3 text-[15px] text-text sm:w-64"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
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
                  {!online && " Internet yo'q — kun internet kelganda yopiladi."}
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
