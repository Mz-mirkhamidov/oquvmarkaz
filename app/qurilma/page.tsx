"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost, ApiClientError } from "@/lib/api/client";

/** TZ v2 §12.4 — 8 belgili bog'lash kodi ("XXXX-XXXX"), manager /api/devices'dan oladi. */
export default function QurilmaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  function formatInput(raw: string): string {
    const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (normalized.length !== 8) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/api/auth/device/bind", { code: normalized });
      router.replace("/kirish/pin");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Hozir ulanib bo'lmadi. Internetni tekshiring.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Qurilmani bog&apos;lash</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-text-2">
              Rahbar bergan 8 belgili kodni kiriting.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(formatInput(e.target.value))}
              placeholder="XXXX-XXXX"
              autoFocus
              inputMode="text"
              maxLength={9}
              className="h-16 w-full rounded-(--r-md) border border-border bg-surface px-4 text-center text-[28px] font-semibold uppercase tracking-[0.2em] text-text"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" disabled={normalized.length !== 8 || submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Bog'lash"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
