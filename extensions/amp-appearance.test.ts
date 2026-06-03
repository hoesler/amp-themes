import { describe, expect, test, afterEach } from "vitest";
import { detectAppearance, type AppearanceProbes, appearanceFromOscReply, readOverride, syncTheme } from "./amp-appearance.js";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

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

function fakeCtx(opts: {
  hasUI?: boolean;
  themeName?: string;
  setThemeResult?: { success: boolean; error?: string };
}) {
  const calls = { setTheme: [] as string[], notify: [] as Array<[string, string | undefined]> };
  const ctx = {
    hasUI: opts.hasUI ?? true,
    ui: {
      theme: { name: opts.themeName },
      setTheme: (name: string) => { calls.setTheme.push(name); return opts.setThemeResult ?? { success: true }; },
      notify: (msg: string, type?: string) => { calls.notify.push([msg, type]); },
    },
  } as unknown as ExtensionContext;
  return { ctx, calls };
}

describe("syncTheme", () => {
  const originalEnv = process.env.AMP_APPEARANCE;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AMP_APPEARANCE;
    else process.env.AMP_APPEARANCE = originalEnv;
  });

  test("skips entirely when !ctx.hasUI", () => {
    process.env.AMP_APPEARANCE = "dark";
    const { ctx, calls } = fakeCtx({ hasUI: false, themeName: "amp-dark" });
    syncTheme(ctx);
    expect(calls.setTheme).toHaveLength(0);
    expect(calls.notify).toHaveLength(0);
  });

  test("skips when a non-amp theme is active", () => {
    process.env.AMP_APPEARANCE = "dark";
    const { ctx, calls } = fakeCtx({ hasUI: true, themeName: "some-other-theme" });
    syncTheme(ctx);
    expect(calls.setTheme).toHaveLength(0);
  });

  test("switches when target differs from active", () => {
    process.env.AMP_APPEARANCE = "light";
    const { ctx, calls } = fakeCtx({ hasUI: true, themeName: "amp-dark" });
    syncTheme(ctx);
    expect(calls.setTheme).toHaveLength(1);
    expect(calls.setTheme[0]).toBe("amp-light");
  });

  test("no-op when already on the correct theme", () => {
    process.env.AMP_APPEARANCE = "dark";
    const { ctx, calls } = fakeCtx({ hasUI: true, themeName: "amp-dark" });
    syncTheme(ctx);
    expect(calls.setTheme).toHaveLength(0);
  });

  test("notifies with warning type when setTheme fails", () => {
    process.env.AMP_APPEARANCE = "light";
    const { ctx, calls } = fakeCtx({
      hasUI: true,
      themeName: "amp-dark",
      setThemeResult: { success: false, error: "nope" },
    });
    syncTheme(ctx);
    expect(calls.setTheme).toHaveLength(1);
    expect(calls.notify).toHaveLength(1);
    expect(calls.notify[0]![1]).toBe("warning");
    expect(calls.notify[0]![0]).toContain("nope");
  });
});
