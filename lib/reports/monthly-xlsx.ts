import "server-only";
import ExcelJS from "exceljs";

import type { MonthlyReportData } from "@/lib/reports/monthly-data";

const GRID_STATUS_LETTER: Record<string, string> = {
  present: "K", // Keldi
  absent: "Y", // Yo'q
  sick: "B", // Bemor
  vacation: "T", // Ta'til
};

export async function buildMonthlyWorkbook(data: MonthlyReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Qalqon";
  workbook.created = new Date();

  const daily = workbook.addWorksheet("Kunlik");
  daily.columns = [
    { header: "Sana", key: "date", width: 14 },
    { header: "Holat", key: "status", width: 12 },
    { header: "Jami", key: "total", width: 10 },
    { header: "Keldi", key: "present", width: 10 },
    { header: "Kelmadi", key: "absent", width: 10 },
    { header: "Nomuvofiqlik", key: "mismatch", width: 14 },
  ];
  daily.getRow(1).font = { bold: true };
  for (const d of data.days) {
    daily.addRow({
      date: d.day_date,
      status: d.status === "closed" ? "Yopiq" : d.status === "reopened" ? "Qayta ochilgan" : "Ochiq",
      total: d.total_count,
      present: d.present_count,
      absent: d.absent_count,
      mismatch: d.mismatch_count,
    });
  }

  const grid = workbook.addWorksheet("Bolalar");
  const dateColumns = data.days.map((d) => d.day_date);
  grid.columns = [
    { header: "Bola", key: "child", width: 28 },
    ...dateColumns.map((date) => ({ header: date.slice(5), key: date, width: 6 })),
  ];
  grid.getRow(1).font = { bold: true };
  for (const child of data.children) {
    const row: Record<string, string> = { child: child.full_name };
    const byDate = data.grid.get(child.id);
    for (const date of dateColumns) {
      const status = byDate?.get(date);
      row[date] = status ? (GRID_STATUS_LETTER[status] ?? "?") : "";
    }
    grid.addRow(row);
  }
  grid.addRow({});
  grid.addRow({ child: "K=Keldi, Y=Yo'q, B=Bemor, T=Ta'til" });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
