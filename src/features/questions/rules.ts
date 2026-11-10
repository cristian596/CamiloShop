import { z } from "zod";

export const QUESTION_LIMITS = { min: 10, max: 500, answerMin: 2, answerMax: 1000 } as const;

export const questionSchema = z
  .string()
  .trim()
  .min(QUESTION_LIMITS.min, { error: "tooShort" })
  .max(QUESTION_LIMITS.max, { error: "tooLong" });

export const answerSchema = z
  .string()
  .trim()
  .min(QUESTION_LIMITS.answerMin, { error: "tooShort" })
  .max(QUESTION_LIMITS.answerMax, { error: "tooLong" });

/** Translation keys under "Questions.errors". */
export type QuestionErrorKey =
  "tooShort" | "tooLong" | "rateLimited" | "auth" | "forbidden" | "generic";

/**
 * Unanswered questions are only shown to their author and to admins: the
 * public sees a question once the store answered it (light moderation).
 */
export function isQuestionVisible(
  question: { userId: string; answerCount: number },
  viewer: { id: string; isAdmin: boolean } | null,
): boolean {
  return question.answerCount > 0 || viewer?.isAdmin === true || viewer?.id === question.userId;
}
