import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache yet: every page is dynamic or statically built.
// Add r2IncrementalCache here if ISR is introduced later.
export default defineCloudflareConfig({});
