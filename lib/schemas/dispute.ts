import { z } from "zod";

export const disputeCreateSchema = z.object({
  period_month: z.iso.date(),
  title: z.string().trim().min(3).max(200),
  check_ids: z.array(z.uuid()).min(1),
  estimated_amount: z.number().nonnegative().optional(),
});
export type DisputeCreateInput = z.infer<typeof disputeCreateSchema>;

export const disputeUpdateSchema = z.object({
  status: z.enum(["draft", "submitted", "won", "lost", "cancelled"]).optional(),
  submitted_to: z.string().trim().max(200).optional(),
  response_note: z.string().trim().max(2000).optional(),
});
export type DisputeUpdateInput = z.infer<typeof disputeUpdateSchema>;
