import { randomInt } from "node:crypto";

// No 0/O/1/I — a parent reads this off a screen or a printed slip.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLinkCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
