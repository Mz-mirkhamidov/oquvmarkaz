"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";

import { setBoundOrgSlug } from "@/lib/device";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** The link/QR a bog'cha bookmarks on its shared tablet — binds it to an org once, then redirects. */
export default function BindDevicePage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    setBoundOrgSlug(slug);
    router.replace("/kirish/pin");
  }, [slug, router]);

  return null;
}
