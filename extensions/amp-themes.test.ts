import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const requiredColorTokens = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "selectedBg",
  "userMessageBg",
  "userMessageText",
  "customMessageBg",
  "customMessageText",
  "customMessageLabel",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "bashMode",
];

type ThemeFile = {
  name: string;
  vars?: Record<string, string | number>;
  colors: Record<string, string | number>;
};

function readTheme(fileName: string): ThemeFile {
  return JSON.parse(readFileSync(join(process.cwd(), "themes", fileName), "utf8")) as ThemeFile;
}

test("amp-themes uses the current Pi package namespace", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    peerDependenciesMeta: Record<string, unknown>;
  };

  expect(packageJson.peerDependencies).toHaveProperty("@earendil-works/pi-coding-agent");
  expect(packageJson.peerDependencies).toHaveProperty("@earendil-works/pi-tui");
  expect(packageJson.devDependencies).toHaveProperty("@earendil-works/pi-coding-agent");
  expect(packageJson.devDependencies).toHaveProperty("@earendil-works/pi-tui");
  expect(packageJson.peerDependenciesMeta).toHaveProperty("@earendil-works/pi-coding-agent");
  expect(packageJson.peerDependenciesMeta).toHaveProperty("@earendil-works/pi-tui");

  const serializedPackageJson = JSON.stringify(packageJson);
  expect(serializedPackageJson).not.toContain("@mariozechner/pi-coding-agent");
  expect(serializedPackageJson).not.toContain("@mariozechner/pi-tui");
});

test("amp-themes no longer bundles pi-tool-display and ships its own tool display", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    bundledDependencies?: string[];
    bundleDependencies?: string[];
    pi?: { extensions?: string[] };
  };

  // Tool rendering is now self-authored, so pi-tool-display must not be a
  // dependency, a bundled dependency, or a registered extension anywhere.
  expect(packageJson.dependencies ?? {}).not.toHaveProperty("pi-tool-display");
  expect(packageJson.bundledDependencies ?? []).not.toContain("pi-tool-display");
  expect(packageJson.bundleDependencies ?? []).not.toContain("pi-tool-display");

  const extensions = packageJson.pi?.extensions ?? [];
  expect(extensions).not.toContain("pi-tool-display");
  for (const extension of extensions) {
    expect(extension).not.toContain("pi-tool-display");
  }

  // Our own tool-display extension is registered instead.
  expect(extensions).toContain("./extensions/amp-tool-display.ts");
});

test("extension source imports Pi packages from the current namespace", () => {
  const extensionFiles = readdirSync(join(process.cwd(), "extensions"))
    .filter((fileName) => fileName.endsWith(".ts"))
    .filter((fileName) => !fileName.endsWith(".test.ts"));

  for (const fileName of extensionFiles) {
    const source = readFileSync(join(process.cwd(), "extensions", fileName), "utf8");

    expect(source, fileName).not.toContain("@mariozechner/pi-coding-agent");
    expect(source, fileName).not.toContain("@mariozechner/pi-tui");
  }
});

test.each([
  ["amp-dark.json", "amp-dark"],
  ["amp-light.json", "amp-light"],
])("%s defines every required Pi color token", (fileName, expectedName) => {
  const theme = readTheme(fileName);

  expect(theme.name).toBe(expectedName);
  expect(Object.keys(theme.colors).sort()).toEqual([...requiredColorTokens].sort());

  for (const [token, value] of Object.entries(theme.colors)) {
    expect(value, `${fileName}:${token}`).not.toBe("");
  }
});
