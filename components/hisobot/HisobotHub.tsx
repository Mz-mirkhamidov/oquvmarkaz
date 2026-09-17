"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGet, apiPatch } from "@/lib/api/client";
import { todayInTashkent } from "@/lib/utils/date";
import { DISPUTE_STATUS_LABELS } from "@/lib/utils/labels";

interface MonthDay {
  day_date: string;
  status: string;
  total_count: number;
  present_count: number;
  mismatch_count: number;
}

interface Dispute {
  id: string;
  title: string;
  status: string;
  affected_children: number;
  affected_days: number;
  estimated_amount: number | null;
}

export function HisobotHub() {
  const [month, setMonth] = useState(() => todayInTashkent().slice(0, 7));
  const [days, setDays] = useState<MonthDay[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [stateRes, disputesRes] = await Promise.all([
          apiGet<{ days: MonthDay[] }>(`/api/state?month=${month}`),
          apiGet<Dispute[]>(`/api/disputes?month=${month}`),
        ]);
        if (cancelled) return;
        setDays(stateRes.days);
        setDisputes(disputesRes);
      } catch {
        if (!cancelled) {
          setDays([]);
          setDisputes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month]);

  async function submitDispute(id: string) {
    try {
      const updated = await apiPatch<Dispute>(`/api/disputes/${id}`, { status: "submitted" });
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch {
      // the row stays as-is; the director can retry from the same screen
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-11 rounded-(--r-md) border border-border bg-surface px-3 text-[15px] text-text"
        />
        <Button variant="secondary" asChild>
          <a href={`/api/reports/monthly?month=${month}`} download>
            <Download className="size-4" aria-hidden />
            Oylik hisobot (XLSX)
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Davlat tizimi bilan solishtirish</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
            </div>
          ) : days.length === 0 ? (
            <EmptyState title="Bu oyda kun yo'q" description="Davomat belgilangan kunlar shu yerda ko'rinadi." />
          ) : (
            <ul className="flex flex-col gap-1">
              {days.map((d) => (
                <li key={d.day_date}>
                  <a
                    href={`/hisobot/${d.day_date}`}
                    className="flex items-center justify-between rounded-(--r-md) px-3 py-2.5 hover:bg-surface-2"
                  >
                    <span className="text-[15px] text-text">{d.day_date}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-text-2">
                        {d.present_count}/{d.total_count}
                      </span>
                      {d.mismatch_count > 0 && (
                        <Badge variant="danger">
                          <AlertTriangle className="size-3" aria-hidden />
                          {d.mismatch_count}
                        </Badge>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Da&apos;volar</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <EmptyState
              title="Hali da'vo yo'q"
              description="Nomuvofiqlik topilgan kundan da'vo yaratishingiz mumkin."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {disputes.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-(--r-md) border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-[15px] font-medium text-text">{d.title}</p>
                    <p className="text-sm text-text-2">
                      {d.affected_children} bola · {d.affected_days} kun
                      {d.estimated_amount != null && ` · ${d.estimated_amount.toLocaleString("uz-UZ")} so'm`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "won" ? "ok" : d.status === "lost" ? "danger" : "neutral"}>
                      {DISPUTE_STATUS_LABELS[d.status] ?? d.status}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/disputes/${d.id}/pdf`} target="_blank" rel="noreferrer">
                        <FileText className="size-4" aria-hidden />
                      </a>
                    </Button>
                    {d.status === "draft" && (
                      <Button size="sm" onClick={() => void submitDispute(d.id)}>
                        Yuborish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
