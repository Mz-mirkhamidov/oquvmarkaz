import { ImageResponse } from "next/og";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// One-off asset generation (no design tooling in this environment) — a
// simple shield mark in the brand teal, rendered at every size the PWA
// manifest and favicons need. Re-run only if the mark itself changes;
// the output PNGs are committed like any other static asset.

const BRAND = "#0f766e";
const OUT_DIR = path.resolve(__dirname, "../public/icons");

function Shield({ size }: { size: number }) {
  const stroke = Math.max(size * 0.06, 3);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND,
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"
          fill="white"
          fillOpacity={0.15}
          stroke="white"
          strokeWidth={stroke / 8}
        />
        <path
          d="m8 12 3 3 5-6"
          stroke="white"
          strokeWidth={stroke / 6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

async function renderIcon(size: number, filename: string, padded = false) {
  const content = padded ? (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND,
      }}
    >
      <div style={{ width: size * 0.7, height: size * 0.7, display: "flex" }}>
        <Shield size={size * 0.7} />
      </div>
    </div>
  ) : (
    <Shield size={size} />
  );

  const res = new ImageResponse(content, { width: size, height: size });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path.join(OUT_DIR, filename), buf);
  console.log("wrote", filename, buf.length, "bytes");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await renderIcon(192, "icon-192.png");
  await renderIcon(512, "icon-512.png");
  await renderIcon(512, "icon-maskable-512.png", true); // extra safe-zone padding for adaptive icon masks
  await renderIcon(180, "apple-touch-icon.png");
  await renderIcon(32, "favicon-32.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
