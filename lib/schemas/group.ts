import { z } from "zod";

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teacher_id: z.uuid().nullable().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});
export type GroupCreateInput = z.infer<typeof groupCreateSchema>;

export const groupUpdateSchema = groupCreateSchema.partial();
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
