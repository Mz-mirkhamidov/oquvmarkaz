"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch, ApiClientError } from "@/lib/api/client";
import type { OrgType } from "@/lib/db/types";

interface Org {
  id: string;
  name: string;
  org_type: OrgType;
  region: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  capacity: number | null;
  subsidy_enabled: boolean;
  photo_required: boolean;
}

export function OrgSettingsTab() {
  const [org, setOrg] = useState<Org | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ org: Org }>("/api/me")
      .then(({ org }) => {
        setOrg(org);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiPatch<Org>("/api/org", {
        name: org.name,
        org_type: org.org_type,
        region: org.region ?? undefined,
        district: org.district ?? undefined,
        address: org.address ?? undefined,
        phone: org.phone ?? undefined,
        capacity: org.capacity ?? undefined,
        subsidy_enabled: org.subsidy_enabled,
        photo_required: org.photo_required,
      });
      setOrg(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Hozir ulanib bo'lmadi.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-text-2" aria-hidden />
      </div>
    );
  }

  if (status === "error" || !org) {
    return <p className="text-sm text-danger">Hozir ulanib bo&apos;lmadi.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Bog&apos;cha nomi</Label>
        <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Viloyat</Label>
          <Input
            value={org.region ?? ""}
            onChange={(e) => setOrg({ ...org, region: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Tuman</Label>
          <Input
            value={org.district ?? ""}
            onChange={(e) => setOrg({ ...org, district: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Manzil</Label>
        <Input
          value={org.address ?? ""}
          onChange={(e) => setOrg({ ...org, address: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Telefon</Label>
        <Input value={org.phone ?? ""} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={org.subsidy_enabled}
          onChange={(e) => setOrg({ ...org, subsidy_enabled: e.target.checked })}
          className="size-4"
        />
        Davlat subsidiyasini olaman
      </label>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={org.photo_required}
          onChange={(e) => setOrg({ ...org, photo_required: e.target.checked })}
          className="size-4"
        />
        Davomatda rasm majburiy
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-ok">Saqlandi.</p>}

      <Button type="submit" disabled={saving} className="self-start">
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Saqlash"}
      </Button>
    </form>
  );
}
