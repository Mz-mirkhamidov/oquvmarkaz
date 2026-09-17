import { z } from "zod";

export const parentCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(30).optional(),
  child_ids: z.array(z.uuid()).min(1),
  notify_enabled: z.boolean().optional(),
});
export type ParentCreateInput = z.infer<typeof parentCreateSchema>;

export const parentUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  notify_enabled: z.boolean().optional(),
  child_ids: z.array(z.uuid()).min(1).optional(),
});
export type ParentUpdateInput = z.infer<typeof parentUpdateSchema>;
