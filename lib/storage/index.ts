import "server-only";
import { createSupabaseStorage } from "@/lib/storage/supabase";

/**
 * TZ §11.7a — the legal requirement that biometric-adjacent data (these
 * photos, even though we never do face recognition on them) can move to
 * an Uzbekistan-hosted store later without any app code changing. Every
 * file operation goes through this interface; nothing outside
 * lib/storage/ may import a Supabase Storage or S3 client directly.
 */
export interface UploadTarget {
  uploadUrl: string;
  path: string;
  token?: string;
  expiresAt: string;
}

export interface StorageProvider {
  createUploadUrl(path: string, opts: { expiresIn: number }): Promise<UploadTarget>;
  createReadUrl(path: string, opts: { expiresIn: number }): Promise<string>;
  read(path: string): Promise<Uint8Array>;
  remove(paths: string[]): Promise<void>;
}

let cached: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (cached) return cached;
  const provider = process.env.STORAGE_PROVIDER ?? "supabase";
  if (provider !== "supabase") {
    // S3-compatible implementation lands with the self-hosted migration
    // path (TZ §11.7a.3) — not needed for the Supabase Cloud pilot.
    throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
  }
  cached = createSupabaseStorage();
  return cached;
}
