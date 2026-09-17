import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { requestDb } from "@/lib/db/server";
import { AppNav } from "@/components/shared/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext();
  if (!auth) redirect("/kirish");

  const db = requestDb(auth.token);
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", auth.claims.org_id)
    .maybeSingle();
  const { data: user } = await db
    .from("app_users")
    .select("full_name, role")
    .eq("id", auth.claims.sub)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppNav
        orgName={org?.name ?? "Qalqon"}
        userName={user?.full_name ?? ""}
        role={auth.claims.user_role}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
