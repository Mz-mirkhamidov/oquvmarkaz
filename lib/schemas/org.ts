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

// TZ v2 §4.2 (X1 fix) — registration now starts from an *already*
// authenticated session (Better Auth), not a bundled Telegram initData:
// /sozlash is only reachable once /kirish/t has signed the user in, so
// this only needs the org fields.
export const orgRegisterSchema = z.object({
  org: orgSetupSchema,
});
export type OrgRegisterInput = z.infer<typeof orgRegisterSchema>;

