import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** Centered card used by every auth page. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Container className="flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl shadow-violet/10 sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </Container>
  );
}
