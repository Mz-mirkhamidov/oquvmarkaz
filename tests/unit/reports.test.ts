// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderDisputePdf } from "@/lib/reports/dispute-pdf";
import { buildMonthlyWorkbook } from "@/lib/reports/monthly-xlsx";
import type { DisputeEvidence } from "@/lib/disputes/evidence";
import type { MonthlyReportData } from "@/lib/reports/monthly-data";

// Vite's resolver (unlike a plain Node `require`) can load @react-pdf/renderer's
// exports-map subpaths, so this exercises the real rendering path end to end —
// typecheck alone can't catch a runtime failure inside these libraries.

describe("renderDisputePdf (TZ §7.7 evidence bundle)", () => {
  it("renders a non-empty PDF buffer starting with the PDF magic bytes", async () => {
    const evidence: DisputeEvidence = {
      dispute: {
        id: "d1",
        title: "Sentyabr nomuvofiqliklari",
        period_month: "2026-09-01",
        affected_children: 1,
        affected_days: 1,
        estimated_amount: 150000,
        status: "draft",
        bundle_code: null,
      },
      org: { name: "Test Bog'cha", region: "Toshkent", district: "Chilonzor" },
      rows: [
        {
          child_name: "Ali Valiyev",
          day_date: "2026-09-10",
          our_status: "present",
          reason: "tizim_qotdi",
          note: "Tizim ishlamadi",
          checked_at: "2026-09-10T10:00:00Z",
          marked_at: "2026-09-10T08:05:00Z",
          marked_by_name: "Tarbiyachi",
          photo_sha256: "a".repeat(64),
        },
      ],
    };

    const pdf = await renderDisputePdf(evidence);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders an empty-rows dispute without throwing", async () => {
    const evidence: DisputeEvidence = {
      dispute: {
        id: "d2",
        title: "Bo'sh da'vo",
        period_month: "2026-09-01",
        affected_children: 0,
        affected_days: 0,
        estimated_amount: null,
        status: "draft",
        bundle_code: null,
      },
      org: { name: "Test Bog'cha", region: null, district: null },
      rows: [],
    };
    const pdf = await renderDisputePdf(evidence);
    expect(pdf.length).toBeGreaterThan(0);
  });
});

describe("buildMonthlyWorkbook (TZ F-R* monthly register)", () => {
  it("builds a non-empty XLSX (zip) buffer with two sheets' worth of data", async () => {
    const grid = new Map<string, Map<string, string>>();
    grid.set("c1", new Map([["2026-09-10", "present"]]));

    const data: MonthlyReportData = {
      org: { name: "Test Bog'cha" },
      month: "2026-09",
      days: [
        {
          day_date: "2026-09-10",
          status: "closed",
          total_count: 1,
          present_count: 1,
          absent_count: 0,
          mismatch_count: 1,
        },
      ],
      children: [{ id: "c1", full_name: "Ali Valiyev" }],
      grid,
    };

    const xlsx = await buildMonthlyWorkbook(data);
    expect(xlsx.length).toBeGreaterThan(0);
    // XLSX files are zip archives — "PK\x03\x04" is the local file header signature.
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("builds an empty-month workbook without throwing", async () => {
    const xlsx = await buildMonthlyWorkbook({
      org: { name: "Test Bog'cha" },
      month: "2026-09",
      days: [],
      children: [],
      grid: new Map(),
    });
    expect(xlsx.length).toBeGreaterThan(0);
  });
});
