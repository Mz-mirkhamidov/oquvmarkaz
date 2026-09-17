import { EmptyState } from "@/components/shared/EmptyState";

export default function PanelPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-[22px] font-semibold text-text">Panel</h1>
      <EmptyState
        title="Davomat hali boshlanmagan"
        description="Bugungi ko'rsatkichlar bu yerda, birinchi davomat belgilanganidan keyin paydo bo'ladi."
      />
    </div>
  );
}
