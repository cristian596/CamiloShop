"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";
import { isAdminUser } from "@/features/orders/queries";
import { reviewSchema, type ReviewErrorKey } from "./rules";
import { createReview, deleteReview } from "./service";

export interface ReviewFormState {
  status: "idle" | "error" | "success";
  error?: ReviewErrorKey;
  fieldErrors?: Partial<Record<"rating" | "title" | "body", ReviewErrorKey>>;
}

// Pages render per request; this refreshes the router cache of every store page.
const PRODUCT_PAGE = "/[locale]";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createReviewAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "auth" };

  const productId = z.uuid().safeParse(formData.get("productId"));
  const parsed = reviewSchema.safeParse({
    rating: text(formData, "rating") || "0",
    title: text(formData, "title"),
    body: text(formData, "body"),
  });
  if (!productId.success) return { status: "error", error: "generic" };
  if (!parsed.success) {
    const fieldErrors: ReviewFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as "rating" | "title" | "body";
      fieldErrors[field] ??= (issue.message as ReviewErrorKey) || "generic";
    }
    return { status: "error", fieldErrors };
  }

  if (!(await consumeRateLimit(`user:${user.id}`, RATE_LIMITS.review))) {
    return { status: "error", error: "rateLimited" };
  }
  const result = await createReview(getDb(), {
    ...parsed.data,
    userId: user.id,
    productId: productId.data,
  });
  if (!result.ok) return { status: "error", error: result.error };

  revalidatePath(PRODUCT_PAGE, "layout");
  return { status: "success" };
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const reviewId = z.uuid().safeParse(formData.get("reviewId"));
  if (!user || !reviewId.success) return;

  const isAdmin = await isAdminUser(user.id);
  if (await deleteReview(getDb(), reviewId.data, { id: user.id, isAdmin })) {
    revalidatePath(PRODUCT_PAGE, "layout");
  }
}
