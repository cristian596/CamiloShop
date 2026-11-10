import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { DeleteProductForm } from "@/features/admin/delete-product-form";
import { ImageManager } from "@/features/admin/image-manager";
import { ProductForm } from "@/features/admin/product-form";
import { getAdminProduct, getProductFormOptions } from "@/features/admin/product-queries";
import { AdminHeader, cardClass } from "@/features/admin/ui";

interface EditProductPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}

async function loadProduct(id: string) {
  return z.uuid().safeParse(id).success ? getAdminProduct(id) : null;
}

export async function generateMetadata({ params }: EditProductPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const product = await loadProduct(id);
  return { title: product ? (locale === "en" ? product.nameEn : product.nameEs) : undefined };
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const [{ locale: rawLocale, id }, query] = await Promise.all([params, searchParams]);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin(`/admin/products/${id}`);

  const [product, options, t] = await Promise.all([
    loadProduct(id),
    getProductFormOptions(),
    getTranslations("Admin.products"),
  ]);
  if (!product) notFound();
  const ordered = product.variants.some((variant) => variant._count.orderItems > 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader
        title={locale === "en" ? product.nameEn : product.nameEs}
        description={t("soldInfo", { count: product.soldCount })}
        actions={
          product.isActive ? (
            <Link
              href={`/p/${product.slug}`}
              target="_blank"
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("viewInStore")}
            </Link>
          ) : null
        }
      />

      {query.created === "1" || query.saved === "1" ? (
        <FormMessage tone="success">{t(query.created === "1" ? "created" : "saved")}</FormMessage>
      ) : null}

      <ProductForm
        key={product.updatedAt.toISOString()}
        options={options}
        initial={{
          id: product.id,
          nameEs: product.nameEs,
          nameEn: product.nameEn,
          slug: product.slug,
          descriptionEs: product.descriptionEs,
          descriptionEn: product.descriptionEn,
          categoryId: product.categoryId,
          brandId: product.brandId,
          price: String(product.price),
          compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          variants: product.variants.map((variant) => ({
            key: variant.id,
            id: variant.id,
            sku: variant.sku,
            size: variant.size ?? "",
            color: variant.color ?? "",
            priceOverride: variant.priceOverride ? String(variant.priceOverride) : "",
            stock: String(variant.stock),
            locked: variant._count.orderItems > 0,
          })),
        }}
      />

      <ImageManager productId={product.id} images={product.images} />

      <section className={cardClass} aria-labelledby="danger-zone">
        <h2 id="danger-zone" className="mb-2 font-semibold">
          {t("dangerZone")}
        </h2>
        {ordered ? (
          <p className="text-sm text-muted">{t("cannotDelete")}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{t("deleteHint")}</p>
            <DeleteProductForm productId={product.id} />
          </>
        )}
      </section>
    </div>
  );
}
