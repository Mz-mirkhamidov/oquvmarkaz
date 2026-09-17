import { HisobotHub } from "@/components/hisobot/HisobotHub";

export default function HisobotPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-[22px] font-semibold text-text">Hisobot</h1>
      <HisobotHub />
    </div>
  );
}
