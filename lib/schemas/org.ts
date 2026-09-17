import { z } from "zod";

export const orgTypeSchema = z.enum(["oilaviy", "dxsh", "xususiy"]);

export const orgSetupSchema = z.object({
  name: z.string().trim().min(2).max(200),
  org_type: orgTypeSchema,
  region: z.string().trim().min(1).max(120).optional(),
  district: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  capacity: z.coerce.number().int().min(1).max(1000).optional(),
  subsidy_enabled: z.boolean().default(false),
  photo_required: z.boolean().default(true),
});
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;

export const orgUpdateSchema = orgSetupSchema.partial();
export type OrgUpdateInput = z.infer<typeof orgUpdateSchema>;

// TZ §7.2 lists no separate "register" endpoint — S4's registration wizard
// (§3.4) goes straight from Telegram login into org setup, so
// /api/org/setup itself verifies initData and creates the org + owner.
export const orgRegisterSchema = z.object({
  initData: z.string().min(1),
  org: orgSetupSchema,
});
export type OrgRegisterInput = z.infer<typeof orgRegisterSchema>;

