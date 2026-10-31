"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { useRecentlyViewed, type RecentlyViewedItem } from "@/stores/recently-viewed";
import { CompactProductCard } from "./compact-product-card";

const subscribeHydration = (onChange: () => void) =>
  useRecentlyViewed.persist.onFinishHydration(onChange);

/** Records a product view; renders nothing. */
export function RecordProductView({ item }: { item: RecentlyViewedItem }) {
  useEffect(() => {
    const record = () => useRecentlyViewed.getState().add(item);
    // Child effects run before the parent's rehydrate(); recording earlier would be
    // overwritten by the stored list, so wait for hydration when it has not happened yet.
    if (useRecentlyViewed.persist.hasHydrated()) {
      record();
      return;
    }
    return useRecentlyViewed.persist.onFinishHydration(record);
    // Only the slug identifies a view; a new object with the same slug is not a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug]);
  return null;
}

/**
 * Products viewed in this browser (stored in localStorage). Hidden until the store
 * hydrates, so the server render and the first client render match.
 */
export function RecentlyViewed({
  excludeSlug,
  limit = 6,
}: {
  excludeSlug?: string;
  limit?: number;
}) {
  const t = useTranslations("Product");
  const items = useRecentlyViewed((state) => state.items);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => useRecentlyViewed.persist.hasHydrated(),
    () => false,
  );

  const visible = items.filter((item) => item.slug !== excludeSlug).slice(0, limit);
  if (!hydrated || visible.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-title" className="py-12">
      <Container>
        <SectionHeading id="recently-viewed-title" title={t("recentlyViewed")} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visible.map((item) => (
            <li key={item.slug} className="flex">
              <CompactProductCard product={item} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
