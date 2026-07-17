import { expect, test } from "vitest";
import { formatStatusTopRight } from "./amp-editor.js";

test("groups model and thinking together", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", fg: (_c, t) => t }))
    .toBe("sonnet-4 · high");
});

test("omits the model when none is set", () => {
  expect(formatStatusTopRight({ model: "", thinking: "off", fg: (_c, t) => t }))
    .toBe("off");
});

test("appends a rounded context-usage percent after the thinking level", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", contextPercent: 45.6, fg: (_c, t) => t }))
    .toBe("sonnet-4 · high · 46%");
});

test("shows the percent even when no model is set", () => {
  expect(formatStatusTopRight({ model: "", thinking: "off", contextPercent: 12, fg: (_c, t) => t }))
    .toBe("off · 12%");
});

test("hides the percent when usage is unknown (null/undefined)", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", contextPercent: null, fg: (_c, t) => t }))
    .toBe("sonnet-4 · high");
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", fg: (_c, t) => t }))
    .toBe("sonnet-4 · high");
});

test("prepends a third-party status label before the model", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", statusLabel: "mode:high", fg: (_c, t) => t }))
    .toBe("mode:high · sonnet-4 · high");
});

test("ignores an empty status label", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", thinking: "high", statusLabel: "", fg: (_c, t) => t }))
    .toBe("sonnet-4 · high");
});
