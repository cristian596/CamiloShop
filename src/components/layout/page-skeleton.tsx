import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading skeleton for product grids. Used from route-level loading.tsx files
 * (listing, search, account). It is intentionally not mounted at the locale root:
 * a root Suspense boundary would stream a 200 before notFound() could send a 404.
 */
export async function PageSkeleton() {
  const t = await getTranslations("Loading");

  return (
    <Container aria-busy="true" aria-label={t("label")} role="status" className="py-16">
      <Skeleton className="mb-4 h-10 w-2/3 max-w-md" />
      <Skeleton className="mb-12 h-5 w-1/2 max-w-sm" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
