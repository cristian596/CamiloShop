import "server-only";
import { after } from "next/server";

/**
 * Runs work after the response is sent (emails, cleanup). `after` keeps the
 * function alive until the promise settles (on Vercel it maps to waitUntil).
 * Errors are logged, never thrown: background work must not affect the user's
 * request.
 */
export function runInBackground(label: string, work: Promise<unknown>) {
  const guarded = work.catch((error: unknown) => console.error(`[background] ${label}`, error));
  try {
    after(guarded);
  } catch {
    // Outside a request (e.g. unit tests): the promise still runs on its own.
  }
}
