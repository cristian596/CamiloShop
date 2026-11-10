"use client";

import { Ban, CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, TextArea } from "@/components/ui/form";
import type { OrderStatusValue } from "@/features/orders/status";
import { changeOrderStatusAction, type StatusFormState } from "./order-actions";

const ICONS = { PAID: CheckCircle2, SHIPPED: Truck, DELIVERED: PackageCheck, CANCELLED: Ban };

export function OrderStatusForm({
  orderId,
  status,
  targets,
  isCod,
}: {
  orderId: string;
  status: OrderStatusValue;
  targets: OrderStatusValue[];
  isCod: boolean;
}) {
  const t = useTranslations("Admin.orders");
  const [state, dispatch, pending] = useActionState<StatusFormState, FormData>(
    changeOrderStatusAction,
    { status: "idle" },
  );

  if (targets.length === 0) {
    return <p className="text-sm text-muted">{t("finalStatus")}</p>;
  }

  return (
    <form action={dispatch} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="expectedFrom" value={status} />
      {state.status === "error" ? (
        <FormMessage tone="error">{t(`errors.${state.error ?? "invalid"}`)}</FormMessage>
      ) : null}
      {state.status === "success" ? <FormMessage tone="success">{t("saved")}</FormMessage> : null}
      {status === "PENDING" && !isCod ? (
        <p className="text-sm text-muted">{t("onlineHint")}</p>
      ) : null}
      <Field label={t("note")} hint={t("noteHint")}>
        {(props) => <TextArea {...props} name="note" maxLength={240} rows={2} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => {
          if (target === "PENDING") return null;
          const Icon = ICONS[target];
          const cancel = target === "CANCELLED";
          return (
            <button
              key={target}
              type="submit"
              name="to"
              value={target}
              disabled={pending}
              onClick={(event) => {
                if (cancel && !window.confirm(t("confirmCancel"))) event.preventDefault();
              }}
              className={buttonClasses({ variant: cancel ? "outline" : "primary" })}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(`to.${target === "PAID" && isCod ? "CONFIRM_COD" : target}`)}
            </button>
          );
        })}
      </div>
    </form>
  );
}
