"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DOMAINS, PROFESSIONS, TOOLS, toolBySlug, toolsByDomain } from "@/lib/registry";
import { useSearch } from "@/components/site/search-dialog";
import { PinnedToolsBar } from "@/components/site/bookmarks";

/** One tool of each kind, so the first screen shows the site isn't only calculators. */
const SAMPLES = [
  {
    href: "/finance/loan-mortgage-calculator",
    name: "Loan & Mortgage Calculator",
    input: "$350,000 at 6.25% over 30 years",
    output: "$2,155 a month",
  },
  {
    href: "/developer/json-formatter",
    name: "JSON Formatter",
    input: `{"name":"sumly","tools":${TOOLS.length}}`,
    output: "Valid JSON, 4 lines",
  },
  {
    href: "/files/merge-pdf",
    name: "Merge PDF",
    input: "3 PDFs, 6 pages",
    output: "merged.pdf",
  },
];

function topTools(slug: Parameters<typeof toolsByDomain>[0]) {
  const tools = toolsByDomain(slug);
  return [...tools.filter((t) => t.popular), ...tools.filter((t) => !t.popular)].slice(0, 3);
}

export function HomePage() {
  const { setOpen } = useSearch();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="pb-14 pt-12 sm:pb-16 sm:pt-20">
        <h1 className="max-w-5xl text-display-xl">Bring what you&apos;ve got. Leave with what you need.</h1>
        <p className="mt-8 text-lg text-muted-foreground">
          Whatever you&apos;ve got, a number to work out, a file to convert or a draft to check, you leave with
          what you need. Search {TOOLS.length} tools across {DOMAINS.length} domains. Free, with no sign-up.
        </p>
        <div className="mt-2 flex max-w-4xl flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            // The label must contain the visible text (WCAG 2.5.3) and still say what the button does.
            aria-label={`Loan payment, format JSON, merge PDF: search ${TOOLS.length} tools`}
            aria-keyshortcuts="Meta+K Control+K /"
            className="flex h-16 min-w-0 flex-[1_1_280px] items-center justify-between gap-4 rounded-md border-[1.5px] border-input bg-card px-4 text-left text-xl text-muted-foreground"
          >
            <span className="truncate">Loan payment, format JSON, merge PDF</span>
            <kbd className="hidden shrink-0 font-sans text-sm [@media(pointer:fine)]:inline">⌘K</kbd>
          </button>
          <Button variant="highlight" size="lg" className="h-16" onClick={() => setOpen(true)}>
            Search
          </Button>
        </div>
      </section>

      <PinnedToolsBar />

      <section aria-labelledby="whatever-you-bring">
        <h2 id="whatever-you-bring" className="text-display-md">
          Whatever you bring
        </h2>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {SAMPLES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col gap-6 rounded-xl border-[1.5px] border-input bg-card p-5 transition-colors hover:bg-accent"
            >
              <span className="font-display text-display-sm font-medium tracking-tight">{s.name}</span>
              <span className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">In</span>
                <span className="font-mono text-sm [overflow-wrap:anywhere]">{s.input}</span>
                <span className="text-muted-foreground">Out</span>
                <span className="font-mono text-sm font-medium [overflow-wrap:anywhere]">{s.output}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="browse-domains" className="scroll-mt-20 pt-16" aria-labelledby="browse-domains-title">
        <h2 id="browse-domains-title" className="text-display-md">
          Browse by domain
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DOMAINS.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.slug} className="rounded-xl bg-card p-4">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <Link href={`/${d.slug}`} className="flex-1 text-lg font-semibold leading-tight underline underline-offset-[3px]">
                    {d.name}
                  </Link>
                  <span className="tnum text-sm text-muted-foreground">{toolsByDomain(d.slug).length}</span>
                </div>
                <ul className="mt-2">
                  {topTools(d.slug).map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/${t.domain}/${t.slug}`}
                        className="block py-[11px] text-sm text-muted-foreground underline underline-offset-[3px] hover:text-foreground"
                      >
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section id="professions" className="scroll-mt-20 py-16" aria-labelledby="professions-title">
        <h2 id="professions-title" className="text-display-md">
          Tools for your profession
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONS.map((p) => (
            <Link
              key={p.slug}
              href={`/professions/${p.slug}`}
              className="flex flex-col gap-1 rounded-xl border-[1.5px] border-input bg-card p-4 transition-colors hover:bg-accent"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{p.name}</span>
                <span className="tnum shrink-0 text-sm text-muted-foreground">
                  {p.liveSlugs.filter((s) => toolBySlug(s)).length} tools
                </span>
              </span>
              <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{p.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="good-to-know" className="scroll-mt-20 pb-16" aria-labelledby="good-to-know-title">
        <h2 id="good-to-know-title" className="text-display-md">
          Good to know
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">Is Sumly really free?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Yes. All {TOOLS.length} tools are free, with no account and no sign-up. The site may carry ads, placed
              below the tools and never in the way of one.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">Do my numbers leave my device?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              No. Calculations, file conversions and previews run in your browser, so what you type or drop in is not
              sent to our servers. Some tools keep your inputs in the page address so you can share a scenario;
              anyone you send that link to can see those values.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">What can I do here?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Work out loan payments, profit margins and return on ad spend. Format JSON, build a QR code or check
              colour contrast. Merge, split and convert PDFs and spreadsheets. Convert units and currencies. The
              tools sit in {DOMAINS.length} domains, from finance and marketing to developer, design and everyday
              utilities.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">How accurate are the results?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Each calculator explains its formula and shows a worked example on the page, so you can check the
              maths yourself. Results are estimates for planning, not financial, tax or medical advice. Currency
              rates are indicative, so enter your bank or card rate when you need exact figures.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">Where do I start?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Type what you want to do into the search box, or press ⌘K or / from any page. You can also browse by
              domain, or by profession: marketers, accountants, business owners, contractors, designers,
              developers, project managers and students each have a page with the tools they reach for most.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5">
            <h3 className="font-sans font-semibold tracking-normal">Can I save the tools I use often?</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Yes. Star a tool to pin it for quick access. Stars are stored in your browser on this device, not in an
              account, so they stay private and clearing your browser data removes them.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
