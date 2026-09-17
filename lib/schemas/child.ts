import { z } from "zod";

export const childCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  group_id: z.uuid().nullable().optional(),
  birth_date: z.iso.date().optional(),
  gender: z.enum(["m", "f"]).optional(),
  state_system_id: z.string().trim().max(60).optional(),
  parent_name: z.string().trim().max(200).optional(),
  parent_phone: z.string().trim().max(20).optional(),
  monthly_fee: z.coerce.number().nonnegative().optional(),
  is_subsidized: z.boolean().optional(),
  // Consent must be given explicitly by the owner/director on the child's
  // behalf (TZ §11.7b) — it can never default to true.
  photo_consent: z.boolean().optional(),
});
export type ChildCreateInput = z.infer<typeof childCreateSchema>;

export const childUpdateSchema = childCreateSchema.partial();
export type ChildUpdateInput = z.infer<typeof childUpdateSchema>;
