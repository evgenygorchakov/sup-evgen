import { spawn } from "node:child_process";
import type { Tool } from "../types.ts";

const TIMEOUT_MS = 30_000;
const OUTPUT_CAP = 20_000;

function cap(s: string): string {
  return s.length > OUTPUT_CAP ? s.slice(0, OUTPUT_CAP) + "\n...[truncated]" : s;
}

export const runShell: Tool = {
  def: {
    type: "function",
    function: {
      name: "run_shell",
      description:
        "Executes a bash command in the user's shell. Returns exit code, stdout, and stderr.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute (passed to `bash -c`).",
          },
        },
        required: ["command"],
      },
    },
  },
  handler: async (args: unknown) => {
    if (
      typeof args !== "object" ||
      args === null ||
      !("command" in args) ||
      typeof (args as { command: unknown }).command !== "string"
    ) {
      return "ERROR: run_shell expects { command: string }";
    }
    const { command } = args as { command: string };
    return await new Promise<string>((resolve) => {
      const child = spawn("bash", ["-c", command], {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => {
        resolve(`exit=${code}\nstdout:\n${cap(out)}\nstderr:\n${cap(err)}`);
      });
      child.on("error", (e) => {
        resolve(`exec_error: ${e.message}`);
      });
    });
  },
};
