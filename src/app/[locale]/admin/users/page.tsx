import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { CleanGetForm } from "@/features/catalog/clean-get-form";
import { Pagination } from "@/features/catalog/pagination";
import { ADMIN_PAGE_SIZE } from "@/features/admin/order-queries";
import { queryHref } from "@/features/admin/query-href";
import { AdminHeader, EmptyState, TableWrap, tdClass, thClass } from "@/features/admin/ui";
import { UserRowActions } from "@/features/admin/user-row-actions";

interface AdminUsersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export async function generateMetadata({ params }: AdminUsersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("users") };
}

export default async function AdminUsersPage({ params, searchParams }: AdminUsersPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale as Locale);
  const admin = await requireAdmin("/admin/users");

  const filters = filtersSchema.parse({
    q: typeof query.q === "string" && query.q.trim() !== "" ? query.q : undefined,
    role: query.role,
    page: query.page ?? 1,
  });
  const where: Prisma.ProfileWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.q
      ? {
          OR: [
            { email: { contains: filters.q, mode: "insensitive" } },
            { fullName: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const db = getDb();
  const [t, format, total, users] = await Promise.all([
    getTranslations("Admin.users"),
    getFormatter(),
    db.profile.count({ where }),
    db.profile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div>
      <AdminHeader title={t("title")} description={t("hint")} />

      <CleanGetForm className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">{t("search")}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={t("searchPlaceholder")}
            className={`${inputClasses} pl-10`}
          />
        </label>
        <label>
          <span className="sr-only">{t("role")}</span>
          <select name="role" defaultValue={filters.role ?? ""} className={inputClasses}>
            <option value="">{t("allRoles")}</option>
            <option value="CUSTOMER">{t("roles.CUSTOMER")}</option>
            <option value="ADMIN">{t("roles.ADMIN")}</option>
          </select>
        </label>
        <button type="submit" className={buttonClasses({ variant: "outline" })}>
          {t("filter")}
        </button>
      </CleanGetForm>

      {users.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                {t("user")}
              </th>
              <th scope="col" className={thClass}>
                {t("since")}
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                {t("orders")}
              </th>
              <th scope="col" className={thClass}>
                {t("state")}
              </th>
              <th scope="col" className={thClass}>
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={tdClass}>
                  <span className="block font-medium">{user.fullName ?? "—"}</span>
                  <span className="block text-xs break-all text-muted">{user.email}</span>
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                </td>
                <td className={`${tdClass} text-right`}>{user._count.orders}</td>
                <td className={tdClass}>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={user.role === "ADMIN" ? "violet" : "cyan"}>
                      {t(`roles.${user.role}`)}
                    </Badge>
                    {user.isActive ? null : <Badge tone="pink">{t("inactive")}</Badge>}
                  </span>
                </td>
                <td className={tdClass}>
                  <UserRowActions
                    userId={user.id}
                    role={user.role}
                    isActive={user.isActive}
                    isSelf={user.id === admin.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Pagination
        currentPage={filters.page}
        pageCount={pageCount}
        hrefForPage={(page) =>
          queryHref("/admin/users", { q: filters.q, role: filters.role, page })
        }
      />
    </div>
  );
}
