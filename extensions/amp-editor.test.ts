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
