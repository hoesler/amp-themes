import { describe, expect, test, afterEach } from "vitest";
import { detectAppearance, type AppearanceProbes, appearanceFromOscReply, readOverride } from "./amp-appearance.js";

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

describe("appearanceFromOscReply", () => {
  test("parses a dark background reply", () => {
    // OSC 11 reply form: ESC ] 11 ; rgb:RRRR/GGGG/BBBB ESC \
    expect(appearanceFromOscReply("\x1b]11;rgb:0000/0000/0000\x1b\\")).toBe("dark");
  });
  test("parses a light background reply", () => {
    expect(appearanceFromOscReply("\x1b]11;rgb:ffff/ffff/ffff\x1b\\")).toBe("light");
  });
  test("returns null on unparseable input", () => {
    expect(appearanceFromOscReply("garbage")).toBeNull();
  });
});

describe("readOverride (AMP_APPEARANCE env var)", () => {
  const original = process.env.AMP_APPEARANCE;
  afterEach(() => {
    if (original === undefined) delete process.env.AMP_APPEARANCE;
    else process.env.AMP_APPEARANCE = original;
  });

  test("reads dark/light case-insensitively", () => {
    process.env.AMP_APPEARANCE = "LIGHT";
    expect(readOverride()).toBe("light");
    process.env.AMP_APPEARANCE = "dark";
    expect(readOverride()).toBe("dark");
  });

  test("returns null when unset or invalid", () => {
    delete process.env.AMP_APPEARANCE;
    expect(readOverride()).toBeNull();
    process.env.AMP_APPEARANCE = "purple";
    expect(readOverride()).toBeNull();
  });
});
