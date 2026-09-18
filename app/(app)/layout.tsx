import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAuth } from "@/lib/auth/guard";
import { auth as betterAuth } from "@/lib/auth";
import { AppNav } from "@/components/shared/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAuth();
  if (!result.ok) redirect("/kirish");
  const auth = result.auth;

  // customSession() (lib/auth/index.ts) enriches getSession() with
  // `org`/`role`/user.fullName — no separate PostgREST round-trip needed.
  // requireAuth() above already confirmed a session exists.
  const session = await betterAuth.api.getSession({ headers: await headers() });
  const user = session?.user as { fullName: string | null } | undefined;
  const org = (session as unknown as { org: { name: string } | null } | null)?.org;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppNav
        orgName={org?.name ?? "Qalqon"}
        userName={user?.fullName ?? ""}
        role={auth.claims.user_role}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
