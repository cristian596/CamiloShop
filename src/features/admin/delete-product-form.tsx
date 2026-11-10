"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { deleteProductAction } from "./product-actions";
import type { AdminFormState } from "./product-schema";

export function DeleteProductForm({ productId }: { productId: string }) {
  const t = useTranslations("Admin.products");
  const te = useTranslations("Admin.errors");
  const [state, dispatch, pending] = useActionState<AdminFormState, FormData>(deleteProductAction, {
    status: "idle",
  });

  return (
    <form
      action={dispatch}
      onSubmit={(event) => {
        if (!window.confirm(t("confirmDelete"))) event.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="productId" value={productId} />
      {state.status === "error" && state.error ? (
        <FormMessage tone="error">{te(state.error)}</FormMessage>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses({ variant: "outline", className: "self-start" })}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t("delete")}
      </button>
    </form>
  );
}
