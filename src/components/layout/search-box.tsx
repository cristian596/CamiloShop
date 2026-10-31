"use client";

import { ImageOff, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SuggestionItem } from "@/app/api/search/suggest/route";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { SEARCH_MIN_LENGTH, normalizeSearchQuery } from "@/features/catalog/search-query";
import { focusRing } from "@/components/ui/styles";
import { Price } from "./price";

const DEBOUNCE_MS = 250;

/**
 * Header search with product suggestions, following the WAI-ARIA combobox pattern
 * (list autocomplete). Without JavaScript it is a plain GET form to /search.
 */
export function SearchBox({
  className,
  defaultQuery = "",
}: {
  className?: string;
  defaultQuery?: string;
}) {
  const t = useTranslations("Search");
  const th = useTranslations("Header");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = normalizeSearchQuery(query);
  // Derived instead of reset in an effect: a too-short query simply shows nothing.
  const items = normalized ? results : [];
  const loading = normalized ? fetching : false;
  // The last option is "see all results", after the product suggestions.
  const optionCount = normalized ? items.length + 1 : 0;

  useEffect(() => {
    if (!normalized) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setFetching(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { items: SuggestionItem[] };
        setResults(data.items);
        setActiveIndex(-1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized]);

  // Close when focus or a click leaves the component.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function goToSearch() {
    if (!normalized) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  function selectOption(index: number) {
    const item = items[index];
    setOpen(false);
    if (item) router.push(`/p/${item.slug}`);
    else goToSearch();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        if (optionCount > 0) setActiveIndex((index) => (index + 1) % optionCount);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (optionCount > 0) setActiveIndex((index) => (index <= 0 ? optionCount - 1 : index - 1));
        break;
      case "Enter":
        if (open && activeIndex >= 0) {
          event.preventDefault();
          selectOption(activeIndex);
        }
        // Otherwise the form submits normally.
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else {
          setQuery("");
        }
        break;
    }
  }

  const showPopup = open && normalized !== null;
  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        action={`/${locale}/search`}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          goToSearch();
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {th("searchLabel")}
        </label>
        <input
          id={`${id}-input`}
          name="q"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPopup}
          aria-controls={listboxId}
          aria-activedescendant={showPopup && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          minLength={SEARCH_MIN_LENGTH}
          maxLength={80}
          value={query}
          placeholder={th("searchPlaceholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full rounded-full border border-line bg-surface pr-12 pl-4 text-sm text-fg placeholder:text-muted",
            focusRing,
          )}
        />
        <button
          type="submit"
          aria-label={th("searchSubmit")}
          className={cn(
            "absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-primary text-on-primary hover:bg-primary-hover",
            focusRing,
          )}
        >
          {loading ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
        </button>
      </form>

      {/* Announces result counts to screen readers without moving focus. */}
      <p className="sr-only" role="status" aria-live="polite">
        {showPopup && !loading ? t("resultsAvailable", { count: items.length }) : ""}
      </p>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("suggestions")}
        hidden={!showPopup}
        className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-2xl"
      >
        {items.map((item, index) => (
          <li
            key={item.slug}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => selectOption(index)}
            onMouseEnter={() => setActiveIndex(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl p-2",
              index === activeIndex && "bg-surface-raised ring-1 ring-primary-fg/50",
            )}
          >
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raised">
              {item.image ? (
                <Image src={item.image.url} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <ImageOff className="size-5 text-muted" aria-hidden="true" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{item.name[locale]}</span>
              <span className="text-xs text-muted">{item.brand}</span>
            </span>
            <Price amount={item.price} className="text-sm font-semibold" />
          </li>
        ))}
        {!loading && items.length === 0 && normalized ? (
          <li role="presentation" className="px-3 py-2 text-sm text-muted">
            {t("noSuggestions", { query: normalized })}
          </li>
        ) : null}
        {normalized ? (
          <li
            id={optionId(items.length)}
            role="option"
            aria-selected={activeIndex === items.length}
            onPointerDown={(event) => event.preventDefault()}
            onClick={goToSearch}
            onMouseEnter={() => setActiveIndex(items.length)}
            className={cn(
              "mt-1 cursor-pointer rounded-xl border-t border-line px-3 py-2.5 text-sm font-medium text-primary-fg",
              activeIndex === items.length && "bg-surface-raised ring-1 ring-primary-fg/50",
            )}
          >
            {t("seeAll", { query: normalized })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
