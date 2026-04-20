import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Message, ToolCall } from "./types.ts";
import { chat } from "./ollama.ts";
import { tools, dispatch } from "./tools/index.ts";
import { MAX_ITERATIONS } from "./config.ts";
import { bold, cyan, red } from "./utils/colors.ts";

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
