import { z } from "zod";

/** Pure review rules, shared by the server, the form and the tests. */

export const REVIEW_LIMITS = { titleMax: 80, bodyMin: 10, bodyMax: 1000 } as const;

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, { error: "rating" }).max(5, { error: "rating" }),
  title: z
    .string()
    .trim()
    .max(REVIEW_LIMITS.titleMax, { error: "tooLong" })
    .transform((value) => (value === "" ? null : value)),
  body: z
    .string()
    .trim()
    .min(REVIEW_LIMITS.bodyMin, { error: "tooShort" })
    .max(REVIEW_LIMITS.bodyMax, { error: "tooLong" }),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** Translation keys under "Reviews.errors". */
export type ReviewErrorKey =
  | "rating"
  | "tooShort"
  | "tooLong"
  | "notEligible"
  | "alreadyReviewed"
  | "rateLimited"
  | "auth"
  | "generic";

/**
 * Public name of a reviewer or asker: first name and last initial
 * ("Camilo Higuera" -> "Camilo H."). Never the email.
 */
export function publicName(fullName: string | null | undefined, fallback: string): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = parts;
  if (!first) return fallback;
  const firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const last = rest.at(-1);
  return last ? `${firstName} ${last.charAt(0).toUpperCase()}.` : firstName;
}

/** Average (1 decimal) and how many reviews gave each number of stars. */
export function summarizeRatings(ratings: number[]) {
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.filter((rating) => rating === stars).length,
  }));
  const count = ratings.length;
  const average =
    count === 0 ? 0 : Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10;
  return { average, count, distribution };
}
