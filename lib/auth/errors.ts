/**
 * TZ v2 §9.2 / §18.4 — every auth failure returns one of these, never a
 * bare "Invalid" or "Xatolik yuz berdi". The code is shown on screen (small
 * gray text) so a user can report it verbatim.
 */
export const AUTH_CODES = [
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "NO_DEVICE",
  "DEVICE_BLOCKED",
  "BIND_CODE_INVALID",
  "PIN_WRONG",
  "PIN_LOCKED",
  "PASSWORD_WRONG",
  "PASSWORD_TOO_SHORT",
  "RATE_LIMITED",
  "NO_ORG",
  "FORBIDDEN",
  "NO_SESSION",
  "DB_ERROR",
  "CONFIG_ERROR",
] as const;

export type AuthCode = (typeof AUTH_CODES)[number];

export const AUTH_MESSAGES: Record<AuthCode, string> = {
  TOKEN_INVALID: "Bu havola eskirgan. Botga qaytib /kirish yozing.",
  TOKEN_EXPIRED: "Havolaning muddati tugadi. Yangisini oling.",
  USER_DISABLED: "Hisobingiz o'chirilgan. Rahbaringizga murojaat qiling.",
  NO_DEVICE: "Bu qurilma ro'yxatdan o'tmagan.",
  DEVICE_BLOCKED: "Bu qurilma bloklangan.",
  BIND_CODE_INVALID: "Kod noto'g'ri yoki muddati tugagan.",
  PIN_WRONG: "PIN noto'g'ri.",
  PIN_LOCKED: "15 daqiqadan keyin qayta urinib ko'ring.",
  PASSWORD_WRONG: "Joriy parol noto'g'ri.",
  PASSWORD_TOO_SHORT: "Parol kamida 8 ta belgidan iborat bo'lsin.",
  RATE_LIMITED: "Juda ko'p urinish. Biroz kuting.",
  NO_ORG: "Avval bog'changizni ro'yxatdan o'tkazing.",
  FORBIDDEN: "Bu bo'limga ruxsatingiz yo'q.",
  NO_SESSION: "Sessiya topilmadi. Qayta kiring.",
  DB_ERROR: "Texnik nosozlik. Kod: DB_ERROR",
  CONFIG_ERROR: "Tizim sozlanmagan. Kod: CONFIG_ERROR",
};

export class AuthError extends Error {
  code: AuthCode;
  constructor(code: AuthCode) {
    super(AUTH_MESSAGES[code]);
    this.code = code;
  }
}
