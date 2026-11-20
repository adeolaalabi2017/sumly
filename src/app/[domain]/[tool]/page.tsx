import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, domainBySlug, toolBySlug } from "@/lib/registry";
import { TOOL_CONTENT } from "@/lib/registry/tool-content";
import { ToolPage } from "@/components/pages/tool-page";
import { SITE_URL, appCategory, breadcrumbSchema, jsonLd } from "@/lib/structured-data";
import { OG_SIZE, ogAlt, ogImagePath } from "@/lib/og";

export function generateStaticParams() {
  return TOOLS.map((t) => ({
    domain: t.domain,
    tool: t.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; tool: string }>;
}): Promise<Metadata> {
  const { domain, tool: slug } = await params;
  const t = toolBySlug(slug);

  if (!t || t.domain !== domain) {
    return {
      title: "Tool not found",
    };
  }

  const title = `${t.name} — Free Online Tool`;
  const description = t.description || t.tagline;
  const canonicalUrl = `/${t.domain}/${t.slug}`;
  const ogImage = { url: ogImagePath(t), ...OG_SIZE, type: "image/png", alt: ogAlt(t) };

  return {
    title,
    description,
    keywords: t.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${t.name} — Sumly`,
      description,
      type: "website",
      images: [ogImage],
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: `${t.name} — Sumly`,
      description: t.tagline,
      images: [{ url: ogImagePath(t), alt: ogAlt(t) }],
    },
  };
}

export default async function ToolRoutePage({
  params,
}: {
  params: Promise<{ domain: string; tool: string }>;
}) {
  const { domain, tool: slug } = await params;
  const t = toolBySlug(slug);

  const content = t && TOOL_CONTENT[t.slug];
  if (!t || !content || t.domain !== domain) {
    notFound();
  }

  // Schema.org Structured Data: WebApplication
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t.name,
    url: `${SITE_URL}/${t.domain}/${t.slug}`,
    description: t.description || t.tagline,
    applicationCategory: appCategory(t.domain),
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Runs client-side in web browser.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  // Mirrors the visible breadcrumb: Home > Domain > Tool
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: domainBySlug(t.domain)?.name ?? t.domain, path: `/${t.domain}` },
    { name: t.name, path: `/${t.domain}/${t.slug}` },
  ]);

  // Schema.org Structured Data: FAQPage
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }} />
      <ToolPage toolSlug={slug} content={content} />
    </>
  );
}
