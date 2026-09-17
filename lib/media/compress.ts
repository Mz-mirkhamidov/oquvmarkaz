"use client";

import imageCompression from "browser-image-compression";

/** TZ §10.1 — target ~150 KB, 1280px longest side, WebP (JPEG fallback if the browser can't encode WebP). */
export async function compressPhoto(file: File | Blob): Promise<Blob> {
  return imageCompression(file as File, {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1280,
    fileType: "image/webp",
    initialQuality: 0.82,
    useWebWorker: true,
  });
}
