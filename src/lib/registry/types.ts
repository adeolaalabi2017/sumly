import type { LucideIcon } from "lucide-react";

export type DomainSlug =
  | "finance"
  | "marketing"
  | "advertising"
  | "business"
  | "seo"
  | "content"
  | "design"
  | "data"
  | "developer"
  | "productivity"
  | "education"
  | "everyday"
  | "health"
  | "math"
  | "files"
  | "construction";

export interface Domain {
  slug: DomainSlug;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  status: "live" | "planned";
  /** Rollout phase in the 6-month roadmap (1 = MVP) */
  phase: number;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Tool {
  slug: string;
  name: string;
  domain: DomainSlug;
  category: string;
  /** One-line value proposition under the H1 */
  tagline: string;
  /** Card/SEO description (1-2 sentences) */
  description: string;
  tags: string[];
  popular?: boolean;
  /** Optional <title> override; the "| Sumly" suffix is added by the layout template */
  metaTitle?: string;
}

/** Tool-page copy, stored separately from Tool so it only ships with its own page. */
export interface WorkedStep {
  /** What this step finds, e.g. "Monthly rate" */
  label: string;
  /** The working with the example's numbers substituted in */
  working: string;
  /** The figure the step produces */
  result: string;
}

export interface ToolContent {
  /** 2-4 short paragraphs explaining the method */
  howItWorks: string[];
  /** Narrated worked example (the tool itself ships preloaded with the same values) */
  example: string;
  /** Optional step-by-step working of the same example, one row per calculation */
  steps?: WorkedStep[];
  faqs: Faq[];
}

export interface PlannedTool {
  name: string;
  domain: DomainSlug;
  phase: 2 | 3 | 4;
}

export interface Profession {
  slug: string;
  /** Plural display name, e.g. "Marketers" */
  name: string;
  icon: LucideIcon;
  blurb: string;
  /** Slugs of live tools surfaced first */
  liveSlugs: string[];
  /** Names of planned tools relevant to this profession, in build order */
  comingNames: string[];
}

export type Route =
  | { kind: "home" }
  | { kind: "domain"; domain: DomainSlug }
  | { kind: "tool"; domain: DomainSlug; tool: string }
  | { kind: "profession"; profession: string }
  | { kind: "notfound"; path: string };
