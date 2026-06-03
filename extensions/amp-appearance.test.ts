import { describe, expect, test } from "vitest";
import { detectAppearance, type AppearanceProbes } from "./amp-appearance.js";

function probes(overrides: Partial<AppearanceProbes>): AppearanceProbes {
  return { override: null, mac: () => null, osc: () => null, ...overrides };
}

describe("detectAppearance", () => {
  test("explicit override wins over everything", () => {
    expect(detectAppearance(probes({ override: "light", mac: () => "dark" }))).toBe("light");
  });

  test("falls back to macOS probe when no override", () => {
    expect(detectAppearance(probes({ mac: () => "light" }))).toBe("light");
    expect(detectAppearance(probes({ mac: () => "dark" }))).toBe("dark");
  });

  test("falls back to OSC probe when mac probe cannot answer", () => {
    expect(detectAppearance(probes({ mac: () => null, osc: () => "light" }))).toBe("light");
  });

  test("defaults to dark when nothing can answer", () => {
    expect(detectAppearance(probes({}))).toBe("dark");
  });
});
