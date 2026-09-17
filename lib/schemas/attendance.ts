import { z } from "zod";

export const attendStatusSchema = z.enum(["present", "absent", "sick", "vacation"]);

export const dayCloseSchema = z.object({
  day_date: z.iso.date(),
});
export type DayCloseInput = z.infer<typeof dayCloseSchema>;

export const dayReopenSchema = z.object({
  day_date: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
});
export type DayReopenInput = z.infer<typeof dayReopenSchema>;
