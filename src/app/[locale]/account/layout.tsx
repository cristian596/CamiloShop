import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { Container } from "@/components/ui/container";
import { AccountNav } from "@/features/account/account-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // Layouts do not re-render on client navigation, so every page also calls requireUser().
  await requireUser("/account");
  const t = await getTranslations("Account");

  return (
    <Container className="py-8">
      <p className="mb-6 font-display text-sm font-semibold tracking-wide text-cyan-fg uppercase">
        {t("title")}
      </p>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
