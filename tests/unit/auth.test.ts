import { describe, expect, it } from "vitest";
import { LEGAL_PAGES } from "@/config/legal";
import { addressSchema, accountFieldErrors, profileSchema } from "@/features/account/schemas";
import {
  authErrorKey,
  fieldErrorsFrom,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas";
import { LEGAL_CONTENT } from "@/features/legal/content";
import {
  isAdminPath,
  isGuestOnlyPath,
  isProtectedPath,
  safeNextPath,
  splitLocale,
  stripLocale,
} from "@/lib/auth-paths";
import { escapeHtml, welcomeEmail } from "@/lib/email/templates";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/es/account/orders?tab=1")).toBe("/es/account/orders?tab=1");
  });

  it.each([
    ["protocol-relative URL", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["absolute URL", "https://evil.com"],
    ["relative path", "account"],
    ["control characters", "/es\n/account"],
    ["non-string", 42],
    ["empty", ""],
  ])("rejects a %s", (_label, value) => {
    expect(safeNextPath(value, "/fallback")).toBe("/fallback");
  });
});

describe("locale-aware route guards", () => {
  it("splits the locale prefix", () => {
    expect(splitLocale("/en/account/addresses")).toEqual({
      locale: "en",
      path: "/account/addresses",
    });
    expect(splitLocale("/es")).toEqual({ locale: "es", path: "/" });
    expect(splitLocale("/account")).toEqual({ locale: "es", path: "/account" });
    expect(stripLocale("/en/p/x?variant=1")).toBe("/p/x?variant=1");
  });

  it("classifies protected, admin and guest-only paths by segment", () => {
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/account/favorites")).toBe(true);
    expect(isProtectedPath("/checkout")).toBe(true);
    expect(isProtectedPath("/accountant")).toBe(false);
    expect(isProtectedPath("/p/camiseta")).toBe(false);
    expect(isAdminPath("/admin/orders")).toBe(true);
    expect(isAdminPath("/administrador")).toBe(false);
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
  });
});

describe("auth form validation", () => {
  it("normalizes the email and requires a password on login", () => {
    const parsed = loginSchema.safeParse({ email: "  Ana@Example.COM ", password: "x" });
    expect(parsed.success && parsed.data.email).toBe("ana@example.com");
    const empty = loginSchema.safeParse({ email: "nope", password: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(fieldErrorsFrom(empty.error)).toEqual({
        email: "emailInvalid",
        password: "passwordRequired",
      });
    }
  });

  it("requires privacy consent and a password of 8 to 72 characters on sign-up", () => {
    const base = { fullName: "Ana Pérez", email: "ana@example.com", password: "12345678" };
    expect(registerSchema.safeParse({ ...base, acceptPrivacy: "on" }).success).toBe(true);

    const noConsent = registerSchema.safeParse({ ...base, acceptPrivacy: null });
    expect(noConsent.success).toBe(false);
    if (!noConsent.success) {
      expect(fieldErrorsFrom(noConsent.error).acceptPrivacy).toBe("privacyRequired");
    }

    const short = registerSchema.safeParse({ ...base, password: "1234567", acceptPrivacy: "on" });
    const long = registerSchema.safeParse({
      ...base,
      password: "x".repeat(73),
      acceptPrivacy: "on",
    });
    expect(short.success || fieldErrorsFrom(short.error).password).toBe("passwordTooShort");
    expect(long.success || fieldErrorsFrom(long.error).password).toBe("passwordTooLong");
  });

  it("reports mismatched passwords on the confirmation field", () => {
    const parsed = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(parsed.success || fieldErrorsFrom(parsed.error)).toEqual({
      confirmPassword: "passwordMismatch",
    });
  });

  it("maps Supabase error codes to translation keys", () => {
    expect(authErrorKey("invalid_credentials")).toBe("invalidCredentials");
    expect(authErrorKey("email_exists")).toBe("emailTaken");
    expect(authErrorKey("over_request_rate_limit")).toBe("rateLimited");
    expect(authErrorKey(undefined)).toBe("generic");
    expect(authErrorKey("something_new")).toBe("generic");
  });
});

describe("account validation", () => {
  const address = {
    label: "Casa",
    recipient: "Ana Pérez",
    phone: "300 123-4567",
    department: "Antioquia",
    city: "Medellín",
    line1: "Calle 10 # 43-21",
    line2: "",
    notes: "",
  };

  it("accepts a Colombian address and normalizes optional fields", () => {
    const parsed = addressSchema.safeParse(address);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("3001234567");
      expect(parsed.data.line2).toBeNull();
      expect(parsed.data.isDefault).toBe(false);
    }
  });

  it("rejects unknown departments and non-mobile phones", () => {
    const parsed = addressSchema.safeParse({
      ...address,
      department: "Texas",
      phone: "6041234567",
    });
    expect(parsed.success || accountFieldErrors(parsed.error)).toEqual({
      department: "departmentInvalid",
      phone: "phoneInvalid",
    });
  });

  it("allows an empty phone on the profile and falls back to Spanish", () => {
    const parsed = profileSchema.safeParse({ fullName: "Ana", phone: "", locale: "fr" });
    expect(parsed.success && parsed.data).toEqual({ fullName: "Ana", phone: null, locale: "es" });
  });
});

describe("welcome email", () => {
  it("escapes user-provided names", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe(
      "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;",
    );
    const message = welcomeEmail({
      to: "ana@example.com",
      name: "<script>alert(1)</script>",
      locale: "en",
      siteUrl: "https://shop.example",
    });
    expect(message.html).not.toContain("<script>");
    expect(message.subject).toBe("Welcome to CamiloShop");
    expect(message.text).toContain("https://shop.example/en");
  });
});

describe("legal templates", () => {
  it("have the same sections in Spanish and English", () => {
    for (const page of LEGAL_PAGES) {
      const ids = (locale: "es" | "en") => LEGAL_CONTENT[page][locale].map((section) => section.id);
      expect(ids("en")).toEqual(ids("es"));
      expect(ids("es").length).toBeGreaterThan(0);
    }
  });
});
