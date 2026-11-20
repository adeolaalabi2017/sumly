import type { DomainSlug } from "./registry/types";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sumly.cc";

/** The applicationCategory values Google's software-application documentation accepts. */
export const GOOGLE_APP_CATEGORIES = [
  "GameApplication", "SocialNetworkingApplication", "TravelApplication", "ShoppingApplication",
  "SportsApplication", "LifestyleApplication", "BusinessApplication", "DesignApplication",
  "DeveloperApplication", "DriverApplication", "EducationalApplication", "HealthApplication",
  "FinanceApplication", "SecurityApplication", "BrowserApplication", "CommunicationApplication",
  "DesktopEnhancementApplication", "EntertainmentApplication", "MultimediaApplication",
  "HomeApplication", "UtilitiesApplication", "ReferenceApplication",
] as const;

export type AppCategory = (typeof GOOGLE_APP_CATEGORIES)[number];

const CATEGORY_BY_DOMAIN: Record<DomainSlug, AppCategory> = {
  finance: "FinanceApplication",
  marketing: "BusinessApplication",
  advertising: "BusinessApplication",
  business: "BusinessApplication",
  seo: "BusinessApplication",
  content: "UtilitiesApplication",
  design: "DesignApplication",
  data: "BusinessApplication",
  developer: "DeveloperApplication",
  productivity: "BusinessApplication",
  education: "EducationalApplication",
  everyday: "UtilitiesApplication",
  health: "HealthApplication",
  math: "EducationalApplication",
  files: "UtilitiesApplication",
  construction: "UtilitiesApplication",
};

export function appCategory(domain: DomainSlug): AppCategory {
  return CATEGORY_BY_DOMAIN[domain] ?? "UtilitiesApplication";
}

export interface Crumb {
  name: string;
  /** Path on this site, e.g. "/finance". Omit the leading host. */
  path: string;
}

/** BreadcrumbList that mirrors the visible breadcrumb, Home first. */
export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path === "/" ? "" : c.path}`,
    })),
  };
}

/** JSON for a ld+json script tag. Escapes "<" so content can never close the tag early. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
