/**
 * amp-tool-display — self-authored, Amp-style rendering for Pi's built-in tools.
 *
 * Strategy (see docs/superpowers/p2-implementation-brief.md):
 * we build each tool's real `ToolDefinition` via `create<Tool>ToolDefinition(cwd)`,
 * spread it, and override ONLY its `renderCall`/`renderResult` hooks. Execution,
 * schema, and metadata are inherited unchanged, so there are no `any` casts and
 * no re-implementation of tool behaviour. The last `registerTool({name})` wins,
 * so registering here replaces Pi's default rendering for these tools.
 */
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { getConfig } from "./amp-tool-config.js";
import {
  renderFindCall,
  renderFindResult,
  renderGrepCall,
  renderGrepResult,
  renderLsCall,
  renderLsResult,
  renderReadCall,
  renderReadResult,
} from "./amp-tools-readonly.js";
import { renderBashCall, renderBashResult } from "./amp-tools-bash.js";
import {
  renderEditCall,
  renderEditResult,
  renderWriteCall,
  renderWriteResult,
} from "./amp-tools-edit.js";
import { registerMcpTools } from "./amp-tools-mcp.js";

/**
 * `TSchema` lives in the `typebox` package, which is a transitive dependency of
 * pi-coding-agent and is NOT resolvable from this extension. Recover the exact
 * same type from the public `ToolDefinition` surface instead: `parameters: TParams`
 * defaults to `TSchema`, so `ToolDefinition["parameters"]` IS `TSchema`.
 */
type ToolParamsSchema = ToolDefinition["parameters"];

/**
 * Register a tool definition with custom render hooks, inheriting everything
 * else (schema, execute, metadata) from `def`. The three type params are
 * inferred directly from `def`, so the concrete schema is reconstructed exactly
 * and the renderer params are checked against that tool's real argument/detail
 * types — zero casts, zero `any`. (Inferring a single `D extends ToolDefinition`
 * does NOT work: it widens to the bare default whose `renderCall` consumes
 * `unknown` args, which a concrete renderer cannot satisfy contravariantly.)
 */
function override<TParams extends ToolParamsSchema, TDetails, TState>(
  pi: ExtensionAPI,
  def: ToolDefinition<TParams, TDetails, TState>,
  renderers: {
    renderCall?: ToolDefinition<TParams, TDetails, TState>["renderCall"];
    renderResult?: ToolDefinition<TParams, TDetails, TState>["renderResult"];
  },
): void {
  pi.registerTool({
    ...def,
    renderCall: renderers.renderCall ?? def.renderCall,
    renderResult: renderers.renderResult ?? def.renderResult,
  });
}

export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();

  override(pi, createReadToolDefinition(cwd), {
    renderCall: renderReadCall,
    renderResult: renderReadResult,
  });

  override(pi, createGrepToolDefinition(cwd), {
    renderCall: renderGrepCall,
    renderResult: renderGrepResult,
  });

  override(pi, createFindToolDefinition(cwd), {
    renderCall: renderFindCall,
    renderResult: renderFindResult,
  });

  override(pi, createLsToolDefinition(cwd), {
    renderCall: renderLsCall,
    renderResult: renderLsResult,
  });

  override(pi, createBashToolDefinition(cwd), {
    renderCall: renderBashCall,
    renderResult: renderBashResult,
  });

  // edit keeps its inherited `renderShell: "self"` (brief R3): the override
  // helper only sets renderCall/renderResult, so the diff-centric framing the
  // built-in edit tool ships with is preserved.
  override(pi, createEditToolDefinition(cwd), {
    renderCall: renderEditCall,
    renderResult: renderEditResult,
  });

  override(pi, createWriteToolDefinition(cwd), {
    renderCall: renderWriteCall,
    renderResult: renderWriteResult,
  });

  // MCP tools are discovered at runtime (not via a static factory) and cannot
  // be safely re-rendered — re-registering them would clobber their execute
  // (see amp-tools-mcp.ts). We run idempotent discovery on both lifecycle
  // events so the survey stays current; MCP keeps Pi's default renderer.
  registerMcpTools(pi, getConfig);
  pi.on("session_start", () => {
    registerMcpTools(pi, getConfig);
  });
  pi.on("before_agent_start", () => {
    registerMcpTools(pi, getConfig);
  });
}
