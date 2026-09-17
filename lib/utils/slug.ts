export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
