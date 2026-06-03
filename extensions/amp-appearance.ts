import { execFileSync } from "node:child_process";

export type Appearance = "dark" | "light";

export interface AppearanceProbes {
  /** Explicit user setting; wins when set. */
  override: Appearance | null;
  /** macOS system setting, or null when not macOS. */
  mac: () => Appearance | null;
  /** OSC 11 terminal-background result, or null when unavailable. */
  osc: () => Appearance | null;
}

export function detectAppearance(probes: AppearanceProbes): Appearance {
  return probes.override ?? probes.mac() ?? probes.osc() ?? "dark";
}

/** macOS: `defaults read -g AppleInterfaceStyle` prints "Dark" in dark mode and
 * errors (key absent) in light mode. Returns null off macOS. */
export function macAppearanceProbe(): Appearance | null {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 500,
    }).trim();
    return out === "Dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
