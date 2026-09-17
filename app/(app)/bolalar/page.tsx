"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, WifiOff, Check, X as XIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";

interface Group {
  id: string;
  name: string;
}

interface Child {
  id: string;
  full_name: string;
  group_id: string | null;
  state_system_id: string | null;
  photo_consent: boolean;
}

type Status = "loading" | "ready" | "empty" | "error" | "offline";

export default function BolalarPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    await Promise.resolve();
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    try {
      const [childrenData, groupsData] = await Promise.all([
        apiGet<Child[]>("/api/children"),
        apiGet<Group[]>("/api/groups"),
      ]);
      setChildren(childrenData);
      setGroups(groupsData);
      setStatus(childrenData.length === 0 ? "empty" : "ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    // Fetch-on-mount, reusing `load` so the retry button below can call it
    // too — the rule can't see through the indirection to confirm `load`
    // awaits before its first setState (it does).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const groupName = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "Guruhsiz");
  }, [groups]);

  const filtered = children.filter((c) => {
    if (groupFilter && c.group_id !== groupFilter) return false;
    if (search && !c.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <PageHeader
        title="Bolalar"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-[18px]" aria-hidden />
                Yangi bola
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi bola qo&apos;shish</DialogTitle>
              </DialogHeader>
              <AddChildForm
                groups={groups}
                onDone={(child) => {
                  setChildren((prev) => [...prev, child]);
                  setStatus("ready");
                  setDialogOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-2" aria-hidden />
        </div>
      )}

      {status === "offline" && (
        <EmptyState
          icon={<WifiOff className="size-8" aria-hidden />}
          title="Internet yo'q"
          description="Bolalar ro'yxati internet kelganda yuklanadi."
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
          title="Hali bola qo'shilmagan"
          description="Birinchi bolani qo'shing yoki Excel fayldan yuklang."
        />
      )}

      {(status === "ready" || (status === "empty" && children.length > 0)) && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3"
                aria-hidden
              />
              <Input
                placeholder="Ism bo'yicha qidirish"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="h-12 rounded-(--r-md) border border-border bg-surface px-3.5 text-[15px] text-text sm:w-56"
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
          </div>

          <div className="overflow-x-auto rounded-(--r-lg) border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-2 text-text-2">
                <tr>
                  <th className="px-4 py-3 font-medium">F.I.Sh</th>
                  <th className="px-4 py-3 font-medium">Guruh</th>
                  <th className="px-4 py-3 font-medium">Davlat ID</th>
                  <th className="px-4 py-3 font-medium">Rozilik</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 text-text">{c.full_name}</td>
                    <td className="px-4 py-3 text-text-2">{groupName(c.group_id)}</td>
                    <td className="px-4 py-3 font-mono text-text-2">{c.state_system_id || "—"}</td>
                    <td className="px-4 py-3">
                      {c.photo_consent ? (
                        <Check className="size-4 text-ok" aria-label="Rozilik bor" />
                      ) : (
                        <XIcon className="size-4 text-text-3" aria-label="Rozilik yo'q" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AddChildForm({
  groups,
  onDone,
}: {
  groups: Group[];
  onDone: (child: Child) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [stateId, setStateId] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const child = await apiPost<Child>("/api/children", {
        full_name: fullName.trim(),
        group_id: groupId || undefined,
        state_system_id: stateId || undefined,
        photo_consent: consent,
      });
      onDone(child);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>F.I.Sh</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Guruh</Label>
        <select
          className="h-12 rounded-(--r-md) border border-border bg-surface px-3.5 text-[15px] text-text"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">Guruhsiz</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Davlat tizimi ID (ixtiyoriy)</Label>
        <Input value={stateId} onChange={(e) => setStateId(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="size-4"
        />
        Ota-onadan rasm olishga rozilik olingan
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={submitting || fullName.trim().length < 2}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Qo'shish"}
      </Button>
    </form>
  );
}
