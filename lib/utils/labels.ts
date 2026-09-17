/** Uzbek labels for enum values shared across the state-comparison UI, PDF bundle and XLSX report. */

export const ATTEND_STATUS_LABELS: Record<string, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  sick: "Kasal",
  vacation: "Ta'tilda",
};

export const REJECT_REASON_LABELS: Record<string, string> = {
  tizim_qotdi: "Tizim qotib qoldi",
  rasm_tanilmadi: "Rasm tanilmadi",
  xatolik: "Xatolik",
  boshqa: "Boshqa sabab",
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  draft: "Qoralama",
  submitted: "Yuborilgan",
  won: "Yutildi",
  lost: "Yutqazildi",
  cancelled: "Bekor qilindi",
};

export const STATE_RESULT_LABELS: Record<string, string> = {
  pending: "Tekshirilmagan",
  accepted: "Qabul qilindi",
  rejected: "Rad etildi",
};
