import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAuth } from "@/lib/auth/guard";
import { getAuth } from "@/lib/auth";
import { AppNav } from "@/components/shared/AppNav";

// Every page here is session-gated and never cacheable — but more
// importantly, without this Next's build tries to *statically prerender*
// them (headers()/cookies() usage normally signals "bail to dynamic", but
// only once execution reaches that point; if requireAuth() throws first —
// e.g. lib/env.ts's validation failing in an environment missing some
// unrelated env var — that throw looks like a real prerender crash, not a
// "make this dynamic" signal, and fails the whole build). force-dynamic
// skips the static attempt entirely, so this segment is never executed at
// build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAuth();
  if (!result.ok) redirect("/kirish");
  const auth = result.auth;

  // customSession() (lib/auth/index.ts) enriches getSession() with
  // `org`/`role`/user.fullName — no separate PostgREST round-trip needed.
  // requireAuth() above already confirmed a session exists.
  const session = await getAuth().api.getSession({ headers: await headers() });
  // Falls back to Better Auth's core `name`: accounts created before the
  // databaseHooks backfill in lib/auth/index.ts have fullName = null, and
  // an empty header name looks like a broken session.
  const user = session?.user as { fullName: string | null; name: string | null } | undefined;
  const org = (session as unknown as { org: { name: string } | null } | null)?.org;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppNav
        orgName={org?.name ?? "Qalqon"}
        userName={user?.fullName ?? user?.name ?? ""}
        role={auth.claims.user_role}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
