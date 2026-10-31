import { getTranslations } from "next-intl/server";
import { COLOR_SWATCH_CLASSES } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "@/components/ui/button";
import { focusRing } from "@/components/ui/styles";
import { CleanGetForm } from "./clean-get-form";
import { RATING_OPTIONS, type ListingFilters } from "./listing-params";
import type { Facets } from "./queries";

interface FilterFormProps {
  /** Locale-prefixed path used as the GET form action, e.g. /es/c/ropa. */
  action: string;
  /** Locale-less path for next-intl links, e.g. /c/ropa. */
  basePath: string;
  filters: ListingFilters;
  facets: Facets;
  /** Keeps ids unique when the form renders in both the sidebar and the mobile drawer. */
  idPrefix: string;
}

const legendClass = "mb-3 font-display text-sm font-semibold";
const chipClass = cn(
  "inline-flex h-9 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line px-3 text-sm transition-colors",
  "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
  "hover:border-primary-fg",
);
const inputClass = cn(
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted",
  focusRing,
);

/**
 * Plain GET form: filters work without JavaScript and every state is a shareable URL.
 * Submitting resets pagination because no `page` field is sent.
 */
export async function FilterForm({ action, basePath, filters, facets, idPrefix }: FilterFormProps) {
  const t = await getTranslations("Filters");
  const tc = await getTranslations("Colors");
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <CleanGetForm action={action} className="flex flex-col gap-8">
      {filters.sort !== "featured" ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}

      <fieldset>
        <legend className={legendClass}>{t("price")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={id("min")} className="text-xs text-muted">
              {t("min")}
            </label>
            <input
              id={id("min")}
              name="min"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={filters.minPrice}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={id("max")} className="text-xs text-muted">
              {t("max")}
            </label>
            <input
              id={id("max")}
              name="max"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={filters.maxPrice}
              placeholder="5.000.000"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {facets.brands.length > 0 ? (
        <fieldset>
          <legend className={legendClass}>{t("brand")}</legend>
          <ul className="flex flex-col gap-2">
            {facets.brands.map((brand) => (
              <li key={brand.slug}>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="brand"
                    value={brand.slug}
                    defaultChecked={filters.brands.includes(brand.slug)}
                    className={cn("size-4 rounded accent-violet", focusRing)}
                  />
                  {brand.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {facets.sizes.length > 0 ? (
        <fieldset>
          <legend className={legendClass}>{t("size")}</legend>
          <ul className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <li key={size}>
                <label>
                  <input
                    type="checkbox"
                    name="size"
                    value={size}
                    defaultChecked={filters.sizes.includes(size)}
                    className="peer sr-only"
                  />
                  <span className={chipClass}>{size}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {facets.colors.length > 0 ? (
        <fieldset>
          <legend className={legendClass}>{t("color")}</legend>
          <ul className="flex flex-wrap gap-2">
            {facets.colors.map((color) => (
              <li key={color}>
                <label>
                  <input
                    type="checkbox"
                    name="color"
                    value={color}
                    defaultChecked={filters.colors.includes(color)}
                    className="peer sr-only"
                  />
                  <span className={cn(chipClass, "gap-2 pl-1.5")}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-5 rounded-full border border-line",
                        COLOR_SWATCH_CLASSES[color],
                      )}
                    />
                    {tc(color)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className={legendClass}>{t("rating")}</legend>
        <ul className="flex flex-col gap-2">
          <li>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="rating"
                value=""
                defaultChecked={filters.minRating === undefined}
                className={cn("size-4 accent-violet", focusRing)}
              />
              {t("anyRating")}
            </label>
          </li>
          {RATING_OPTIONS.map((stars) => (
            <li key={stars}>
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="rating"
                  value={stars}
                  defaultChecked={filters.minRating === stars}
                  className={cn("size-4 accent-violet", focusRing)}
                />
                {t("ratingOption", { stars })}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="flex-1">
          {t("apply")}
        </Button>
        <Link href={basePath} className={buttonClasses({ variant: "outline" })}>
          {t("clear")}
        </Link>
      </div>
    </CleanGetForm>
  );
}
