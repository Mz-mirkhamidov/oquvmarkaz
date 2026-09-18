import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

// Equivalent to better-auth/next-js's toNextJsHandler(getAuth()), but calls
// getAuth() *inside* the handler rather than at module scope — passing
// `toNextJsHandler(getAuth())` here would still construct the real
// instance eagerly, at import time, defeating the whole point of getAuth()
// (see lib/auth/index.ts's comment on why that broke `next build`).
async function handleAuth(request: Request) {
  return getAuth().handler(request);
}

export const GET = handleAuth;
export const POST = handleAuth;
