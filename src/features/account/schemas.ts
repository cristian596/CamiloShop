import { z } from "zod";
import { DEPARTMENTS } from "@/config/colombia";

/** Translation keys under "Account.errors". */
export type AccountErrorKey =
  "required" | "tooLong" | "phoneInvalid" | "departmentInvalid" | "notFound" | "limit" | "generic";

const required = (max: number) =>
  z.string().trim().min(1, { error: "required" }).max(max, { error: "tooLong" });

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((value) => (value === "" ? null : value));

/** Colombian mobile numbers: 10 digits starting with 3. Spaces and dashes are ignored. */
export const phoneField = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^3\d{9}$/, { error: "phoneInvalid" }));

export const profileSchema = z.object({
  fullName: required(80),
  phone: z.union([z.literal("").transform(() => null), phoneField]),
  locale: z.enum(["es", "en"]).catch("es"),
});

export const addressSchema = z.object({
  label: required(40),
  recipient: required(80),
  phone: phoneField,
  department: z.enum(DEPARTMENTS, { error: "departmentInvalid" }),
  city: required(60),
  line1: required(120),
  line2: optional(120),
  notes: optional(240),
  isDefault: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export type AddressInput = z.infer<typeof addressSchema>;

const KNOWN = new Set<string>(["required", "tooLong", "phoneInvalid", "departmentInvalid"]);

export function accountFieldErrors(error: z.ZodError): Record<string, AccountErrorKey> {
  const result: Record<string, AccountErrorKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (result[field]) continue;
    result[field] = (KNOWN.has(issue.message) ? issue.message : "required") as AccountErrorKey;
  }
  return result;
}
