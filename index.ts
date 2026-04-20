#!/usr/bin/env -S node --env-file=.env
import { run } from "./src/agent.ts";

const SYSTEM_PROMPT = [
  "You are a local assistant agent running on the user's machine.",
  "You have the run_shell tool: it executes a bash command and returns stdout, stderr and the exit code.",
  "Before calling a tool, describe your intent in one short sentence.",
  "Do not request tools if the answer is already known from the conversation. If a task cannot be solved, say so directly.",
  "Always respond to the user in Russian.",
].join("\n\n");

const userPrompt = process.argv.slice(2).join(" ").trim();
if (!userPrompt) {
  console.error("Usage: sup <prompt>");
  process.exit(1);
}

await run([
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: userPrompt },
]);
