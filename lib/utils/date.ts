import { toZonedTime, format as formatTz } from "date-fns-tz";

export const APP_TIMEZONE = "Asia/Tashkent";

/** "Day" always means an Asia/Tashkent calendar date (TZ §5.4), never UTC's. */
export function todayInTashkent(): string {
  return formatTz(toZonedTime(new Date(), APP_TIMEZONE), "yyyy-MM-dd", { timeZone: APP_TIMEZONE });
}

/** How far apart a device's clock and the server's are, in minutes — used for the >10min warning (TZ §5.4). */
export function clockSkewMinutes(clientIso: string, serverIso: string): number {
  return Math.abs(new Date(clientIso).getTime() - new Date(serverIso).getTime()) / 60_000;
}
