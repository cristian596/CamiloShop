import "server-only";
import { getDb } from "@/lib/db";
import { isQuestionVisible } from "./rules";

const questionSelect = {
  id: true,
  userId: true,
  body: true,
  createdAt: true,
  user: { select: { fullName: true } },
  answers: {
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, createdAt: true },
  },
} as const;

/** Questions this viewer may see on a product page, newest first. */
export async function getProductQuestions(
  productId: string,
  viewer: { id: string; isAdmin: boolean } | null,
) {
  const questions = await getDb().question.findMany({
    where: {
      productId,
      // Filtered in SQL for the public; the author and admins also get pending ones.
      ...(viewer?.isAdmin
        ? {}
        : { OR: [{ answers: { some: {} } }, ...(viewer ? [{ userId: viewer.id }] : [])] }),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: questionSelect,
  });
  return questions.filter((question) =>
    isQuestionVisible({ userId: question.userId, answerCount: question.answers.length }, viewer),
  );
}

/** The admin queue: questions nobody answered yet, oldest first. */
export async function getPendingQuestions() {
  return getDb().question.findMany({
    where: { answers: { none: {} } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      ...questionSelect,
      product: { select: { slug: true, nameEs: true, nameEn: true } },
      user: { select: { fullName: true, email: true } },
    },
  });
}

export async function countPendingQuestions() {
  return getDb().question.count({ where: { answers: { none: {} } } });
}
