"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { apiPost } from "@/lib/api/client";
import type { UserRole } from "@/lib/db/types";

const MANAGER_LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/davomat", label: "Davomat" },
  { href: "/bolalar", label: "Bolalar" },
  { href: "/hisobot", label: "Hisobot" },
];

const TEACHER_LINKS = [{ href: "/davomat", label: "Davomat" }];

export function AppNav({
  orgName,
  userName,
  role,
}: {
  orgName: string;
  userName: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isManager = role === "owner" || role === "director";
  const links = isManager ? MANAGER_LINKS : TEACHER_LINKS;

  async function logout() {
    await apiPost("/api/auth/logout", {}).catch(() => {});
    router.push("/kirish");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-6">
        <span className="text-[16px] font-semibold text-text">{orgName}</span>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-(--r-md) px-3 py-2 text-sm font-medium text-text-2 transition-colors hover:bg-surface-2 hover:text-text",
                pathname.startsWith(link.href) && "bg-surface-2 text-text",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-text-2 sm:inline">{userName}</span>
        {isManager && (
          <Link
            href="/sozlama"
            aria-label="Sozlamalar"
            className={cn(
              "flex size-9 items-center justify-center rounded-(--r-md) text-text-2 hover:bg-surface-2 hover:text-text",
              pathname.startsWith("/sozlama") && "bg-surface-2 text-text",
            )}
          >
            <Settings className="size-[18px]" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          aria-label="Chiqish"
          className="flex size-9 items-center justify-center rounded-(--r-md) text-text-2 hover:bg-surface-2 hover:text-text"
        >
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </div>
    </header>
  );
}
