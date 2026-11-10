"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { AdminFormState } from "./product-schema";
import { changeUserRoleAction, setUserActiveAction } from "./user-actions";

const initialState: AdminFormState = { status: "idle" };

export function UserRowActions({
  userId,
  role,
  isActive,
  isSelf,
}: {
  userId: string;
  role: "CUSTOMER" | "ADMIN";
  isActive: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("Admin.users");
  const te = useTranslations("Admin.errors");
  const [roleState, roleDispatch, rolePending] = useActionState(changeUserRoleAction, initialState);
  const [activeState, activeDispatch, activePending] = useActionState(
    setUserActiveAction,
    initialState,
  );

  if (isSelf) return <span className="text-xs text-muted">{t("you")}</span>;
  const error =
    roleState.status === "error"
      ? roleState.error
      : activeState.status === "error"
        ? activeState.error
        : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={roleDispatch} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <label>
            <span className="sr-only">{t("role")}</span>
            <select
              name="role"
              defaultValue={role}
              className={cn(inputClasses, "h-9 w-auto py-0 pr-8 text-xs")}
            >
              <option value="CUSTOMER">{t("roles.CUSTOMER")}</option>
              <option value="ADMIN">{t("roles.ADMIN")}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={rolePending}
            onClick={(event) => {
              const select = event.currentTarget.form?.elements.namedItem("role");
              if (
                select instanceof HTMLSelectElement &&
                select.value !== role &&
                !window.confirm(t("confirmRole"))
              ) {
                event.preventDefault();
              }
            }}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            {t("applyRole")}
          </button>
        </form>
        <form
          action={activeDispatch}
          onSubmit={(event) => {
            if (!window.confirm(isActive ? t("confirmDeactivate") : t("confirmActivate"))) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          <button
            type="submit"
            disabled={activePending}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            {isActive ? t("deactivate") : t("activate")}
          </button>
        </form>
      </div>
      {error ? <p className="text-xs text-pink-fg">{te(error)}</p> : null}
    </div>
  );
}
