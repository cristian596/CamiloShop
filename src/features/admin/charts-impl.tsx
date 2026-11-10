"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/money";
import type { DashboardData } from "./dashboard";

const AXIS = { stroke: "var(--color-muted)", fontSize: 12, tickLine: false, axisLine: false };
const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  color: "var(--color-fg)",
  fontSize: 13,
};

function shortDay(day: string, locale: string) {
  // Noon UTC keeps the calendar day stable in any viewer time zone.
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function compactCop(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function SalesChart({ daily }: { daily: DashboardData["daily"] }) {
  const locale = useLocale() as "es" | "en";
  const t = useTranslations("Admin.dashboard");
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-violet)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-violet)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="day"
          {...AXIS}
          tickFormatter={(day: string) => shortDay(day, locale)}
          minTickGap={24}
        />
        <YAxis {...AXIS} width={48} tickFormatter={(value: number) => compactCop(value, locale)} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(day) => shortDay(String(day), locale)}
          formatter={(value, name) =>
            name === "revenue"
              ? [formatPrice(Number(value), { locale }), t("revenue")]
              : [String(value), t("orders")]
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-violet)"
          strokeWidth={2}
          fill="url(#sales-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ byStatus }: { byStatus: DashboardData["byStatus"] }) {
  const t = useTranslations("Orders.status");
  const data = byStatus.map((row) => ({ ...row, label: t(row.status) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={32} allowDecimals={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--color-surface-raised)" }}
          formatter={(value) => [String(value), ""]}
          separator=""
        />
        <Bar dataKey="count" fill="var(--color-cyan)" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
