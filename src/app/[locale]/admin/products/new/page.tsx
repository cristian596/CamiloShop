import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "@/features/admin/product-form";
import { getProductFormOptions } from "@/features/admin/product-queries";
import { AdminHeader } from "@/features/admin/ui";

interface NewProductPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewProductPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.products" });
  return { title: t("new") };
}

export default async function NewProductPage({ params }: NewProductPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireAdmin("/admin/products/new");
  const [t, options] = await Promise.all([
    getTranslations("Admin.products"),
    getProductFormOptions(),
  ]);

  return (
    <div>
      <AdminHeader title={t("new")} description={t("newHint")} />
      <ProductForm
        options={options}
        initial={{
          nameEs: "",
          nameEn: "",
          slug: "",
          descriptionEs: "",
          descriptionEn: "",
          categoryId: "",
          brandId: "",
          price: "",
          compareAtPrice: "",
          isActive: false,
          isFeatured: false,
          variants: [],
        }}
      />
    </div>
  );
}
