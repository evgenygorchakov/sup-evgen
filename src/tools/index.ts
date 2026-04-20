import type { Tool, ToolCall, ToolDefinition } from "../types.ts";
import { emit } from "../hooks.ts";
import { runShell } from "./run-shell.ts";

const registry: Tool[] = [runShell];

export const tools: ToolDefinition[] = registry.map((t) => t.def);

const byName: Record<string, Tool> = Object.fromEntries(
  registry.map((t) => [t.def.function.name, t]),
);

export async function dispatch(call: ToolCall): Promise<string> {
  const tool = byName[call.function.name];
  if (!tool) return `Unknown tool: ${call.function.name}`;

  await emit("preToolUse", { name: call.function.name, input: call.function.arguments });
  const result = await tool
    .handler(call.function.arguments)
    .catch((e: Error) => `ERROR: ${e.message}`);
  await emit("postToolUse", { name: call.function.name, output: result });
  return result;
}
