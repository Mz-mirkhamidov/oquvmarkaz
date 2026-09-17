import Link from "next/link";
import {
  ShieldCheck,
  WifiOff,
  Camera,
  FileCheck2,
  Scale,
  Bell,
  Lock,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: WifiOff,
    title: "Internet yo'q bo'lsa ham ishlaydi",
    description:
      "Davomat qurilmada darhol saqlanadi, internet kelganda o'zi yuboriladi. Tarbiyachi hech qachon kutib turmaydi.",
  },
  {
    icon: Camera,
    title: "Har bir bola uchun rasm va aniq vaqt",
    description: "Server vaqti va SHA-256 imzo bilan tasdiqlangan yozuv — keyinchalik o'zgartirib bo'lmaydi.",
  },
  {
    icon: Scale,
    title: "Davlat tizimi bilan solishtiring",
    description:
      "Har bir nomuvofiqlikni ko'ring, sababini yozing va rad etilgan kunlardan bir tugma bilan da'vo yig'masi tuzing.",
  },
  {
    icon: FileCheck2,
    title: "Oy oxirida tayyor hujjat",
    description: "Dalil to'plami PDF, davomat hisoboti esa Excel holida bir tugma bilan yaratiladi.",
  },
  {
    icon: Bell,
    title: "Ota-onalar ham xabardor",
    description: "Farzand keldi yoki kelmadi — ota-ona Telegram orqali darhol bilib turadi.",
  },
  {
    icon: Lock,
    title: "Har bir bog'cha — o'z maydonida",
    description:
      "Ma'lumotlar bazasi darajasida ajratilgan (RLS): boshqa bog'cha ma'lumotingizni hech qachon ko'rmaydi.",
  },
];

const steps = [
  {
    n: "1",
    title: "Tarbiyachi bolani belgilaydi",
    description: "Kelgan-kelmaganini bir bosishda belgilaydi, kerak bo'lsa rasmga oladi.",
  },
  {
    n: "2",
    title: "Qalqon vaqt va imzo bilan saqlaydi",
    description: "Server vaqti, qurilma va (bo'lsa) rasmning xeshi — hammasi audit izida qoladi.",
  },
  {
    n: "3",
    title: "Rahbar davlat tizimi bilan solishtiradi",
    description: "Nomuvofiqlik topilsa, sababini belgilaydi va kerak bo'lsa da'vo tayyorlaydi.",
  },
  {
    n: "4",
    title: "Hujjat va xabar tayyor",
    description: "PDF dalil to'plami, Excel hisobot, ota-onaga Telegram xabari — barchasi avtomatik.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <span className="text-[18px] font-semibold tracking-tight text-text">Qalqon</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kirish">Kirish</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sozlash">Bepul sinash</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-20 px-4 py-16 sm:px-6 lg:px-8">
        <section className="flex flex-col items-start gap-6">
          <h1 className="max-w-2xl text-[28px] leading-[34px] font-bold text-text sm:text-[36px] sm:leading-[40px]">
            Kelgan bolaga subsidiya olmay qolgandingizmi?
          </h1>
          <p className="max-w-xl text-[16px] leading-6 text-text-2">
            Qalqon har kuni o&apos;z davomatingizni rasm va vaqt bilan yozib
            boradi. Davlat tizimi (nodavlat-bogcha.uz) sekin ishlasa,
            ulanmasa yoki xato ketsa — sizda mustaqil dalil bo&apos;ladi.
            Qalqon davlat tizimiga ulanmaydi, uni avtomatlashtirmaydi —
            faqat sizning o&apos;z yozuvingizni saqlaydi.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/sozlash">14 kun bepul sinash</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="#qanday-ishlaydi">Qanday ishlaydi?</Link>
            </Button>
          </div>
        </section>

        <section id="qanday-ishlaydi" className="flex flex-col gap-8">
          <h2 className="text-[22px] font-semibold text-text">Qanday ishlaydi</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-(--r-full) bg-brand text-sm font-semibold text-brand-text">
                  {s.n}
                </span>
                <h3 className="text-[15px] font-semibold text-text">{s.title}</h3>
                <p className="text-sm text-text-2">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <section className="flex flex-col gap-6 rounded-(--r-lg) border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-[22px] font-semibold text-text">Ishonch va xavfsizlik</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 shrink-0 text-brand-hover" aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-text">SMS kod so&apos;ramaymiz</p>
                <p className="text-sm text-text-2">Kartangizga hech qanday aloqasi yo&apos;q.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="size-5 shrink-0 text-brand-hover" aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-text">Har yozuv — o&apos;chirilmas</p>
                <p className="text-sm text-text-2">Tuzatishlar yangi yozuv sifatida qo&apos;shiladi, eskisi saqlanadi.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="size-5 shrink-0 text-brand-hover" aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-text">Telefonga o&apos;rnatiladi</p>
                <p className="text-sm text-text-2">App Store shart emas — brauzerdan bir bosishda qo&apos;shiladi.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-(--r-lg) bg-brand px-6 py-12 text-center">
          <h2 className="text-[24px] font-bold text-brand-text">Bugundan boshlang</h2>
          <p className="max-w-md text-brand-text/90">
            Ro&apos;yxatdan o&apos;tish 5 daqiqa vaqt oladi. Karta kerak emas.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sozlash">14 kun bepul sinash</Link>
          </Button>
        </section>

        <footer className="mt-auto flex flex-col items-start gap-2 border-t border-border pt-8 text-sm text-text-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden />
            Qalqon — nodavlat bog&apos;chalar uchun mustaqil davomat va dalil tizimi.
          </div>
          <p>Davlat subsidiya tizimi (nodavlat-bogcha.uz) bilan bog&apos;liq emas va uni avtomatlashtirmaydi.</p>
        </footer>
      </div>
    </main>
  );
}
