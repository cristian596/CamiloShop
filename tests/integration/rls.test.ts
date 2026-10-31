import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * Verifies Row Level Security through Supabase's public Data API using only the
 * anon key, i.e. exactly what any visitor could do from the browser.
 * Skipped when Supabase is not configured (e.g. in CI without secrets).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!url || !anonKey)("RLS with the anon key", () => {
  const supabase = createClient(url ?? "", anonKey ?? "", { auth: { persistSession: false } });

  it("can read the active catalog", async () => {
    const { data, error } = await supabase.from("Product").select("slug, isActive").limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.isActive)).toBe(true);
  });

  it.each([
    "Setting",
    "Coupon",
    "ShippingRate",
    "Order",
    "Profile",
    "Address",
    "Payment",
    "WebhookEvent",
  ])("cannot read %s", async (table) => {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    // RLS hides rows instead of failing the query.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot write to the catalog", async () => {
    const { error } = await supabase
      .from("Brand")
      .insert({ id: crypto.randomUUID(), slug: "rls-probe", name: "RLS probe" });
    expect(error?.code).toBe("42501");
  });

  it("cannot change existing products", async () => {
    const { data } = await supabase
      .from("Product")
      .update({ price: 1 })
      .eq("slug", "audifonos-pulse-anc")
      .select("id");
    // No UPDATE policy: zero rows are affected.
    expect(data ?? []).toEqual([]);
  });
});
