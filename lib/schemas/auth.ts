import { z } from "zod";

export const telegramLoginSchema = z.object({
  initData: z.string().min(1),
});
export type TelegramLoginInput = z.infer<typeof telegramLoginSchema>;

export const pinLoginSchema = z.object({
  org_slug: z.string().trim().min(1).max(80),
  user_id: z.uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN 4 ta raqamdan iborat bo'lishi kerak"),
  device_key: z.string().trim().min(8).max(128),
});
export type PinLoginInput = z.infer<typeof pinLoginSchema>;
