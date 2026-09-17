import { z } from "zod";

export const rejectReasonSchema = z.enum(["tizim_qotdi", "rasm_tanilmadi", "xatolik", "boshqa"]);

export const stateCheckItemSchema = z
  .object({
    child_id: z.uuid(),
    result: z.enum(["accepted", "rejected"]),
    reason: rejectReasonSchema.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.result !== "rejected" || !!v.reason, {
    message: "Rad etish sababini tanlang.",
    path: ["reason"],
  });

export const stateChecksUpsertSchema = z.object({
  items: z.array(stateCheckItemSchema).min(1),
});
export type StateChecksUpsertInput = z.infer<typeof stateChecksUpsertSchema>;
