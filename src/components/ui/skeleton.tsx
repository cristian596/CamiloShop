import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Decorative placeholder; the surrounding region carries aria-busy and a label. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-xl bg-surface-raised motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
