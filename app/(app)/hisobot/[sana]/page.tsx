import { notFound } from "next/navigation";
import { z } from "zod";

import { DayComparison } from "@/components/hisobot/DayComparison";

export default async function HisobotDayPage({
  params,
}: {
  params: Promise<{ sana: string }>;
}) {
  const { sana } = await params;
  if (!z.iso.date().safeParse(sana).success) notFound();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <DayComparison date={sana} />
    </div>
  );
}
