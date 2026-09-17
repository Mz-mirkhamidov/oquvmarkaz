import { ShieldCheck, WifiOff, Camera, FileCheck2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: WifiOff,
    title: "Internet yo'q bo'lsa ham ishlaydi",
    description:
      "Davomat qurilmada darhol saqlanadi, internet kelganda o'zi yuboriladi.",
  },
  {
    icon: Camera,
    title: "Har bir bola uchun rasm va aniq vaqt",
    description: "Server vaqti va SHA-256 imzo bilan tasdiqlangan yozuv.",
  },
  {
    icon: FileCheck2,
    title: "Oy oxirida tayyor hujjat",
    description: "Dalil to'plami PDF holida bir tugma bilan yaratiladi.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-16 px-4 py-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between">
        <span className="text-[18px] font-semibold tracking-tight text-text">
          Qalqon
        </span>
        <Badge variant="brand">M0 — poydevor</Badge>
      </header>

      <section className="flex flex-col items-start gap-6">
        <h1 className="max-w-2xl text-[28px] leading-[34px] font-bold text-text sm:text-[36px] sm:leading-[40px]">
          Kelgan bolaga subsidiya olmay qolgandingizmi?
        </h1>
        <p className="max-w-xl text-[16px] leading-6 text-text-2">
          Qalqon har kuni o&apos;z davomatingizni rasm va vaqt bilan yozib
          boradi. Davlat tizimi xato ketsa — sizda dalil bo&apos;ladi.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">14 kun bepul sinash</Button>
          <Button size="lg" variant="secondary">
            Qanday ishlaydi?
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-(--r-md) bg-brand-soft text-brand-hover">
                <Icon className="size-5" aria-hidden />
              </div>
              <CardTitle className="mt-2">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <footer className="mt-auto flex items-center gap-2 text-sm text-text-3">
        <ShieldCheck className="size-4" aria-hidden />
        SMS kod so&apos;ramaymiz. Kartangizga aloqasi yo&apos;q.
      </footer>
    </main>
  );
}
