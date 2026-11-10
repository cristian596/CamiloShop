"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  TextArea,
  submitWithoutReset,
} from "@/components/ui/form";
import { answerQuestionAction, askQuestionAction, type QuestionFormState } from "./actions";
import { QUESTION_LIMITS } from "./rules";

const initialState: QuestionFormState = { status: "idle" };

export function AskQuestionForm({ productId }: { productId: string }) {
  const t = useTranslations("Questions");
  const [state, dispatch, pending] = useActionState(askQuestionAction, initialState);

  return (
    <form
      // A new key after each question empties the box.
      key={state.savedAt ?? "ask"}
      action={dispatch}
      onSubmit={submitWithoutReset(dispatch)}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="productId" value={productId} />
      {state.status === "error" && state.error ? (
        <FormMessage tone="error">
          {t(`errors.${state.error}`, { min: QUESTION_LIMITS.min })}
        </FormMessage>
      ) : null}
      {state.status === "success" ? <FormMessage tone="success">{t("sent")}</FormMessage> : null}
      <Field label={t("yourQuestion")} hint={t("hint")}>
        {(props) => (
          <TextArea
            {...props}
            name="body"
            rows={3}
            minLength={QUESTION_LIMITS.min}
            maxLength={QUESTION_LIMITS.max}
            required
          />
        )}
      </Field>
      <SubmitButton
        pending={pending}
        pendingLabel={t("sending")}
        className="sm:w-auto sm:self-start"
      >
        {t("ask")}
      </SubmitButton>
    </form>
  );
}

export function AnswerForm({ questionId }: { questionId: string }) {
  const t = useTranslations("Questions");
  const [state, dispatch, pending] = useActionState(answerQuestionAction, initialState);

  if (state.status === "success") {
    return <FormMessage tone="success">{t("answered")}</FormMessage>;
  }
  return (
    <form action={dispatch} onSubmit={submitWithoutReset(dispatch)} className="flex flex-col gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      {state.status === "error" && state.error ? (
        <FormMessage tone="error">
          {t(`errors.${state.error}`, { min: QUESTION_LIMITS.answerMin })}
        </FormMessage>
      ) : null}
      <Field label={t("answerAsStore")}>
        {(props) => (
          <TextArea
            {...props}
            name="body"
            rows={2}
            maxLength={QUESTION_LIMITS.answerMax}
            required
          />
        )}
      </Field>
      <SubmitButton
        pending={pending}
        pendingLabel={t("sending")}
        variant="outline"
        className="sm:w-auto sm:self-start"
      >
        {t("answer")}
      </SubmitButton>
    </form>
  );
}
