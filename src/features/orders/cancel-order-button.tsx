"use client";

import { XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui/button";

/** Submit button for the cancel form; asks for confirmation first. */
export function CancelOrderButton() {
  const t = useTranslations("Orders");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(t("cancelConfirm"))) event.preventDefault();
      }}
      className={buttonClasses({ variant: "outline", className: "w-full hover:text-pink-fg" })}
    >
      <XCircle className="size-4" aria-hidden="true" />
      {pending ? t("cancelling") : t("cancel")}
    </button>
  );
}
