import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Building blocks shared by the admin pages. */

export const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "violet",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "violet" | "cyan" | "pink";
}) {
  return (
    <div className={cn(cardClass, "flex flex-col gap-1")}>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={cn(
          "font-display text-2xl font-bold",
          tone === "violet" && "text-primary-fg",
          tone === "cyan" && "text-cyan-fg",
          tone === "pink" && "text-pink-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Wraps a wide table so it scrolls inside its card instead of the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const thClass = "px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase";
export const tdClass = "border-t border-line px-4 py-3 align-middle";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
      {children}
    </p>
  );
}
