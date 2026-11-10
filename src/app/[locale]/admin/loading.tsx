import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeleton for every admin page (inside the admin layout and its guard). */
export default async function AdminLoading() {
  const t = await getTranslations("Loading");
  return (
    <div aria-busy="true" aria-label={t("label")} role="status" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
