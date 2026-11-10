import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * requireAdmin() and getAdminActor() decide from the database row, not from
 * the JWT claim: a demoted or deactivated admin loses access at once.
 */
const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: null } | null,
  profile: null as { role: string; isActive: boolean } | null,
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "es" }));
vi.mock("@/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: mocks.user ? { claims: { sub: mocks.user.id, email: mocks.user.email } } : null,
      }),
    },
  }),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ profile: { findUnique: async () => mocks.profile } }),
}));

const { requireAdmin } = await import("@/lib/auth");
const { getAdminActor } = await import("@/features/admin/guard");

describe("admin guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "u-1", email: "admin@example.com", name: null };
    mocks.profile = { role: "ADMIN", isActive: true };
  });

  it("lets an active admin through", async () => {
    await expect(requireAdmin("/admin")).resolves.toMatchObject({ id: "u-1" });
    await expect(getAdminActor()).resolves.toMatchObject({ id: "u-1" });
  });

  it("answers 404 to a customer, even if the JWT still said admin", async () => {
    mocks.profile = { role: "CUSTOMER", isActive: true };
    await expect(requireAdmin("/admin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(getAdminActor()).resolves.toBeNull();
  });

  it("locks out a deactivated admin", async () => {
    mocks.profile = { role: "ADMIN", isActive: false };
    await expect(requireAdmin("/admin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(getAdminActor()).resolves.toBeNull();
  });

  it("sends a signed-out visitor to the login", async () => {
    mocks.user = null;
    await expect(requireAdmin("/admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/login?next=%2Fes%2Fadmin",
      locale: "es",
    });
    await expect(getAdminActor()).resolves.toBeNull();
  });
});
