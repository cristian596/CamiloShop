"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorPageProps) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container role="alert" className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-muted">{t("text")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link href="/" className={buttonClasses({ variant: "outline" })}>
          {t("home")}
        </Link>
      </div>
    </Container>
  );
}
