"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/auth/PinPad";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";

interface Teacher {
  id: string;
  full_name: string;
}

type Screen = "loading" | "no_device" | "device_blocked" | "empty" | "error" | "ready";

export default function PinLoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("loading");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [padKey, setPadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!navigator.onLine) {
        setScreen("error");
        return;
      }
      try {
        const data = await apiGet<Teacher[]>("/api/auth/device/teachers");
        if (cancelled) return;
        setTeachers(data);
        setScreen(data.length === 0 ? "empty" : "ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.code === "NO_DEVICE") {
          setScreen("no_device");
        } else if (err instanceof ApiClientError && err.code === "DEVICE_BLOCKED") {
          setScreen("device_blocked");
        } else {
          setScreen("error");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePin(pin: string) {
    if (!selected) return;
    setSubmitting(true);
    setPinError(null);
    try {
      await apiPost("/api/auth/pin/sign-in", { user_id: selected.id, pin });
      router.push("/davomat");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "PIN_LOCKED") {
          setPinError("Ko'p marta noto'g'ri PIN kiritildi. Birozdan keyin qayta urining.");
        } else if (err.code === "DEVICE_BLOCKED") {
          setPinError("Bu qurilma bloklangan. Rahbarga murojaat qiling.");
        } else {
          setPinError("PIN noto'g'ri. Qayta urinib ko'ring.");
        }
      } else {
        setPinError("Hozir ulanib bo'lmadi. Internetni tekshiring.");
      }
      setPadKey((k) => k + 1); // remounts PinPad, clearing entered dots
    } finally {
      setSubmitting(false);
    }
  }

  if (screen === "loading") {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-text-2">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">Yuklanmoqda...</p>
      </div>
    );
  }

  if (screen === "no_device") {
    return (
      <EmptyNotice
        title="Bu qurilma hali bog'chaga bog'lanmagan"
        description="Rahbardan shu planshet uchun bog'lash kodini so'rang."
        action={
          <Button asChild variant="secondary">
            <Link href="/qurilma">Kodni kiritish</Link>
          </Button>
        }
      />
    );
  }

  if (screen === "device_blocked") {
    return (
      <EmptyNotice
        title="Bu qurilma bloklangan"
        description="Rahbarga murojaat qiling."
      />
    );
  }

  if (screen === "error") {
    return (
      <EmptyNotice
        icon={<WifiOff className="size-8" aria-hidden />}
        title="Hozir ulanib bo'lmadi"
        description="Internetni tekshirib, qaytadan urinib ko'ring."
        action={
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Qayta urinish
          </Button>
        }
      />
    );
  }

  if (screen === "empty") {
    return (
      <EmptyNotice
        title="Hali tarbiyachi qo'shilmagan"
        description="Rahbar sozlamalardan tarbiyachi qo'shishi kerak."
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        type="button"
        onClick={() => router.push("/kirish")}
        className="flex items-center gap-1 self-start text-sm text-text-2 hover:text-text"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Orqaga
      </button>

      <h1 className="text-[22px] font-semibold text-text">Kim ishlayapti?</h1>

      <select
        className="h-12 w-full rounded-(--r-md) border border-border bg-surface px-3.5 text-[15px] text-text"
        value={selected?.id ?? ""}
        onChange={(e) => {
          const t = teachers.find((x) => x.id === e.target.value) ?? null;
          setSelected(t);
          setPinError(null);
        }}
      >
        <option value="" disabled>
          Tarbiyachini tanlang
        </option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
          </option>
        ))}
      </select>

      {selected && (
        <>
          <PinPad key={padKey} disabled={submitting} onComplete={handlePin} />
          {pinError && (
            <p role="alert" className="text-sm text-danger">
              {pinError}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function EmptyNotice({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="text-text-3">{icon}</div>
      <h2 className="text-[18px] font-semibold text-text">{title}</h2>
      <p className="max-w-xs text-sm text-text-2">{description}</p>
      {action}
    </div>
  );
}
