#!/usr/bin/env -S node --env-file=.env
import { run } from "./src/agent.ts";
import { buildSystemPrompt } from "./src/system-prompt.ts";

const userPrompt = process.argv.slice(2).join(" ").trim();
if (!userPrompt) {
  console.error("Usage: sup <prompt>");
  process.exit(1);
}

await run([
  { role: "system", content: buildSystemPrompt() },
  { role: "user", content: userPrompt },
]);
