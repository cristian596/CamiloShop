"use client";

import type { FormEvent, FormHTMLAttributes } from "react";

/**
 * GET form that leaves empty fields out of the URL (e.g. `?min=&max=`).
 * Disabled controls are not submitted, so empty ones are disabled just before
 * the browser builds the query and re-enabled right after. Without JavaScript
 * it degrades to a regular form; the parser ignores empty values anyway.
 */
export function CleanGetForm(
  props: Omit<FormHTMLAttributes<HTMLFormElement>, "method" | "onSubmit">,
) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const empty = [...event.currentTarget.elements].filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.name !== "" && element.value === "",
    );
    for (const input of empty) input.disabled = true;
    requestAnimationFrame(() => {
      for (const input of empty) input.disabled = false;
    });
  }

  return <form {...props} method="get" onSubmit={onSubmit} />;
}
