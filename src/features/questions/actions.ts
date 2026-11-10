"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";
import { getAdminActor } from "@/features/admin/guard";
import { answerSchema, questionSchema, type QuestionErrorKey } from "./rules";

export interface QuestionFormState {
  status: "idle" | "error" | "success";
  error?: QuestionErrorKey;
  savedAt?: number;
}

const STORE_LAYOUT = "/[locale]";

export async function askQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "auth" };

  const productId = z.uuid().safeParse(formData.get("productId"));
  const body = questionSchema.safeParse(formData.get("body") ?? "");
  if (!productId.success) return { status: "error", error: "generic" };
  if (!body.success) {
    return { status: "error", error: body.error.issues[0]?.message as QuestionErrorKey };
  }
  if (!(await consumeRateLimit(`user:${user.id}`, RATE_LIMITS.question))) {
    return { status: "error", error: "rateLimited" };
  }

  const db = getDb();
  const product = await db.product.findFirst({
    where: { id: productId.data, isActive: true },
    select: { id: true },
  });
  if (!product) return { status: "error", error: "generic" };

  await db.question.create({ data: { productId: product.id, userId: user.id, body: body.data } });
  revalidatePath(STORE_LAYOUT, "layout");
  return { status: "success", savedAt: Date.now() };
}

/** Store answer (admins only), from the product page or the admin queue. */
export async function answerQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const admin = await getAdminActor();
  if (!admin) return { status: "error", error: "forbidden" };

  const questionId = z.uuid().safeParse(formData.get("questionId"));
  const body = answerSchema.safeParse(formData.get("body") ?? "");
  if (!questionId.success) return { status: "error", error: "generic" };
  if (!body.success) {
    return { status: "error", error: body.error.issues[0]?.message as QuestionErrorKey };
  }

  const db = getDb();
  const question = await db.question.findUnique({
    where: { id: questionId.data },
    select: { id: true },
  });
  if (!question) return { status: "error", error: "generic" };

  await db.answer.create({ data: { questionId: question.id, userId: admin.id, body: body.data } });
  revalidatePath(STORE_LAYOUT, "layout");
  return { status: "success", savedAt: Date.now() };
}

/** Removes a question with its answers: its author, or an admin moderating. */
export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const questionId = z.uuid().safeParse(formData.get("questionId"));
  if (!user || !questionId.success) return;

  const db = getDb();
  const question = await db.question.findUnique({
    where: { id: questionId.data },
    select: { userId: true },
  });
  if (!question) return;
  if (question.userId !== user.id && !(await getAdminActor())) return;

  await db.question.delete({ where: { id: questionId.data } });
  revalidatePath(STORE_LAYOUT, "layout");
}
