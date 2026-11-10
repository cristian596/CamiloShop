import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ORDER_STATUSES } from "@/features/orders/status";

export const ADMIN_PAGE_SIZE = 20;

export const orderFiltersSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  method: z.enum(["CARD", "PSE", "COD"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export async function listAdminOrders(filters: OrderFilters) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { paymentMethod: filters.method } : {}),
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q, mode: "insensitive" } },
            { user: { email: { contains: filters.q, mode: "insensitive" } } },
            { user: { fullName: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const db = getDb();
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
        user: { select: { email: true, fullName: true } },
      },
    }),
  ]);
  return { orders, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

/** Everything the admin order page shows besides the shared order detail. */
export async function getAdminOrderExtras(orderId: string) {
  return getDb().order.findUnique({
    where: { id: orderId },
    select: {
      user: { select: { email: true, fullName: true, phone: true } },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          provider: true,
          reference: true,
          providerTxId: true,
          method: true,
          status: true,
          amountInCents: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          from: true,
          to: true,
          note: true,
          createdAt: true,
          changedBy: { select: { email: true } },
        },
      },
    },
  });
}
