import { expect, test } from "vitest";
import { formatStatusTopRight } from "./amp-editor.js";

test("shows cost and thinking when cost is present", () => {
  expect(formatStatusTopRight({ cost: 0.005, thinking: "high", fg: (_c, t) => t }))
    .toBe("$0.005 · ↯high");
});

test("always shows cost, even at zero", () => {
  expect(formatStatusTopRight({ cost: 0, thinking: "off", fg: (_c, t) => t }))
    .toBe("$0.000 · ↯off");
});
