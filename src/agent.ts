import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type {
  ConfirmResult,
  Message,
  Tool,
  ToolCall,
  ToolDefinition
} from "./types.ts";

import { chat } from "./client/ollama.ts";
import { runShell } from "./tools/run-shell.ts";
import { bold, cyan, gray, red, yellow } from "./utils/colors.ts";
import { getEnvValue } from "./utils/env.ts";

const MAX_ITERATIONS = 20;
const LANGUAGE = getEnvValue("LANGUAGE");

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

async function explainCalls(messages: Message[]): Promise<string> {
  const ask: Message = {
    role: "user",
    content: `Before executing, briefly explain in ${LANGUAGE} what each tool call you just proposed will do. Quote each call and add one short sentence below it. Do not call tools.`,
  };

  try {
    const explanation = await chat([...messages, ask]);
    return explanation.content.trim();
  } catch {
    return "";
  }
}

async function confirmBatch(calls: ToolCall[], intent: string): Promise<ConfirmResult> {
  const trimmed = intent.trim();
  if (trimmed) {
    console.log(`\n${yellow(trimmed)}`);
  }

  console.log(bold("\nModel wants to run:"));
  for (const call of calls) {
    console.log(`  ${cyan(call.function.name)}(${JSON.stringify(call.function.arguments)})`);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const answer = (await rl.question("\n[y / n / type feedback] ")).trim();
    const lowered = answer.toLowerCase();

    if (lowered === "y") return { kind: "approve" };
    if (!answer || lowered === "n" || lowered === "no") return { kind: "quit" };

    return { kind: "replan", feedback: answer };
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

    let explanation = await explainCalls(messages);

    const intent = explanation || reply.content;
    const decision = await confirmBatch(reply.tool_calls, intent);

    if (decision.kind === "quit") {
      console.error(red("Cancelled by user."));
      return;
    }

    if (decision.kind === "replan") {
      for (const _ of reply.tool_calls) {
        messages.push({ role: "tool", content: "Rejected by user. Do not run this command." });
      }
      messages.push({ role: "user", content: decision.feedback });
      continue;
    }

    for (const call of reply.tool_calls) {
      const result = await dispatch(call);
      messages.push({ role: "tool", content: result });
    }
  }

  console.error(red(`Reached MAX_ITERATIONS (${MAX_ITERATIONS}) without final answer.`));
}
