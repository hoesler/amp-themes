import { expect, test } from "vitest";
import { formatStatusTopRight } from "./amp-editor.js";

test("shows model, cost, and thinking", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", cost: 0.005, thinking: "high", fg: (_c, t) => t }))
    .toBe("sonnet-4 · $0.005 · high");
});

test("always shows cost, even at zero", () => {
  expect(formatStatusTopRight({ model: "sonnet-4", cost: 0, thinking: "off", fg: (_c, t) => t }))
    .toBe("sonnet-4 · $0.000 · off");
});

test("omits the model when none is set", () => {
  expect(formatStatusTopRight({ model: "", cost: 0.005, thinking: "high", fg: (_c, t) => t }))
    .toBe("$0.005 · high");
});
