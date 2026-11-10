import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { Container } from "@/components/ui/container";
import { AdminNav } from "@/features/admin/admin-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Admin shell. requireAdmin() runs here before anything streams, so a non-admin
 * gets a real 404 (the loading.tsx below only wraps the pages). Layouts do not
 * re-render on client navigation, so every page and action checks again.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin("/admin");
  const t = await getTranslations("Admin");

  return (
    <Container className="py-8">
      <p className="mb-6 font-display text-sm font-semibold tracking-wide text-primary-fg uppercase">
        {t("title")}
      </p>
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside>
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
