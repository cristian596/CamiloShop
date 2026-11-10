import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { ORDER_STATUSES, type OrderStatusValue } from "@/features/orders/status";

export const DASHBOARD_DAYS = 30;
const STORE_TIME_ZONE = "America/Bogota";
/** Orders that represent money received (cancelled ones are refunded or never paid). */
const SOLD_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

export interface DailySales {
  /** YYYY-MM-DD in the store's time zone. */
  day: string;
  revenue: number;
  orders: number;
}

export interface DashboardData {
  revenue: number;
  paidOrders: number;
  averageTicket: number;
  codToConfirm: number;
  toShip: number;
  daily: DailySales[];
  byStatus: { status: OrderStatusValue; count: number }[];
  topProducts: { productId: string; nameEs: string; nameEn: string; units: number }[];
  paymentAlerts: { paymentId: string; reference: string; orderNumber: string; amount: number }[];
}

/** YYYY-MM-DD of a date in the store's time zone. */
export function storeDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Every day of the window, oldest first, with zeros where nothing was sold. */
export function fillDays(rows: DailySales[], days: number, now: Date): DailySales[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const day = storeDay(new Date(now.getTime() - (days - 1 - index) * 86_400_000));
    return byDay.get(day) ?? { day, revenue: 0, orders: 0 };
  });
}

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
  const db = getDb();
  const since = new Date(now.getTime() - DASHBOARD_DAYS * 86_400_000);
  const soldInWindow = { status: { in: [...SOLD_STATUSES] }, paidAt: { gte: since } };

  const [totals, daily, byStatus, top, codToConfirm, toShip, alerts] = await Promise.all([
    db.order.aggregate({ where: soldInWindow, _sum: { total: true }, _count: true }),
    // paidAt is stored as UTC without a zone: convert to the store's day.
    db.$queryRaw<{ day: string; revenue: number; orders: number }[]>(Prisma.sql`
      SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${STORE_TIME_ZONE}, 'YYYY-MM-DD') AS day,
             sum(total)::int AS revenue,
             count(*)::int AS orders
      FROM "Order"
      WHERE status IN ('PAID', 'SHIPPED', 'DELIVERED') AND "paidAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`),
    db.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { order: soldInWindow },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.order.count({ where: { status: "PENDING", paymentMethod: "COD" } }),
    db.order.count({ where: { status: "PAID" } }),
    db.payment.findMany({
      where: { status: "APPROVED", reviewedAt: null, order: { status: "CANCELLED" } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        reference: true,
        amountInCents: true,
        order: { select: { number: true } },
      },
    }),
  ]);

  const products = await db.product.findMany({
    where: { id: { in: top.map((row) => row.productId) } },
    select: { id: true, nameEs: true, nameEn: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const revenue = totals._sum.total ?? 0;
  const paidOrders = totals._count;
  const countByStatus = new Map(byStatus.map((row) => [row.status, row._count._all]));

  return {
    revenue,
    paidOrders,
    averageTicket: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    codToConfirm,
    toShip,
    daily: fillDays(daily, DASHBOARD_DAYS, now),
    byStatus: ORDER_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 })),
    topProducts: top.flatMap((row) => {
      const product = productById.get(row.productId);
      return product
        ? [{ productId: row.productId, ...product, units: row._sum.quantity ?? 0 }]
        : [];
    }),
    paymentAlerts: alerts.map((payment) => ({
      paymentId: payment.id,
      reference: payment.reference,
      orderNumber: payment.order.number,
      amount: Number(payment.amountInCents / 100n),
    })),
  };
}
