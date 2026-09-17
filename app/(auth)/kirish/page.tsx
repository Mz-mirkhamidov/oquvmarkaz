"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Send, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadTelegramWebApp } from "@/lib/telegram/webapp";
import { setPendingTelegramAuth } from "@/lib/telegram/pending-auth";
import { apiPost, ApiClientError } from "@/lib/api/client";

type Status = "checking" | "authenticating" | "need_setup" | "idle" | "error";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function KirishPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const webApp = await loadTelegramWebApp();
      if (cancelled) return;

      if (!webApp?.initData) {
        setStatus("idle");
        return;
      }

      setStatus("authenticating");
      try {
        await apiPost("/api/auth/telegram", { initData: webApp.initData });
        router.push("/panel");
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "NOT_REGISTERED") {
          setPendingTelegramAuth(webApp.initData);
          router.push("/sozlash");
          return;
        }
        setErrorMessage(
          err instanceof ApiClientError
            ? err.message
            : "Hozir ulanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
        );
        setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-8">
      <h1 className="text-[28px] font-bold text-text">Qalqon</h1>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 pt-5">
          <h2 className="text-center text-[18px] font-semibold text-text">Tizimga kirish</h2>

          {status === "checking" || status === "authenticating" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-text-2">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              <p className="text-sm">
                {status === "authenticating" ? "Tekshirilmoqda..." : "Yuklanmoqda..."}
              </p>
            </div>
          ) : (
            <>
              {status === "error" && errorMessage && (
                <p className="rounded-(--r-md) bg-danger-soft px-3 py-2 text-sm text-danger">
                  {errorMessage}
                </p>
              )}

              <Button asChild size="lg" className="w-full">
                <a href={BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?startapp=login` : "#"}>
                  <Send className="size-[18px]" aria-hidden />
                  Telegram orqali kirish
                </a>
              </Button>

              <div className="flex items-center gap-3 text-xs text-text-3">
                <span className="h-px flex-1 bg-border" />
                yoki
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/kirish/pin")}
              >
                Tarbiyachiman
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-center text-sm text-text-3">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        SMS kod so&apos;ramaymiz. Kartangizga aloqasi yo&apos;q.
      </p>
    </div>
  );
}
