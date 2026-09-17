import "server-only";

import { adminDb } from "@/lib/db/admin";
import type { StorageProvider, UploadTarget } from "@/lib/storage";

const BUCKET = "attendance";

export function createSupabaseStorage(): StorageProvider {
  return {
    async createUploadUrl(path, { expiresIn }): Promise<UploadTarget> {
      const { data, error } = await adminDb()
        .storage.from(BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data) throw new Error(`createUploadUrl failed: ${error?.message}`);
      return {
        uploadUrl: data.signedUrl,
        path: data.path,
        token: data.token,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    },

    async createReadUrl(path, { expiresIn }): Promise<string> {
      const { data, error } = await adminDb()
        .storage.from(BUCKET)
        .createSignedUrl(path, expiresIn);
      if (error || !data) throw new Error(`createReadUrl failed: ${error?.message}`);
      return data.signedUrl;
    },

    async read(path): Promise<Uint8Array> {
      const { data, error } = await adminDb().storage.from(BUCKET).download(path);
      if (error || !data) throw new Error(`read failed: ${error?.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async remove(paths): Promise<void> {
      const { error } = await adminDb().storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`remove failed: ${error.message}`);
    },
  };
}
