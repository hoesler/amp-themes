import assert from "node:assert/strict";
import test from "node:test";

import { UserMessageComponent, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";

import ampEditorExtension from "./amp-editor.js";
import ampUserMessageExtension from "./amp-user-message.js";

type EventHandler = (event: unknown, ctx: ExtensionContext) => unknown;

type ThemeStub = {
  borderColor(text: string): string;
  fg(color: string, text: string): string;
  italic?(text: string): string;
};

function createPiStub(getThinkingLevel: () => string) {
  const handlers = new Map<string, EventHandler>();
  const pi = {
    on(event: string, handler: EventHandler) {
      handlers.set(event, handler);
    },
    getThinkingLevel,
  } as unknown as ExtensionAPI;

  return { pi, handlers };
}

function createThemeStub(): ThemeStub {
  return {
    borderColor(text: string) {
      return text;
    },
    fg(_color: string, text: string) {
      return text;
    },
    italic(text: string) {
      return text;
    },
  };
}

function createSessionManager(thinkingLevel = "medium") {
  const entries = [
    {
      type: "thinking_level_change",
      id: "thinking-1",
      parentId: null,
      timestamp: new Date().toISOString(),
      thinkingLevel,
    },
  ];

  return {
    getEntries() {
      return entries;
    },
    getLeafId() {
      return "thinking-1";
    },
    getSessionName() {
      return undefined;
    },
  };
}

function resetUserMessagePatch(): void {
  const prototype = UserMessageComponent.prototype as unknown as {
    render: UserMessageComponent["render"];
    __ampUserMessageOriginalRender?: UserMessageComponent["render"];
    __ampUserMessagePatched?: boolean;
  };

  if (prototype.__ampUserMessageOriginalRender) {
    prototype.render = prototype.__ampUserMessageOriginalRender;
  }

  delete prototype.__ampUserMessageOriginalRender;
  delete prototype.__ampUserMessagePatched;
}

test("amp user message render stays safe after pi runtime becomes stale", () => {
  resetUserMessagePatch();

  let stale = false;
  const { pi, handlers } = createPiStub(() => {
    if (stale) throw new Error("stale runtime");
    return "medium";
  });

  ampUserMessageExtension(pi);

  const sessionStart = handlers.get("session_start");
  assert.ok(sessionStart, "session_start handler should be registered");

  sessionStart(
    { type: "session_start", reason: "startup" },
    {
      hasUI: true,
      sessionManager: createSessionManager(),
      ui: { theme: createThemeStub() },
    } as unknown as ExtensionContext,
  );

  const message = new UserMessageComponent("hello from amp");
  assert.doesNotThrow(() => message.render(48));

  stale = true;
  assert.doesNotThrow(() => message.render(48));

  resetUserMessagePatch();
});

test("amp editor render stays safe after pi runtime becomes stale", () => {
  let stale = false;
  const { pi, handlers } = createPiStub(() => {
    if (stale) throw new Error("stale runtime");
    return "medium";
  });

  ampEditorExtension(pi);

  let editorFactory:
    | ((tui: unknown, theme: ThemeStub, keybindings: { matches(): boolean }) => { render(width: number): string[] })
    | undefined;

  const theme = createThemeStub();
  const sessionStart = handlers.get("session_start");
  assert.ok(sessionStart, "session_start handler should be registered");

  sessionStart(
    { type: "session_start", reason: "startup" },
    {
      hasUI: true,
      cwd: process.cwd(),
      model: {
        id: "claude-sonnet-4-20250514",
        contextWindow: 200000,
        reasoning: true,
      },
      modelRegistry: { isUsingOAuth: () => false },
      sessionManager: createSessionManager(),
      getContextUsage: () => ({ percent: 12, contextWindow: 200000 }),
      ui: {
        theme,
        setEditorComponent(factory: typeof editorFactory) {
          editorFactory = factory;
        },
        setWorkingIndicator() {},
        setWorkingMessage() {},
        setFooter() {},
      },
    } as unknown as ExtensionContext,
  );

  assert.ok(editorFactory, "editor factory should be registered");

  const editor = editorFactory(
    { requestRender() {}, terminal: { rows: 24 } },
    theme,
    { matches: () => false },
  );

  assert.doesNotThrow(() => editor.render(80));

  stale = true;
  assert.doesNotThrow(() => editor.render(80));
});
