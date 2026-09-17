"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGet, apiPost, apiDelete, ApiClientError } from "@/lib/api/client";

interface Group {
  id: string;
  name: string;
  sort_order: number;
}

type Status = "loading" | "ready" | "empty" | "error" | "offline";

export function GroupsTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const data = await apiGet<Group[]>("/api/groups");
      setGroups(data);
      setStatus(data.length === 0 ? "empty" : "ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used by the retry button); it awaits before its first setState.
    void load();
  }, []);

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const group = await apiPost<Group>("/api/groups", { name: newName.trim() });
      setGroups((prev) => [...prev, group]);
      setNewName("");
      setStatus("ready");
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setAdding(false);
    }
  }

  async function removeGroup(id: string) {
    if (!confirm("Guruhni o'chirishni tasdiqlaysizmi?")) return;
    const prev = groups;
    setGroups((g) => g.filter((x) => x.id !== id));
    try {
      await apiDelete(`/api/groups/${id}`);
    } catch {
      setGroups(prev);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addGroup} className="flex gap-2">
        <Input
          placeholder="Yangi guruh nomi"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-[18px]" aria-hidden />}
        </Button>
      </form>

      {status === "loading" && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
        </div>
      )}

      {status === "offline" && (
        <EmptyState
          icon={<WifiOff className="size-8" aria-hidden />}
          title="Internet yo'q"
          description="Guruhlar ro'yxati internet kelganda yuklanadi."
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
        <EmptyState title="Hali guruh yo'q" description="Birinchi guruhni yuqoridan qo'shing." />
      )}

      {status === "ready" && (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-(--r-md) border border-border bg-surface px-4 py-3"
            >
              <span className="text-[15px] text-text">{g.name}</span>
              <button
                type="button"
                onClick={() => removeGroup(g.id)}
                aria-label={`${g.name} guruhini o'chirish`}
                className="text-text-3 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
