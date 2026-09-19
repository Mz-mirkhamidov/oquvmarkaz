"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";

const MIN_PASSWORD = 8;

/**
 * The recovery path for "parolni unutdim". There is no mail provider, so
 * Better Auth's token-by-email reset cannot work here — instead a manager
 * signs in through the bot (which proves who they are) and sets a new
 * password from this screen. That also covers the first-time case: a
 * Telegram account has no password at all until it is set here.
 */
export function PasswordSection() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ has_password: boolean }>("/api/me/password")
      .then((data) => {
        if (!cancelled) setHasPassword(data.has_password);
      })
      .catch(() => {
        // Treat an unknown state as "already set": asking for the current
        // password when none exists fails loudly and harmlessly, whereas
        // not asking when one does exist would be the wrong way to be
        // wrong.
        if (!cancelled) setHasPassword(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (next.length < MIN_PASSWORD) {
      setError(`Parol kamida ${MIN_PASSWORD} ta belgidan iborat bo'lsin.`);
      return;
    }
    if (next !== confirm) {
      setError("Parollar mos kelmadi.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/api/auth/password/set", {
        new_password: next,
        ...(hasPassword ? { current_password: current } : {}),
      });
      setDone(true);
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (hasPassword === null) {
    return <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />;
  }

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={submit}>
      <p className="text-sm text-text-2">
        {hasPassword
          ? "Pochta va parol bilan kirasiz. Parolni shu yerdan almashtiring."
          : "Hozir faqat Telegram orqali kirasiz. Parol qo'ysangiz, pochta va parol bilan ham kira olasiz."}
      </p>

      {hasPassword && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">Joriy parol</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Yangi parol</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <span className="text-xs text-text-3">Kamida {MIN_PASSWORD} ta belgi</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Yangi parolni takrorlang</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-(--r-md) bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-(--r-md) bg-ok-soft px-3 py-2 text-sm text-ok">
          Parol saqlandi. Boshqa qurilmalardagi sessiyalar yopildi.
        </p>
      )}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : hasPassword ? (
            "Parolni almashtirish"
          ) : (
            "Parol qo'yish"
          )}
        </Button>
      </div>
    </form>
  );
}
