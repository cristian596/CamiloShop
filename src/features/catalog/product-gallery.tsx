"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";

interface GalleryImage {
  id: string;
  url: string;
  alt: { es: string; en: string };
}

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <section aria-label={t("gallery")} className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface-raised">
        {current ? (
          <Image
            key={current.id}
            src={current.url}
            alt={current.alt[locale]}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <ImageOff className="size-12 text-muted" aria-hidden="true" />
          </div>
        )}
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={t("showImage", { index: index + 1, total: images.length })}
                aria-pressed={index === active}
                className={cn(
                  "relative block size-20 overflow-hidden rounded-xl border-2 transition-colors",
                  index === active ? "border-primary" : "border-transparent hover:border-line",
                  focusRing,
                )}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
