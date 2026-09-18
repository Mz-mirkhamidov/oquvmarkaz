import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TZ v2 A-T21 / §11.1 — auth_events.detail must never carry a token, PIN,
 * cookie, or bot-token value. A DB test can't catch this (it would just
 * see whatever the app already wrote); this scans every `logAuthEvent(...)`
 * call site's `detail:` object literal for a value that looks like it
 * carries one of those, so a future call site can't reintroduce it
 * silently.
 */

const FORBIDDEN_IDENTIFIER = /\b(pin|token|secret|cookie|password|hash)\w*\b/i;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("A-T21 — logAuthEvent never passes a secret-shaped value in detail", () => {
  it("scans every logAuthEvent call site's detail object", () => {
    const root = path.resolve(__dirname, "../..");
    const files = [...listTsFiles(path.join(root, "lib")), ...listTsFiles(path.join(root, "app"))];

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Matches `detail: { ... }` (single-line, matching this codebase's
      // actual style) immediately following a logAuthEvent(...) call.
      const callSites = src.matchAll(/logAuthEvent\(\{[^}]*?detail:\s*\{([^}]*)\}/g);
      for (const match of callSites) {
        const detailBody = match[1];
        if (FORBIDDEN_IDENTIFIER.test(detailBody)) {
          offenders.push(`${path.relative(root, file)}: detail body "${detailBody.trim()}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
