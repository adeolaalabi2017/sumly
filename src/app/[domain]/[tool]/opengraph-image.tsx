import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { DOMAINS, TOOLS, toolBySlug } from "@/lib/registry";

export const dynamic = "force-static";
export const alt = "Sumly: free professional tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ domain: t.domain, tool: t.slug }));
}

// Long names such as "Email Click-to-Open Rate (CTOR) Calculator" need to stay on 3 lines or fewer.
function titleSize(name: string): number {
  if (name.length <= 18) return 104;
  if (name.length <= 28) return 88;
  if (name.length <= 38) return 76;
  return 66;
}

export default async function ToolOpenGraphImage({
  params,
}: {
  params: Promise<{ domain: string; tool: string }>;
}) {
  const { domain, tool: slug } = await params;
  const tool = toolBySlug(slug);
  const domainName = DOMAINS.find((d) => d.slug === domain)?.name ?? "";
  const outfit = await readFile(path.join(process.cwd(), "src/app/fonts/Outfit-Medium.woff"));

  const name = tool?.name ?? "Sumly";
  const tagline = tool?.tagline ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px",
          background: "#131412",
          color: "#f2f2ec",
          fontFamily: "Outfit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="18" fill="#d4f53c" />
            <path
              d="M44 21C44 16 38.5 13 32 13C25 13 20.5 16.5 20.5 21.5C20.5 32 44 27.5 44 42C44 47.5 38.5 51 31.5 51C25 51 20 48.5 19 43"
              fill="none"
              stroke="#111210"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 500 }}>Sumly</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: titleSize(name),
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            {name}
          </div>
          {tagline ? (
            <div style={{ display: "flex", marginTop: 28, fontSize: 32, lineHeight: 1.3, color: "#adb0a7" }}>
              {tagline}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid #2a2c28",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, color: "#8a8d84" }}>Domain</div>
            <div style={{ display: "flex", fontSize: 32, marginTop: 4 }}>{domainName}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 22, color: "#8a8d84" }}>Free, runs in your browser</div>
            <div style={{ display: "flex", fontSize: 32, marginTop: 4 }}>sumly.cc</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Outfit", data: outfit, weight: 500, style: "normal" }] }
  );
}
