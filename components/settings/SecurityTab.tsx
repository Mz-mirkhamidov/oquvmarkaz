"use client";

import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGet, apiDelete } from "@/lib/api/client";

interface SessionListItem {
  id: string;
  userId: string;
  userName: string | null;
  userRole: string | null;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

interface AuthEventListItem {
  id: string;
  at: string;
  code: string;
  stage: string;
  ok: boolean;
  userId: string | null;
  deviceId: string | null;
  ip: string | null;
}

type Status = "loading" | "ready" | "error" | "offline";

const ROLE_LABEL: Record<string, string> = {
  owner: "Rahbar",
  director: "Direktor",
  teacher: "Tarbiyachi",
};

function SessionsSection() {
  const [status, setStatus] = useState<Status>("loading");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const data = await apiGet<SessionListItem[]>("/api/sessions");
      setSessions(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await apiDelete(`/api/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // best-effort; the manager can retry the click
    } finally {
      setRevokingId(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }
  if (status === "offline") {
    return (
      <EmptyState
        icon={<WifiOff className="size-8" aria-hidden />}
        title="Internet yo'q"
        description="Sessiyalar ro'yxati internet kelganda yuklanadi."
      />
    );
  }
  if (status === "error") {
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
  if (sessions.length === 0) {
    return <EmptyState title="Faol sessiya yo'q" description="Hozircha hech kim tizimga kirmagan." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 rounded-(--r-md) border border-border bg-surface px-4 py-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] text-text">
              {s.userName ?? "Noma'lum foydalanuvchi"}
              {s.userRole && (
                <span className="ml-2 text-xs text-text-2">{ROLE_LABEL[s.userRole] ?? s.userRole}</span>
              )}
            </span>
            <span className="text-xs text-text-2">
              Kirdi: {new Date(s.createdAt).toLocaleString("uz-UZ")}
              {s.ipAddress && ` · IP: ${s.ipAddress}`}
              {s.deviceId && " · qurilmadan"}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={revokingId === s.id}
            onClick={() => void revoke(s.id)}
          >
            {revokingId === s.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Chiqarish"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AuthEventsSection() {
  const [status, setStatus] = useState<Status>("loading");
  const [events, setEvents] = useState<AuthEventListItem[]>([]);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const data = await apiGet<AuthEventListItem[]>("/api/auth/events");
      setEvents(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }
  if (status === "offline") {
    return (
      <EmptyState
        icon={<WifiOff className="size-8" aria-hidden />}
        title="Internet yo'q"
        description="Hodisalar ro'yxati internet kelganda yuklanadi."
      />
    );
  }
  if (status === "error") {
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
  if (events.length === 0) {
    return <EmptyState title="Hodisa yo'q" description="Hali hech qanday kirish urinishi qayd etilmagan." />;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between gap-3 rounded-(--r-md) border border-border bg-surface px-4 py-2.5"
        >
          <div className="flex items-center gap-2">
            <Badge variant={e.ok ? "ok" : "danger"}>{e.code}</Badge>
            <span className="text-xs text-text-2">{e.stage}</span>
          </div>
          <span className="text-xs text-text-2">{new Date(e.at).toLocaleString("uz-UZ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** TZ v2 A5/§11.1 — "rahbar kim qayerdan kirganini ko'radi": sessions + auth_events. */
export function SecurityTab() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-text">Faol sessiyalar</h2>
        <SessionsSection />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-text">Kirish hodisalari</h2>
        <p className="text-sm text-text-2">Oxirgi 100 ta hodisa — muvaffaqiyatli va xato urinishlar.</p>
        <AuthEventsSection />
      </section>
    </div>
  );
}
