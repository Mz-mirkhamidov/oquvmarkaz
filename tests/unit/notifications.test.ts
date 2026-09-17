import { describe, expect, it } from "vitest";

import { renderNotification } from "@/lib/notifications/templates";
import { generateLinkCode } from "@/lib/utils/link-code";

describe("renderNotification (TZ §9 message copy)", () => {
  it("renders an arrival message with the child's name and time", () => {
    const text = renderNotification({
      kind: "arrival",
      child_name: "Ali Valiyev",
      day_date: "2026-09-17",
      marked_at: "2026-09-17T04:05:00Z",
    });
    expect(text).toContain("Ali Valiyev");
    expect(text).toMatch(/keldi/i);
  });

  it("renders an absence message naming the actual status", () => {
    const text = renderNotification({
      kind: "absent",
      child_name: "Laylo Karimova",
      day_date: "2026-09-17",
      status: "sick",
    });
    expect(text).toContain("Laylo Karimova");
    expect(text.toLowerCase()).toContain("kasal");
  });

  it("passes a system message through verbatim", () => {
    expect(renderNotification({ kind: "system", text: "Sinov xabari" })).toBe("Sinov xabari");
  });
});

describe("generateLinkCode", () => {
  it("generates an 8-character code from the unambiguous alphabet (no 0/O/1/I)", () => {
    const code = generateLinkCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("generates different codes across calls (birthday-bound, not guaranteed, but overwhelmingly likely)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateLinkCode()));
    expect(codes.size).toBe(50);
  });
});
