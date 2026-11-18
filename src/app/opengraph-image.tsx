import { ImageResponse } from "next/og";
import { DOMAINS, TOOLS } from "@/lib/registry";

export const alt = "Sumly: professional tools, organized by domain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          fontFamily: "sans-serif",
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
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>Sumly</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            <div style={{ display: "flex" }}>Professional tools,</div>
            <div style={{ display: "flex" }}>organized by domain</div>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#adb0a7" }}>
            {`${TOOLS.length} free tools across ${DOMAINS.length} domains`}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
