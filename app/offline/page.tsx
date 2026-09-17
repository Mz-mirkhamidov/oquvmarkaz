import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-10 text-text-3" aria-hidden />
      <h1 className="text-[18px] font-semibold text-text">Bu sahifa hali yuklanmagan</h1>
      <p className="max-w-xs text-sm text-text-2">
        Internet kelganda avtomatik ochiladi. Davomat belgilash bu holatda ham ishlayveradi —
        avval ochilgan sahifaga qayting.
      </p>
    </main>
  );
}
