import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// The R2 bucket backs ISR, so /api/rates (12h revalidate) refreshes without a redeploy.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
