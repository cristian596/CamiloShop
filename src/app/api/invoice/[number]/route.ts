import { NextResponse, type NextRequest } from "next/server";
import { isColorKey } from "@/config/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrderForViewer, isAdminUser } from "@/features/orders/queries";
import { buildReceiptPdf } from "@/features/orders/receipt";
import en from "../../../../../messages/en.json";
import es from "../../../../../messages/es.json";

export const dynamic = "force-dynamic";

const MESSAGES = { es, en };

/** Receipt PDF for the order owner or an admin. Everyone else gets a 404. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { number } = await params;
  const order = await getOrderForViewer(decodeURIComponent(number), {
    id: user.id,
    isAdmin: await isAdminUser(user.id),
  });
  if (!order) return new NextResponse("Not found", { status: 404 });

  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "es";
  const messages = MESSAGES[locale];
  const customer = await getDb().profile.findUnique({
    where: { id: order.userId },
    select: { fullName: true, email: true },
  });

  const pdf = await buildReceiptPdf(
    {
      ...order,
      customer: { name: customer?.fullName ?? "", email: customer?.email ?? "" },
      address: order.shippingAddress,
      items: order.items.map((item) => ({
        name: item.name[locale],
        variant: [
          item.size,
          item.color && isColorKey(item.color) ? messages.Colors[item.color] : item.color,
        ]
          .filter(Boolean)
          .join(" · "),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    },
    locale,
    {
      status: messages.Orders.status[order.status],
      payment: messages.Orders.method[order.paymentMethod],
    },
  );

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-${order.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
