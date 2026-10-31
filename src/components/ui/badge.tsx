import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "violet" | "cyan" | "pink";

const tones: Record<Tone, string> = {
  violet: "border-primary-fg/40 text-primary-fg",
  cyan: "border-cyan-fg/40 text-cyan-fg",
  pink: "border-pink-fg/40 text-pink-fg",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "violet", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-surface px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
