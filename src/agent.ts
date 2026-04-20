import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Message, Tool, ToolCall, ToolDefinition } from "./types.ts";
import { chat } from "./client/ollama.ts";
import { runShell } from "./tools/run-shell.ts";
import { bold, cyan, gray, red } from "./utils/colors.ts";

const MAX_ITERATIONS = 20;

const registry: Tool[] = [runShell];
const tools: ToolDefinition[] = registry.map((t) => t.def);
const byName: Record<string, Tool> = Object.fromEntries(
  registry.map((t) => [t.def.function.name, t]),
);

async function dispatch(call: ToolCall): Promise<string> {
  const tool = byName[call.function.name];
  if (!tool) return `Unknown tool: ${call.function.name}`;

  console.error(gray(`→ ${call.function.name}(${JSON.stringify(call.function.arguments)})`));

  return await tool
    .handler(call.function.arguments)
    .catch((e: Error) => `ERROR: ${e.message}`);
}

async function confirmBatch(calls: ToolCall[]): Promise<boolean> {
  console.log(bold("\nModel wants to run:"));
  for (const call of calls) {
    console.log(`  ${cyan(call.function.name)}(${JSON.stringify(call.function.arguments)})`);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question("\n[y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

export async function run(messages: Message[]): Promise<void> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const reply = await chat(messages, tools);
    messages.push(reply);

    if (!reply.tool_calls?.length) {
      console.log(reply.content);
      return;
    }

    if (!(await confirmBatch(reply.tool_calls))) {
      console.error(red("Cancelled by user."));
      return;
    }

    for (const call of reply.tool_calls) {
      const result = await dispatch(call);
      messages.push({ role: "tool", content: result });
    }
  }

  console.error(red(`Reached MAX_ITERATIONS (${MAX_ITERATIONS}) without final answer.`));
}
