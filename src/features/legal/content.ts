import type { LegalPage } from "@/config/legal";
import type { Locale } from "@/i18n/routing";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
}

/**
 * Legal templates for a fictitious Colombian store. They are placeholders for a
 * portfolio project: every page shows a notice that a lawyer must review them.
 * Section ids are shared across locales so anchors work in both languages.
 */
const CONTACT_ES = "privacidad@camiloshop.example";
const CONTACT_EN = CONTACT_ES;

export const LEGAL_CONTENT: Record<LegalPage, Record<Locale, LegalSection[]>> = {
  terms: {
    es: [
      {
        id: "scope",
        title: "1. Objeto y aceptación",
        paragraphs: [
          "Estos términos regulan el uso del sitio CamiloShop y las compras que se realicen en él. Al crear una cuenta o realizar un pedido declaras que los leíste y los aceptas.",
          "CamiloShop es un proyecto de demostración: los productos y marcas son ficticios, los pagos se procesan en modo de pruebas (sandbox) y no se entregan productos reales.",
        ],
      },
      {
        id: "account",
        title: "2. Cuenta de usuario",
        paragraphs: [
          "Para comprar necesitas una cuenta. Eres responsable de la veracidad de los datos que registres y de mantener la confidencialidad de tu contraseña.",
          "Podemos suspender cuentas que se usen de forma fraudulenta o contraria a estos términos.",
        ],
      },
      {
        id: "prices",
        title: "3. Precios, impuestos y pagos",
        paragraphs: [
          "Los precios se expresan en pesos colombianos (COP) e incluyen el IVA del 19 %. Los valores en dólares (USD) son aproximados y solo informativos; el cobro siempre se realiza en COP.",
          "Los pagos con tarjeta y PSE se procesan a través de la pasarela Wompi. CamiloShop no almacena datos de tarjetas.",
          "El comprobante de compra que emite el sitio no es una factura electrónica de venta ante la DIAN.",
        ],
      },
      {
        id: "orders",
        title: "4. Pedidos, disponibilidad y envíos",
        paragraphs: [
          "Un pedido queda confirmado cuando el pago es aprobado o, en pagos contra entrega, cuando lo confirmamos. Los pedidos pendientes de pago vencen automáticamente y el inventario reservado se libera.",
          "El costo de envío depende de la ciudad de destino y es gratuito en compras desde $200.000 después de descuentos.",
        ],
      },
      {
        id: "coupons",
        title: "5. Cupones",
        paragraphs: [
          "Los cupones tienen las condiciones de vigencia, monto mínimo y número de usos que se indiquen en cada caso, no son acumulables y no se pueden cambiar por dinero.",
        ],
      },
      {
        id: "liability",
        title: "6. Responsabilidad y ley aplicable",
        paragraphs: [
          "Estos términos se rigen por las leyes de la República de Colombia, en particular el Estatuto del Consumidor (Ley 1480 de 2011). Los derechos de garantía, retracto y reversión del pago se describen en la política de devoluciones.",
        ],
      },
    ],
    en: [
      {
        id: "scope",
        title: "1. Purpose and acceptance",
        paragraphs: [
          "These terms govern the use of the CamiloShop site and the purchases made on it. By creating an account or placing an order you confirm that you have read and accept them.",
          "CamiloShop is a demo project: products and brands are fictitious, payments run in test (sandbox) mode and no real products are delivered.",
        ],
      },
      {
        id: "account",
        title: "2. User account",
        paragraphs: [
          "You need an account to buy. You are responsible for the accuracy of the data you register and for keeping your password confidential.",
          "We may suspend accounts used fraudulently or against these terms.",
        ],
      },
      {
        id: "prices",
        title: "3. Prices, taxes and payments",
        paragraphs: [
          "Prices are in Colombian pesos (COP) and include 19% VAT. US dollar (USD) amounts are approximate and for reference only; charges are always made in COP.",
          "Card and PSE payments are processed by the Wompi payment gateway. CamiloShop does not store card data.",
          "The purchase receipt issued by the site is not an electronic sales invoice before the DIAN (Colombian tax authority).",
        ],
      },
      {
        id: "orders",
        title: "4. Orders, availability and shipping",
        paragraphs: [
          "An order is confirmed when the payment is approved or, for cash on delivery, when we confirm it. Orders pending payment expire automatically and the reserved stock is released.",
          "Shipping cost depends on the destination city and is free on purchases from COP 200,000 after discounts.",
        ],
      },
      {
        id: "coupons",
        title: "5. Coupons",
        paragraphs: [
          "Coupons are subject to the validity period, minimum amount and number of uses stated for each one, cannot be combined and cannot be exchanged for cash.",
        ],
      },
      {
        id: "liability",
        title: "6. Liability and governing law",
        paragraphs: [
          "These terms are governed by the laws of the Republic of Colombia, in particular the Consumer Statute (Law 1480 of 2011). Warranty, withdrawal and payment reversal rights are described in the returns policy.",
        ],
      },
    ],
  },
  privacy: {
    es: [
      {
        id: "controller",
        title: "1. Responsable del tratamiento",
        paragraphs: [
          `CamiloShop (proyecto de demostración) actúa como responsable del tratamiento de los datos personales recolectados en este sitio. Contacto: ${CONTACT_ES}.`,
          "Esta política se adopta en cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).",
        ],
      },
      {
        id: "data",
        title: "2. Datos que recolectamos",
        paragraphs: [
          "Nombre, correo electrónico, celular, direcciones de entrega, historial de pedidos, favoritos, reseñas y preguntas que publiques.",
          "Si ingresas con Google, recibimos tu nombre, correo y foto de perfil según los permisos que autorices. No recolectamos datos sensibles ni datos de tarjetas.",
        ],
      },
      {
        id: "purposes",
        title: "3. Finalidades",
        paragraphs: [
          "Crear y administrar tu cuenta; procesar, entregar y dar soporte a tus pedidos; enviarte correos transaccionales (bienvenida, confirmación y estado de pedidos, recuperación de contraseña); prevenir fraude y abuso; y, solo si lo aceptas en el banner de cookies, medir el uso del sitio con analítica.",
        ],
      },
      {
        id: "rights",
        title: "4. Derechos del titular",
        paragraphs: [
          "Como titular puedes conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser informado sobre su uso; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización o pedir la supresión de los datos cuando no exista un deber legal o contractual de conservarlos; y acceder gratuitamente a ellos.",
        ],
      },
      {
        id: "procedure",
        title: "5. Consultas y reclamos",
        paragraphs: [
          `Escribe a ${CONTACT_ES}. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, prorrogables en los términos de la ley.`,
        ],
      },
      {
        id: "processors",
        title: "6. Encargados y transferencias",
        paragraphs: [
          "Para operar el sitio usamos proveedores que tratan datos por nuestra cuenta: Supabase (base de datos y autenticación), Vercel (alojamiento), Resend (correos), Wompi (pagos) y Google (inicio de sesión y, si lo aceptas, analítica). Algunos almacenan datos fuera de Colombia.",
        ],
      },
      {
        id: "retention",
        title: "7. Vigencia",
        paragraphs: [
          "Conservamos los datos mientras tengas una cuenta activa y durante el tiempo exigido por normas contables y tributarias para los pedidos. Esta política rige desde su publicación.",
        ],
      },
    ],
    en: [
      {
        id: "controller",
        title: "1. Data controller",
        paragraphs: [
          `CamiloShop (a demo project) is the controller of the personal data collected on this site. Contact: ${CONTACT_EN}.`,
          "This policy is adopted under Colombian Statutory Law 1581 of 2012 and Decree 1377 of 2013 (compiled in Decree 1074 of 2015).",
        ],
      },
      {
        id: "data",
        title: "2. Data we collect",
        paragraphs: [
          "Name, email, mobile phone, delivery addresses, order history, favorites, and the reviews and questions you publish.",
          "If you sign in with Google, we receive your name, email and profile picture according to the permissions you grant. We do not collect sensitive data or card data.",
        ],
      },
      {
        id: "purposes",
        title: "3. Purposes",
        paragraphs: [
          "Creating and managing your account; processing, delivering and supporting your orders; sending transactional emails (welcome, order confirmation and status, password recovery); preventing fraud and abuse; and, only if you accept it in the cookie banner, measuring site usage with analytics.",
        ],
      },
      {
        id: "rights",
        title: "4. Your rights",
        paragraphs: [
          "As the data subject you can access, update and correct your data; request proof of your authorization; be informed about its use; file complaints with the Superintendence of Industry and Commerce; revoke the authorization or request deletion when there is no legal or contractual duty to keep the data; and access it free of charge.",
        ],
      },
      {
        id: "procedure",
        title: "5. Inquiries and claims",
        paragraphs: [
          `Write to ${CONTACT_EN}. Inquiries are answered within 10 business days and claims within 15 business days, extendable as the law allows.`,
        ],
      },
      {
        id: "processors",
        title: "6. Processors and transfers",
        paragraphs: [
          "To run the site we use providers that process data on our behalf: Supabase (database and authentication), Vercel (hosting), Resend (email), Wompi (payments) and Google (sign-in and, if you accept it, analytics). Some store data outside Colombia.",
        ],
      },
      {
        id: "retention",
        title: "7. Validity",
        paragraphs: [
          "We keep data while your account is active and for the time required by accounting and tax rules for orders. This policy applies from its publication.",
        ],
      },
    ],
  },
  returns: {
    es: [
      {
        id: "withdrawal",
        title: "1. Derecho de retracto",
        paragraphs: [
          "En compras a distancia puedes retractarte dentro de los 5 días hábiles siguientes a la entrega del producto (artículo 47 de la Ley 1480 de 2011). El producto debe devolverse sin uso, en su empaque y con sus accesorios.",
          "Te devolveremos la totalidad del dinero pagado dentro de los 30 días calendario siguientes a tu solicitud. Los costos de transporte de la devolución corren por tu cuenta.",
          "No aplica a productos de uso personal (como cosméticos abiertos o ropa interior), perecederos o confeccionados a la medida, según las excepciones de la ley.",
        ],
      },
      {
        id: "reversal",
        title: "2. Reversión del pago",
        paragraphs: [
          "Si fuiste objeto de fraude, si la operación no fue solicitada, si el producto no se recibió o si no corresponde a lo pedido o es defectuoso, puedes pedir la reversión del pago dentro de los 5 días hábiles siguientes a que conociste la situación (artículo 51 de la Ley 1480 de 2011).",
        ],
      },
      {
        id: "warranty",
        title: "3. Garantía legal",
        paragraphs: [
          "Todos los productos tienen garantía legal por calidad, idoneidad y seguridad. Salvo que se indique un término mayor, la garantía es de un año para productos nuevos. Podrás pedir la reparación, el cambio o la devolución del dinero según las reglas de la ley.",
        ],
      },
      {
        id: "how",
        title: "4. Cómo solicitarlo",
        paragraphs: [
          `Escribe a ${CONTACT_ES} con el número de pedido y el motivo. Responderemos en máximo 15 días hábiles.`,
          "Como CamiloShop es un proyecto de demostración, no se procesan devoluciones ni reembolsos reales.",
        ],
      },
    ],
    en: [
      {
        id: "withdrawal",
        title: "1. Right of withdrawal",
        paragraphs: [
          "For distance purchases you can withdraw within 5 business days after delivery (article 47 of Colombian Law 1480 of 2011). The product must be returned unused, in its packaging and with its accessories.",
          "We will refund the full amount paid within 30 calendar days of your request. Return shipping costs are on you.",
          "It does not apply to personal-use products (such as opened cosmetics or underwear), perishables or made-to-measure goods, under the exceptions in the law.",
        ],
      },
      {
        id: "reversal",
        title: "2. Payment reversal",
        paragraphs: [
          "If you were a victim of fraud, the transaction was not requested, the product was not received, or it does not match the order or is defective, you can request a payment reversal within 5 business days after learning of it (article 51 of Law 1480 of 2011).",
        ],
      },
      {
        id: "warranty",
        title: "3. Legal warranty",
        paragraphs: [
          "All products carry a legal warranty for quality, suitability and safety. Unless a longer term is stated, the warranty is one year for new products. You may request repair, replacement or a refund under the rules of the law.",
        ],
      },
      {
        id: "how",
        title: "4. How to request it",
        paragraphs: [
          `Write to ${CONTACT_EN} with the order number and the reason. We will reply within 15 business days.`,
          "Since CamiloShop is a demo project, no real returns or refunds are processed.",
        ],
      },
    ],
  },
};
