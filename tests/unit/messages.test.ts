import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === "object"
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("translations", () => {
  it("Spanish and English define exactly the same keys", () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(es).sort());
  });

  it("has no empty strings", () => {
    const empty = (messages: object) =>
      flattenKeys(messages).filter((key) => {
        const text = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
        return typeof text === "string" && text.trim() === "";
      });
    expect(empty(es)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });
});
