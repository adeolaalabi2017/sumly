import Script from "next/script";

const BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

/**
 * Cloudflare Web Analytics: cookieless, no consent banner needed.
 * Renders nothing until NEXT_PUBLIC_CF_BEACON_TOKEN is set (the token is public).
 */
export function Analytics() {
  if (!BEACON_TOKEN || process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: BEACON_TOKEN })}
      strategy="afterInteractive"
    />
  );
}
