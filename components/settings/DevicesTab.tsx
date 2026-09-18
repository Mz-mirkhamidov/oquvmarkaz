"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";

interface Device {
  id: string;
  label: string | null;
  bound_at: string | null;
  last_seen_at: string | null;
  is_blocked: boolean;
  created_at: string;
}

interface NewDevice {
  id: string;
  bind_code: string;
  bind_expires: string;
}

type Status = "loading" | "ready" | "empty" | "error" | "offline";

export function DevicesTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [devices, setDevices] = useState<Device[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState<NewDevice | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const data = await apiGet<Device[]>("/api/devices");
      setDevices(data);
      setStatus(data.length === 0 ? "empty" : "ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const device = await apiPost<NewDevice>("/api/devices", {
        label: label.trim() || undefined,
      });
      setNewDevice(device);
      setLabel("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setCreating(false);
    }
  }

  async function blockDevice(id: string) {
    setBlockingId(id);
    try {
      await apiPost(`/api/devices/${id}/block`, {});
      setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, is_blocked: true } : d)));
    } catch {
      // best-effort UI update; the row simply won't flip and the manager can retry
    } finally {
      setBlockingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={createDevice} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Qurilma nomi (masalan, Guruh 1 planshet)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="sm:flex-1"
        />
        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-[18px]" aria-hidden />}
        </Button>
      </form>
      {formError && <p className="text-sm text-danger">{formError}</p>}

      {newDevice && (
        <div className="flex flex-col gap-1 rounded-(--r-md) border border-brand bg-brand-soft px-4 py-3">
          <p className="text-sm text-text-2">
            Bog&apos;lash kodi (planshetda <span className="font-medium">/qurilma</span> sahifasiga kiriting):
          </p>
          <p className="text-[28px] font-semibold tracking-[0.2em] text-text">{newDevice.bind_code}</p>
          <p className="text-xs text-text-2">
            Muddati: {new Date(newDevice.bind_expires).toLocaleString("uz-UZ")}
          </p>
        </div>
      )}

      {status === "loading" && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
        </div>
      )}

      {status === "offline" && (
        <EmptyState
          icon={<WifiOff className="size-8" aria-hidden />}
          title="Internet yo'q"
          description="Qurilmalar ro'yxati internet kelganda yuklanadi."
        />
      )}

      {status === "error" && (
        <EmptyState
          title="Yuklab bo'lmadi"
          description="Hozir ulanib bo'lmadi."
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {status === "empty" && (
        <EmptyState
          title="Hali qurilma yo'q"
          description="Yuqoridagi tugma bilan bog'lash kodi yarating va planshetda /qurilma sahifasiga kiriting."
        />
      )}

      {status === "ready" && (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-(--r-md) border border-border bg-surface px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] text-text">{d.label ?? "Nomsiz qurilma"}</span>
                <span className="text-xs text-text-2">
                  {d.bound_at
                    ? `Bog'landi: ${new Date(d.bound_at).toLocaleString("uz-UZ")}`
                    : "Hali bog'lanmagan"}
                  {d.last_seen_at && ` · Oxirgi faollik: ${new Date(d.last_seen_at).toLocaleString("uz-UZ")}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.is_blocked ? "danger" : "ok"}>
                  {d.is_blocked ? "bloklangan" : "faol"}
                </Badge>
                {!d.is_blocked && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={blockingId === d.id}
                    onClick={() => void blockDevice(d.id)}
                  >
                    {blockingId === d.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Bloklash"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
