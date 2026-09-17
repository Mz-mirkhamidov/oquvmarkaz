"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils/cn";
import { OrgSettingsTab } from "@/components/settings/OrgSettingsTab";
import { GroupsTab } from "@/components/settings/GroupsTab";
import { TeachersTab } from "@/components/settings/TeachersTab";

const TABS = [
  { slug: "bogcha", label: "Bog'cha" },
  { slug: "guruhlar", label: "Guruhlar" },
  { slug: "xodimlar", label: "Xodimlar" },
  { slug: "qurilmalar", label: "Qurilmalar" },
  { slug: "ota-onalar", label: "Ota-onalar" },
  { slug: "obuna", label: "Obuna" },
] as const;

interface PageProps {
  params: Promise<{ tab: string }>;
}

export default function SozlamaTabPage({ params }: PageProps) {
  const { tab } = use(params);
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <PageHeader title="Sozlamalar" />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={`/sozlama/${t.slug}`}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-text-2 hover:text-text",
              pathname === `/sozlama/${t.slug}` && "border-brand text-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "bogcha" && <OrgSettingsTab />}
      {tab === "guruhlar" && <GroupsTab />}
      {tab === "xodimlar" && <TeachersTab />}
      {(tab === "qurilmalar" || tab === "ota-onalar" || tab === "obuna") && (
        <p className="text-sm text-text-2">Bu bo&apos;lim keyingi bosqichda qo&apos;shiladi.</p>
      )}
    </div>
  );
}
