"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";

interface Teacher {
  id: string;
  full_name: string;
  is_active: boolean;
}

type Status = "loading" | "ready" | "empty" | "error" | "offline";

export function TeachersTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const data = await apiGet<Teacher[]>("/api/teachers");
      setTeachers(data);
      setStatus(data.length === 0 ? "empty" : "ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2 || !/^\d{4}$/.test(pin)) {
      setFormError("Ism va 4 xonali PIN kiriting.");
      return;
    }
    setAdding(true);
    try {
      const teacher = await apiPost<Teacher>("/api/teachers", { full_name: name.trim(), pin });
      setTeachers((prev) => [...prev, teacher]);
      setName("");
      setPin("");
      setStatus("ready");
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addTeacher} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Tarbiyachi F.I.Sh"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="sm:flex-1"
        />
        <Input
          placeholder="4 xonali PIN"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="sm:w-32"
        />
        <Button type="submit" disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-[18px]" aria-hidden />}
        </Button>
      </form>
      {formError && <p className="text-sm text-danger">{formError}</p>}

      {status === "loading" && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
        </div>
      )}

      {status === "offline" && (
        <EmptyState
          icon={<WifiOff className="size-8" aria-hidden />}
          title="Internet yo'q"
          description="Tarbiyachilar ro'yxati internet kelganda yuklanadi."
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
        <EmptyState title="Hali tarbiyachi yo'q" description="Birinchi tarbiyachini yuqoridan qo'shing." />
      )}

      {status === "ready" && (
        <ul className="flex flex-col gap-2">
          {teachers.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-(--r-md) border border-border bg-surface px-4 py-3"
            >
              <span className="text-[15px] text-text">{t.full_name}</span>
              <Badge variant={t.is_active ? "ok" : "neutral"}>
                {t.is_active ? "faol" : "faol emas"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
