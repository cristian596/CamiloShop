import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Runs work after the response is sent (emails, cleanup). On Workers the promise
 * must be handed to waitUntil or the runtime may cancel it. Errors are logged,
 * never thrown: background work must not affect the user's request.
 */
export function runInBackground(label: string, work: Promise<unknown>) {
  const guarded = work.catch((error: unknown) => console.error(`[background] ${label}`, error));
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    // No Cloudflare context (e.g. unit tests): the promise still runs on its own.
  }
}
