// Next.js swaps the real `server-only` package for a no-op at the bundler
// level so it only throws inside a client bundle. Vitest isn't that
// bundler, so without this alias every test importing a server-only
// module (lib/auth/*, lib/db/*, ...) would fail unconditionally — see
// node_modules/server-only/index.js, which throws unconditionally.
export {};
