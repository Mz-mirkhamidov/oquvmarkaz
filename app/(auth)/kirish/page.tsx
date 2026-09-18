import Link from "next/link";
import { ShieldCheck, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUTH_MESSAGES, type AuthCode } from "@/lib/auth/errors";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

interface PageProps {
  searchParams: Promise<{ e?: string }>;
}

/**
 * TZ v2 §4.1, §12.1 — no Mini App, no `initData`. The bot hands out a
 * one-time login link (lib/telegram/bot.ts's /kirish command); this page
 * only opens the bot. /kirish/t consumes the link once it's clicked.
 */
export default async function KirishPage({ searchParams }: PageProps) {
  const { e } = await searchParams;
  const errorMessage = e && e in AUTH_MESSAGES ? AUTH_MESSAGES[e as AuthCode] : null;

  return (
    <div className="flex flex-col items-center gap-8">
      <h1 className="text-[28px] font-bold text-text">Qalqon</h1>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 pt-5">
          <h2 className="text-center text-[18px] font-semibold text-text">Tizimga kirish</h2>

          {errorMessage && (
            <p className="rounded-(--r-md) bg-danger-soft px-3 py-2 text-sm text-danger">
              {errorMessage}
              {e && <span className="ml-1 text-xs text-text-3">({e})</span>}
            </p>
          )}

          {BOT_USERNAME ? (
            <>
              <Button asChild size="lg" className="w-full">
                <a href={`https://t.me/${BOT_USERNAME}?start=web`}>
                  <Send className="size-[18px]" aria-hidden />
                  Telegram orqali kirish
                </a>
              </Button>
              <p className="text-center text-xs text-text-3">
                Telegramda botga o&apos;ting va &quot;🔐 Saytga kirish&quot; tugmasini bosing.
              </p>
            </>
          ) : (
            // A silent dead "#" link here is exactly what caused a real
            // production incident: the button did nothing and looked
            // broken with no diagnostic. NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
            // is deliberately not in lib/env.ts's schema (a missing
            // client-only var shouldn't fail the whole build — see
            // lib/auth/index.ts's getAuth() comment for why that's
            // dangerous) — but a misconfiguration here still needs to be
            // visible, not silent.
            <p className="rounded-(--r-md) bg-danger-soft px-3 py-2 text-center text-sm text-danger">
              Bot sozlanmagan. Kod: NO_BOT_USERNAME
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-text-3">
            <span className="h-px flex-1 bg-border" />
            yoki
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href="/kirish/pin">Tarbiyachiman</Link>
          </Button>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-center text-sm text-text-3">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        SMS kod so&apos;ramaymiz. Kartangizga aloqasi yo&apos;q.
      </p>
    </div>
  );
}
