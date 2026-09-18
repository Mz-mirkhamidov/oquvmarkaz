"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * TZ v2 §12.2 — the token is consumed by a POST fired from here, never by
 * this page simply loading (a link-prefetching browser/Telegram client
 * would otherwise burn the one-time token before the user arrives). On
 * failure this redirects to /kirish?e=<code>, which renders the message.
 */
export function ConsumeLoginToken({ tokenParam }: { tokenParam: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!tokenParam) {
      router.replace("/kirish?e=TOKEN_INVALID");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/auth/telegram/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ k: tokenParam }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok: true; needsSetup: boolean }
          | { ok: false; error: { code: string } }
          | null;
        if (cancelled) return;

        if (!body || !body.ok) {
          const code = body && "error" in body ? body.error.code : "TOKEN_INVALID";
          router.replace(`/kirish?e=${encodeURIComponent(code)}`);
          return;
        }

        router.replace(body.needsSetup ? "/sozlash" : "/panel");
      } catch {
        if (!cancelled) router.replace("/kirish?e=DB_ERROR");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tokenParam, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="size-6 animate-spin text-text-2" aria-hidden />
      <p className="text-sm text-text-2">Kirilmoqda...</p>
    </div>
  );
}
