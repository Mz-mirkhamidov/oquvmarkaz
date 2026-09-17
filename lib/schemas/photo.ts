import { z } from "zod";

export const photoSignSchema = z.object({
  photo_id: z.uuid(),
  record_id: z.uuid(),
  child_id: z.uuid(),
  day_date: z.iso.date(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(1).max(2 * 1024 * 1024),
  mime: z.enum(["image/webp", "image/jpeg"]),
});
export type PhotoSignInput = z.infer<typeof photoSignSchema>;

export const photoAttachSchema = z.object({
  photo_id: z.uuid(),
  record_id: z.uuid(),
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(1).max(2 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  taken_at: z.iso.datetime(),
});
export type PhotoAttachInput = z.infer<typeof photoAttachSchema>;
