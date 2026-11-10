import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, Sora } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Providers } from "@/components/layout/providers";
import { getStoreSettings } from "@/features/catalog/queries";
import { CONSENT_COOKIE, parseConsent } from "@/features/consent/consent";
import { ConsentManager } from "@/features/consent/consent-manager";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

// Every page reads live catalog data (prices, stock, USD rate) that the admin can
// change at any time, so pages render per request instead of being cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : "es",
    namespace: "Metadata",
  });

  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t("title"), template: "%s | CamiloShop" },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, settings, cookieStore] = await Promise.all([
    getTranslations("Common"),
    getStoreSettings(),
    cookies(),
  ]);
  // Read on the server so the banner never flashes for visitors who already chose.
  const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);

  return (
    <html
      lang={locale}
      className={cn("dark", inter.variable, sora.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-fg antialiased">
        <NextIntlClientProvider>
          <Providers
            config={{
              usdRate: settings.usdRate,
              freeShippingThreshold: settings.freeShippingThreshold,
            }}
          >
            <a
              href="#main-content"
              className={cn(
                "sr-only z-50 rounded-full bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3",
                focusRing,
              )}
            >
              {t("skipToContent")}
            </a>
            <Header />
            <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <Footer />
            <ConsentManager
              initialDecision={consent}
              measurementId={publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID}
            />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
