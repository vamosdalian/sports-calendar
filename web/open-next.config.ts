import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  // Persist ISR/data-cache entries in R2 instead of falling back to the dummy cache.
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
  }),
  // Deduplicate and coordinate time-based revalidation across isolates/regions.
  queue: doQueue,
  // Serve cached ISR/SSG responses before booting Next where possible.
  enableCacheInterception: true,
});
