import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { OrderStatusValue } from "./status";

const TONES = {
  PENDING: "pink",
  PAID: "violet",
  SHIPPED: "cyan",
  DELIVERED: "cyan",
  CANCELLED: "pink",
} as const;

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  const t = useTranslations("Orders.status");
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
