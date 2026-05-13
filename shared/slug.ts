// URL slug helper — lowercase, alphanumeric + dashes, no leading/trailing dash.
// Used for author slugs (and anywhere else we need a consistent slug format).
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")                  // strip diacritics
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
