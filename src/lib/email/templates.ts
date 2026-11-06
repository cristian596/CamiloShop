import type { Locale } from "@/i18n/routing";
import type { EmailMessage } from "./send";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Shared table-based layout with inline styles (email clients ignore stylesheets). */
function layout({ preheader, body, locale }: { preheader: string; body: string; locale: Locale }) {
  const footer =
    locale === "es"
      ? "CamiloShop es un proyecto de portafolio. No se realizan ventas reales."
      : "CamiloShop is a portfolio project. No real sales are made.";

  return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CamiloShop</title></head>
<body style="margin:0;padding:0;background:#0b0f19;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f8fafc">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2937;border-radius:16px">
<tr><td style="padding:28px 32px 0;font-size:22px;font-weight:700">Camilo<span style="color:#a78bfa">Shop</span></td></tr>
<tr><td style="padding:20px 32px 32px;font-size:15px;line-height:1.6;color:#e5e7eb">${body}</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#9ca3af">${escapeHtml(footer)}</p>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;padding:12px 24px;border-radius:999px;background:#7c3aed;color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>`;
}

export function welcomeEmail({
  to,
  name,
  locale,
  siteUrl,
}: {
  to: string;
  name: string | null;
  locale: Locale;
  siteUrl: string;
}): EmailMessage {
  const shopUrl = `${siteUrl}/${locale}`;
  const copy =
    locale === "es"
      ? {
          subject: "Bienvenido a CamiloShop",
          greeting: name ? `Hola, ${name}:` : "Hola:",
          intro:
            "Tu cuenta quedó lista. Ya puedes guardar favoritos, administrar tus direcciones y seguir tus pedidos.",
          cta: "Ir a la tienda",
        }
      : {
          subject: "Welcome to CamiloShop",
          greeting: name ? `Hi ${name},` : "Hi,",
          intro:
            "Your account is ready. You can now save favorites, manage your addresses and track your orders.",
          cta: "Go to the store",
        };

  const html = layout({
    locale,
    preheader: copy.intro,
    body: `<p style="margin:0 0 12px">${escapeHtml(copy.greeting)}</p><p style="margin:0 0 20px">${escapeHtml(copy.intro)}</p>${button(shopUrl, copy.cta)}`,
  });

  return {
    to,
    subject: copy.subject,
    html,
    text: `${copy.greeting}\n\n${copy.intro}\n\n${copy.cta}: ${shopUrl}`,
  };
}
