"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, X as XIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGet, apiPost, apiPut, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { ATTEND_STATUS_LABELS, REJECT_REASON_LABELS } from "@/lib/utils/labels";

const REASONS = Object.keys(REJECT_REASON_LABELS) as (keyof typeof REJECT_REASON_LABELS)[];

interface StateRow {
  child_id: string;
  full_name: string;
  group_id: string | null;
  our_status: string | null;
  check: { id: string; result: string; reason: string | null; note: string | null } | null;
}

interface Edit {
  result: "accepted" | "rejected";
  reason?: string;
  note?: string;
}

export function DayComparison({ date }: { date: string }) {
  const [rows, setRows] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [creatingDispute, setCreatingDispute] = useState(false);
  const [disputeTitle, setDisputeTitle] = useState("");

  async function load() {
    await Promise.resolve();
    setLoading(true);
    try {
      const view = await apiGet<{ rows: StateRow[] }>(`/api/state/${date}`);
      setRows(view.rows);
      const prefill: Record<string, Edit> = {};
      for (const r of view.rows) {
        if (r.check) {
          prefill[r.child_id] = {
            result: r.check.result as "accepted" | "rejected",
            reason: r.check.reason ?? undefined,
            note: r.check.note ?? undefined,
          };
        }
      }
      setEdits(prefill);
    } catch {
      setError("Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a reusable `load` (also used after saving); it awaits before its first setState.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is keyed on the route's date only
  }, [date]);

  function setEdit(childId: string, next: Partial<Edit>) {
    setEdits((prev) => {
      const current = prev[childId] ?? { result: "accepted" as const };
      return { ...prev, [childId]: { ...current, ...next } };
    });
  }

  async function save() {
    const items = Object.entries(edits)
      .filter(([, e]) => e.result)
      .map(([child_id, e]) => ({
        child_id,
        result: e.result,
        reason: e.result === "rejected" ? (e.reason as string | undefined) ?? "boshqa" : undefined,
        note: e.note,
      }));
    if (items.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await apiPut(`/api/state/${date}`, { items });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Saqlab bo'lmadi.");
    } finally {
      setSaving(false);
    }
  }

  const mismatchChecks = rows.filter((r) => r.check?.result === "rejected");

  async function createDispute() {
    if (disputeTitle.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/disputes", {
        period_month: `${date.slice(0, 7)}-01`,
        title: disputeTitle.trim(),
        check_ids: mismatchChecks.map((r) => r.check!.id),
      });
      setCreatingDispute(false);
      setDisputeTitle("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Da'vo yaratib bo'lmadi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title="Bu kun uchun bola yo'q" description={date} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-text">{date}</h1>
        {mismatchChecks.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setCreatingDispute(true)}>
            Nomuvofiqlar asosida da&apos;vo yaratish ({mismatchChecks.length})
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {creatingDispute && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <Input
              placeholder="Da'vo nomi (masalan: Sentyabr nomuvofiqliklari)"
              value={disputeTitle}
              onChange={(e) => setDisputeTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void createDispute()} disabled={saving}>
                Yaratish
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatingDispute(false)}>
                Bekor qilish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bolalar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {rows.map((r) => {
            const edit = edits[r.child_id];
            return (
              <div key={r.child_id} className="flex flex-col gap-2 border-b border-border py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-text">{r.full_name}</p>
                    <p className="text-sm text-text-2">
                      Bizda: {r.our_status ? (ATTEND_STATUS_LABELS[r.our_status] ?? r.our_status) : "belgilanmagan"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {edit?.result === "rejected" && (
                      <Badge variant="danger">
                        <AlertTriangle className="size-3" aria-hidden />
                        Nomuvofiq
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant={edit?.result === "accepted" ? "primary" : "secondary"}
                      onClick={() => setEdit(r.child_id, { result: "accepted", reason: undefined })}
                    >
                      <Check className="size-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant={edit?.result === "rejected" ? "danger" : "secondary"}
                      onClick={() => setEdit(r.child_id, { result: "rejected" })}
                    >
                      <XIcon className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                {edit?.result === "rejected" && (
                  <div className="flex flex-col gap-2 rounded-(--r-md) bg-surface-2 p-3 sm:flex-row sm:items-center">
                    <select
                      value={edit.reason ?? ""}
                      onChange={(e) => setEdit(r.child_id, { reason: e.target.value })}
                      className="h-10 rounded-(--r-md) border border-border bg-surface px-2 text-sm text-text"
                    >
                      <option value="" disabled>
                        Sabab...
                      </option>
                      {REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {REJECT_REASON_LABELS[reason]}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Izoh (ixtiyoriy)"
                      value={edit.note ?? ""}
                      onChange={(e) => setEdit(r.child_id, { note: e.target.value })}
                      className={cn("sm:flex-1")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button onClick={() => void save()} disabled={saving || Object.keys(edits).length === 0}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Saqlash"}
      </Button>
    </div>
  );
}
