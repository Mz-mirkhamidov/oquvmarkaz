// Mandatory per TZ §11.3 / §17.1 (T6-T10): every endpoint must reject a
// request scoped to org A when it's authenticated with org B's token.
// Written against real endpoints starting in M1, once auth exists.
import { describe } from "vitest";

describe.todo("tenant isolation (T6-T10) — implemented in M1");
