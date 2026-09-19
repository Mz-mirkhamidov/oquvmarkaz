"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Mode = "login" | "register";

const MIN_PASSWORD = 8;

/**
 * TZ v2 §4.1 gave Telegram as the only way in. That left a bog'cha with no
 * Telegram — or hitting a bot outage — with no way to register at all, so
 * this is the second door. It talks to Better Auth's own
 * /api/auth/sign-in/email and /api/auth/sign-up/email endpoints (served by
 * app/api/auth/[...all]) rather than a hand-rolled route: password
 * hashing, the account row and the session cookie are all Better Auth's
 * job, and re-implementing any of it here would be a worse version.
 *
 * Those endpoints answer with Better Auth's own shape ({ code, message }),
 * not this app's { ok, data } envelope, so apiPost is deliberately not
 * used — the codes are translated below instead. A code we don't know is
 * shown verbatim alongside the message (TZ v2 §9.2: never a bare
 * "Xatolik").
 */
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Pochta yoki parol noto'g'ri.",
  INVALID_EMAIL: "Pochta manzili noto'g'ri.",
  // Better Auth 1.7.5 answers with the long form; the short one is kept
  // because the two have swapped places across versions.
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Bu pochta allaqachon ro'yxatdan o'tgan. Kirishni tanlang.",
  USER_ALREADY_EXISTS: "Bu pochta allaqachon ro'yxatdan o'tgan. Kirishni tanlang.",
  EMAIL_RESERVED: "Bu pochta manzilidan foydalanib bo'lmaydi.",
  PASSWORD_TOO_SHORT: `Parol kamida ${MIN_PASSWORD} ta belgidan iborat bo'lsin.`,
  PASSWORD_TOO_LONG: "Parol juda uzun.",
  USER_DISABLED: "Hisobingiz o'chirilgan. Rahbaringizga murojaat qiling.",
};

export default function EmailAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "register" && name.trim().length < 2) {
      setError("Ismingizni kiriting.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(ERROR_MESSAGES.PASSWORD_TOO_SHORT);
      return;
    }

    setSubmitting(true);
    try {
      const path = mode === "register" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          mode === "register"
            ? { name: name.trim(), email: email.trim(), password }
            : { email: email.trim(), password },
        ),
      });

      const body = (await res.json().catch(() => null)) as {
        code?: string;
        message?: string;
        user?: { orgId?: string | null; appRole?: string | null };
      } | null;

      if (!res.ok) {
        const code = body?.code;
        setError(
          (code && ERROR_MESSAGES[code]) ??
            `${body?.message ?? "Kirib bo'lmadi."}${code ? ` (${code})` : ""}`,
        );
        return;
      }

      // autoSignIn is on, so a successful sign-up already carries a
      // session cookie. Where to send them is decided here and not by the
      // app shell: requireAuth() treats orgId=null as NO_ORG and
      // (app)/layout.tsx redirects that straight back to /kirish, so a
      // freshly registered account sent to /davomat would bounce out of
      // the app it just joined. This mirrors ConsumeLoginToken's
      // needsSetup branch for the Telegram flow.
      const user = body?.user;
      const isManager = user?.appRole === "owner" || user?.appRole === "director";
      router.replace(!user?.orgId ? "/sozlash" : isManager ? "/panel" : "/davomat");
      router.refresh();
    } catch {
      setError("Internet bilan aloqa yo'q. Qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-[28px] font-bold text-text">Qalqon</h1>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex rounded-(--r-md) bg-surface-2 p-1">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-(--r-sm) px-3 py-2 text-sm font-medium text-text-2 transition-colors",
                  mode === value && "bg-surface text-text shadow-sm",
                )}
              >
                {value === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
              </button>
            ))}
          </div>

          <form className="flex flex-col gap-3" onSubmit={submit}>
            {mode === "register" && (
              <Field
                label="Ismingiz"
                type="text"
                autoComplete="name"
                value={name}
                onChange={setName}
              />
            )}
            <Field
              label="Pochta"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />
            <Field
              label="Parol"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={setPassword}
              hint={mode === "register" ? `Kamida ${MIN_PASSWORD} ta belgi` : undefined}
            />

            {error && (
              <p
                role="alert"
                className="rounded-(--r-md) bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-[18px] animate-spin" aria-hidden />
              ) : mode === "register" ? (
                "Ro'yxatdan o'tish"
              ) : (
                "Kirish"
              )}
            </Button>
          </form>

          {/* Reset-by-email needs a mail provider and there isn't one, so
              recovery runs through the bot instead: it can already prove
              who you are and hand you a session, and Sozlamalar ->
              Xavfsizlik -> Parol sets a new password from there. */}
          <p className="text-center text-xs text-text-3">
            Parolni unutdingizmi?{" "}
            <Link href="/kirish" className="underline underline-offset-2">
              Telegram orqali kiring
            </Link>{" "}
            va Sozlamalar → Xavfsizlik bo&apos;limidan yangi parol qo&apos;ying.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="ghost" size="sm">
        <Link href="/kirish">
          <ChevronLeft className="size-4" aria-hidden />
          Boshqa usul bilan kirish
        </Link>
      </Button>
    </div>
  );
}

function Field({
  label,
  type,
  autoComplete,
  value,
  onChange,
  hint,
}: {
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-2">{label}</span>
      <input
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-(--r-md) border border-border bg-surface px-3 text-[15px] text-text outline-none focus:border-accent"
      />
      {hint && <span className="text-xs text-text-3">{hint}</span>}
    </label>
  );
}
