"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * TZ v2 §4.3 replaced org-slug device binding with a manager-issued bind
 * code (/qurilma). Old bookmarked/shared links to this URL still redirect
 * somewhere useful instead of 404ing.
 */
export default function LegacyBindDevicePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/qurilma");
  }, [router]);

  return null;
}
