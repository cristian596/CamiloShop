import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for a product grid, used as a <Suspense> fallback inside pages. */
export async function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  const t = await getTranslations("Loading");

  return (
    <div
      aria-busy="true"
      aria-label={t("label")}
      role="status"
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full-page skeleton for route-level loading.tsx files.
 *
 * Only mount it in segments that can never 404: a loading.tsx boundary streams a
 * 200 before notFound() runs. Pages that validate params (e.g. categories) resolve
 * them first and wrap just the slow part in <Suspense fallback={<ProductGridSkeleton />}>.
 */
export async function PageSkeleton() {
  return (
    <Container className="py-16">
      <Skeleton className="mb-4 h-10 w-2/3 max-w-md" />
      <Skeleton className="mb-12 h-5 w-1/2 max-w-sm" />
      <ProductGridSkeleton />
    </Container>
  );
}
