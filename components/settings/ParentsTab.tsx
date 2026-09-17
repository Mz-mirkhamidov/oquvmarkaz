"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Copy, Loader2, Plus, RefreshCw, Trash2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGet, apiPost, apiPatch, apiDelete, ApiClientError } from "@/lib/api/client";

interface Parent {
  id: string;
  full_name: string;
  phone: string | null;
  notify_enabled: boolean;
  linked: boolean;
  link_code: string | null;
  link_code_expires: string | null;
  children: string[];
}

interface Child {
  id: string;
  full_name: string;
}

type Status = "loading" | "ready" | "empty" | "error" | "offline";

export function ParentsTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [parents, setParents] = useState<Parent[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<{ id: string; url: string } | null>(null);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const [parentsData, childrenData] = await Promise.all([
        apiGet<Parent[]>("/api/parents"),
        apiGet<Child[]>("/api/children"),
      ]);
      setParents(parentsData);
      setChildren(childrenData);
      setStatus(parentsData.length === 0 ? "empty" : "ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  function toggleChild(id: string) {
    setSelectedChildren((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function addParent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2 || selectedChildren.length === 0) {
      setFormError("Ism va kamida bitta bolani tanlang.");
      return;
    }
    setAdding(true);
    try {
      const created = await apiPost<{ id: string; link_url: string }>("/api/parents", {
        full_name: name.trim(),
        phone: phone.trim() || undefined,
        child_ids: selectedChildren,
      });
      setName("");
      setPhone("");
      setSelectedChildren([]);
      setLastLink({ id: created.id, url: created.link_url });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleNotify(p: Parent) {
    const prev = parents;
    setParents((list) => list.map((x) => (x.id === p.id ? { ...x, notify_enabled: !x.notify_enabled } : x)));
    try {
      await apiPatch(`/api/parents/${p.id}`, { notify_enabled: !p.notify_enabled });
    } catch {
      setParents(prev);
    }
  }

  async function relink(id: string) {
    try {
      const result = await apiPost<{ id: string; link_url: string }>(`/api/parents/${id}/relink`, {});
      setLastLink({ id: result.id, url: result.link_url });
      await load();
    } catch {
      // the row keeps its old (now-unlinked) state; the director can retry
    }
  }

  async function removeParent(id: string) {
    if (!confirm("Ota-onani o'chirishni tasdiqlaysizmi?")) return;
    const prev = parents;
    setParents((list) => list.filter((x) => x.id !== id));
    try {
      await apiDelete(`/api/parents/${id}`);
    } catch {
      setParents(prev);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addParent} className="flex flex-col gap-2 rounded-(--r-md) border border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Ota-ona F.I.Sh"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:flex-1"
          />
          <Input
            placeholder="Telefon (ixtiyoriy)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="sm:w-48"
          />
        </div>
        {children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChild(c.id)}
                className={`rounded-(--r-full) border px-3 py-1 text-sm ${
                  selectedChildren.includes(c.id)
                    ? "border-brand bg-brand-soft text-brand-hover"
                    : "border-border text-text-2"
                }`}
              >
                {c.full_name}
              </button>
            ))}
          </div>
        )}
        <Button type="submit" disabled={adding} className="self-start">
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-[18px]" aria-hidden />}
          Qo&apos;shish
        </Button>
        {formError && <p className="text-sm text-danger">{formError}</p>}
      </form>

      {lastLink && (
        <div className="flex flex-col gap-2 rounded-(--r-md) bg-brand-soft p-4">
          <p className="text-sm text-text">Ota-onaga shu havolani yuboring (Telegramda ochiladi):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-(--r-sm) bg-surface px-2 py-1.5 text-sm">{lastLink.url}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void navigator.clipboard?.writeText(lastLink.url)}
            >
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
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
          description="Ota-onalar ro'yxati internet kelganda yuklanadi."
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
        <EmptyState title="Hali ota-ona yo'q" description="Birinchi ota-onani yuqoridan qo'shing." />
      )}

      {status === "ready" && (
        <ul className="flex flex-col gap-2">
          {parents.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-(--r-md) border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-[15px] font-medium text-text">{p.full_name}</p>
                <p className="text-sm text-text-2">{p.children.join(", ") || "bola bog'lanmagan"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.linked ? "ok" : "neutral"}>{p.linked ? "bog'langan" : "kutilmoqda"}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={p.notify_enabled ? "Xabarlarni o'chirish" : "Xabarlarni yoqish"}
                  onClick={() => void toggleNotify(p)}
                >
                  {p.notify_enabled ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
                </Button>
                <Button variant="ghost" size="sm" aria-label="Qayta bog'lash havolasi" onClick={() => void relink(p.id)}>
                  <RefreshCw className="size-4" aria-hidden />
                </Button>
                <button
                  type="button"
                  onClick={() => void removeParent(p.id)}
                  aria-label={`${p.full_name}ni o'chirish`}
                  className="text-text-3 hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
