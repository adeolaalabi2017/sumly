import { describe, expect, test } from "bun:test";
import { getWithLegacy } from "@/lib/storage";

function fakeStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("getWithLegacy", () => {
  test("prefers the current key and leaves the legacy key alone", () => {
    const s = fakeStorage({ sumly_x: "new", utility_toolz_x: "old" });
    expect(getWithLegacy(s, "sumly_x", "utility_toolz_x")).toBe("new");
    expect(s.data.get("utility_toolz_x")).toBe("old");
  });

  test("migrates the legacy value to the current key", () => {
    const s = fakeStorage({ utility_toolz_x: "old" });
    expect(getWithLegacy(s, "sumly_x", "utility_toolz_x")).toBe("old");
    expect(s.data.get("sumly_x")).toBe("old");
    expect(s.data.has("utility_toolz_x")).toBe(false);
  });

  test("returns null when neither key exists", () => {
    expect(getWithLegacy(fakeStorage(), "sumly_x", "utility_toolz_x")).toBeNull();
  });
});
