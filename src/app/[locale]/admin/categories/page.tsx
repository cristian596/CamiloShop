import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CategoryEditor, NewCategoryForm } from "@/features/admin/category-forms";
import { AdminHeader, cardClass } from "@/features/admin/ui";

interface AdminCategoriesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AdminCategoriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("categories") };
}

const categorySelect = {
  id: true,
  nameEs: true,
  nameEn: true,
  slug: true,
  position: true,
  _count: { select: { products: true } },
} as const;

export default async function AdminCategoriesPage({ params }: AdminCategoriesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireAdmin("/admin/categories");

  const [t, roots] = await Promise.all([
    getTranslations("Admin.categories"),
    getDb().category.findMany({
      where: { parentId: null },
      orderBy: { position: "asc" },
      select: {
        ...categorySelect,
        children: { orderBy: { position: "asc" }, select: categorySelect },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader title={t("title")} description={t("hint")} />
      {roots.map((root) => (
        <section
          key={root.id}
          aria-label={root.nameEs}
          className={`${cardClass} flex flex-col gap-5`}
        >
          <CategoryEditor
            category={{ ...root, productCount: root._count.products, isRoot: true }}
          />
          <ul className="flex flex-col gap-4 border-l-2 border-line pl-4">
            {root.children.map((child) => (
              <li key={child.id}>
                <CategoryEditor
                  category={{ ...child, productCount: child._count.products, isRoot: false }}
                />
              </li>
            ))}
          </ul>
          <NewCategoryForm
            parentId={root.id}
            parentName={locale === "en" ? root.nameEn : root.nameEs}
          />
        </section>
      ))}
    </div>
  );
}
