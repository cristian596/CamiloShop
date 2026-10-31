import type messages from "../../messages/es.json";
import type { routing } from "./routing";

// Type-safe message keys and locales for next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
