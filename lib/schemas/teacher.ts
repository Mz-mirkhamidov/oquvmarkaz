import { z } from "zod";

// TZ §7.2's endpoint table has no explicit "create teacher" route, but
// F-A4 and the S4 onboarding wizard's step 4 ("Tarbiyachilar + ularga PIN
// berish") both require one — added here under /api/teachers.
export const teacherCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  pin: z.string().regex(/^\d{4}$/, "PIN 4 ta raqamdan iborat bo'lishi kerak"),
});
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;

export const teacherPinResetSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN 4 ta raqamdan iborat bo'lishi kerak"),
});
export type TeacherPinResetInput = z.infer<typeof teacherPinResetSchema>;
