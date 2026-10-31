import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");

  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-primary-fg">404</p>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-muted">{t("text")}</p>
      <Link href="/" className={buttonClasses({ className: "mt-4" })}>
        {t("cta")}
      </Link>
    </Container>
  );
}
