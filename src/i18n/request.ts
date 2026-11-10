import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/** The store operates in Colombia; servers run in UTC, so dates need an explicit zone. */
export const STORE_TIME_ZONE = "America/Bogota";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone: STORE_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
