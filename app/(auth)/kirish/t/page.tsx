import type { Metadata } from "next";

import { ConsumeLoginToken } from "@/components/auth/ConsumeLoginToken";

// TZ v2 §12.2 — this page must never be served from a cache, and its
// token-consuming request must never fire from mere navigation (a
// prefetching client would burn the one-time token before the user gets
// here) — the actual POST happens client-side in ConsumeLoginToken.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ k?: string }>;
}

export default async function KirishTokenPage({ searchParams }: PageProps) {
  const { k } = await searchParams;
  return <ConsumeLoginToken tokenParam={k ?? null} />;
}
