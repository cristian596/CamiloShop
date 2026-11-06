import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ProfileForm } from "@/features/account/profile-form";
import { ResetPasswordForm } from "@/features/auth/auth-forms";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("profile") };
}

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/account/profile");

  const [t, profile] = await Promise.all([
    getTranslations("Account"),
    getDb().profile.findUnique({
      where: { id: user.id },
      select: { email: true, fullName: true, phone: true, locale: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("profile")}</h1>
      <section aria-labelledby="profile-title" className={cardClass}>
        <h2 id="profile-title" className="mb-5 font-display text-lg font-semibold">
          {t("profileTitle")}
        </h2>
        <ProfileForm
          email={profile?.email ?? user.email}
          fullName={profile?.fullName ?? user.name ?? ""}
          phone={profile?.phone ?? ""}
          locale={profile?.locale ?? locale}
        />
      </section>
      <section aria-labelledby="password-title" className={cardClass}>
        <h2 id="password-title" className="mb-5 font-display text-lg font-semibold">
          {t("passwordTitle")}
        </h2>
        <ResetPasswordForm successLink={false} />
      </section>
    </div>
  );
}
