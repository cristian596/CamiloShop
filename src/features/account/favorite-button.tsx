"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { toggleFavoriteAction } from "./actions";

/**
 * Heart toggle for a product. Signed-out users get a link to the login page that
 * returns them here. The state flips optimistically and reverts on failure.
 */
export function FavoriteButton({
  productId,
  initialFavorited,
  signedIn,
  locale,
}: {
  productId: string;
  initialFavorited: boolean;
  signedIn: boolean;
  locale: string;
}) {
  const t = useTranslations("Favorites");
  const pathname = usePathname();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();
  const classes = buttonClasses({ variant: "outline", className: "w-full sm:w-auto" });

  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: `/${locale}${pathname}` } }}
        className={classes}
        title={t("loginRequired")}
      >
        <Heart className="size-4" aria-hidden="true" />
        {t("add")}
      </Link>
    );
  }

  function toggle() {
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = await toggleFavoriteAction(productId);
      if (result.ok) {
        setFavorited(result.favorited);
        setAnnouncement(result.favorited ? t("added") : t("removed"));
      } else {
        setFavorited(!next);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        className={classes}
      >
        <Heart className={cn("size-4", favorited && "fill-pink text-pink-fg")} aria-hidden="true" />
        {favorited ? t("remove") : t("add")}
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
