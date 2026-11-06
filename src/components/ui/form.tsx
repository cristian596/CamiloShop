"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  startTransition,
  useId,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./button";
import { focusRing } from "./styles";

export const inputClasses = cn(
  "h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-fg placeholder:text-muted aria-invalid:border-pink-fg",
  focusRing,
);

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}

/** Label + control + hint + error, wired with aria-describedby / aria-invalid. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-pink-fg">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClasses, "h-auto min-h-20 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClasses, "pr-8", className)} {...props} />;
}

export function PasswordInput({
  showLabel,
  hideLabel,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(inputClasses, "pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className={cn(
          "absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg",
          focusRing,
        )}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * onSubmit handler that dispatches a useActionState action without React's
 * automatic form reset, so every field (selects included) keeps what the user
 * typed after a failed save. Pair it with the `pending` from useActionState, and
 * keep `action={dispatch}` on the form so it still posts without JavaScript.
 */
export function submitWithoutReset(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

/** Submit button that disables itself and shows a spinner while its form is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  pending: pendingOverride,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
  /** For forms submitted with submitWithoutReset, where useFormStatus does not apply. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={buttonClasses({ variant, className: cn("w-full", className) })}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Form-level message. Errors use role="alert" so screen readers announce them. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        tone === "error" ? "border-pink-fg/40 text-pink-fg" : "border-cyan-fg/40 text-cyan-fg",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
