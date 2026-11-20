/** The date each legal page's text last changed. The pages print it and the sitemap uses it. */
export const LEGAL_UPDATED = {
  privacy: "2026-11-19",
  terms: "2026-11-18",
} as const;

/** "2026-11-19" -> "19 November 2026", for the legal pages' "Last updated" line. */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
