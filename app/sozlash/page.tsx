"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";
import type { OrgType } from "@/lib/db/types";

type Step = 1 | 2 | 3 | 4;

interface CreatedGroup {
  id: string;
  name: string;
}

const STEP_LABELS: Record<Step, string> = {
  1: "Bog'cha ma'lumotlari",
  2: "Guruhlar",
  3: "Bolalar",
  4: "Tarbiyachilar",
};

export default function SozlashPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [groups, setGroups] = useState<CreatedGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await Promise.resolve();
      if (cancelled) return;
      try {
        await apiGet("/api/me");
        if (!cancelled) {
          setStep(2);
          setReady(true);
        }
      } catch {
        // No session yet — fine as long as we still have a pending
        // Telegram auth to register with (set by /kirish).
        if (!cancelled) setReady(true);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-text-2">{step}/4-qadam</p>
        <h1 className="text-[22px] font-semibold text-text">{STEP_LABELS[step]}</h1>
      </div>

      {step === 1 && <OrgStep onDone={() => setStep(2)} />}
      {step === 2 && (
        <GroupsStep
          onDone={(created) => {
            setGroups(created);
            setStep(3);
          }}
        />
      )}
      {step === 3 && <ChildrenStep groups={groups} onDone={() => setStep(4)} />}
      {step === 4 && <TeachersStep onDone={() => router.push("/panel")} />}
    </main>
  );
}

function StepActions({
  onSkip,
  submitLabel,
  disabled,
  submitting,
}: {
  onSkip?: () => void;
  submitLabel: string;
  disabled?: boolean;
  submitting?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onSkip ? (
        <button type="button" onClick={onSkip} className="text-sm text-text-2 hover:text-text">
          O&apos;tkazib yuborish
        </button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={disabled || submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : submitLabel}
      </Button>
    </div>
  );
}

function OrgStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("oilaviy");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [capacity, setCapacity] = useState("");
  const [subsidyEnabled, setSubsidyEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/api/org/setup", {
        org: {
          name,
          org_type: orgType,
          region: region || undefined,
          district: district || undefined,
          capacity: capacity ? Number(capacity) : undefined,
          subsidy_enabled: subsidyEnabled,
          photo_required: true,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bog&apos;cha haqida</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Bog'cha nomi">
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="Turi">
            <select
              className="h-12 w-full rounded-(--r-md) border border-border bg-surface px-3.5 text-[15px] text-text"
              value={orgType}
              onChange={(e) => setOrgType(e.target.value as OrgType)}
            >
              <option value="oilaviy">Oilaviy</option>
              <option value="dxsh">DXSh</option>
              <option value="xususiy">Xususiy</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Viloyat">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </Field>
            <Field label="Tuman">
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
            </Field>
          </div>
          <Field label="Sig'imi (ixtiyoriy)">
            <Input
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={subsidyEnabled}
              onChange={(e) => setSubsidyEnabled(e.target.checked)}
              className="size-4"
            />
            Davlat subsidiyasini olaman
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          <StepActions submitLabel="Davom etish" submitting={submitting} disabled={name.trim().length < 2} />
        </form>
      </CardContent>
    </Card>
  );
}

function GroupsStep({ onDone }: { onDone: (groups: CreatedGroup[]) => void }) {
  const [names, setNames] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validNames = names.map((n) => n.trim()).filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validNames.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const created: CreatedGroup[] = [];
      for (const name of validNames) {
        const group = await apiPost<CreatedGroup>("/api/groups", { name });
        created.push(group);
      }
      onDone(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guruhlar (kamida 1 ta)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {names.map((name, i) => (
            <Input
              key={i}
              value={name}
              placeholder={`Guruh ${i + 1} nomi`}
              onChange={(e) =>
                setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
              }
            />
          ))}
          <button
            type="button"
            onClick={() => setNames((prev) => [...prev, ""])}
            className="self-start text-sm text-brand hover:text-brand-hover"
          >
            + Yana guruh qo&apos;shish
          </button>

          {error && <p className="text-sm text-danger">{error}</p>}
          <StepActions submitLabel="Davom etish" submitting={submitting} disabled={validNames.length === 0} />
        </form>
      </CardContent>
    </Card>
  );
}

interface ChildDraft {
  full_name: string;
  group_id: string;
  state_system_id: string;
  photo_consent: boolean;
}

function ChildrenStep({ groups, onDone }: { groups: CreatedGroup[]; onDone: () => void }) {
  const [rows, setRows] = useState<ChildDraft[]>([
    { full_name: "", group_id: groups[0]?.id ?? "", state_system_id: "", photo_consent: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateRow(i: number, patch: Partial<ChildDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const validRows = rows.filter((r) => r.full_name.trim().length >= 2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      for (const row of validRows) {
        await apiPost("/api/children", {
          full_name: row.full_name.trim(),
          group_id: row.group_id || undefined,
          state_system_id: row.state_system_id || undefined,
          photo_consent: row.photo_consent,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bolalar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-(--r-md) border border-border p-3">
              <Input
                placeholder="F.I.Sh"
                value={row.full_name}
                onChange={(e) => updateRow(i, { full_name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-12 rounded-(--r-md) border border-border bg-surface px-3 text-sm text-text"
                  value={row.group_id}
                  onChange={(e) => updateRow(i, { group_id: e.target.value })}
                >
                  <option value="">Guruhsiz</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Davlat tizimi ID (ixtiyoriy)"
                  value={row.state_system_id}
                  onChange={(e) => updateRow(i, { state_system_id: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-2">
                <input
                  type="checkbox"
                  checked={row.photo_consent}
                  onChange={(e) => updateRow(i, { photo_consent: e.target.checked })}
                  className="size-4"
                />
                Ota-onadan rasm olishga rozilik olingan
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { full_name: "", group_id: groups[0]?.id ?? "", state_system_id: "", photo_consent: false },
              ])
            }
            className="self-start text-sm text-brand hover:text-brand-hover"
          >
            + Yana bola qo&apos;shish
          </button>

          {error && <p className="text-sm text-danger">{error}</p>}
          <StepActions submitLabel="Davom etish" submitting={submitting} onSkip={onDone} />
        </form>
      </CardContent>
    </Card>
  );
}

interface TeacherDraft {
  full_name: string;
  pin: string;
}

function TeachersStep({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<TeacherDraft[]>([{ full_name: "", pin: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateRow(i: number, patch: Partial<TeacherDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const validRows = rows.filter((r) => r.full_name.trim().length >= 2 && /^\d{4}$/.test(r.pin));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      for (const row of validRows) {
        await apiPost("/api/teachers", { full_name: row.full_name.trim(), pin: row.pin });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarbiyachilar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px] gap-2">
              <Input
                placeholder="F.I.Sh"
                value={row.full_name}
                onChange={(e) => updateRow(i, { full_name: e.target.value })}
              />
              <Input
                placeholder="PIN"
                inputMode="numeric"
                maxLength={4}
                value={row.pin}
                onChange={(e) => updateRow(i, { pin: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { full_name: "", pin: "" }])}
            className="self-start text-sm text-brand hover:text-brand-hover"
          >
            + Yana tarbiyachi qo&apos;shish
          </button>

          {error && <p className="text-sm text-danger">{error}</p>}
          <StepActions submitLabel="Tayyor" submitting={submitting} onSkip={onDone} />
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
