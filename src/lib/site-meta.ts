/**
 * The site-wide title and description, kept out of layout.tsx so tests can check their
 * length. Search results show about 50-60 characters of title and 140-160 of description.
 */
export const siteTitle = (toolCount: number) => `Sumly — ${toolCount} Free Online Calculators & Tools for Work`;

export const siteDescription = (toolCount: number, domainCount: number) =>
  `Free professional calculators and utilities for finance, marketing, business, developers and students. ${toolCount} tools across ${domainCount} domains, no sign-up.`;
